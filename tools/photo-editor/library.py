from datetime import date
from html import escape
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit
import base64
import fcntl
import hashlib
import json
import os
import re
import shutil
import subprocess
import tempfile
import threading
from contextlib import contextmanager

from PIL import Image, ImageOps, UnidentifiedImageError

class ConflictError(ValueError):
    pass

def atomic_write(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    descriptor, temporary = tempfile.mkstemp(dir=path.parent, prefix='.' + path.name)
    try:
        with os.fdopen(descriptor, 'wb') as stream:
            stream.write(data)
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)

def image_path(repo, source):
    parsed = urlsplit(source)
    if parsed.scheme or parsed.netloc or not re.fullmatch(r'/images/[A-Za-z0-9][A-Za-z0-9_.-]*\.(?:jpe?g|png|webp)', parsed.path):
        raise ValueError('Photo files must be inside the website images folder.')
    folder = (repo / 'public/images').resolve()
    path = (folder / Path(parsed.path).name).resolve()
    if path.parent != folder:
        raise ValueError('Invalid photo path.')
    return path

def imported_path(repo, source):
    return repo / '.git/photo-editor-imports' / image_path(repo, source).name

def readable_image_path(repo, source):
    public = image_path(repo, source)
    return public if public.is_file() else imported_path(repo, source)

def validate_gallery(repo, entries):
    if not isinstance(entries, list):
        raise ValueError('Expected a photo list.')
    result = []
    identifiers = set()
    for entry in entries:
        if not isinstance(entry, dict):
            raise ValueError('Each photo must be an object.')
        identifier = entry.get('id')
        if not isinstance(identifier, str) or not identifier or identifier in identifiers:
            raise ValueError('Each photo needs its own identifier.')
        identifiers.add(identifier)
        source = entry.get('src', '')
        path = readable_image_path(repo, source)
        if not path.is_file():
            raise ValueError('Photo file is missing: ' + path.name)
        with Image.open(path) as image:
            width, height = image.size
        caption = entry.get('caption', '')
        description = entry.get('alt', '')
        taken = entry.get('date', '')
        if not all(isinstance(value, str) for value in (caption, description, taken)):
            raise ValueError('Captions, descriptions, and dates must be text.')
        if taken:
            if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', taken):
                raise ValueError('Dates must use year-month-day format.')
            date.fromisoformat(taken)
        result.append(dict(id=identifier, src=source, width=width, height=height,
            caption=caption, alt=description or caption or 'Photo', date=taken))
    return result

def render_preview(repo, preview, gallery):
    source = (repo / 'src/pages/index.astro').read_text()
    source = source.split('---', 2)[2].lstrip()
    source = source.replace('<style is:global>', '<style>').replace('<script is:inline>', '<script>')
    source = source.replace('<main class={gallery.length ? undefined : "text-only"}>',
        '<main>' if gallery else '<main class="text-only">')
    source = source.replace('<div class="photos" hidden={!gallery.length}>',
        '<div class="photos">' if gallery else '<div class="photos" hidden>')
    buttons = []
    for index, photo in enumerate(gallery):
        taken = ''
        if photo['date']:
            value = date.fromisoformat(photo['date'])
            label = value.strftime('%B') + ' ' + str(value.day) + value.strftime(', %Y')
            taken = f'<time datetime="{escape(photo["date"], quote=True)}">{label}</time>'
        priority = ' fetchpriority="high"' if index == 0 else ''
        buttons.append(f'''
            <button class="photo" type="button" aria-expanded="false" data-photo-id="{escape(photo['id'], quote=True)}"
              style="--photo-ratio: {photo['width'] / photo['height']}">
              <img src="{escape(photo['src'].lstrip('/'), quote=True)}"
                width="{photo['width']}" height="{photo['height']}"{priority}
                alt="{escape(photo['alt'], quote=True)}">
              <span class="photo-caption" hidden><span>{escape(photo['caption'])}</span>{taken}</span>
            </button>''')
    source = re.sub(r'<!-- GALLERY_START -->.*?<!-- GALLERY_END -->',
        lambda match: '\n'.join(buttons), source, flags=re.S)
    for photo in gallery:
        original = image_path(repo, photo['src'])
        destination = preview / 'images' / original.name
        if not destination.exists() or destination.read_bytes() != original.read_bytes():
            atomic_write(destination, original.read_bytes())
    atomic_write(preview / 'index.html', source.encode())

