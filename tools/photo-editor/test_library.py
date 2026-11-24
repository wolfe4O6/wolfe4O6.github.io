import base64
from io import BytesIO
import json
from pathlib import Path
import subprocess
import tempfile
import unittest

from PIL import Image, PngImagePlugin
from library import PhotoLibrary, ConflictError, clean_upload, validate_gallery

TEMPLATE = '''---
---
<html><head><style is:global></style></head><body>
<main class={gallery.length ? undefined : "text-only"}>
<div class="photos" hidden={!gallery.length}><div class="photo-group">
<!-- GALLERY_START -->dynamic<!-- GALLERY_END -->
</div></div></main><script is:inline></script></body></html>'''

def jpeg():
    image = Image.new('RGB', (24, 40), '#356244')
    exif = Image.Exif()
    exif[271] = 'Private camera'
    exif[270] = 'Private description'
    exif[36867] = '2026:10:10 15:22:52'
    exif[34853] = {1: 'N', 2: (45, 0, 0), 3: 'W', 4: (110, 0, 0)}
    output = BytesIO()
    image.save(output, 'JPEG', exif=exif)
    payload = b'http://ns.adobe.com/xap/1.0/\0<xmp>private details</xmp>'
    data = output.getvalue()
    return data[:2] + b'\xff\xe1' + (len(payload) + 2).to_bytes(2, 'big') + payload + data[2:]

class LibraryTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.repo = self.root / 'repo'
        (self.repo / 'src/pages').mkdir(parents=True)
        (self.repo / 'src/data').mkdir()
        (self.repo / 'public/images').mkdir(parents=True)
        (self.repo / 'src/pages/index.astro').write_text(TEMPLATE)
        (self.repo / 'src/data/gallery.json').write_text('[]\n')
        self.library = PhotoLibrary(self.repo, self.root / 'preview')

    def tearDown(self):
        self.temporary.cleanup()

    def add_photo(self):
        return self.library.import_photo('Portrait.jpeg', base64.b64encode(jpeg()).decode())

    def test_jpeg_metadata_removed_without_reencoding(self):
        original = jpeg()
        cleaned, extension, size = clean_upload(original, 'portrait.jpeg')
        self.assertEqual(extension, 'jpeg')
        self.assertEqual(size, (24, 40))
        with Image.open(BytesIO(original)) as before, Image.open(BytesIO(cleaned)) as after:
            self.assertTrue(before.getexif().get_ifd(34853))
            self.assertFalse(after.getexif())
            self.assertFalse(after.info.get('xmp'))
            self.assertEqual(before.tobytes(), after.tobytes())

    def test_paletted_png_preserves_colors_and_clears_text(self):
        image = Image.new('P', (4, 6), 1)
        image.putpalette([255, 0, 0, 0, 255, 0] + [0] * 762)
        info = PngImagePlugin.PngInfo()
        info.add_text('Description', 'Private caption')
        output = BytesIO()
        image.save(output, 'PNG', pnginfo=info, transparency=0)
        cleaned, _, _ = clean_upload(output.getvalue(), 'palette.png')
        with Image.open(BytesIO(output.getvalue())) as before, Image.open(BytesIO(cleaned)) as after:
            self.assertEqual(before.convert('RGBA').tobytes(), after.convert('RGBA').tobytes())
            self.assertNotIn('Description', after.info)

    def test_orientation_is_applied_before_exif_is_removed(self):
        image = Image.new('RGB', (40, 24), 'green')
        exif = Image.Exif()
        exif[274] = 6
        output = BytesIO()
        image.save(output, 'JPEG', exif=exif)
        cleaned, _, size = clean_upload(output.getvalue(), 'rotated.jpeg')
        self.assertEqual(size, (24, 40))
        with Image.open(BytesIO(cleaned)) as after:
            self.assertFalse(after.getexif())

    def test_unsaved_import_is_kept_outside_the_public_tree(self):
        photo = self.add_photo()
        public = self.repo / 'public/images' / Path(photo['src']).name
        self.assertFalse(public.exists())
        self.assertTrue((self.repo / '.git/photo-editor-imports' / public.name).exists())
        self.library.save([photo], self.library.state()['revision'])
        self.assertTrue(public.exists())

    def test_save_escapes_captions_and_rejects_stale_revision(self):
        photo = self.add_photo()
        photo.update(caption='<script>example</script>', alt='A portrait', date='2026-05-06')
        before = self.library.state()
        state = self.library.save([photo], before['revision'])
        html = (self.library.preview / 'index.html').read_text()
        self.assertIn('&lt;script&gt;example&lt;/script&gt;', html)
        self.assertIn('May 6, 2026', html)
        with self.assertRaises(ConflictError):
            self.library.save([], before['revision'])
        self.assertEqual(self.library.state()['revision'], state['revision'])

    def test_remove_last_photo_cleans_files_and_renders_empty_gallery(self):
        photo = self.add_photo()
        state = self.library.save([photo], self.library.state()['revision'])
        self.library.save([], state['revision'])
        self.assertEqual(self.library.state()['photos'], [])
        self.assertFalse((self.repo / 'public/images' / Path(photo['src']).name).exists())
        self.assertIn('class="text-only"', (self.library.preview / 'index.html').read_text())

    def test_path_traversal_and_invalid_dates_are_rejected(self):
        photo = self.add_photo()
        for source in ['/images/../secret.jpeg', 'https://example.com/image.jpeg']:
            with self.assertRaises(ValueError):
                validate_gallery(self.repo, [dict(photo, src=source)])
        with self.assertRaises(ValueError):
            validate_gallery(self.repo, [dict(photo, date='20260506')])

    def test_duplicate_photo_ids_are_rejected(self):
        photo = self.add_photo()
        with self.assertRaises(ValueError):
            validate_gallery(self.repo, [photo, photo])

    def test_publish_commits_gallery_changes_to_a_local_remote(self):
        def git(*args):
            subprocess.run(['git', *args], cwd=self.repo, capture_output=True, check=True)
        # The editor lock file is created later, inside the initialized repository.
        git('init', '-b', 'main')
        git('config', 'user.name', 'Photo editor test')
        git('config', 'user.email', 'test@example.invalid')
        git('add', '.')
        git('commit', '-m', 'Initial')
        remote = self.root / 'remote.git'
        subprocess.run(['git', 'init', '--bare', str(remote)], capture_output=True, check=True)
        git('remote', 'add', 'origin', str(remote))
        git('push', '-u', 'origin', 'main')
        photo = self.add_photo()
        state = self.library.save([photo], self.library.state()['revision'])
        self.library.publish()
        self.library.save([], state['revision'])
        result = self.library.publish()
        self.assertEqual(len(result['commit']), 40)
        saved = subprocess.check_output(['git', '--git-dir', str(remote), 'show', 'main:src/data/gallery.json'])
        self.assertEqual(json.loads(saved), [])
        self.library.publish()

if __name__ == '__main__':
    unittest.main()
