from datetime import date
from html import escape
from io import BytesIO
from pathlib import Path
from urllib.parse import urlsplit
import base64
import fcntl
import hashlib
import json
import math
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
    source = source.replace('hidden={!gallery.length}', '' if gallery else 'hidden')
    slots = list(range(7)) if len(gallery) >= 7 else [2, 3, 5] if len(gallery) == 3 else [2, 3, 1, 4, 5, 6][:len(gallery)]
    buttons = []
    for index, photo in enumerate(gallery[:7]):
        label = 'View photo: ' + (photo['caption'] or photo['alt'])
        buttons.append(f'''
            <button class="float-photo" type="button" tabindex="-1" data-index="{index}" data-slot="{slots[index]}"
              aria-label="{escape(label, quote=True)}" style="--ratio:{photo['width'] / photo['height']}">
              <img src="{escape(photo['src'].lstrip('/'), quote=True)}"
                width="{photo['width']}" height="{photo['height']}" decoding="async"
                alt="{escape(photo['alt'], quote=True)}">
            </button>''')
    source = re.sub(r'<!-- GALLERY_START -->.*?<!-- GALLERY_END -->',
        lambda match: '\n'.join(buttons), source, flags=re.S)
    data = [dict(photo, src=photo['src'].lstrip('/')) for photo in gallery]
    encoded = json.dumps(data, ensure_ascii=False).replace('<', '\\u003c')
    source = re.sub(r'<!-- GALLERY_DATA_START -->.*?<!-- GALLERY_DATA_END -->',
        lambda match: '<script type="application/json" id="gallery-data">' + encoded + '</script>', source, flags=re.S)
    viewer = '<img class="viewer-image" alt="">'
    if gallery:
        viewer = f'<img class="viewer-image" src="{escape(data[0]["src"], quote=True)}" alt="{escape(data[0]["alt"], quote=True)}">'
    source = re.sub(r'<!-- VIEWER_IMAGE_START -->.*?<!-- VIEWER_IMAGE_END -->',
        lambda match: viewer, source, flags=re.S)
    if '<!-- PHOTO_MOTION_START -->' in source:
        motion = '\n'.join((repo / 'src/scripts' / name).read_text()
            for name in ['photo-physics.js', 'photo-controller.js'])
        source = re.sub(r'<!-- PHOTO_MOTION_START -->.*?<!-- PHOTO_MOTION_END -->',
            lambda match: '<script>' + motion + '</script>', source, flags=re.S)
    for photo in gallery:
        original = image_path(repo, photo['src'])
        destination = preview / 'images' / original.name
        if not destination.exists() or destination.read_bytes() != original.read_bytes():
            atomic_write(destination, original.read_bytes())
    atomic_write(preview / 'index.html', source.encode())

def capture_date(image):
    """Read the camera's local calendar date before removing private metadata."""
    try:
        exif = image.getexif()
        try:
            details = exif.get_ifd(34665)
        except (KeyError, TypeError, ValueError, SyntaxError):
            details = {}
        for tag in (36867, 36868, 306):
            for source in (details, exif):
                value = source.get(tag, '')
                if isinstance(value, bytes):
                    value = value.decode('ascii', errors='ignore')
                if not isinstance(value, str):
                    continue
                match = re.match(r'^\s*(\d{4})[:-](\d{2})[:-](\d{2})(?:[ T]|$)', value.strip('\0'))
                if match:
                    try:
                        return date(*map(int, match.groups())).isoformat()
                    except ValueError:
                        pass
    except (OSError, ValueError, TypeError, SyntaxError):
        pass
    return ''

def clean_upload(data, filename, include_date=False):
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
        taken = capture_date(original) if include_date else ''
        # iPhone JPEGs can contain an auxiliary image (for example an HDR
        # gain map), so Pillow identifies them as MPO. Export the main photo.
        # The JPEG cleaner drops the MPF index and ends at the first image's
        # end marker, removing auxiliary images and their metadata as well.
        original.load()
        orientation = original.getexif().get(274, 1)
        if original.format in ('JPEG', 'MPO') and orientation == 1:
            result = (strip_descriptive_metadata(data), 'jpeg', original.size)
            return result + (taken,) if include_date else result
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
        result = (output.getvalue(), extension, clean.size)
        return result + (taken,) if include_date else result

