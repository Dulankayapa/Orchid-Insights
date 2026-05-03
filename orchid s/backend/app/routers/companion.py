from fastapi import APIRouter, HTTPException

from app.models.schemas import CompanionChatRequest, CompanionChatResponse
from app.services import companion as companion_service

router = APIRouter(prefix="/companion", tags=["companion"])


@router.post("/chat", response_model=CompanionChatResponse)
async def chat(payload: CompanionChatRequest):
    try:
        reply = await companion_service.generate_reply(payload.messages)
        return CompanionChatResponse(reply=reply)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc
