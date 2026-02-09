from datetime import datetime

from fastapi import APIRouter, HTTPException

from app.models.schemas import GrowthRequest, GrowthResponse
from app.services import growth

router = APIRouter(prefix="/growth", tags=["growth"])


@router.post("/analyze", response_model=GrowthResponse)
def analyze_growth(payload: GrowthRequest):
    try:
        current_date = payload.current_date or datetime.today().strftime("%Y-%m-%d")
        result = growth.classify_growth(
            planting_date=payload.planting_date,
            current_date=current_date,
            height_mm=payload.current_height_mm,
            age_days_override=payload.age_days,
        )
        return result
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover - runtime safety
        raise HTTPException(status_code=500, detail=str(exc)) from exc
