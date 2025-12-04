from fastapi import FastAPI
from pydantic import BaseModel
import joblib
import pandas as pd
from datetime import datetime

app = FastAPI()

# Load model + metadata
model = joblib.load("orchid_growth_rf_model.joblib")
metadata = joblib.load("orchid_growth_metadata.joblib")

# ========= Helper functions =========

def compute_age_days(planting_date_str, current_date_str, date_format="%Y-%m-%d"):
    planting_date = datetime.strptime(planting_date_str, date_format)
    current_date = datetime.strptime(current_date_str, date_format)
    return (current_date - planting_date).days

def get_expected_height_range(age_days):
    if age_days <= 40:
        return (3, 10)
    elif age_days <= 60:
        return (8, 20)
    elif age_days <= 80:
        return (15, 28)
    elif age_days <= 100:
        return (20, 35)
    elif age_days <= 120:
        return (25, 40)
    else:
        return (30, 50)

def classify_growth(planting_date, current_date, height_mm):
    age_days = compute_age_days(planting_date, current_date)

    X_new = pd.DataFrame([{
        "age_days": age_days,
        "plant_height_mm": float(height_mm)
    }], columns=metadata["feature_cols"])

    pred = model.predict(X_new)[0]
    
    probs = model.predict_proba(X_new)[0]
    probs = {cls: float(p) for cls, p in zip(model.classes_, probs)}

    expected_range = get_expected_height_range(age_days)

    return {
        "predicted_label": pred,
        "probabilities": probs,
        "age_days": age_days,
        "expected_height_range": expected_range
    }

# ========= API Request Model =========

class GrowthRequest(BaseModel):
    planting_date: str
    current_height_mm: float
    current_date: str = None

# ========= API Endpoint =========

@app.post("/analyze-growth")
def analyze_growth(request: GrowthRequest):
    current_date = request.current_date or datetime.today().strftime("%Y-%m-%d")
    
    result = classify_growth(
        planting_date=request.planting_date,
        current_date=current_date,
        height_mm=request.current_height_mm
    )

    return result
