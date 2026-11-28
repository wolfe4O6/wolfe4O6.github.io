#!/usr/bin/env python3
"""Read-only public BlueMap, including live players; no console or admin API."""
import argparse
import http.client
import http.server
import json
import re
import socket
import threading
import time
from pathlib import Path
from urllib.parse import urlsplit

UPSTREAM = ('100.93.108.20', 8100)
MAPS = ('world', 'world_the_nether', 'world_the_end')
MAP_ID = r'(?:world|world_the_nether|world_the_end)'
STATIC = re.compile(r'(?:/|/index\.html|/(?:assets|lang)/[A-Za-z0-9_.-]+|/maps/' + MAP_ID + r'/(?:settings\.json|textures\.json(?:\.gz)?|live/(?:players|markers)\.json|assets/[A-Za-z0-9_.-]+\.(?:png|jpg|webp)|assets/playerheads/[a-fA-F0-9-]{32,36}\.png|tiles/[0-9]{1,2}/(?:[xz]-?[0-9]+/)+[xz]-?[0-9]+\.(?:prbm|png)(?:\.gz)?))\Z', re.ASCII)
EVENTS = re.compile(r'/maps/' + MAP_ID + r'/live/sse\Z')
BRIDGE = b"""const notify = () => parent.postMessage({type:'minecraft-map-view',hash:location.hash}, 'https://williamkearns.org');
addEventListener('hashchange', notify); notify();
"""


class MapServer(http.server.ThreadingHTTPServer):
    daemon_threads = True
    allow_reuse_address = True
    request_queue_size = 64

    def __init__(self, address=('127.0.0.1', 8180), *, upstream=UPSTREAM, preview=False, map_root=None):
        self.upstream = upstream
        self.map_root = Path(map_root) if map_root else None
        self.origins = ['https://williamkearns.org'] + (['http://127.0.0.1:4173', 'http://localhost:4173'] if preview else [])
        self.frames = "https://williamkearns.org" + (" http://127.0.0.1:4173 http://localhost:4173" if preview else '')
        self.slots = threading.BoundedSemaphore(48)
        self.streams = threading.BoundedSemaphore(8)
        super().__init__(address, Handler)

    def process_request(self, request, client_address):
        if not self.slots.acquire(blocking=False):
            request.close()
            return
        try: super().process_request(request, client_address)
        except BaseException:
            self.slots.release()
            raise

    def process_request_thread(self, request, client_address):
        try: super().process_request_thread(request, client_address)
        finally: self.slots.release()

    def handle_error(self, request, client_address): pass


