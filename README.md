# Marine Sentinel

**AI-Powered Oil Spill Detection & Vessel Attribution System**
Hackathon prototype dashboard for satellite-based oil spill detection, drift/hindcasting analysis, and AI-assisted vessel attribution.

> This is a functional **prototype**. It does not connect to a real satellite feed, real AIS feed, or a trained ML model — all data is realistic dummy JSON served from the Flask backend so the full product experience can be demonstrated end-to-end.

## Technology Stack

- **Backend:** Python, Flask
- **Frontend:** HTML5, CSS3, Vanilla JavaScript (Fetch API)
- **Map:** Leaflet + OpenStreetMap tiles
- **Charts:** Chart.js
- **Data:** Static JSON (`data/cases.json`), no database

## Project Structure

```
marine-sentinel/
├── app.py                     # Flask app + API routes
├── requirements.txt
├── data/
│   └── cases.json             # Dummy case, vessel, and drift data
├── templates/
│   └── index.html             # Main dashboard page
├── static/
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   └── images/
│       ├── satellite-spill-1.jpg
│       ├── satellite-spill-2.jpg
│       └── satellite-spill-3.jpg
└── README.md
```

## API Endpoints

| Method | Route | Description |
|---|---|---|
| GET | `/` | Renders the dashboard |
| GET | `/api/cases` | List of all cases (for the case switcher) |
| GET | `/api/case/<case_id>` | Full case detail, satellite metadata, geometry, drift, charts |
| GET | `/api/case/<case_id>/vessels` | Nearby vessel list with AIS-style fields |
| GET | `/api/case/<case_id>/suspects` | Ranked suspect list + top-suspect attribution factors |
| GET | `/api/case/<case_id>/statistics` | Dashboard statistic card values |

Dummy cases available: `OS-2026-001` (Arabian Sea), `OS-2026-002` (Bay of Bengal), `OS-2026-003` (Indian Ocean).

## Installation

1. **Create and activate a virtual environment**

   ```bash
   python -m venv venv

   # macOS / Linux
   source venv/bin/activate

   # Windows
   venv\Scripts\activate
   ```

2. **Install dependencies**

   ```bash
   pip install -r requirements.txt
   ```

3. **Run the application**

   ```bash
   python app.py
   ```

4. **Open the dashboard**

   Visit [http://127.0.0.1:5000](http://127.0.0.1:5000) in your browser.

## Notes for Judges / Reviewers

- Switching cases in the top case switcher triggers real `fetch()` calls to the Flask API and re-renders statistics, satellite imagery, the map, case details, vessel table, and charts.
- The oil spill map is Leaflet-based, auto-fits to the investigation area (spill, origin zone, vessels), and layers the spill polygon, centroid, estimated origin zone, backward hindcasting path, forward forecast path, and vessel markers/trajectories with a color-coded suspicion legend.
- Vessel attribution scores and supporting factors are computed server-side in `app.py` from the vessel dataset — swap in a real ML pipeline and real AIS/SAR ingestion without changing the frontend contract.
