import hashlib
import json
import uuid
from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional

import httpx

from app.core.config import get_settings
from app.models.schemas import QuizAttempt, QuizQuestion

OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"
DEFAULT_QUESTION_COUNT = 5
MAX_HISTORY_PER_USER = 10

_quiz_history: Dict[str, List[QuizAttempt]] = defaultdict(list)
_fallback_question_pool = [
    {
        "id": "light-1",
        "question": "What kind of light do most common indoor orchids prefer?",
        "options": [
            "Bright, indirect light",
            "Full afternoon sun",
            "Complete shade",
            "Only artificial light",
        ],
        "correct": 0,
        "explanation": "Most common house orchids do best with bright, filtered light rather than direct afternoon sun.",
    },
    {
        "id": "water-1",
        "question": "A healthy orchid root that needs water often looks:",
        "options": ["Black and dry", "Silvery or pale", "Bright red", "Soft and mushy"],
        "correct": 1,
        "explanation": "Silvery roots often indicate the plant is ready for watering.",
    },
    {
        "id": "mix-1",
        "question": "Why are orchids usually planted in bark or chunky media instead of dense soil?",
        "options": [
            "To hold as much water as possible",
            "To improve airflow around the roots",
            "To make the pot heavier",
            "To keep the plant colder",
        ],
        "correct": 1,
        "explanation": "Orchid roots benefit from airflow and can rot in dense, soggy soil.",
    },
    {
        "id": "leaf-1",
        "question": "A single old lower leaf turning yellow is often:",
        "options": [
            "Always a deadly disease",
            "Normal aging",
            "A sign the orchid needs freezing temperatures",
            "Proof the plant needs no more water",
        ],
        "correct": 1,
        "explanation": "One older lower leaf yellowing can be part of normal leaf turnover.",
    },
    {
        "id": "water-2",
        "question": "What is the best general watering rule for many orchids?",
        "options": [
            "Water on a strict hourly schedule",
            "Keep the potting mix soggy at all times",
            "Water when the potting mix is close to dry",
            "Only water once per month no matter what",
        ],
        "correct": 2,
        "explanation": "Many orchids prefer a gentle wet-dry cycle rather than constant saturation.",
    },
    {
        "id": "temp-1",
        "question": "What can happen if an orchid sits in a cold draft overnight?",
        "options": [
            "It will always bloom faster",
            "It may become stressed or damaged",
            "Its roots will automatically dry out",
            "Nothing, orchids prefer sudden cold air",
        ],
        "correct": 1,
        "explanation": "Cold drafts can stress tropical orchids and damage leaves or buds.",
    },
]


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=30)


def _history_key(authorization: Optional[str]) -> str:
    if not authorization:
        return "anonymous"

    return hashlib.sha256(authorization.encode("utf-8")).hexdigest()


def _extract_output_text(payload: Dict[str, object]) -> str:
    for item in payload.get("output", []):
        if item.get("type") != "message":
            continue

        for content_item in item.get("content", []):
            if content_item.get("type") == "output_text" and content_item.get("text"):
                return content_item["text"]

    raise ValueError("OpenAI response did not contain output_text content.")


def _build_fallback_questions(count: int) -> List[QuizQuestion]:
    questions = _fallback_question_pool[:count]
    return [QuizQuestion(**question) for question in questions]


def _normalize_questions(items: List[dict], expected_count: int) -> List[QuizQuestion]:
    normalized: List[QuizQuestion] = []

    for item in items[:expected_count]:
        options = item.get("options") or []
        correct = item.get("correct")
        if len(options) != 4 or not isinstance(correct, int) or correct < 0 or correct > 3:
            continue

        normalized.append(
            QuizQuestion(
                id=item.get("id") or str(uuid.uuid4()),
                question=str(item.get("question", "")).strip(),
                options=[str(option).strip() for option in options],
                correct=correct,
                explanation=str(item.get("explanation", "")).strip() or None,
            )
        )

    if len(normalized) < expected_count:
        raise ValueError("OpenAI returned too few valid quiz questions.")

    return normalized


async def generate_questions(
    count: int = DEFAULT_QUESTION_COUNT,
    topic: str = "orchid care basics",
    difficulty: str = "mixed",
) -> List[QuizQuestion]:
    settings = get_settings()
    api_key = settings.openai_api_key

    if not api_key:
        return _build_fallback_questions(count)

    schema = {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "questions": {
                "type": "array",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "id": {"type": "string"},
                        "question": {"type": "string"},
                        "options": {
                            "type": "array",
                            "items": {"type": "string"},
                        },
                        "correct": {"type": "integer"},
                        "explanation": {"type": "string"},
                    },
                    "required": ["id", "question", "options", "correct", "explanation"],
                },
            }
        },
        "required": ["questions"],
    }

    prompt = (
        f"Create {count} unique multiple-choice quiz questions about {topic}. "
        f"Difficulty should be {difficulty}. "
        "Each question must have exactly 4 answer options, exactly 1 correct answer index from 0 to 3, "
        "and a short explanation. Keep the tone beginner-friendly, practical, and factually careful. "
        "Avoid repeating questions or options. Return JSON only."
    )

    try:
        async with _client() as client:
            response = await client.post(
                OPENAI_RESPONSES_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.openai_quiz_model,
                    "store": False,
                    "instructions": (
                        "You are an orchid care educator creating concise, accurate quiz content "
                        "for hobby growers and students."
                    ),
                    "input": prompt,
                    "text": {
                        "format": {
                            "type": "json_schema",
                            "name": "orchid_quiz_questions",
                            "strict": True,
                            "schema": schema,
                        }
                    },
                },
            )
            response.raise_for_status()
            payload = response.json()

        parsed = json.loads(_extract_output_text(payload))
        return _normalize_questions(parsed.get("questions") or [], count)
    except Exception:
        return _build_fallback_questions(count)


def save_attempt(score: int, total: int, authorization: Optional[str]) -> QuizAttempt:
    key = _history_key(authorization)
    attempt = QuizAttempt(
        id=str(uuid.uuid4()),
        score=score,
        total=total,
        completed_at=datetime.utcnow(),
    )
    _quiz_history[key] = [attempt, *_quiz_history[key]][:MAX_HISTORY_PER_USER]
    return attempt


def get_history(authorization: Optional[str]) -> List[QuizAttempt]:
    key = _history_key(authorization)
    return _quiz_history[key]
