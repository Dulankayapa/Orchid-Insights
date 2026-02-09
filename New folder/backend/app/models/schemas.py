from datetime import datetime
from typing import Dict, List, Optional, Tuple

from pydantic import BaseModel, Field


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


class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    disease_model_loaded: bool
    firebase_connected: bool
    timestamp: datetime


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


class DiseasePrediction(BaseModel):
    status: str
    disease: str
    confidence: float
    confidence_percent: float
    class_index: int
