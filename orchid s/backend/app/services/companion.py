from typing import List

from app.models.schemas import (
    CompanionChatRequest,
    CompanionChatResponse,
    CompanionGuideResponse,
    CompanionSection,
)

CARE_GUIDE_DATA = [
    {
        "id": 1,
        "title": "Watering Guide",
        "icon": "💧",
        "tips": [
            "Water once every 7-10 days.",
            "Use room-temperature water.",
            "Water in the morning and let excess drain fully.",
            "Reduce watering frequency in cooler months.",
        ],
        "warning": "Overwatering is the most common cause of orchid root damage.",
    },
    {
        "id": 2,
        "title": "Light Requirements",
        "icon": "☀️",
        "tips": [
            "Keep orchids in bright, indirect light.",
            "East-facing windows usually work best.",
            "Target 6-8 hours of filtered light daily.",
            "Avoid harsh direct afternoon sunlight.",
        ],
        "warning": "Too much direct sun can scorch leaves.",
    },
    {
        "id": 3,
        "title": "Temperature Control",
        "icon": "🌡️",
        "tips": [
            "Target daytime temperature around 18-28 C.",
            "Keep nights slightly cooler than daytime.",
            "Avoid sudden temperature shocks from vents or drafts.",
        ],
        "warning": "Extreme heat or cold can delay flowering.",
    },
    {
        "id": 4,
        "title": "Humidity Levels",
        "icon": "💨",
        "tips": [
            "Aim for humidity between 50-70%.",
            "Use a humidity tray or humidifier in dry rooms.",
            "Support airflow to reduce fungal risk.",
        ],
        "warning": "Low humidity can cause bud drop and dry roots.",
    },
    {
        "id": 5,
        "title": "Fertilizing Schedule",
        "icon": "🌱",
        "tips": [
            "Fertilize lightly every 2 weeks during active growth.",
            "Use balanced orchid fertilizer at reduced strength.",
            "Apply fertilizer after watering to protect roots.",
        ],
        "warning": "Over-fertilizing can burn roots and leaves.",
    },
    {
        "id": 6,
        "title": "Common Problems",
        "icon": "⚠️",
        "problems": [
            {"symptom": "Yellow leaves", "cause": "Overwatering or strong sun", "fix": "Reduce watering and adjust light."},
            {"symptom": "No blooms", "cause": "Insufficient light or no temperature drop", "fix": "Increase filtered light and day/night contrast."},
            {"symptom": "Root rot", "cause": "Poor drainage", "fix": "Repot into airy media and trim damaged roots."},
            {"symptom": "Leaf spots", "cause": "Fungal or bacterial stress", "fix": "Improve airflow and isolate affected plants."},
        ],
    },
]

QUICK_QUESTIONS = [
    "How often should I water my orchid?",
    "Why are my orchid leaves turning yellow?",
    "How do I improve orchid flowering?",
    "What should I do when humidity is low?",
    "How much light is safe for orchids?",
]


def get_care_guide() -> CompanionGuideResponse:
    sections = [CompanionSection(**row) for row in CARE_GUIDE_DATA]
    return CompanionGuideResponse(
        title="Orchid Care Guide",
        subtitle="Essential tips for healthy orchids and consistent blooms.",
        sections=sections,
    )


def get_quick_questions() -> List[str]:
    return QUICK_QUESTIONS


def _metric_line(name: str, value: float | None, unit: str) -> str:
    if value is None:
        return f"{name}: n/a"
    digits = 0 if unit == "lx" else 1
    return f"{name}: {value:.{digits}f} {unit}".rstrip()


def _topic_flags(message: str) -> dict:
    q = message.lower()
    return {
        "watering": any(word in q for word in ["water", "watering", "root", "dry"]),
        "light": any(word in q for word in ["light", "sun", "lux", "shade"]),
        "temperature": any(word in q for word in ["temp", "temperature", "hot", "cold", "heat"]),
        "humidity": any(word in q for word in ["humidity", "humid", "mist"]),
        "air": any(word in q for word in ["air", "mq", "gas", "ventilation"]),
        "bloom": any(word in q for word in ["bloom", "flower", "bud"]),
    }


def _build_actions(payload: CompanionChatRequest, flags: dict) -> list[str]:
    actions: list[str] = []

    if payload.temperature is not None:
        if payload.temperature < 18:
            actions.append("Temperature is low. Raise warmth gradually and avoid cold drafts.")
        elif payload.temperature > 28:
            actions.append("Temperature is high. Increase airflow and reduce midday heat exposure.")
        elif flags["temperature"]:
            actions.append("Temperature looks stable. Maintain a gentle day/night temperature difference.")

    if payload.humidity is not None:
        if payload.humidity < 50:
            actions.append("Humidity is low. Add a humidity tray or humidifier near the orchids.")
        elif payload.humidity > 70:
            actions.append("Humidity is high. Improve airflow to reduce fungal risk.")
        elif flags["humidity"] or flags["watering"]:
            actions.append("Humidity is in a workable range. Keep watering consistent with root dryness.")

    if payload.lux is not None:
        if payload.lux < 1000:
            actions.append("Light level is low. Increase bright indirect light exposure.")
        elif payload.lux > 25000:
            actions.append("Light is very strong. Use filtered shade to prevent leaf burn.")
        elif flags["light"] or flags["bloom"]:
            actions.append("Light level is acceptable. Keep exposure consistent to support blooming.")

    if payload.mq135 is not None:
        if payload.mq135 > 150:
            actions.append("Air quality indicator is elevated. Improve ventilation around the grow area.")
        elif flags["air"]:
            actions.append("Air quality indicator is currently stable.")

    if flags["bloom"] and not any("bloom" in action.lower() for action in actions):
        actions.append("For better blooms, keep light steady and avoid major watering schedule changes.")

    if not actions:
        actions = [
            "Check root moisture before watering.",
            "Use bright indirect light and stable airflow.",
            "Track temperature and humidity trends weekly.",
        ]

    return actions


def generate_chat_response(payload: CompanionChatRequest) -> CompanionChatResponse:
    flags = _topic_flags(payload.message)
    actions = _build_actions(payload, flags)

    snapshot = ", ".join(
        [
            _metric_line("Temp", payload.temperature, "C"),
            _metric_line("Humidity", payload.humidity, "%"),
            _metric_line("Light", payload.lux, "lx"),
            _metric_line("MQ135", payload.mq135, ""),
        ]
    )
    action_lines = "\n".join([f"{idx + 1}. {item}" for idx, item in enumerate(actions[:4])])
    response_text = f"Current snapshot: {snapshot}\nRecommended actions:\n{action_lines}"

    confidence = 0.78
    known_metrics = [payload.temperature, payload.humidity, payload.lux, payload.mq135]
    confidence += 0.03 * sum(value is not None for value in known_metrics)
    confidence = min(confidence, 0.93)

    suggestions = [question for question in QUICK_QUESTIONS if question.lower() != payload.message.lower()][:4]
    return CompanionChatResponse(response=response_text, confidence=round(confidence, 2), suggestions=suggestions)
