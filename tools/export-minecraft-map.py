#!/usr/bin/env python3
"""Copy a public, static BlueMap render into GitHub Pages. Never copies world saves or players."""
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import shutil
import sys
import zipfile

root = Path(__file__).resolve().parents[1]
source = Path(sys.argv[1]) if len(sys.argv) > 1 else Path('/home/william/minecraft-server/bluemap/web')
target = root / 'public/minecraft/viewer'
target.mkdir(parents=True, exist_ok=True)
for name in ('assets', 'lang'):
    shutil.copytree(source / name, target / name, dirs_exist_ok=True, ignore=shutil.ignore_patterns('*.map'))
index = (source / 'index.html').read_text()
index = index.replace('<title>BlueMap</title>', '<title>Minecraft Map</title>')
index = index.replace('content="index,nofollow"', 'content="noindex,nofollow"')
(target / 'index.html').write_text(index)
settings = json.loads((source / 'settings.json').read_text())
maps = ['world', 'world_the_nether', 'world_the_end']
settings.update(maps=maps, useCookies=False, clientDecompression=True, mapDataRoot='maps', liveDataRoot='maps', scripts=[], styles=[])
(target / 'settings.json').write_text(json.dumps(settings, separators=(',', ':')) + '\n')
for file in (target / 'assets').glob('index-*.js'):
    script = file.read_text()
    if script.count('initEventSource(){') != 1:
        raise RuntimeError('BlueMap changed: review static-mode adaptation before exporting.')
    script = script.replace('initEventSource(){', 'initEventSource(){return;')
    script = re.sub(r'this\.(playerMarkerManager|markerFileManager)\.setAutoUpdateInterval\([^)]*\)', r'this.\1.setAutoUpdateInterval(0)', script)
    file.write_text(script)
summary = {}
for map_id in maps:
    destination = target / 'maps' / map_id
    if destination.exists(): shutil.rmtree(destination)
    shutil.copytree(source / 'maps' / map_id, destination,
        ignore=shutil.ignore_patterns('rstate', 'live', 'playerheads', '*.dat'))
    (destination / 'live').mkdir(exist_ok=True)
    (destination / 'live/players.json').write_text('{"players":[]}\n')
    (destination / 'live/markers.json').write_text('{}\n')
    tiles = list((destination / 'tiles').rglob('*.prbm.gz'))
    summary[map_id] = {'rendered': bool(tiles), 'tiles': len(tiles)}
jar = source.parents[1] / 'mods/bluemap-5.29-fabric.jar'
if jar.exists():
    with zipfile.ZipFile(jar) as archive:
        for name in ('META-INF/LICENSE', 'META-INF/LICENSE.txt'):
            if name in archive.namelist():
                (target / ('BLUEMAP-' + Path(name).name)).write_bytes(archive.read(name))
metadata = {'exportedAt': datetime.now(timezone.utc).isoformat(), 'maps': summary}
(root / 'src/data/minecraft-map.json').write_text(json.dumps(metadata, indent=2) + '\n')
print('Exported public map snapshot:', summary)
