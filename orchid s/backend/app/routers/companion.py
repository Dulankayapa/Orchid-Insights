from fastapi import APIRouter, HTTPException

from app.models.schemas import CompanionChatRequest, CompanionChatResponse, CompanionGuideResponse
from app.services import companion

router = APIRouter(prefix="/companion", tags=["companion"])


@router.get("/care-guide", response_model=CompanionGuideResponse)
async def care_guide():
    try:
        return companion.get_care_guide()
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/quick-questions")
async def quick_questions():
    try:
        return {"questions": companion.get_quick_questions()}
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.post("/chat", response_model=CompanionChatResponse)
async def companion_chat(payload: CompanionChatRequest):
    try:
        return companion.generate_chat_response(payload)
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc
