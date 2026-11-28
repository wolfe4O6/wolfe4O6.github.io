import contextlib
import gzip
import http.client
import http.server
import io
import json
from pathlib import Path
import socket
import sys
import threading
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from map_proxy import MapServer, live_event


class Upstream(http.server.BaseHTTPRequestHandler):
    def log_message(self, *args): pass
    def do_GET(self):
        self.server.calls.append(self.path)
        status, content_type, encoding = 200, 'application/json', None
        if self.path == '/settings.json':
            body = json.dumps({'version': '5.29', 'maps': ['world', 'world_the_nether', 'world_the_end', 'secret_dimension'], 'scripts': ['https://bad.example/tracker.js'],
                'styles': ['https://bad.example/style.css'], 'mapDataRoot': 'https://private.example/maps', 'liveDataRoot': 'https://private.example/maps', 'clientDecompression': True}).encode()
        elif self.path.endswith('live/players.json'):
            body = b'{"players":[{"name":"TestPlayer","uuid":"657c020d-828c-420e-aebc-0ee37b11224c","position":{"x":12,"y":65,"z":34}}]}'
        elif '/assets/playerheads/' in self.path:
            content_type, body = 'image/png', b'head-png-fixture'
        elif self.path.endswith('live/sse'):
            content_type = 'text/event-stream'
            body = b'event: player\ndata: {"name":"private-name","x":12345}\n\nevent: marker\ndata: {"private-marker":true}\n\nevent: tile\ndata: {"lod":0,"x":2,"y":3,"private-field":"hidden"}\n\n'
        elif 'x999/' in self.path:
            status, body = 404, b'Missing tile'
        elif self.path.endswith('.prbm'):
            body = gzip.compress(b'actual-binary-tile')
            content_type, encoding = 'application/octet-stream', 'gzip'
        elif self.path == '/assets/redirect.js':
            status, body = 302, b''
        else: body = b'{}'
        self.send_response(status)
        self.send_header('Content-Type', content_type)
        self.send_header('Content-Length', str(len(body)))
        if encoding: self.send_header('Content-Encoding', encoding)
        self.end_headers()
        self.wfile.write(body)