def clean_upload(data, filename):
    try:
        original = Image.open(BytesIO(data))
    except UnidentifiedImageError:
        if Path(filename).suffix.lower() not in ('.heic', '.heif') or not shutil.which('sips'):
            raise ValueError('Choose a JPEG, PNG, WebP, or supported HEIC photo.')
        with tempfile.TemporaryDirectory() as temporary:
            source = Path(temporary) / ('upload' + Path(filename).suffix.lower())
            target = Path(temporary) / 'converted.jpeg'
            source.write_bytes(data)
            subprocess.run(['sips', '-s', 'format', 'jpeg', str(source), '--out', str(target)],
                check=True, capture_output=True, timeout=60)
            data = target.read_bytes()
        original = Image.open(BytesIO(data))
    with original:
        if original.format not in ('JPEG', 'MPO', 'PNG', 'WEBP'):
            raise ValueError('Choose a JPEG, PNG, WebP, or supported HEIC photo.')
        # iPhone JPEGs can contain an auxiliary image (for example an HDR
        # gain map), so Pillow identifies them as MPO. Export the main photo.
        # The JPEG cleaner drops the MPF index and ends at the first image's
        # end marker, removing auxiliary images and their metadata as well.
        original.load()
        orientation = original.getexif().get(274, 1)
        if original.format in ('JPEG', 'MPO') and orientation == 1:
            return strip_descriptive_metadata(data), 'jpeg', original.size
        profile = original.info.get('icc_profile')
        image = ImageOps.exif_transpose(original)
        if image.mode == 'P':
            image = image.convert('RGBA' if 'transparency' in image.info else 'RGB')
        clean = Image.frombytes(image.mode, image.size, image.tobytes())
        output = BytesIO()
        # Recreating PNG/WebP images clears textual and camera metadata.
        if original.format == 'WEBP':
            clean.save(output, format='WEBP', lossless=True, icc_profile=profile)
            extension = 'webp'
        elif original.format == 'PNG':
            clean.save(output, format='PNG', icc_profile=profile)
            extension = 'png'
        else:
            if clean.mode not in ('RGB', 'L', 'CMYK'):
                clean = clean.convert('RGB')
            clean.save(output, format='JPEG', quality=95, subsampling=0, icc_profile=profile)
            extension = 'jpeg'
        return output.getvalue(), extension, clean.size

