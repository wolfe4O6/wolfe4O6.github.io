from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit
from urllib.request import urlopen
import argparse
import hashlib
import json
import mimetypes
import secrets
import tempfile
import webbrowser

from library import PhotoLibrary, ConflictError

REPO = Path(__file__).resolve().parents[2]
EDITOR = Path(__file__).with_name('index.html')
VERSION = hashlib.sha256(b''.join(path.read_bytes() for path in
    [Path(__file__), Path(__file__).with_name('library.py'), EDITOR])).hexdigest()[:16]

class Handler(BaseHTTPRequestHandler):
    def log_message(self, *arguments):
        pass

    def send_bytes(self, content, content_type, status=200):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(content)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.end_headers()
        self.wfile.write(content)

    def json(self, value, status=200):
        self.send_bytes(json.dumps(value, ensure_ascii=False).encode(),
            'application/json; charset=utf-8', status)

    def valid_host(self):
        return self.headers.get('Host') in self.server.allowed_hosts

    def serve_file(self, root, relative):
        path = (root / relative).resolve()
        if not path.is_relative_to(root.resolve()) or not path.is_file():
            self.json(dict(error='File not found.'), 404)
            return
        content_type = mimetypes.guess_type(path)[0] or 'application/octet-stream'
        self.send_bytes(path.read_bytes(), content_type)

    def do_GET(self):
        if not self.valid_host():
            self.json(dict(error='Use the local editor address shown in the terminal.'), 403)
            return
        parsed = urlsplit(self.path)
        try:
            if parsed.path == '/':
                content = EDITOR.read_text().replace('__EDITOR_TOKEN__', self.server.token)
                self.send_bytes(content.encode(), 'text/html; charset=utf-8')
            elif parsed.path == '/api/info':
                self.json(dict(app='william-photo-editor', project=self.server.project, version=VERSION))
            elif parsed.path == '/api/state':
                with self.server.library.locked():
                    self.json(self.server.library.state())
            elif parsed.path == '/api/deployment':
                commit = parse_qs(parsed.query).get('commit', [''])[0]
                self.json(self.server.library.deployment(commit))
            elif parsed.path.startswith('/images/'):
                relative = parsed.path[len('/images/'):]
                public = self.server.library.repo / 'public/images'
                root = public if (public / relative).is_file() else self.server.library.repo / '.git/photo-editor-imports'
                self.serve_file(root, relative)
            elif parsed.path.startswith('/preview/'):
                relative = parsed.path[len('/preview/'):] or 'index.html'
                if relative == 'index.html':
                    self.server.library.refresh_preview()
                self.serve_file(self.server.library.preview, relative)
            else:
                self.json(dict(error='Page not found.'), 404)
        except (ValueError, OSError, RuntimeError) as error:
            self.json(dict(error=str(error)), 400)

    def do_POST(self):
        origin = self.headers.get('Origin')
        allowed_origins = {'http://' + host for host in self.server.allowed_hosts}
        token = self.headers.get('X-Photo-Editor-Token', '')
        if not self.valid_host() or not secrets.compare_digest(token, self.server.token) or (origin and origin not in allowed_origins):
            self.json(dict(error='Reload the local editor and try again.'), 403)
            return
        try:
            length = int(self.headers.get('Content-Length', '0'))
            if length < 1:
                raise ValueError('The request is empty.')
            body = json.loads(self.rfile.read(length))
            path = urlsplit(self.path).path
            if path == '/api/import':
                photos, errors = [], []
                for item in body.get('files', []):
                    try:
                        photos.append(self.server.library.import_photo(item['name'], item['data']))
                    except Exception as error:
                        errors.append(item.get('name', 'Photo') + ': ' + str(error))
                self.json(dict(photos=photos, errors=errors))
            elif path == '/api/save':
                self.json(self.server.library.save(body['photos'], body['revision']))
            elif path == '/api/crop':
                self.json(self.server.library.crop_photo(body['id'], body['src'], body['rect']))
            elif path == '/api/restore':
                self.json(self.server.library.restore_photo(body['id']))
            elif path == '/api/publish':
                self.json(self.server.library.publish())
            else:
                self.json(dict(error='Unknown action.'), 404)
        except ConflictError as error:
            self.json(dict(error=str(error)), 409)
        except (ValueError, KeyError, OSError, RuntimeError) as error:
            self.json(dict(error=str(error)), 400)
        except Exception as error:
            self.json(dict(error='The action could not finish. ' + str(error)), 500)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--port', type=int, default=8766)
    parser.add_argument('--preview-dir', type=Path)
    parser.add_argument('--no-open', action='store_true')
    arguments = parser.parse_args()
    project = hashlib.sha256(str(REPO).encode()).hexdigest()[:16]
    preview = arguments.preview_dir or Path(tempfile.gettempdir()) / ('william-photo-preview-' + project)
    library = PhotoLibrary(REPO, preview)
    library.refresh_preview()
    try:
        server = ThreadingHTTPServer(('127.0.0.1', arguments.port), Handler)
    except OSError:
        existing = f'http://127.0.0.1:{arguments.port}'
        try:
            with urlopen(existing + '/api/info', timeout=2) as response:
                data = json.load(response)
            if data.get('app') == 'william-photo-editor' and data.get('project') == project and data.get('version') == VERSION:
                print('Photo editor is already running at ' + existing, flush=True)
                if not arguments.no_open:
                    webbrowser.open(existing)
                return
        except Exception:
            pass
        server = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    server.library = library
    server.project = project
    server.token = secrets.token_urlsafe(32)
    port = server.server_address[1]
    server.allowed_hosts = {f'127.0.0.1:{port}', f'localhost:{port}'}
    address = f'http://127.0.0.1:{port}/'
    print('Photo editor: ' + address, flush=True)
    print('Leave this window open while editing. Press Control-C to stop.', flush=True)
    if not arguments.no_open:
        webbrowser.open(address)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()

if __name__ == '__main__':
    main()
