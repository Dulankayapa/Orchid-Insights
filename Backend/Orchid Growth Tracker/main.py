# from fastapi import FastAPI
# from fastapi.middleware.cors import CORSMiddleware
# from pydantic import BaseModel
# import joblib
# import pandas as pd
# import numpy as np
# from datetime import datetime
# from pathlib import Path
# from collections import Counter

# app = FastAPI()

# # Enable CORS for the frontend (adjust origins as needed)
# app.add_middleware(
#     CORSMiddleware,
#     allow_origins=["*"],  # swap to your frontend URL for tighter security
#     allow_credentials=True,
#     allow_methods=["*"],
#     allow_headers=["*"],
# )

# # Load model + metadata
# model = joblib.load("orchid_growth_rf_model.joblib")
# metadata = joblib.load("orchid_growth_metadata.joblib")

# # ========= Dataset-driven expected ranges =========
# BASE_DIR = Path(__file__).resolve().parent
# # Try multiple locations for the dataset (backend dir, backend parent, repo root)
# POSSIBLE_DATASET_PATHS = [
#     BASE_DIR / "orchid_growth_agar_biweekly_weekly_2025-10-21.xlsx",
#     BASE_DIR.parent / "orchid_growth_agar_biweekly_weekly_2025-10-21.xlsx",
#     BASE_DIR.parent.parent / "orchid_growth_agar_biweekly_weekly_2025-10-21.xlsx",
# ]
# DATASET_PATH = next((p for p in POSSIBLE_DATASET_PATHS if p.exists()), None)
# age_range_lookup = None  # (sorted list of (age_day, (min,max)) drawn from dataset, or None on failure)


# def parse_range_to_min_max(s):
#     """Parse strings like '3–10 mm' into numeric min/max, tolerant to odd dashes/characters."""
#     s = str(s)
#     nums = "".join(ch if (ch.isdigit() or ch == "." or ch == "-") else " " for ch in s)
#     parts = [p for p in nums.split() if p]
#     if len(parts) >= 2:
#         return float(parts[0]), float(parts[1])
#     return None, None


# def build_age_lookup_from_dataset():
#     """
#     Load the dataset (if present) and build an age->(min,max) mapping using the modal range
#     observed for each age_day in the dataset. This is intentionally hardcoded to the dataset ranges
#     (not predicted by the model).
#     """
#     if not DATASET_PATH or not DATASET_PATH.exists():
#         return None

#     df = pd.read_excel(DATASET_PATH)
#     if "expected_height_range" not in df.columns or "age_days" not in df.columns:
#         return None

#     df["h_min"], df["h_max"] = zip(*df["expected_height_range"].map(parse_range_to_min_max))
#     age_lookup = []
#     for age, sub in df.groupby("age_days"):
#         # Choose the most common (min,max) tuple for this age
#         cnt = Counter(zip(sub["h_min"], sub["h_max"]))
#         (h_min, h_max), _ = cnt.most_common(1)[0]
#         age_lookup.append((int(age), (float(h_min), float(h_max))))

#     age_lookup.sort(key=lambda x: x[0])
#     return age_lookup


# def expected_range_from_lookup(age_days):
#     """
#     Choose the expected range based on the nearest age bucket from the dataset-driven lookup.
#     Falls back to heuristic if lookup is unavailable.
#     """
#     global age_range_lookup
#     if age_range_lookup is None:
#         age_range_lookup = build_age_lookup_from_dataset()

#     if not age_range_lookup:
#         # Legacy heuristic buckets
#         return get_expected_height_range(age_days)

#     ages = [a for a, _ in age_range_lookup]
#     ranges = [r for _, r in age_range_lookup]

#     if age_days <= ages[0]:
#         return ranges[0]
#     if age_days >= ages[-1]:
#         return ranges[-1]

#     # Nearest-neighbor using midpoints between sorted ages
#     for i in range(len(ages) - 1):
#         midpoint = (ages[i] + ages[i + 1]) / 2
#         if age_days <= midpoint:
#             return ranges[i]
#     return ranges[-1]