class Handler(http.server.BaseHTTPRequestHandler):
    server_version = 'MinecraftMap'
    sys_version = ''

    def log_message(self, *args): pass

    def setup(self):
        super().setup()
        self.connection.settimeout(15)

    def headers_out(self, status, content_type, cache='no-cache', length=None, encoding=None, extra=()):
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Cache-Control', cache)
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('Referrer-Policy', 'no-referrer')
        self.send_header('Content-Security-Policy', 'frame-ancestors ' + self.server.frames)
        if self.path.split('?')[0] == '/health.json':
            origin = self.headers.get('Origin')
            if origin in self.server.origins: self.send_header('Access-Control-Allow-Origin', origin)
            self.send_header('Vary', 'Origin')
        if length is not None and status not in (204, 304): self.send_header('Content-Length', str(length))
        if encoding: self.send_header('Content-Encoding', encoding)
        for name, value in extra: self.send_header(name, value)
        self.end_headers()

    def reply(self, status, body=b'', content_type='text/plain; charset=utf-8'):
        if isinstance(body, dict):
            body = json.dumps(body).encode()
            content_type = 'application/json'
        self.headers_out(status, content_type, 'no-store', len(body))
        if self.command != 'HEAD': self.wfile.write(body)

    def do_POST(self): self.reply(405, b'Read-only map.')
    do_PUT = do_POST
    do_PATCH = do_POST
    do_DELETE = do_POST
    do_CONNECT = do_POST
    do_TRACE = do_POST
    do_OPTIONS = do_POST

    def do_HEAD(self): self.do_GET()

    def do_GET(self):
        connection = None
        try:
            if len(self.path) > 1024 or '%' in self.path or '\\' in self.path or '..' in self.path:
                return self.reply(404)
            url = urlsplit(self.path)
            if url.scheme or url.netloc or url.fragment:
                return self.reply(404)
            path = url.path
            if path == '/website-bridge.js':
                return self.reply(200, BRIDGE, 'text/javascript; charset=utf-8')
            if EVENTS.fullmatch(path):
                if self.command == 'HEAD':
                    return self.reply(200, content_type='text/event-stream')
                return self.events(path)
            if path not in ('/settings.json', '/health.json') and (not STATIC.fullmatch(path) or path.endswith('.map')):
                return self.reply(404)
            connection = http.client.HTTPConnection(*self.server.upstream, timeout=12)
            upstream_headers = {'Accept-Encoding': 'gzip'}
            settings_request = path in ('/settings.json', '/health.json')
            if settings_request:
                upstream_headers['Accept-Encoding'] = 'identity'
            else:
                for header in ('If-None-Match', 'If-Modified-Since'):
                    value = self.headers.get(header)
                    if value and len(value) < 256: upstream_headers[header] = value
            connection.request('GET' if settings_request else self.command, '/settings.json' if settings_request else path, headers=upstream_headers)
            response = connection.getresponse()
            if settings_request:
                if response.status != 200: return self.reply(503, b'Map unavailable. Try again shortly.')
                settings = json.loads(response.read(65537))
                if not isinstance(settings, dict) or 'world' not in settings.get('maps', []): raise ValueError()
                if path == '/health.json':
                    maps = {}
                    for map_id in MAPS:
                        rendered = map_id in settings['maps']
                        if self.server.map_root:
                            rendered = rendered and next((self.server.map_root / map_id / 'tiles').rglob('*.prbm*'), None) is not None
                        maps[map_id] = {'rendered': rendered}
                    return self.reply(200, {'ready': True, 'maps': maps})
                settings.update(maps=[m for m in MAPS if m in settings['maps']], mapDataRoot='maps', liveDataRoot='maps', useCookies=False,
                                clientDecompression=False, scripts=['/website-bridge.js'], styles=[])
                return self.reply(200, settings)
            # An absent tile represents unrendered terrain; it is not an error page.
            status = 204 if response.status == 404 and '/tiles/' in path else response.status
            if status not in (200, 204, 304, 404): return self.reply(503, b'Map unavailable. Try again shortly.')
            limit = 16 * 1024 * 1024
            body = response.read(limit + 1) if self.command != 'HEAD' and status == 200 else b''
            if len(body) > limit: raise ValueError()
            length = len(body)
            if self.command == 'HEAD':
                header_length = response.getheader('Content-Length')
                length = int(header_length) if header_length else None
            extra = [(header, response.getheader(header)) for header in ('ETag', 'Last-Modified') if response.getheader(header)]
            self.headers_out(status, response.getheader('Content-Type', 'application/octet-stream'),
                             'no-store' if '/live/' in path else ('public, max-age=3600' if path.startswith('/assets/') else 'no-cache'),
                             length, response.getheader('Content-Encoding'), extra)
            if self.command != 'HEAD': self.wfile.write(body)
        except (OSError, ValueError, http.client.HTTPException):
            try: self.reply(503, b'Map unavailable. Try again shortly.')
            except OSError: pass
        finally:
            if connection is not None: connection.close()

    def events(self, path):
        if not self.server.streams.acquire(blocking=False): return self.reply(503)
        connection = None
        sent = False
        try:
            connection = http.client.HTTPConnection(*self.server.upstream, timeout=20)
            connection.request('GET', path, headers={'Accept': 'text/event-stream', 'Accept-Encoding': 'identity'})
            response = connection.getresponse()
            if response.status != 200: return self.reply(503)
            self.headers_out(200, 'text/event-stream', 'no-store')
            sent = True
            self.wfile.write(b': connected\n\n')
            self.wfile.flush()
            deadline = time.monotonic() + 180
            event = []
            size = 0
            while time.monotonic() < deadline:
                line = response.readline(8193)
                if not line or len(line) > 8192: break
                event.append(line)
                size += len(line)
                if size > 1024 * 1024: break
                if line.strip(): continue
                filtered = live_event(event)
                self.wfile.write(filtered or b': keepalive\n\n')
                self.wfile.flush()
                event, size = [], 0
        except (OSError, ValueError, http.client.HTTPException):
            if not sent:
                try: self.reply(503)
                except OSError: pass
        finally:
            if connection is not None: connection.close()
            self.server.streams.release()


def live_event(lines):
    event_type = ''
    data = []
    for line in lines:
        if line.startswith(b'event:'): event_type = line[6:].strip()
        if line.startswith(b'data:'): data.append(line[5:].strip())
    if event_type not in (b'tile', b'player', b'marker'): return None
    try:
        parsed = json.loads(b'\n'.join(data))
        if event_type == b'tile':
            parsed = {key: parsed[key] for key in ('lod', 'x', 'y')}
            if not all(type(value) is int for value in parsed.values()) or not 0 <= parsed['lod'] <= 16: return None
        return b'event: ' + event_type + b'\ndata: ' + json.dumps(parsed, separators=(',', ':')).encode() + b'\n\n'
    except (ValueError, KeyError, TypeError): return None


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=8180)
    parser.add_argument('--preview', action='store_true', help='Also allow framing by the local preview only.')
    parser.add_argument('--map-root', type=Path, help='Read-only BlueMap maps folder, for terrain availability.')
    args = parser.parse_args()
    server = MapServer(('127.0.0.1', args.port), preview=args.preview, map_root=args.map_root)
    print('Read-only live map proxy listening on loopback. Request logging disabled.', flush=True)
    try: server.serve_forever()
    except KeyboardInterrupt: pass
    finally: server.server_close()
