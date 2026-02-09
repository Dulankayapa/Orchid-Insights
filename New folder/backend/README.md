## Orchid Insights Unified Backend

FastAPI service combining:
- Growth tracker ML (RandomForest) `/api/growth/analyze`
- Leaf disease detector (PlantVillage MobileNetV3) `/api/disease/predict`
- Firebase bridge for plant/env rows `/api/env/*`
- Service health `/api/health`

### Setup
```
cd backend
python -m venv .venv
.venv\Scripts\activate  # Windows
pip install -r requirements.txt
```

Place model assets (or set env vars):
- Growth: drop into `backend/models/growth/` (or set `GROWTH_MODEL_PATH`/`GROWTH_METADATA_PATH`):
  - `orchid_growth_rf_model.joblib`
  - `orchid_growth_metadata.joblib`
  - optional dataset: `orchid_growth_agar_biweekly_weekly_2025-10-21.xlsx`
- Disease: drop into `backend/models/disease/` (or set `DISEASE_WEIGHTS_PATH`):
  - `plant_village.pth`

### Config (.env)
```
API_PREFIX=/api
CORS_ORIGINS=*
FIREBASE_DB_URL=https://orchid-enviromental-monitor-d-default-rtdb.firebaseio.com
GROWTH_MODEL_PATH=
GROWTH_METADATA_PATH=
GROWTH_DATASET_PATH=
DISEASE_WEIGHTS_PATH=
```

### Run
```
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Endpoints (default prefix `/api`)
- `GET /api/health`
- `POST /api/growth/analyze`
- `POST /api/disease/predict` (multipart file)
- `GET /api/env/plants`
- `PUT /api/env/plants/{id}`
- `DELETE /api/env/plants/{id}`
