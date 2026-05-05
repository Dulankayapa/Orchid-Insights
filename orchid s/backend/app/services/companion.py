from typing import Dict, List

import httpx

from app.core.config import get_settings
from app.models.schemas import CompanionChatMessage

OPENAI_RESPONSES_URL = "https://api.openai.com/v1/responses"

_canned_responses = [
    {
        "keywords": ("water", "watering", "thirst"),
        "text": (
            "Water most orchids when the potting mix is close to dry, not on a fixed daily schedule. "
            "Roots often look silvery before watering and greener afterward."
        ),
    },
    {
        "keywords": ("yellow", "leaf", "leaves"),
        "text": (
            "A yellow leaf can mean normal aging, overwatering, or stress. "
            "Check whether only the oldest leaf is affected and whether the potting mix stays wet too long."
        ),
    },
    {
        "keywords": ("light", "sun", "window"),
        "text": (
            "Most common house orchids prefer bright, indirect light. "
            "Filtered south light or an east-facing window usually works better than harsh afternoon sun."
        ),
    },
    {
        "keywords": ("root", "roots"),
        "text": (
            "Healthy orchid roots are usually firm. "
            "Green roots are hydrated, silvery roots often want water, and mushy brown roots can suggest rot."
        ),
    },
]

_default_reply = (
    "I can help with watering, light, roots, leaves, repotting, and basic orchid care planning. "
    "Ask a short orchid-care question and I will give you a practical starting point."
)


def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=30)


def _extract_output_text(payload: Dict[str, object]) -> str:
    for item in payload.get("output", []):
        if item.get("type") != "message":
            continue

        for content_item in item.get("content", []):
            if content_item.get("type") == "output_text" and content_item.get("text"):
                return content_item["text"]

    raise ValueError("OpenAI response did not contain output_text content.")


def fallback_reply(messages: List[CompanionChatMessage]) -> str:
    latest_user_message = next(
        (message.text for message in reversed(messages) if message.role == "user" and message.text.strip()),
        "",
    )
    lowered = latest_user_message.lower()

    for item in _canned_responses:
        if any(keyword in lowered for keyword in item["keywords"]):
            return item["text"]

    return _default_reply


def _build_input_items(messages: List[CompanionChatMessage]) -> List[Dict[str, object]]:
    input_items: List[Dict[str, object]] = []

    for message in messages[-10:]:
        text = message.text.strip()
        if not text:
            continue

        role = "assistant" if message.role == "assistant" else "user"
        input_items.append(
            {
                "type": "message",
                "role": role,
                "content": [{"type": "input_text", "text": text}],
            }
        )

    return input_items


async def generate_reply(messages: List[CompanionChatMessage]) -> str:
    settings = get_settings()
    api_key = settings.openai_api_key

    input_items = _build_input_items(messages)
    if not input_items:
        raise ValueError("At least one chat message is required.")

    if not api_key:
        return fallback_reply(messages)

    try:
        async with _client() as client:
            response = await client.post(
                OPENAI_RESPONSES_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": settings.openai_chat_model,
                    "store": False,
                    "instructions": (
                        "You are Orchid Care Chat, a concise and practical orchid-care assistant. "
                        "Give helpful beginner-friendly advice about watering, light, roots, repotting, humidity, "
                        "temperature, and common care issues. Be careful with uncertainty, avoid pretending to diagnose "
                        "serious disease from limited text alone, and suggest observation steps when useful. "
                        "Keep replies short, clear, and actionable."
                    ),
                    "input": input_items,
                },
            )
            response.raise_for_status()
            payload = response.json()

        return _extract_output_text(payload).strip()
    except Exception:
        return fallback_reply(messages)