# # Legacy heuristic used if dataset lookup unavailable
# def get_expected_height_range(age_days):
#     if age_days <= 40:
#         return (3, 10)
#     elif age_days <= 60:
#         return (8, 20)
#     elif age_days <= 80:
#         return (15, 28)
#     elif age_days <= 100:
#         return (20, 35)
#     elif age_days <= 120:
#         return (25, 40)
#     else:
#         return (30, 50)

# # ========= Helper functions =========

# def compute_age_days(planting_date_str, current_date_str, date_format="%Y-%m-%d"):
#     planting_date = datetime.strptime(planting_date_str, date_format)
#     current_date = datetime.strptime(current_date_str, date_format)
#     return (current_date - planting_date).days

# def classify_growth(planting_date, current_date, height_mm):
#     age_days = compute_age_days(planting_date, current_date)

#     X_new = pd.DataFrame([{
#         "age_days": age_days,
#         "plant_height_mm": float(height_mm)
#     }], columns=metadata["feature_cols"])

#     pred = model.predict(X_new)[0]
    
#     probs = model.predict_proba(X_new)[0]
#     probs = {cls: float(p) for cls, p in zip(model.classes_, probs)}

#     expected_range = expected_range_from_lookup(age_days)

#     # Heuristic guardrail: override model if measured height is outside heuristic range
#     min_expected, max_expected = expected_range
#     heuristic_override = None

#     if height_mm < min_expected:
#         heuristic_override = "below_expected"
#     elif height_mm > max_expected:
#         heuristic_override = "above_expected"

#     final_label = pred
#     final_probs = probs

#     if heuristic_override:
#         final_label = f"{heuristic_override} (heuristic)"
#         # Force probability mass to the heuristic label for clarity
#         final_probs = {cls: 0.0 for cls in model.classes_}
#         final_probs[heuristic_override] = 1.0

#     return {
#         "predicted_label": final_label,
#         "probabilities": final_probs,
#         "age_days": age_days,
#         "expected_height_range": expected_range,
#         "heuristic_override": heuristic_override,
#     }

# # ========= API Request Model =========

# class GrowthRequest(BaseModel):
#     planting_date: str
#     current_height_mm: float
#     current_date: str = None

# # ========= API Endpoint =========

# @app.post("/analyze-growth")
# def analyze_growth(request: GrowthRequest):
#     current_date = request.current_date or datetime.today().strftime("%Y-%m-%d")
    
#     result = classify_growth(
#         planting_date=request.planting_date,
#         current_date=current_date,
#         height_mm=request.current_height_mm
#     )

#     return result

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import joblib
import pandas as pd
import numpy as np
from datetime import datetime
from pathlib import Path
from collections import Counter

# =========================
# FastAPI app initialization
# =========================
app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# =========================
# Load trained ML model + metadata
# =========================
model = joblib.load("orchid_growth_rf_model.joblib")
metadata = joblib.load("orchid_growth_metadata.joblib")

# =========================
# Dataset paths
# =========================
BASE_DIR = Path(__file__).resolve().parent

POSSIBLE_DATASET_PATHS = [
    BASE_DIR / "orchid_growth_agar_biweekly_weekly_2025-10-21.xlsx",
    BASE_DIR.parent / "orchid_growth_agar_biweekly_weekly_2025-10-21.xlsx",
    BASE_DIR.parent.parent / "orchid_growth_agar_biweekly_weekly_2025-10-21.xlsx",
]
DATASET_PATH = next((p for p in POSSIBLE_DATASET_PATHS if p.exists()), None)

# =========================
# Dataset range lookup
# =========================
age_range_lookup = None

def parse_range_to_min_max(value):
    if value is None or (isinstance(value, float) and np.isnan(value)):
        return None, None

    s = str(value).strip().replace("–", "-").replace("—", "-")
    s = s.replace("to", "-").replace("TO", "-")

    cleaned = "".join(ch if (ch.isdigit() or ch in ".-") else " " for ch in s)
    nums = []
    for p in cleaned.split():
        try:
            nums.append(float(p))
        except:
            pass

    if len(nums) >= 2:
        return min(nums[0], nums[1]), max(nums[0], nums[1])
    return None, None


