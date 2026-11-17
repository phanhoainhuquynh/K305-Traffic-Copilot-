# K305 Traffic Copilot

A local research prototype for exploring object tracks at the K305 intersection. It replays tracked vehicles, cyclists, and pedestrians; answers questions about selected IDs; checks configured lane geometry; and forecasts short-term movement along a matching route.

> This is an exploratory visualization, not a traffic-control or safety system. Source coordinates and units are assumed, and forecasts are not calibrated probabilities.

## Features

- Replay timestamped object tracks with class, speed, heading, trails, and search across IDs.
- Ask questions about an object or scene using a local rule-based assistant. An optional OpenAI Responses API integration supports more flexible questions.
- Forecast 3–5 seconds ahead. If a moving object matches a route by position and heading, the forecast follows that route; otherwise it extrapolates constant velocity.
- Draw and save route centerlines and lane polygons in sensor coordinates.
- Overlay objects and routes on Google Maps Hybrid after configuring a restricted Maps JavaScript API key. Set the sensor origin and X-axis rotation in the map controls.
- Switch the interface and local assistant between Vietnamese, English, and German.

## Quick start

Requirements: Python 3.10 or newer. The app uses the Python standard library and has no package installation step.

```powershell
python server.py
```

Open <http://127.0.0.1:8766/>. On Windows, `start.cmd` launches the app in the background and opens the browser.

When the original K305 JSON dataset is present at `../k305_object_list_2026-06-16_07-00_to_07-04.json`, the server uses it. A fresh clone falls back to the small **synthetic demo dataset** in `demo_data.json`; no research data is included in this repository. To use another compatible dataset:

```powershell
python server.py --data "C:\path\to\object_tracks.json" --port 8766
```

## Google Maps setup (optional)

The app defaults to an X/Y coordinate view. To show Google Maps in the dashboard, create a Google Maps Platform key, enable Maps JavaScript API and billing, and restrict the key to that API and local HTTP referrers such as `http://127.0.0.1:8766/*` and `http://localhost:8766/*`.

Set the key in the same PowerShell session used to start the server:

```powershell
$env:GOOGLE_MAPS_API_KEY = 'YOUR_RESTRICTED_KEY'
python server.py --port 8766
```

Keep keys out of source files and commits. The key is sent to the browser because the Maps JavaScript API runs there; use Google Cloud's API and referrer restrictions.

The dataset has no GPS transform. The map starts at the approximate K305 location. On the map, choose **Set X/Y origin** and click the point representing sensor coordinate `(0, 0)`, then adjust the `+X` angle until routes align. Coordinates are assumed to be metres. This is a visual registration aid, not a surveyed calibration.

## Optional OpenAI assistant

The local rule-based assistant works without an API key. For OpenAI-backed answers, set the key and a model available to your account before launching:

```powershell
$env:OPENAI_API_KEY = 'YOUR_API_KEY'
$env:OPENAI_MODEL = 'YOUR_ACCESSIBLE_MODEL_ID'
python server.py --port 8766
```

When enabled, the current question and relevant scene data are sent to OpenAI. The key remains on the server. Requests set `store: false`; this does not imply zero data retention.

## Data and configuration

- `demo_data.json` contains synthetic example tracks for fresh clones.
- `routes.example.json` contains approximate K305 route centerlines digitized from the provided annotated diagram. It is a starting point that should be checked against the map.
- User-saved routes and lane polygons are written to `routes.json` and `lanes.json`; these local files are git-ignored.
- The original 3,000-frame object list is intentionally kept outside this repository. Do not publish datasets unless you have permission to redistribute them.

## Forecasting and lane checks

The route matcher uses a maximum centerline distance of 4.5 m and a heading difference of 65°. It is a geometric heuristic; it does not infer turn intent or account for signals, acceleration, right-of-way, or interactions. The lane checker only reports a directional verdict after the lane geometry is marked verified. It does not establish legal compliance or collision risk.

Positions in the source file do not declare units. The application assumes metres and metres per second; verify these assumptions against the sensor documentation before drawing conclusions.

## Project structure

```text
server.py             Local HTTP API, replay, lane checks, forecasts, optional AI
localization.py       Local response formatting for three languages
static/               HTML, CSS, browser application, and translation catalog
demo_data.json        Synthetic runnable example data
routes.example.json   Approximate route presets for K305
start.cmd / start.ps1 Windows launcher
```

## API

- `GET /api/meta`
- `GET /api/frame?index=0&horizon=5`
- `GET /api/track?id=1001&index=0`
- `GET` and `POST /api/lanes`
- `GET` and `POST /api/routes`
- `POST /api/chat`

## License and source data

No license for the original sensor dataset is included. Add a license for the code and confirm dataset redistribution rights before making the repository public or sharing data files.
