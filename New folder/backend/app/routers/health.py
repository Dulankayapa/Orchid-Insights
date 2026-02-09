from datetime import datetime

from fastapi import APIRouter

from app.models.schemas import HealthResponse
from app.services import disease, env, growth

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def healthcheck():
    growth_ok = False
    disease_ok = False
    firebase_ok = False

    try:
        growth.load_model()
        growth_ok = True
    except Exception:
        growth_ok = False

    try:
        disease.get_model()
        disease_ok = True
    except Exception:
        disease_ok = False

    try:
        plants = await env.list_plants()
        firebase_ok = plants is not None
    except Exception:
        firebase_ok = False

    return HealthResponse(
        status="ok" if (growth_ok or disease_ok) else "degraded",
        model_loaded=growth_ok,
        disease_model_loaded=disease_ok,
        firebase_connected=firebase_ok,
        timestamp=datetime.utcnow(),
    )