def build_age_lookup_from_dataset():
    if not DATASET_PATH or not DATASET_PATH.exists():
        return None

    df = pd.read_excel(DATASET_PATH)

    if "age_days" not in df.columns or "expected_height_range" not in df.columns:
        return None

    df["h_min"], df["h_max"] = zip(
        *df["expected_height_range"].map(parse_range_to_min_max)
    )

    df = df.dropna(subset=["age_days", "h_min", "h_max"])

    lookup = []
    for age, sub in df.groupby("age_days"):
        cnt = Counter(zip(sub["h_min"], sub["h_max"]))
        (h_min, h_max), _ = cnt.most_common(1)[0]
        lookup.append((int(age), (float(h_min), float(h_max))))

    lookup.sort(key=lambda x: x[0])
    return lookup


# =========================
# EXPECTED RANGE (UPDATED)
# =========================
def expected_range_from_lookup(age_days):
    global age_range_lookup

    if age_range_lookup is None:
        age_range_lookup = build_age_lookup_from_dataset()

    # fallback if dataset missing
    if not age_range_lookup:
        return get_expected_height_range(age_days)

    # ✅ nearest age match from dataset
    ages = np.array([a for a, _ in age_range_lookup], dtype=int)
    ranges = [r for _, r in age_range_lookup]

    idx = int(np.argmin(np.abs(ages - int(age_days))))
    return ranges[idx]


# =========================
# Fallback ranges (unchanged)
# =========================
def get_expected_height_range(age_days):
    if age_days <= 40:
        return (1, 10)
    elif age_days <= 60:
        return (10, 20)
    elif age_days <= 80:
        return (20, 28)
    elif age_days <= 100:
        return (28, 35)
    elif age_days <= 120:
        return (35, 40)
    else:
        return (40, 50)

# =========================
# Age calculation
# =========================
def compute_age_days(planting_date_str, current_date_str, date_format="%Y-%m-%d"):
    planting_date = datetime.strptime(planting_date_str, date_format)
    current_date = datetime.strptime(current_date_str, date_format)
    return (current_date - planting_date).days

# =========================
# Classification logic (ORIGINAL)
# =========================
def classify_growth_with_age(age_days: int, height_mm: float):
    X_new = pd.DataFrame([{
        "age_days": int(age_days),
        "plant_height_mm": float(height_mm)
    }], columns=metadata["feature_cols"])

    pred = model.predict(X_new)[0]

    probs_arr = model.predict_proba(X_new)[0]
    probs = {cls: float(p) for cls, p in zip(model.classes_, probs_arr)}

    expected_range = expected_range_from_lookup(int(age_days))
    min_expected, max_expected = expected_range

    heuristic_override = None
    if height_mm < min_expected:
        heuristic_override = "below_expected"
    elif height_mm > max_expected:
        heuristic_override = "above_expected"

    final_label = pred
    final_probs = probs

    if heuristic_override:
        final_label = f"{heuristic_override} (heuristic)"
        final_probs = {cls: 0.0 for cls in model.classes_}
        final_probs[heuristic_override] = 1.0

    return {
        "predicted_label": final_label,
        "probabilities": final_probs,
        "age_days": int(age_days),
        "expected_height_range": expected_range,
        "heuristic_override": heuristic_override,
    }


def classify_growth(planting_date, current_date, height_mm):
    age_days = compute_age_days(planting_date, current_date)
    return classify_growth_with_age(age_days, height_mm)

# =========================
# Request schema
# =========================
class GrowthRequest(BaseModel):
    planting_date: str
    current_height_mm: float
    current_date: str = None
    age_days: int | None = None

# =========================
# API endpoint
# =========================
@app.post("/analyze-growth")
def analyze_growth(request: GrowthRequest):
    current_date = request.current_date or datetime.today().strftime("%Y-%m-%d")

    if request.age_days is not None:
        return classify_growth_with_age(
            request.age_days,
            request.current_height_mm
        )

    return classify_growth(
        planting_date=request.planting_date,
        current_date=current_date,
        height_mm=request.current_height_mm
    )
