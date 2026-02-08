from collections import Counter
from datetime import datetime
from functools import lru_cache
from pathlib import Path
from typing import Optional, Tuple

import joblib
import numpy as np
import pandas as pd

from app.core.config import BASE_DIR, ROOT_DIR, get_settings


def _first_existing(paths):
    return next((p for p in paths if p and Path(p).exists()), None)


@lru_cache(maxsize=1)
def load_model():
    settings = get_settings()
    possible_model_paths = [
        settings.growth_model_path,
        BASE_DIR / "orchid_growth_rf_model.joblib",
        ROOT_DIR / "models" / "growth" / "orchid_growth_rf_model.joblib",
        ROOT_DIR.parent / "Growth tracker Backend" / "Orchid Growth Tracker" / "orchid_growth_rf_model.joblib",
        ROOT_DIR / "orchid_growth_rf_model.joblib",
    ]
    possible_meta_paths = [
        settings.growth_metadata_path,
        BASE_DIR / "orchid_growth_metadata.joblib",
        ROOT_DIR / "models" / "growth" / "orchid_growth_metadata.joblib",
        ROOT_DIR.parent / "Growth tracker Backend" / "Orchid Growth Tracker" / "orchid_growth_metadata.joblib",
        ROOT_DIR / "orchid_growth_metadata.joblib",
    ]

    model_path = _first_existing(possible_model_paths)
    meta_path = _first_existing(possible_meta_paths)
    if not model_path or not meta_path:
        raise FileNotFoundError("Growth model or metadata file missing. Configure GROWTH_MODEL_PATH/GROWTH_METADATA_PATH.")

    model = joblib.load(model_path)
    metadata = joblib.load(meta_path)
    return model, metadata


def _parse_range_to_min_max(s: str) -> Tuple[Optional[float], Optional[float]]:
    """Parse strings like '3–10 mm' into numeric min/max, tolerant to odd dashes/characters."""
    s = str(s)
    nums = "".join(ch if (ch.isdigit() or ch == "." or ch == "-") else " " for ch in s)
    parts = [p for p in nums.split() if p]
    if len(parts) >= 2:
        return float(parts[0]), float(parts[1])
    return None, None


@lru_cache(maxsize=1)
def build_age_lookup_from_dataset():
    settings = get_settings()
    possible_dataset_paths = [
        settings.growth_dataset_path,
        BASE_DIR / "orchid_growth_agar_biweekly_weekly_2025-10-21.xlsx",
        ROOT_DIR / "models" / "growth" / "orchid_growth_agar_biweekly_weekly_2025-10-21.xlsx",
        ROOT_DIR.parent / "Growth tracker Backend" / "Orchid Growth Tracker" / "orchid_growth_agar_biweekly_weekly_2025-10-21.xlsx",
        ROOT_DIR.parent / "orchid_growth_agar_biweekly_weekly_2025-10-21.xlsx",
    ]
    dataset_path = _first_existing(possible_dataset_paths)
    if not dataset_path:
        return None

    df = pd.read_excel(dataset_path)
    if "expected_height_range" not in df.columns or "age_days" not in df.columns:
        return None

    df["h_min"], df["h_max"] = zip(*df["expected_height_range"].map(_parse_range_to_min_max))
    age_lookup = []
    for age, sub in df.groupby("age_days"):
        cnt = Counter(zip(sub["h_min"], sub["h_max"]))
        (h_min, h_max), _ = cnt.most_common(1)[0]
        age_lookup.append((int(age), (float(h_min), float(h_max))))

    age_lookup.sort(key=lambda x: x[0])
    return age_lookup


def expected_range_from_lookup(age_days: int):
    lookup = build_age_lookup_from_dataset()
    if not lookup:
        return get_expected_height_range(age_days)

    ages = [a for a, _ in lookup]
    ranges = [r for _, r in lookup]

    if age_days <= ages[0]:
        return ranges[0]
    if age_days >= ages[-1]:
        return ranges[-1]

    for i in range(len(ages) - 1):
        midpoint = (ages[i] + ages[i + 1]) / 2
        if age_days <= midpoint:
            return ranges[i]
    return ranges[-1]


def get_expected_height_range(age_days: int):
    """Legacy heuristic buckets used when dataset lookup is unavailable."""
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


def compute_age_days(planting_date_str: str, current_date_str: str, date_format: str = "%Y-%m-%d") -> int:
    planting_date = datetime.strptime(planting_date_str, date_format)
    current_date = datetime.strptime(current_date_str, date_format)
    return (current_date - planting_date).days


def classify_growth(planting_date: str, current_date: str, height_mm: float, age_days_override: Optional[int] = None):
    model, metadata = load_model()

    age_days = age_days_override if age_days_override is not None else compute_age_days(planting_date, current_date)

    X_new = pd.DataFrame(
        [{"age_days": age_days, "plant_height_mm": float(height_mm)}],
        columns=metadata["feature_cols"],
    )

    _ = model.predict(X_new)[0]  # original label not used after deterministic override
    probs_arr = model.predict_proba(X_new)[0]
    probs = {cls: float(p) for cls, p in zip(model.classes_, probs_arr)}

    expected_range = expected_range_from_lookup(age_days)
    min_expected, max_expected = expected_range
    if height_mm < min_expected:
        final_label = "below_expected"
    elif height_mm > max_expected:
        final_label = "above_expected"
    else:
        final_label = "within_expected"

    final_probs = {cls: 0.0 for cls in model.classes_}
    final_probs[final_label] = 1.0

    return {
        "predicted_label": final_label,
        "probabilities": final_probs,
        "age_days": int(age_days),
        "expected_height_range": expected_range,
        "heuristic_override": None,
        "plant_height_mm": float(height_mm),
    }
