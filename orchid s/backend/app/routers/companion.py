from datetime import datetime
import uuid
from typing import List

from fastapi import APIRouter, HTTPException

from app.models.schemas import (
    CompanionChatRequest,
    CompanionChatResponse,
    CompanionGuideResponse,
    Orchid,
    Reminder,
    EducationalResource,
    GrowthStageAdvice,
    HealthScoreResponse,
    NextWateringResponse,
    Feedback,
)
from app.services import companion as companion_service
from app.services import ml_predictions
from app.services import mock_db
from app.services.device_status import require_online

router = APIRouter(prefix="/companion", tags=["companion"])


@router.get("/care-guide", response_model=CompanionGuideResponse)
async def care_guide():
    try:
        return companion_service.get_care_guide()
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/quick-questions")
async def quick_questions():
    try:
        return {"questions": companion_service.get_quick_questions()}
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/chat", response_model=CompanionChatResponse)
async def companion_chat(payload: CompanionChatRequest):
    try:
        return companion_service.generate_chat_response(payload)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc


# ---------- New endpoints ----------
@router.get("/orchids", response_model=List[Orchid])
async def get_orchids(user_id: str = "default"):
    return mock_db.get_orchids(user_id)


@router.get("/health-score/{orchid_id}", response_model=HealthScoreResponse | dict)
async def health_score(orchid_id: str, temp: float, humidity: float, light: float, device_id: str = "orchid-node-1"):
    ok, status = require_online(device_id)
    if not ok:
        return status
    orchid = next((o for o in mock_db.get_orchids() if o.orchid_id == orchid_id), None)
    if not orchid:
        raise HTTPException(status_code=404, detail="Orchid not found")
    score, breakdown = ml_predictions.predict_health_score(temp, humidity, light, orchid.species, orchid.growth_stage)
    forecast = [max(0, score - i * 2) for i in range(3)]
    anomaly = ml_predictions.detect_anomaly([{"temperature": temp, "humidity": humidity}])
    return HealthScoreResponse(score=score, breakdown=breakdown, forecast=forecast, anomaly_detected=anomaly)


@router.get("/next-watering/{orchid_id}", response_model=NextWateringResponse | dict)
async def next_watering(orchid_id: str, temp: float, humidity: float, light_level: str, device_id: str = "orchid-node-1"):
    ok, status = require_online(device_id)
    if not ok:
        return status
    orchid = next((o for o in mock_db.get_orchids() if o.orchid_id == orchid_id), None)
    if not orchid:
        raise HTTPException(status_code=404, detail="Orchid not found")
    sensor_history = [{"temperature": temp, "humidity": humidity, "light_level": light_level}]
    date_str, conf, reason = ml_predictions.predict_next_watering(orchid.dict(), sensor_history)
    return NextWateringResponse(recommended_date=date_str, confidence=conf, reason=reason)


@router.get("/reminders/{orchid_id}", response_model=List[Reminder])
async def get_reminders(orchid_id: str):
    return mock_db.get_reminders(orchid_id)


@router.post("/reminders")
async def create_reminder(reminder: Reminder):
    reminder.reminder_id = str(uuid.uuid4())
    mock_db.add_reminder(reminder)
    return {"status": "created", "id": reminder.reminder_id}


@router.put("/reminders/{reminder_id}/status")
async def update_reminder_status(reminder_id: str, status: str):
    mock_db.update_reminder_status(reminder_id, status)
    return {"status": "updated"}


@router.get("/resources", response_model=List[EducationalResource])
async def get_resources(species: str, growth_stage: str):
    return mock_db.get_resources(species, growth_stage)


@router.get("/growth-advice/{growth_stage}", response_model=List[GrowthStageAdvice])
async def growth_advice(growth_stage: str):
    return mock_db.get_growth_advice(growth_stage)


@router.post("/feedback")
async def log_feedback(feedback: Feedback):
    feedback.feedback_id = str(uuid.uuid4())
    feedback.timestamp = datetime.now()
    mock_db.store_feedback(feedback)
    return {"status": "logged"}