class ProxyTests(unittest.TestCase):
    def setUp(self):
        self.upstream = http.server.ThreadingHTTPServer(('127.0.0.1', 0), Upstream)
        self.upstream.calls = []
        self.proxy = MapServer(('127.0.0.1', 0), upstream=('127.0.0.1', self.upstream.server_port))
        for server in (self.upstream, self.proxy):
            threading.Thread(target=server.serve_forever, daemon=True).start()

    def tearDown(self):
        for server in (self.proxy, self.upstream):
            server.shutdown()
            server.server_close()

    def request(self, path, method='GET'):
        with contextlib.closing(http.client.HTTPConnection('127.0.0.1', self.proxy.server_port, timeout=5)) as client:
            client.request(method, path)
            response = client.getresponse()
            return response.status, dict(response.getheaders()), response.read()

    def test_settings_expose_three_dimensions_and_local_data_roots(self):
        status, headers, raw = self.request('/settings.json')
        body = json.loads(raw)
        self.assertEqual(status, 200)
        self.assertEqual(body['maps'], ['world', 'world_the_nether', 'world_the_end'])
        self.assertEqual(body['mapDataRoot'], 'maps')
        self.assertEqual(body['liveDataRoot'], 'maps')
        self.assertEqual(body['scripts'], ['/website-bridge.js'])
        self.assertEqual(body['styles'], [])
        self.assertFalse(body['useCookies'])
        self.assertFalse(body['clientDecompression'])

    def test_compressed_map_geometry_is_preserved(self):
        status, headers, body = self.request('/maps/world/tiles/0/x-9/z6.prbm')
        self.assertEqual(status, 200)
        self.assertEqual(headers['Content-Encoding'], 'gzip')
        self.assertEqual(gzip.decompress(body), b'actual-binary-tile')

    def test_absent_tile_is_empty_terrain(self):
        status, headers, body = self.request('/maps/world/tiles/0/x999/z0.prbm')
        self.assertEqual(status, 204)
        self.assertEqual(body, b'')
        self.assertNotIn('Content-Length', headers)

    def test_live_players_and_heads_are_forwarded_in_all_dimensions(self):
        for map_id in ('world', 'world_the_nether', 'world_the_end'):
            status, headers, body = self.request(f'/maps/{map_id}/live/players.json')
            self.assertEqual(status, 200)
            self.assertEqual(json.loads(body)['players'][0]['name'], 'TestPlayer')
            self.assertEqual(headers['Cache-Control'], 'no-store')
            status, headers, body = self.request(f'/maps/{map_id}/assets/playerheads/657c020d-828c-420e-aebc-0ee37b11224c.png')
            self.assertEqual((status, headers['Content-Type'], body), (200, 'image/png', b'head-png-fixture'))

    def test_stream_forwards_live_players_markers_and_tiles(self):
        for map_id in ('world', 'world_the_nether', 'world_the_end'):
            status, headers, body = self.request(f'/maps/{map_id}/live/sse')
            self.assertEqual(status, 200)
            for event in (b'event: tile', b'event: player', b'event: marker', b'private-name', b'12345'):
                self.assertIn(event, body)
            self.assertNotIn(b'private-field', body)

    def test_health_is_live_and_allows_only_website_cors(self):
        client = http.client.HTTPConnection('127.0.0.1', self.proxy.server_port, timeout=5)
        try:
            client.request('GET', '/health.json', headers={'Origin': 'https://williamkearns.org'})
            response = client.getresponse()
            self.assertEqual(response.getheader('Access-Control-Allow-Origin'), 'https://williamkearns.org')
            self.assertTrue(json.loads(response.read())['ready'])
        finally: client.close()
        self.assertNotIn('Access-Control-Allow-Origin', self.request('/health.json')[1])

    def test_unknown_worlds_admin_files_and_traversal_are_denied(self):
        for path in ('/admin', '/server.properties', '/server.jar', '/sql.php', '/maps/secret_dimension/settings.json',
                     '/maps/world/live/commands', '/maps/world/assets/playerheads/user.png', '/assets/../settings.json',
                     '/assets/%2e%2e/server.properties', '//evil.example/index.html', 'https://evil.example/index.html',
                     '/assets/index.js.map'):
            with self.subTest(path=path):
                self.assertEqual(self.request(path)[0], 404)
        self.assertEqual(self.upstream.calls, [])

    def test_mutating_methods_are_never_proxied(self):
        for method in ('POST', 'PUT', 'PATCH', 'DELETE', 'CONNECT', 'TRACE', 'OPTIONS'):
            with self.subTest(method=method): self.assertEqual(self.request('/settings.json', method)[0], 405)
        self.assertEqual(self.upstream.calls, [])

    def test_only_website_may_embed_production_map(self):
        _, headers, _ = self.request('/settings.json')
        self.assertEqual(headers['Content-Security-Policy'], 'frame-ancestors https://williamkearns.org')
        self.assertEqual(headers['Referrer-Policy'], 'no-referrer')
        self.assertEqual(headers['X-Content-Type-Options'], 'nosniff')

    def test_upstream_redirect_cannot_escape_the_fixed_proxy(self):
        self.assertEqual(self.request('/assets/redirect.js')[0], 503)

    def test_unavailable_upstream_returns_503(self):
        with socket.socket() as reservation:
            reservation.bind(('127.0.0.1', 0))
            self.proxy.upstream = reservation.getsockname()
            status, _, body = self.request('/settings.json')
        self.assertEqual(status, 503)
        self.assertIn(b'Map unavailable', body)

    def test_no_access_logs(self):
        stream = io.StringIO()
        with contextlib.redirect_stderr(stream), contextlib.redirect_stdout(stream): self.request('/settings.json')
        self.assertEqual(stream.getvalue(), '')


class EventsTests(unittest.TestCase):
    def test_only_valid_tile_coordinates_are_emitted(self):
        self.assertIn(b'Alice', live_event([b'event: player\n', b'data: {"name":"Alice"}\n']))
        self.assertIsNone(live_event([b'event: command\n', b'data: {"name":"Alice"}\n']))
        self.assertIsNone(live_event([b'event: tile\n', b'data: invalid\n']))
        self.assertIsNone(live_event([b'event: tile\n', b'data: {"lod":0,"x":1.5,"y":2}\n']))
        self.assertIsNone(live_event([b'event: tile\n', b'data: {"lod":0,"x":true,"y":2}\n']))
        self.assertIsNone(live_event([b'event: tile\n', b'data: {"lod":99,"x":1,"y":2}\n']))
        self.assertEqual(live_event([b'event: tile\n', b'data: {"lod":0,"x":1,"y":2,"name":"private"}\n']),
                         b'event: tile\ndata: {"lod":0,"x":1,"y":2}\n\n')


if __name__ == '__main__': unittest.main(verbosity=2)