class PhotoLibrary:
    def __init__(self, repo, preview):
        self.repo = Path(repo).resolve()
        self.preview = Path(preview).resolve()
        self.path = self.repo / 'src/data/gallery.json'
        self.thread_lock = threading.RLock()
        self.lock_path = self.repo / '.git/photo-editor.lock'

    @contextmanager
    def locked(self):
        with self.thread_lock:
            self.lock_path.parent.mkdir(parents=True, exist_ok=True)
            with self.lock_path.open('a') as stream:
                fcntl.flock(stream, fcntl.LOCK_EX)
                try:
                    yield
                finally:
                    fcntl.flock(stream, fcntl.LOCK_UN)

    def state(self):
        raw = self.path.read_bytes()
        return dict(photos=json.loads(raw), revision=hashlib.sha256(raw).hexdigest())

    def refresh_preview(self):
        with self.locked():
            render_preview(self.repo, self.preview, self.state()['photos'])

    def import_photo(self, filename, encoded):
        raw = base64.b64decode(encoded, validate=True)
        data, extension, dimensions = clean_upload(raw, filename)
        digest = hashlib.sha256(data).hexdigest()[:16]
        slug = re.sub(r'[^a-z0-9]+', '-', Path(filename).stem.lower()).strip('-')[:45] or 'photo'
        name = f'{slug}-{digest}.{extension}'
        path = self.repo / '.git/photo-editor-imports' / name
        with self.locked():
            if not path.exists():
                atomic_write(path, data)
        width, height = dimensions
        return dict(id=name.rsplit('.', 1)[0], src='/images/' + name, width=width,
            height=height, caption='', alt='', date='')

    def save(self, entries, revision):
        with self.locked():
            previous = self.state()
            if previous['revision'] != revision:
                raise ConflictError('The photo list changed in another window. Reload before saving.')
            photos = validate_gallery(self.repo, entries)
            promoted = []
            try:
                # Unsaved imports live outside the public tree until this save.
                for photo in photos:
                    public = image_path(self.repo, photo['src'])
                    if not public.exists():
                        atomic_write(public, imported_path(self.repo, photo['src']).read_bytes())
                        promoted.append(public)
                render_preview(self.repo, self.preview, photos)
                raw = (json.dumps(photos, ensure_ascii=False, indent=2) + '\n').encode()
                atomic_write(self.path, raw)
            except OSError:
                for path in promoted:
                    path.unlink(missing_ok=True)
                render_preview(self.repo, self.preview, previous['photos'])
                raise
            removed = {image_path(self.repo, item['src']) for item in previous['photos']}
            kept = {image_path(self.repo, item['src']) for item in photos}
            warnings = []
            for path in removed - kept:
                try:
                    path.unlink(missing_ok=True)
                    (self.preview / 'images' / path.name).unlink(missing_ok=True)
                except OSError:
                    warnings.append('Could not delete the unused file ' + path.name + '.')
            return dict(**self.state(), warnings=warnings)

    def git(self, *arguments, check=True):
        result = subprocess.run(['git', *arguments], cwd=self.repo,
            capture_output=True, text=True, timeout=120)
        if check and result.returncode:
            raise RuntimeError(result.stderr.strip() or result.stdout.strip() or 'Git command failed.')
        return result

    def publish(self):
        with self.locked():
            self.git('fetch', 'origin', 'main')
            self.git('add', '--', 'src/data/gallery.json', 'public/images')
            changed = self.git('diff', '--cached', '--quiet', '--',
                'src/data/gallery.json', 'public/images', check=False).returncode
            if changed:
                self.git('commit', '--only', '-m', 'Update photo gallery', '--',
                    'src/data/gallery.json', 'public/images')
            ancestor = self.git('merge-base', '--is-ancestor', 'origin/main', 'HEAD', check=False)
            if ancestor.returncode:
                rebased = self.git('rebase', 'origin/main', check=False)
                if rebased.returncode:
                    self.git('rebase', '--abort', check=False)
                    raise RuntimeError('GitHub has changes that need a merge. Your photo changes are saved on this computer.')
            self.git('push', 'origin', 'HEAD:main')
            return dict(commit=self.git('rev-parse', 'HEAD').stdout.strip())

    def deployment(self, commit):
        if not re.fullmatch('[0-9a-f]{40}', commit):
            raise ValueError('Invalid deployment commit.')
        result = subprocess.run(['gh', 'run', 'list', '--commit', commit, '--limit', '1',
            '--json', 'status,conclusion,url'], cwd=self.repo,
            capture_output=True, text=True, timeout=30)
        if result.returncode:
            raise RuntimeError('The files were pushed. GitHub deployment status is unavailable.')
        runs = json.loads(result.stdout)
        return runs[0] if runs else dict(status='queued', conclusion=None)


def strip_descriptive_metadata(data):
    if data[:2] != b'\xff\xd8':
        raise ValueError('Expected a JPEG')
    output = bytearray(data[:2])
    position = 2
    while position < len(data):
        start = position
        if data[position] != 255:
            raise ValueError('Invalid JPEG marker')
        while data[position] == 255:
            position += 1
        marker = data[position]
        position += 1
        if marker == 217:
            output.extend(b'\xff\xd9')
            return bytes(output)
        if marker == 1 or 208 <= marker <= 215:
            output.extend(data[start:position])
            continue
        length = int.from_bytes(data[position:position + 2], 'big')
        if length < 2 or position + length > len(data):
            raise ValueError('Invalid JPEG segment length')
        end = position + length
        payload = data[position + 2:end]
        app_segment = 224 <= marker <= 239
        # These segments carry JPEG rendering information, including color.
        rendering_data = (
            marker == 224 and payload.startswith(b'JFIF\0') or
            marker == 226 and payload.startswith(b'ICC_PROFILE\0') or
            marker == 238 and payload.startswith(b'Adobe')
        )
        if not app_segment and marker != 254 or rendering_data:
            output.extend(data[start:end])
        position = end
        if marker == 218:
            # Copy encoded image data through the next unescaped marker.
            scan_start = position
            while position < len(data):
                boundary = data.find(b'\xff', position)
                if boundary < 0:
                    raise ValueError('Unterminated JPEG scan')
                cursor = boundary + 1
                while data[cursor] == 255:
                    cursor += 1
                code = data[cursor]
                if code == 0 or 208 <= code <= 215:
                    position = cursor + 1
                    continue
                output.extend(data[scan_start:boundary])
                position = boundary
                break
    raise ValueError('JPEG has no end marker')
