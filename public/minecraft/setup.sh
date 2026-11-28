#!/usr/bin/env bash
# Minecraft map setup for omarchy. Run as william, without sudo on this script.
set -euo pipefail
umask 077
if (( EUID == 0 )); then echo 'Run this as william, without sudo before bash.' >&2; exit 1; fi
for command_name in python3 systemctl tailscale curl flock; do
  command -v "$command_name" >/dev/null || { echo "Required command missing: $command_name" >&2; exit 1; }
done
systemctl --user show-environment >/dev/null || {
  echo 'Run this command in a normal terminal on omarchy; the user service manager is unavailable here.' >&2
  exit 1
}
map_dir="$HOME/.local/share/minecraft-map"
unit_dir="$HOME/.config/systemd/user"
map_root="$HOME/minecraft-server/bluemap/web/maps"
mkdir -p "$map_dir"
exec 9>"$map_dir/install.lock"
flock -n 9 || { echo 'Map setup is already running.' >&2; exit 1; }
setup_tmp=$(mktemp -d)
trap 'rm -rf "$setup_tmp"' EXIT

tailscale status --json >"$setup_tmp/tailscale.json"
tailscale serve status --json >"$setup_tmp/before.json"
python3 - "$setup_tmp" <<'CHECK'
import json, sys
from pathlib import Path
p=Path(sys.argv[1]); status=json.loads((p/'tailscale.json').read_text()); before=json.loads((p/'before.json').read_text())
assert status.get('BackendState') == 'Running', 'Tailscale must be connected.'
assert status['Self']['DNSName'].rstrip('.') == 'omarchy.tail715766.ts.net', 'Run this on omarchy.'
assert '100.93.108.20' in status['Self']['TailscaleIPs'], 'Unexpected BlueMap host address.'
endpoint='omarchy.tail715766.ts.net:8443'
if '8443' in before.get('TCP', {}) or endpoint in before.get('Web', {}):
    assert before.get('TCP', {}).get('8443') == {'HTTPS':True}, 'Port 8443 already has a different service.'
    assert before.get('Web', {}).get(endpoint) == {'Handlers':{'/':{'Proxy':'http://127.0.0.1:8180'}}}, 'Port 8443 already has a different service.'
CHECK
curl --noproxy '*' --fail --silent --show-error --max-time 10 http://100.93.108.20:8100/settings.json >"$setup_tmp/settings.json"
python3 - "$setup_tmp/settings.json" "$map_root" <<'CHECK'
import json, sys
from pathlib import Path
assert 'world' in json.loads(Path(sys.argv[1]).read_text()).get('maps', []), 'BlueMap is not serving the expected world.'
assert Path(sys.argv[2]).is_dir(), 'BlueMap map folder is missing.'
CHECK
if [[ -e "$unit_dir/minecraft-map.service" ]] && ! grep -q '^# Managed by minecraft-map setup v1$' "$unit_dir/minecraft-map.service"; then
  echo 'minecraft-map.service already exists and was not created by this installer.' >&2; exit 1
fi
# Refuse to replace an unrelated listener on the loopback port.
if ! systemctl --user is-active --quiet minecraft-map.service; then
  python3 - <<'CHECK'
import socket
with socket.socket() as s:
    s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    try: s.bind(('127.0.0.1', 8180))
    except OSError: raise SystemExit('Port 8180 is already in use. No changes made to that listener.')
CHECK
fi
mkdir -p "$unit_dir"
backup_dir="$map_dir/backups/$(date +%Y%m%d-%H%M%S)-$$"
mkdir -p "$backup_dir"
cp "$setup_tmp/before.json" "$backup_dir/tailscale-before.json"
[[ ! -f "$map_dir/map_proxy.py" ]] || cp "$map_dir/map_proxy.py" "$backup_dir/map_proxy.py"
[[ ! -f "$unit_dir/minecraft-map.service" ]] || cp "$unit_dir/minecraft-map.service" "$backup_dir/minecraft-map.service"
cat >"$setup_tmp/map_proxy.py" <<'MAP_PROXY_PY'
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

MAP_PROXY_PY
python3 - "$setup_tmp/map_proxy.py" <<'CHECK'
import ast, sys
from pathlib import Path
ast.parse(Path(sys.argv[1]).read_text())
CHECK
install -m 600 "$setup_tmp/map_proxy.py" "$map_dir/map_proxy.py"
cat >"$unit_dir/minecraft-map.service" <<'SERVICE'
# Managed by minecraft-map setup v1
[Unit]
Description=Read-only live Minecraft map
After=network-online.target

[Service]
Type=simple
ExecStart=/usr/bin/python3 -B "%h/.local/share/minecraft-map/map_proxy.py" --map-root "%h/minecraft-server/bluemap/web/maps"
Restart=on-failure
RestartSec=5
NoNewPrivileges=true
LockPersonality=true
RestrictSUIDSGID=true
RestrictRealtime=true
UMask=0077
TasksMax=64
MemoryMax=256M
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=default.target
SERVICE
systemctl --user daemon-reload
systemctl --user enable minecraft-map.service
systemctl --user restart minecraft-map.service
ready=false
for attempt in {1..20}; do
  if curl --noproxy '*' --fail --silent --max-time 3 http://127.0.0.1:8180/health.json >"$setup_tmp/health.json"; then ready=true; break; fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  echo 'Map proxy did not start. Details:' >&2
  journalctl --user -u minecraft-map.service -n 15 --no-pager >&2
  exit 1
fi
python3 - "$setup_tmp/health.json" <<'CHECK'
import json, sys
from pathlib import Path
assert json.loads(Path(sys.argv[1]).read_text()).get('ready') is True, 'Map proxy is not ready.'
CHECK
# Keep the user service running after logout and reboot, like the Minecraft service.
if [[ "$(loginctl show-user "$(id -un)" -p Linger --value)" != yes ]]; then
  sudo loginctl enable-linger "$(id -un)"
fi
# Only publish the dedicated map port. Never reset Serve or touch port 443.
if tailscale funnel --bg --https=8443 http://127.0.0.1:8180 >"$setup_tmp/funnel.txt" 2>&1; then
  cat "$setup_tmp/funnel.txt"
else
  cat "$setup_tmp/funnel.txt" >&2
  if grep -Eqi 'access denied|permission denied|sudo tailscale' "$setup_tmp/funnel.txt"; then
    sudo tailscale funnel --bg --https=8443 http://127.0.0.1:8180
  else
    echo 'Funnel setup failed; the saved map is still available on the website.' >&2; exit 1
  fi
fi
tailscale serve status --json >"$setup_tmp/after.json"
if ! python3 - "$setup_tmp/before.json" "$setup_tmp/after.json" <<'CHECK'
import json, sys
from pathlib import Path
before, after=(json.loads(Path(p).read_text()) for p in sys.argv[1:])
endpoint='omarchy.tail715766.ts.net:8443'
assert after.get('TCP', {}).get('8443') == {'HTTPS':True}, 'HTTPS 8443 is not configured.'
assert after.get('Web', {}).get(endpoint) == {'Handlers':{'/':{'Proxy':'http://127.0.0.1:8180'}}}, 'Unexpected map proxy.'
assert after.get('AllowFunnel', {}).get(endpoint) is True, 'Public Funnel is not enabled for the map.'
# Ignore only the exact entries this installer owns; everything else must match.
for config in (before, after):
    for section, key in (('TCP', '8443'), ('Web', endpoint), ('AllowFunnel', endpoint)):
        values=config.get(section, {})
        values.pop(key, None)
        if not values: config.pop(section, None)
assert before == after, 'An unrelated Tailscale setting changed. Inspect tailscale serve status.'
CHECK
then
  echo 'Safety check failed. Disabling only the map endpoint on 8443.' >&2
  tailscale funnel --https=8443 off || sudo tailscale funnel --https=8443 off
  exit 1
fi
public_ready=false
for attempt in {1..12}; do
  if curl --noproxy '*' --fail --silent --max-time 5 https://omarchy.tail715766.ts.net:8443/health.json >"$setup_tmp/public.json"; then
    if python3 - "$setup_tmp/public.json" <<'CHECK'
import json, sys
from pathlib import Path
assert json.loads(Path(sys.argv[1]).read_text()).get('ready') is True
CHECK
    then public_ready=true; break; fi
  fi
  sleep 2
done
if [[ "$public_ready" != true ]]; then
  echo 'Service installed and Funnel configured, but the HTTPS health check has not succeeded yet.' >&2
  echo 'Check: curl --fail https://omarchy.tail715766.ts.net:8443/health.json' >&2
  exit 1
fi
printf '\nLive map installed. Open https://williamkearns.org/minecraft/\n'
printf 'The page checks for the live feed every 30 seconds. Players appear while online.\n'
printf 'Minecraft was not restarted. Port 443 was preserved.\n'
printf 'Backups: %s\n' "$backup_dir"