class PhotoLibrary:
    def __init__(self, repo, preview):
        self.repo = Path(repo).resolve()
        self.preview = Path(preview).resolve()
        self.path = self.repo / 'src/data/gallery.json'
        self.thread_lock = threading.RLock()
        self.lock_path = self.repo / '.git/photo-editor.lock'
        self.crops_path = self.repo / '.git/photo-editor-crops.json'

    def crop_records(self):
        return json.loads(self.crops_path.read_text()) if self.crops_path.exists() else {}

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
        photos = json.loads(raw)
        records = self.crop_records()
        restorable = [photo['id'] for photo in photos if photo['id'] in records
            and photo['src'] != records[photo['id']]['src']]
        return dict(photos=photos, revision=hashlib.sha256(raw).hexdigest(), restorable=restorable)

    def refresh_preview(self):
        with self.locked():
            render_preview(self.repo, self.preview, self.state()['photos'])

    def import_photo(self, filename, encoded):
        raw = base64.b64decode(encoded, validate=True)
        data, extension, dimensions, taken = clean_upload(raw, filename, include_date=True)
        digest = hashlib.sha256(data).hexdigest()[:16]
        slug = re.sub(r'[^a-z0-9]+', '-', Path(filename).stem.lower()).strip('-')[:45] or 'photo'
        name = f'{slug}-{digest}.{extension}'
        path = self.repo / '.git/photo-editor-imports' / name
        with self.locked():
            if not path.exists():
                atomic_write(path, data)
        width, height = dimensions
        return dict(id=name.rsplit('.', 1)[0], src='/images/' + name, width=width,
            height=height, caption='', alt='', date=taken)

    def crop_photo(self, identifier, source, rectangle):
        if not isinstance(identifier, str) or not identifier or len(identifier) > 200:
            raise ValueError('Choose a photo to crop.')
        if not isinstance(rectangle, dict):
            raise ValueError('Choose a crop area.')
        values = [rectangle.get(key) for key in ('x', 'y', 'width', 'height')]
        if not all(type(value) in (int, float) and math.isfinite(value) for value in values):
            raise ValueError('Crop coordinates must be finite numbers.')
        x, y, width, height = values
        if x < 0 or y < 0 or width <= 0 or height <= 0 or x + width > 1.000001 or y + height > 1.000001:
            raise ValueError('Keep the crop inside the photo.')
        with self.locked():
            path = readable_image_path(self.repo, source)
            raw = path.read_bytes()
            # Normalize orientation and remove any descriptive metadata from
            # both the crop and the private, restorable original.
            original, extension, dimensions = clean_upload(raw, path.name)
            image_width, image_height = dimensions
            box = (round(x * image_width), round(y * image_height),
                min(image_width, round((x + width) * image_width)),
                min(image_height, round((y + height) * image_height)))
            if box[2] - box[0] < 2 or box[3] - box[1] < 2:
                raise ValueError('Choose a crop at least 2 pixels wide and high.')
            if box == (0, 0, image_width, image_height):
                record = self.crop_records().get(identifier)
                return dict(src=source, width=image_width, height=image_height,
                    restorable=bool(record and source != record['src']))
            with Image.open(BytesIO(original)) as image:
                cropped = image.crop(box)
                profile = image.info.get('icc_profile')
                if cropped.mode == 'P':
                    cropped = cropped.convert('RGBA' if 'transparency' in image.info else 'RGB')
                clean = Image.frombytes(cropped.mode, cropped.size, cropped.tobytes())
                output = BytesIO()
                options = dict(icc_profile=profile)
                if extension == 'jpeg':
                    if clean.mode not in ('RGB', 'L', 'CMYK'):
                        clean = clean.convert('RGB')
                    clean.save(output, 'JPEG', quality=95, subsampling=0, **options)
                elif extension == 'webp':
                    clean.save(output, 'WEBP', lossless=True, **options)
                else:
                    clean.save(output, 'PNG', **options)
                result = output.getvalue()
                dimensions = clean.size
            digest = hashlib.sha256(result).hexdigest()[:16]
            name = f'crop-{digest}.{extension}'
            atomic_write(self.repo / '.git/photo-editor-imports' / name, result)
            records = self.crop_records()
            if identifier not in records:
                original_name = 'original-' + hashlib.sha256(original).hexdigest()[:16] + '.' + extension
                atomic_write(self.repo / '.git/photo-editor-originals' / original_name, original)
                records[identifier] = dict(src='/images/' + original_name,
                    width=image_width, height=image_height)
                atomic_write(self.crops_path, (json.dumps(records, ensure_ascii=False, indent=2) + '\n').encode())
            return dict(src='/images/' + name, width=dimensions[0], height=dimensions[1], restorable=True)

    def restore_photo(self, identifier):
        if not isinstance(identifier, str) or not identifier:
            raise ValueError('Choose a photo to restore.')
        with self.locked():
            record = self.crop_records().get(identifier)
            if not record:
                raise ValueError('There is no saved original for this photo on this computer.')
            name = image_path(self.repo, record['src']).name
            original = self.repo / '.git/photo-editor-originals' / name
            if not original.is_file():
                raise ValueError('The saved original is missing from this computer.')
            atomic_write(self.repo / '.git/photo-editor-imports' / name, original.read_bytes())
            return dict(**record, restorable=False)

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
