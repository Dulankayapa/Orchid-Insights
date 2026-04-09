from typing import Dict, List

from app.models.schemas import EducationalResource, Feedback, GrowthStageAdvice, Orchid, Reminder, CareSchedule

# Mock data for demo purposes
MOCK_ORCHIDS: Dict[str, Orchid] = {
    "orchid_1": Orchid(
        orchid_id="orchid_1",
        name="Luna",
        species="Phalaenopsis",
        growth_stage="flowering",
        planted_date="2025-01-15",
        user_id="default",
    ),
    "orchid_2": Orchid(
        orchid_id="orchid_2",
        name="Starlight",
        species="Dendrobium",
        growth_stage="vegetative",
        planted_date="2025-02-20",
        user_id="default",
    ),
}

MOCK_SCHEDULES: Dict[str, CareSchedule] = {
    "orchid_1": CareSchedule(
        schedule_id="sched_1",
        orchid_id="orchid_1",
        watering_frequency=5,
        fertilizing_frequency=14,
        light_requirement="medium",
        humidity_requirement=60,
    )
}

MOCK_REMINDERS: List[Reminder] = [
    Reminder(reminder_id="rem_1", orchid_id="orchid_1", task="water", reminder_date="2026-03-12", status="pending")
]

MOCK_RESOURCES: List[EducationalResource] = [
    EducationalResource(
        resource_id="res_1",
        title="Phalaenopsis Watering Guide",
        description="How to avoid root rot",
        species="Phalaenopsis",
        link="https://example.com/watering",
    )
]

MOCK_GROWTH_ADVICE: List[GrowthStageAdvice] = [
    GrowthStageAdvice(
        stage_id="adv_1",
        growth_stage="flowering",
        care_instructions="Maintain high humidity and reduce nitrogen fertilizer.",
    )
]

# Feedback storage (in-memory only)
FEEDBACK_STORE: List[Feedback] = []


def get_orchids(user_id: str = "default") -> List[Orchid]:
    return [o for o in MOCK_ORCHIDS.values() if o.user_id == user_id]


def get_schedule(orchid_id: str) -> CareSchedule | None:
    return MOCK_SCHEDULES.get(orchid_id)


def get_reminders(orchid_id: str) -> List[Reminder]:
    return [r for r in MOCK_REMINDERS if r.orchid_id == orchid_id]


def add_reminder(reminder: Reminder):
    MOCK_REMINDERS.append(reminder)


def update_reminder_status(reminder_id: str, status: str):
    for r in MOCK_REMINDERS:
        if r.reminder_id == reminder_id:
            r.status = status
            break


def get_resources(species: str, growth_stage: str) -> List[EducationalResource]:
    return [r for r in MOCK_RESOURCES if r.species == species]


def get_growth_advice(growth_stage: str) -> List[GrowthStageAdvice]:
    return [a for a in MOCK_GROWTH_ADVICE if a.growth_stage == growth_stage]


def store_feedback(feedback: Feedback):
    FEEDBACK_STORE.append(feedback)
