from datetime import datetime
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel, Field


# ---------- Growth ----------
class GrowthRequest(BaseModel):
    planting_date: str = Field(..., description="YYYY-MM-DD")
    current_height_mm: float = Field(..., description="Measured plant height in millimeters")
    current_date: Optional[str] = Field(None, description="Override current date (YYYY-MM-DD)")
    age_days: Optional[int] = Field(None, description="Optional override for computed age")


class GrowthResponse(BaseModel):
    predicted_label: str
    probabilities: Dict[str, float]
    age_days: int
    expected_height_range: Tuple[float, float]
    heuristic_override: Optional[str] = None
    plant_height_mm: Optional[float] = None


# ---------- Health / system ----------
class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    disease_model_loaded: bool
    firebase_connected: bool
    timestamp: datetime


# ---------- Companion core ----------
class CompanionProblem(BaseModel):
    symptom: str
    cause: str
    fix: str


class CompanionSection(BaseModel):
    id: int
    title: str
    icon: str
    tips: List[str] = Field(default_factory=list)
    warning: Optional[str] = None
    problems: List[CompanionProblem] = Field(default_factory=list)


class CompanionGuideResponse(BaseModel):
    title: str
    subtitle: str
    sections: List[CompanionSection]


class CompanionChatRequest(BaseModel):
    message: str
    temperature: Optional[float] = None
    humidity: Optional[float] = None
    lux: Optional[float] = None
    mq135: Optional[float] = None


class CompanionChatResponse(BaseModel):
    response: str
    confidence: float
    suggestions: List[str]


# ---------- New companion models ----------
class Orchid(BaseModel):
    orchid_id: str
    name: str
    species: str
    growth_stage: str
    planted_date: str  # YYYY-MM-DD
    user_id: str = "default"


class CareSchedule(BaseModel):
    schedule_id: str
    orchid_id: str
    watering_frequency: int  # days
    fertilizing_frequency: int  # days
    light_requirement: str  # low, medium, high
    humidity_requirement: int  # percentage


class Reminder(BaseModel):
    reminder_id: str
    orchid_id: str
    task: str  # "water", "fertilize", "mist", etc.
    reminder_date: str  # YYYY-MM-DD
    status: str  # "pending", "done", "skipped"


class EducationalResource(BaseModel):
    resource_id: str
    title: str
    description: str
    species: str
    link: str


class GrowthStageAdvice(BaseModel):
    stage_id: str
    growth_stage: str
    care_instructions: str


class Feedback(BaseModel):
    feedback_id: str
    orchid_id: str
    recommendation_type: str  # "watering", "health_score", "resource", "chat"
    rating: int  # 1 = thumbs up, 0 = thumbs down
    timestamp: datetime


class HealthScoreResponse(BaseModel):
    score: int
    breakdown: Dict[str, int]  # e.g., {"temperature": 85, "humidity": 90}
    forecast: List[int]  # next 3 days predicted scores
    anomaly_detected: bool


class NextWateringResponse(BaseModel):
    recommended_date: str
    confidence: float  # 0-1
    reason: str


# ---------- Device status ----------
class DeviceStatus(BaseModel):
    device_id: str
    last_seen: datetime
    payload: Dict[str, object] = Field(default_factory=dict)


class DeviceStatusResponse(BaseModel):
    status: str
    last_seen: Optional[datetime] = None


class OfflineResponse(BaseModel):
    status: str
    message: str


# ---------- Firebase ----------
class FirebasePlant(BaseModel):
    id: str
    planting_date: Optional[str] = None
    height_mm: Optional[float] = None
    updated_at: Optional[str] = None
    cultivar: Optional[str] = None
    extra: Dict[str, object] = Field(default_factory=dict)


class FirebaseWriteRequest(BaseModel):
    id: str
    planting_date: Optional[str] = None
    height_mm: Optional[float] = None
    cultivar: Optional[str] = None
    updated_at: Optional[str] = None


# ---------- Disease ----------
class DiseasePrediction(BaseModel):
    status: str
    disease: str
    confidence: float
    confidence_percent: float
    class_index: int
