from typing import List, Optional

from fastapi import APIRouter, Header, HTTPException

from app.models.schemas import QuizAttempt, QuizQuestion, QuizSubmission
from app.services import quiz as quiz_service

router = APIRouter(prefix="/quiz", tags=["quiz"])


@router.get("/questions", response_model=List[QuizQuestion])
async def get_questions(
    count: int = 5,
    topic: str = "orchid care basics",
    difficulty: str = "mixed",
):
    try:
        return await quiz_service.generate_questions(count=count, topic=topic, difficulty=difficulty)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.get("/history", response_model=List[QuizAttempt])
async def get_history(authorization: Optional[str] = Header(default=None)):
    return quiz_service.get_history(authorization)


@router.post("/submit", response_model=QuizAttempt)
async def submit_quiz(payload: QuizSubmission, authorization: Optional[str] = Header(default=None)):
    if payload.total <= 0:
        raise HTTPException(status_code=400, detail="total must be greater than 0")
    if payload.score < 0 or payload.score > payload.total:
        raise HTTPException(status_code=400, detail="score must be between 0 and total")

    return quiz_service.save_attempt(
        score=payload.score,
        total=payload.total,
        authorization=authorization,
    )
