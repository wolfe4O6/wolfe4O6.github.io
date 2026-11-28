# Live Minecraft map

The website stays at https://williamkearns.org/minecraft/. It uses a saved map until the HTTPS feed is available, then switches automatically to live terrain, player locations, and head images. Nether and End become viewable as BlueMap renders those dimensions.

## Install on omarchy

Run as william in a normal terminal:

```sh
curl -fsSL https://williamkearns.org/minecraft/setup.sh -o /tmp/minecraft-map-setup.sh && bash /tmp/minecraft-map-setup.sh
```

The installer uses Python, curl, Tailscale, and systemd already on this machine; no additional Python packages or Minecraft mods are needed. It may request your sudo password for the specific Tailscale Funnel command. It installs a `minecraft-map.service` user service, enables autostart, and publishes only `https://omarchy.tail715766.ts.net:8443/`. It refuses a conflicting service on ports 8180 or 8443, backs up existing map files, and checks that every unrelated Tailscale setting stayed unchanged. The existing private service on 443 is preserved.

It does not modify Minecraft files, authentication, whitelist, console access, DNS, or the homepage. Minecraft is not restarted. Only GET/HEAD requests for the three known BlueMap dimensions and their map assets are proxied. The public feed includes online players' usernames, head images, and in-game coordinates, respecting BlueMap's existing vanish/invisibility settings. Request URLs and player data are not logged by this proxy.

After installation, refresh the website or wait up to 30 seconds. A green “Live” indicator confirms the feed is connected. Join Minecraft to see your player marker. No one was online during the real upstream check, so the moving-player path was tested with a fixture; an actual head PNG and actual terrain were successfully served.

## Status and stopping

```sh
systemctl --user status minecraft-map.service
journalctl --user -u minecraft-map.service -n 30 --no-pager
curl --fail https://omarchy.tail715766.ts.net:8443/health.json
tailscale serve status
```

To stop public map access, disable only its port (prefix with `sudo` if Tailscale reports access denied), then stop its service:

```sh
tailscale funnel --https=8443 off
systemctl --user disable --now minecraft-map.service
```

The website falls back to its saved map automatically. Do not use `tailscale serve reset`, `tailscale funnel reset`, or enable Funnel on 443: that port has a separate private application.

## Validation

- 13 proxy tests: player JSON and head images across all three dimensions, SSE player/marker/tile events, gzip terrain, missing tiles, origin restrictions, blocked admin routes and write methods, and unavailable upstream.
- 2 installer tests using a temporary home and fake host commands: install/reinstall preserves private 443; conflicting 8443 aborts before installation.
- Real BlueMap: health, three dimension settings, a PNG head, gzip terrain, and the online-player endpoint all returned successfully.
- Browser: live terrain, dimension controls, top-down mode, and saved-map fallback after disconnect were checked in the local preview.
- The installer was attempted from this chat and stopped at its first preflight because the host's systemd user bus is inaccessible from this sandbox. No host service or Funnel configuration was changed by that attempt.

Run tests with `python3 test_map_proxy.py` and `python3 test_installer.py`.

References: [Tailscale Funnel CLI](https://tailscale.com/docs/reference/tailscale-cli/funnel), [BlueMap reverse proxy](https://bluemap.bluecolored.de/wiki/webserver/ReverseProxy.html).
