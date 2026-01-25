## Orchid Insights Unified Frontend

React + Vite + Tailwind dashboard covering:
- Growth Tracker (calls `/api/growth/analyze`)
- Disease Detector (uploads to `/api/disease/predict`)
- Plant Database + Firebase Table (via `/api/env/*`)
- Env Monitor snapshot (Chart.js sample; swap with live data)

### Setup
```
cd frontend
npm install
```

Create `.env` if you need a different backend origin:
```
VITE_API_URL=http://localhost:8000
```

### Run
```
npm run dev
```
Open the printed URL (default http://localhost:5173). The app expects the FastAPI backend running with the same API prefix (`/api`).
