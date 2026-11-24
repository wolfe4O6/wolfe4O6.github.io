import base64
from io import BytesIO
import json
from pathlib import Path
import subprocess
import tempfile
import unittest
from html.parser import HTMLParser

from PIL import Image, PngImagePlugin
from library import PhotoLibrary, ConflictError, clean_upload, validate_gallery, capture_date

TEMPLATE = '''---
---
<html><head><style is:global></style></head><body>
<main class={gallery.length ? undefined : "text-only"}>
<div class="photo-field" hidden={!gallery.length}>
<!-- GALLERY_START -->dynamic<!-- GALLERY_END -->
</div><button class="browse" hidden={!gallery.length}>Browse photos</button></main>
<!-- VIEWER_IMAGE_START -->dynamic<!-- VIEWER_IMAGE_END -->
<!-- GALLERY_DATA_START -->dynamic<!-- GALLERY_DATA_END -->
<script is:inline></script></body></html>'''

class GalleryHTML(HTMLParser):
    def __init__(self, source):
        super().__init__()
        self.buttons = []
        self.in_data = False
        self.data = ''
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'button':
            self.buttons.append(attrs)
        if tag == 'script' and attrs.get('id') == 'gallery-data':
            self.in_data = True

    def handle_endtag(self, tag):
        if tag == 'script':
            self.in_data = False

    def handle_data(self, data):
        if self.in_data:
            self.data += data

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

    def test_capture_date_is_default_before_private_metadata_is_removed(self):
        photo = self.add_photo()
        self.assertEqual(photo['date'], '2026-10-10')
        data = (self.repo / '.git/photo-editor-imports' / Path(photo['src']).name).read_bytes()
        with Image.open(BytesIO(data)) as image:
            self.assertFalse(image.getexif())
            self.assertNotIn('xmp', image.info)
        photo['date'] = '2025-02-03'
        saved = self.library.save([photo], self.library.state()['revision'])
        self.assertEqual(saved['photos'][0]['date'], '2025-02-03')

    def test_capture_date_prioritizes_nested_original_and_validates_calendar(self):
        image = Image.new('RGB', (8, 8))
        exif = Image.Exif()
        exif[306] = '2026:11:24 12:00:00'
        exif[34665] = {36867: '2024:02:29 23:59:00', 36868: '2025:01:01 00:00:00'}
        output = BytesIO()
        image.save(output, 'JPEG', exif=exif)
        with Image.open(BytesIO(output.getvalue())) as opened:
            self.assertEqual(capture_date(opened), '2024-02-29')
        exif[34665] = {36867: '2025:02:29 00:00:00', 36868: '2025:03:01 00:00:00'}
        output = BytesIO()
        image.save(output, 'JPEG', exif=exif)
        with Image.open(BytesIO(output.getvalue())) as opened:
            self.assertEqual(capture_date(opened), '2025-03-01')
        self.assertEqual(capture_date(image), '')

    def test_renamed_mpo_reads_capture_date_before_cleanup(self):
        with Image.open(BytesIO(jpeg())) as image:
            output = BytesIO()
            image.save(output, 'MPO', save_all=True, append_images=[Image.new('RGB', (8, 8))], exif=image.getexif())
        photo = self.library.import_photo('renamed.png', base64.b64encode(output.getvalue()).decode())
        self.assertEqual(photo['date'], '2026-10-10')

    def test_crop_pixels_transparency_color_profile_save_and_restore(self):
        image = Image.new('RGBA', (40, 30))
        image.putdata([(x * 5, y * 7, 90, (x + y) * 3) for y in range(30) for x in range(40)])
        output = BytesIO()
        image.save(output, 'PNG', icc_profile=b'Color profile', exif=Image.Exif())
        photo = self.library.import_photo('pattern.png', base64.b64encode(output.getvalue()).decode())
        photo.update(caption='Keep this caption.', date='2024-01-02', alt='A test pattern')
        original_id = photo['id']
        original_source = photo['src']
        original_bytes = (self.repo / '.git/photo-editor-imports' / Path(original_source).name).read_bytes()
        state = self.library.save([photo], self.library.state()['revision'])
        result = self.library.crop_photo(photo['id'], photo['src'], dict(x=.25, y=.2, width=.5, height=.6))
        self.assertEqual((result['width'], result['height']), (20, 18))
        self.assertFalse((self.repo / 'public' / result['src'].lstrip('/')).exists())
        with Image.open(self.repo / '.git/photo-editor-imports' / Path(result['src']).name) as cropped:
            self.assertEqual(cropped.tobytes(), image.crop((10, 6, 30, 24)).tobytes())
            self.assertEqual(cropped.info['icc_profile'], b'Color profile')
            self.assertFalse(cropped.getexif())
        photo.update({key: result[key] for key in ('src', 'width', 'height')})
        state = self.library.save([photo], state['revision'])
        self.assertEqual(state['restorable'], [original_id])
        self.assertFalse((self.repo / 'public' / original_source.lstrip('/')).exists())
        self.assertEqual(state['photos'][0]['caption'], 'Keep this caption.')
        self.assertEqual(state['photos'][0]['date'], '2024-01-02')
        self.assertEqual(state['photos'][0]['id'], original_id)
        self.assertEqual(state['photos'][0]['alt'], 'A test pattern')
        reopened = PhotoLibrary(self.repo, self.library.preview)
        restored = reopened.restore_photo(original_id)
        restored_bytes = (self.repo / '.git/photo-editor-imports' / Path(restored['src']).name).read_bytes()
        self.assertEqual(restored_bytes, original_bytes)
        photo.update({key: restored[key] for key in ('src', 'width', 'height')})
        state = reopened.save([photo], state['revision'])
        self.assertEqual(state['restorable'], [])
        self.assertEqual((state['photos'][0]['width'], state['photos'][0]['height']), (40, 30))

    def test_crop_rejects_invalid_areas_and_keeps_original_private(self):
        photo = self.add_photo()
        for rectangle in [None, {}, dict(x=-.1, y=0, width=.5, height=.5),
            dict(x=0, y=0, width=float('nan'), height=.5),
            dict(x=0, y=0, width=True, height=.5), dict(x=0, y=0, width=.001, height=.001),
            dict(x=.8, y=0, width=.5, height=1)]:
            with self.subTest(rectangle=rectangle), self.assertRaises(ValueError):
                self.library.crop_photo(photo['id'], photo['src'], rectangle)
        result = self.library.crop_photo(photo['id'], photo['src'], dict(x=0, y=0, width=.5, height=.5))
        record = self.library.crop_records()[photo['id']]
        self.assertFalse((self.repo / 'public' / record['src'].lstrip('/')).exists())
        with Image.open(self.repo / '.git/photo-editor-originals' / Path(record['src']).name) as image:
            self.assertFalse(image.getexif())
        first_record = record.copy()
        self.library.crop_photo(photo['id'], result['src'], dict(x=0, y=0, width=.5, height=.5))
        self.assertEqual(self.library.crop_records()[photo['id']], first_record)
        with self.assertRaises(ValueError):
            self.library.crop_photo(photo['id'], '/images/../../private.jpeg', dict(x=0, y=0, width=.5, height=.5))

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

    def test_multi_image_jpeg_imports_main_photo_despite_renamed_extension(self):
        with Image.open(BytesIO(jpeg())) as primary:
            output = BytesIO()
            auxiliary = Image.new('RGB', (12, 20), 'gray')
            primary.save(output, 'MPO', save_all=True, append_images=[auxiliary],
                exif=primary.getexif(), icc_profile=b'Test color profile')
        original = output.getvalue()
        for filename in ('trees.jpg', 'trees.png', 'trees.mpo'):
            with self.subTest(filename=filename):
                cleaned, extension, size = clean_upload(original, filename)
                self.assertEqual(extension, 'jpeg')
                self.assertEqual(size, (24, 40))
                with Image.open(BytesIO(original)) as before, Image.open(BytesIO(cleaned)) as after:
                    self.assertEqual(before.format, 'MPO')
                    self.assertEqual(before.n_frames, 2)
                    self.assertEqual(after.format, 'JPEG')
                    self.assertFalse(after.getexif())
                    self.assertNotIn('mp', after.info)
                    self.assertEqual(after.info['icc_profile'], before.info['icc_profile'])
                    self.assertEqual(after.tobytes(), before.tobytes())
                self.assertEqual(cleaned.count(b'\xff\xd8'), 1)

    def test_rotated_multi_image_jpeg_applies_orientation(self):
        primary = Image.new('RGB', (40, 24), 'green')
        exif = Image.Exif()
        exif[274] = 6
        output = BytesIO()
        primary.save(output, 'MPO', save_all=True,
            append_images=[Image.new('RGB', (20, 12), 'gray')], exif=exif)
        cleaned, extension, size = clean_upload(output.getvalue(), 'trees.png')
        self.assertEqual((extension, size), ('jpeg', (24, 40)))
        with Image.open(BytesIO(cleaned)) as after:
            self.assertEqual(after.format, 'JPEG')
            self.assertFalse(after.getexif())

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
        self.assertEqual(json.loads(GalleryHTML(html).data)[0]['date'], '2026-05-06')
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
        rendered = GalleryHTML((self.library.preview / 'index.html').read_text())
        self.assertEqual(json.loads(rendered.data), [])
        self.assertIn('hidden', rendered.buttons[0])

    def test_photo_field_limits_visible_slots_and_keeps_all_gallery_data(self):
        photo = self.add_photo()
        entries = [dict(photo, id=f'photo-{i}', caption=f'Caption {i}') for i in range(10)]
        self.library.save(entries, self.library.state()['revision'])
        rendered = GalleryHTML((self.library.preview / 'index.html').read_text())
        slots = [button for button in rendered.buttons if button.get('class') == 'float-photo']
        self.assertEqual(len(slots), 7)
        self.assertEqual([button['data-slot'] for button in slots], list(map(str, range(7))))
        self.assertEqual([photo['caption'] for photo in json.loads(rendered.data)], [entry['caption'] for entry in entries])

    def test_caption_cannot_close_the_gallery_data_script(self):
        photo = self.add_photo()
        photo['caption'] = '</script><script>alert("example")</script>'
        self.library.save([photo], self.library.state()['revision'])
        html = (self.library.preview / 'index.html').read_text()
        rendered = GalleryHTML(html)
        self.assertEqual(json.loads(rendered.data)[0]['caption'], photo['caption'])
        self.assertNotIn(photo['caption'], html)
        self.assertEqual(rendered.buttons[0]['data-slot'], '2')

    def test_actual_homepage_renders_without_astro_expressions(self):
        source = Path(__file__).resolve().parents[2] / 'src/pages/index.astro'
        (self.repo / 'src/pages/index.astro').write_text(source.read_text())
        (self.repo / 'src/scripts').mkdir()
        for name in ['photo-flow.js', 'photo-controller.js']:
            (self.repo / 'src/scripts' / name).write_text((source.parent.parent / 'scripts' / name).read_text())
        self.library.save([self.add_photo()], self.library.state()['revision'])
        html = (self.library.preview / 'index.html').read_text()
        self.assertNotIn('hidden={!gallery.length}', html)
        self.assertNotIn('{gallery.slice', html)
        self.assertNotIn('set:html', html)
        self.assertNotIn('is:inline', html)
        self.assertNotIn('is:global', html)
        self.assertNotIn('set:html', html)
        self.assertIn('class PhotoFlow', html)
        self.assertEqual(len(json.loads(GalleryHTML(html).data)), 1)

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
