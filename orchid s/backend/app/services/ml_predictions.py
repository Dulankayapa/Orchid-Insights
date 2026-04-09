from datetime import datetime, timedelta
from typing import List, Tuple

try:
    import joblib
    import numpy as np
except Exception:  # pragma: no cover - optional dependency
    joblib = None
    np = None

# Optional model paths (not required for heuristics)
MODEL_PATH = "app/models/orchid_model.pkl"
SPECIES_ENC_PATH = "app/models/species_encoder.pkl"
STAGE_ENC_PATH = "app/models/stage_encoder.pkl"
LIGHT_ENC_PATH = "app/models/light_encoder.pkl"
SEASON_ENC_PATH = "app/models/season_encoder.pkl"
ACTION_ENC_PATH = "app/models/action_encoder.pkl"

_loaded = False
_model = None
_encoders = {}


def _load_artifacts():
    global _loaded, _model, _encoders
    if _loaded or joblib is None:
        return
    try:
        _model = joblib.load(MODEL_PATH)
        _encoders = {
            "species": joblib.load(SPECIES_ENC_PATH),
            "stage": joblib.load(STAGE_ENC_PATH),
            "light": joblib.load(LIGHT_ENC_PATH),
            "season": joblib.load(SEASON_ENC_PATH),
            "action": joblib.load(ACTION_ENC_PATH),
        }
    except Exception:
        _model = None
        _encoders = {}
    finally:
        _loaded = True


def get_current_season() -> str:
    month = datetime.now().month
    if month in (3, 4, 5):
        return "spring"
    if month in (6, 7, 8):
        return "summer"
    if month in (9, 10, 11):
        return "autumn"
    return "winter"


def predict_care_action(species: str, growth_stage: str, temperature: float, humidity: float, light_level: str, season: str) -> str:
    """
    Try to use ML model if available; otherwise fall back to rules.
    """
    _load_artifacts()
    if _model and _encoders:
        try:
            s = _encoders["species"].transform([species])[0]
            g = _encoders["stage"].transform([growth_stage])[0]
            l = _encoders["light"].transform([light_level])[0]
            se = _encoders["season"].transform([season])[0]
            pred = _model.predict([[s, g, temperature, humidity, l, se]])[0]
            return _encoders["action"].inverse_transform([pred])[0]
        except Exception:
            pass

    # Heuristic fallback
    if humidity < 55 or temperature > 30:
        return "water"
    if growth_stage == "flowering" and light_level == "high":
        return "mist"
    if growth_stage == "vegetative":
        return "fertilize"
    return "monitor"


def predict_health_score(temperature: float, humidity: float, light: float, species: str, growth_stage: str) -> Tuple[int, dict]:
    """
    Simple heuristic-based health score.
    """
    score = 100
    breakdown = {}

    # Temperature ideal: 18-28°C
    if temperature < 18:
        score -= (18 - temperature) * 2
        breakdown["temperature"] = max(0, 100 - (18 - temperature) * 2)
    elif temperature > 28:
        score -= (temperature - 28) * 2
        breakdown["temperature"] = max(0, 100 - (temperature - 28) * 2)
    else:
        breakdown["temperature"] = 100

    # Humidity ideal: 50-70%
    if humidity < 50:
        score -= (50 - humidity) * 1.5
        breakdown["humidity"] = max(0, 100 - (50 - humidity) * 1.5)
    elif humidity > 70:
        score -= (humidity - 70) * 1.5
        breakdown["humidity"] = max(0, 100 - (humidity - 70) * 1.5)
    else:
        breakdown["humidity"] = 100

    # Light ideal: 1000-2000 lux
    if light < 1000:
        score -= (1000 - light) / 20
        breakdown["light"] = max(0, 100 - (1000 - light) / 20)
    elif light > 2000:
        score -= (light - 2000) / 20
        breakdown["light"] = max(0, 100 - (light - 2000) / 20)
    else:
        breakdown["light"] = 100

    action = predict_care_action(species, growth_stage, temperature, humidity, "medium" if 1000 <= light <= 2000 else ("high" if light > 2000 else "low"), get_current_season())
    if action in ["water", "fertilize"]:
        score += 5
    breakdown["ml_factor"] = min(100, max(0, score))

    final = min(100, max(0, int(score)))
    return final, breakdown


def predict_next_watering(orchid_data: dict, sensor_history: List[dict]) -> Tuple[str, float, str]:
    """
    Simplified watering prediction: combines last sensor reading with ML action.
    """
    latest = sensor_history[-1] if sensor_history else {}
    action = predict_care_action(
        orchid_data.get("species", "orchid"),
        orchid_data.get("growth_stage", "vegetative"),
        latest.get("temperature", 24),
        latest.get("humidity", 60),
        latest.get("light_level", "medium"),
        get_current_season(),
    )
    if action == "water" and latest.get("humidity", 60) < 60:
        return datetime.now().strftime("%Y-%m-%d"), 0.95, "Low humidity and model suggest watering today."
    if action == "water":
        return (datetime.now() + timedelta(days=1)).strftime("%Y-%m-%d"), 0.7, "Model suggests watering soon."
    return (datetime.now() + timedelta(days=2)).strftime("%Y-%m-%d"), 0.6, "No immediate watering needed."


def detect_anomaly(sensor_history: List[dict]) -> bool:
    """
    Very light anomaly detection based on recent changes.
    """
    if len(sensor_history) < 3:
        return False
    recent = sensor_history[-3:]
    temp_change = abs(recent[-1].get("temperature", 0) - recent[0].get("temperature", 0))
    humidity_change = abs(recent[-1].get("humidity", 0) - recent[0].get("humidity", 0))
    return temp_change > 5 or humidity_change > 20
