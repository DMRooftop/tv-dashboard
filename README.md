# tv-dashboard

TizenBrew app module "Zuhause": a home dashboard (clock, weather, ideas for today, app launcher) for older Samsung Tizen TVs (tested target: UE55MU6179, Tizen 3.0 / Chromium M47, strict ES5).

## Install
TizenBrew > Module Manager > Install from GitHub > `DMRooftop/tv-dashboard`.

## Data
The page loads `http://192.168.68.58:8123/local/tv/status.js` every 30 s via a `<script>` tag (JSONP-style, no CORS needed). The file calls `window.TV_STATUS_CB(<json>)` and is written by a Home Assistant automation (`write_status.py`). Change `TV_STATUS_URL` in `app/index.html` for your own setup.

## Apps
Tiles launch via `tizen.application.launch` using candidate app IDs in `app/tv.js`. Press blue/Info for a diagnostics list of installed app IDs. If the Tizen API is unavailable, tiles show a hint instead.

## License
MIT
