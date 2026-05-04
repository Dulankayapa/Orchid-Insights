"""
Orchid image classifier service (ONNX + Mahalanobis OOD).

Looks for model artifacts in this order:
1) Env var ORCHID_CLS_MODEL_DIR
2) backend/models/classifier
3) User's Desktop export folder: ~/Desktop/orchid classifier/orchid classifier/backend

Required files:
  - orchid_classifier_ood.onnx
  - orchid_feature_extractor.onnx
  - ood_config.json (or ood_config1.json)
"""

from __future__ import annotations

import json
import os
import time
from functools import lru_cache
from pathlib import Path
from typing import List, Optional, Tuple

import numpy as np

REQUIRED_ONNX = [
    "orchid_classifier_ood.onnx",
    "orchid_feature_extractor.onnx",
]
OOD_CONFIG_CANDIDATES = ["ood_config.json", "ood_config1.json"]

IMG_SIZE = (224, 224)
TOP_K = 3
CONFIDENCE_THRESHOLD = 0.70
GRAY_ZONE_THRESHOLD_FACTOR = 0.85
GRAY_ZONE_CONFIDENCE_THRESHOLD = 0.60
SOFT_OOD_THRESHOLD_FACTOR = 1.28
SOFT_OOD_CONFIDENCE_THRESHOLD = 0.70
TOP_MARGIN_THRESHOLD = 0.18
HIGH_CONFIDENCE_OVERRIDE = 0.94


class ModelNotReady(Exception):
    """Raised when model artifacts or deps are missing."""


def _model_search_dirs() -> List[Path]:
    env_dir = os.getenv("ORCHID_CLS_MODEL_DIR")
    return [
        Path(env_dir) if env_dir else None,
        Path(__file__).resolve().parents[2] / "models" / "classifier",
        Path(__file__).resolve().parent.parent / "models" / "classifier",
        Path.home() / "Desktop" / "orchid classifier" / "orchid classifier" / "backend",
    ]


def _find_model_dir() -> Path:
    for base in _model_search_dirs():
        if not base:
            continue
        if all((base / name).exists() for name in REQUIRED_ONNX) and any(
            (base / cand).exists() for cand in OOD_CONFIG_CANDIDATES
        ):
            return base
    raise ModelNotReady(
        "Classifier artifacts not found. "
        "Set ORCHID_CLS_MODEL_DIR or place ONNX + ood_config.json under backend/models/classifier."
    )


@lru_cache(maxsize=1)
def _load_state():
    try:
        import onnxruntime as ort  # type: ignore
    except ImportError as exc:  # pragma: no cover - runtime guard
        raise ModelNotReady(
            "onnxruntime is not installed. Add it to requirements and reinstall."
        ) from exc

    try:
        import cv2  # type: ignore
    except ImportError as exc:  # pragma: no cover - runtime guard
        raise ModelNotReady(
            "opencv-python-headless is not installed. Add it to requirements and reinstall."
        ) from exc

    model_dir = _find_model_dir()

    classifier_path = model_dir / REQUIRED_ONNX[0]
    extractor_path = model_dir / REQUIRED_ONNX[1]
    ood_path = next((model_dir / c for c in OOD_CONFIG_CANDIDATES if (model_dir / c).exists()))

    available = ort.get_available_providers()
    providers = (
        ["CUDAExecutionProvider", "CPUExecutionProvider"]
        if "CUDAExecutionProvider" in available
        else ["CPUExecutionProvider"]
    )

    opts = ort.SessionOptions()
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_EXTENDED

    classifier = ort.InferenceSession(str(classifier_path), sess_options=opts, providers=providers)
    extractor = ort.InferenceSession(str(extractor_path), sess_options=opts, providers=providers)

    with ood_path.open("r", encoding="utf-8") as f:
        ood_cfg = json.load(f)

    class_names = ood_cfg.get("class_names") or ood_cfg.get("labels")
    if not class_names:
        raise ModelNotReady("ood_config missing class_names/labels.")

    raw_stats = (
        ood_cfg.get("class_stats")
        or ood_cfg.get("class_stats_for_flutter")
        or ood_cfg.get("class_stats_export")
    )
    if not raw_stats:
        raise ModelNotReady("ood_config missing class_stats.")

    class_stats = []
    for idx, cs in enumerate(raw_stats):
        mean = np.array(cs["mean"], dtype=np.float64)
        cov_inv = np.array(cs.get("cov_inv") or np.eye(len(mean)), dtype=np.float64)
        class_stats.append({"name": cs.get("class_name", class_names[idx]), "mean": mean, "cov_inv": cov_inv})

    # Warm-up
    dummy = np.zeros((1, *IMG_SIZE, 3), dtype=np.float32)
    classifier.run(None, {classifier.get_inputs()[0].name: dummy})
    extractor.run(None, {extractor.get_inputs()[0].name: dummy})

    return {
        "classifier": classifier,
        "extractor": extractor,
        "cls_input": classifier.get_inputs()[0].name,
        "ext_input": extractor.get_inputs()[0].name,
        "class_names": class_names,
        "class_stats": class_stats,
        "threshold": float(ood_cfg.get("threshold", 8.0)),
    }


def _preprocess(img_bytes: bytes) -> np.ndarray:
    import cv2  # local import to avoid import cost if unused

    nparr = np.frombuffer(img_bytes, np.uint8)
    bgr = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError("Unable to decode image. Please upload a valid JPG/PNG/WEBP.")
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    rgb = cv2.resize(rgb, IMG_SIZE, interpolation=cv2.INTER_LINEAR)
    return np.expand_dims(rgb.astype(np.float32), axis=0)


def _mahalanobis(features: np.ndarray, class_stats) -> Tuple[float, int]:
    feat = features.flatten().astype(np.float64)
    best = (float("inf"), 0)
    for idx, stats in enumerate(class_stats):
        diff = feat - stats["mean"]
        dist = float(np.sqrt(max(0.0, np.dot(np.dot(diff, stats["cov_inv"]), diff))))
        if dist < best[0]:
            best = (dist, idx)
    return best


def predict_image(img_bytes: bytes) -> dict:
    state = _load_state()
    tensor = _preprocess(img_bytes)

    t0 = time.perf_counter()
    features = state["extractor"].run(None, {state["ext_input"]: tensor})[0]
    distance, closest_idx = _mahalanobis(features, state["class_stats"])
    raw_threshold = state["threshold"]
    gray_zone_threshold = raw_threshold * GRAY_ZONE_THRESHOLD_FACTOR

    probs = state["classifier"].run(None, {state["cls_input"]: tensor})[0][0]
    prob_sum = float(np.sum(probs))
    if prob_sum > 5.0:  # logits fallback
        probs = np.exp(probs - np.max(probs))
        probs /= probs.sum()

    top_idx = np.argsort(probs)[::-1][:TOP_K]
    top = [
        {"label": state["class_names"][i], "score": float(probs[i])}
        for i in top_idx
    ]

    top_confidence = float(top[0]["score"]) if top else 0.0
    second_confidence = float(top[1]["score"]) if len(top) > 1 else 0.0
    top_margin = max(0.0, top_confidence - second_confidence)
    soft_ood_threshold = raw_threshold * SOFT_OOD_THRESHOLD_FACTOR

    is_ood = distance > soft_ood_threshold

    # Use a soft-vs-hard OOD band so supported orchid species are not rejected
    # solely because they sit slightly outside the raw Mahalanobis threshold.
    if not is_ood:
        if distance > raw_threshold:
            is_ood = (
                top_confidence < SOFT_OOD_CONFIDENCE_THRESHOLD
                or top_margin < TOP_MARGIN_THRESHOLD
            )
        elif distance > gray_zone_threshold:
            is_ood = (
                top_confidence < GRAY_ZONE_CONFIDENCE_THRESHOLD
                or top_margin < TOP_MARGIN_THRESHOLD
            )
        else:
            is_ood = top_confidence < CONFIDENCE_THRESHOLD

    if top_confidence >= HIGH_CONFIDENCE_OVERRIDE and distance <= soft_ood_threshold:
        is_ood = False

    inf_ms = (time.perf_counter() - t0) * 1000

    ood_score = distance / max(1e-6, gray_zone_threshold)
    ood_score = max(0.0, min(1.5, ood_score))  # cap for display

    return {
        "label": top[0]["label"] if top else "unknown",
        "confidence": round(top_confidence, 6),
        "top_k": top,
        "ood": round(ood_score, 4),
        "threshold": gray_zone_threshold,
        "raw_threshold": raw_threshold,
        "soft_ood_threshold": soft_ood_threshold,
        "mahalanobis_distance": distance,
        "confidence_margin": round(top_margin, 6),
        "is_ood": is_ood,
        "inference_ms": round(inf_ms, 1),
    }


def health() -> dict:
    try:
        state = _load_state()
        return {
            "status": "ok",
            "classes": state["class_names"],
            "threshold": state["threshold"] * GRAY_ZONE_THRESHOLD_FACTOR,
            "raw_threshold": state["threshold"],
            "soft_ood_threshold": state["threshold"] * SOFT_OOD_THRESHOLD_FACTOR,
            "providers": state["classifier"].get_providers(),
        }
    except Exception as exc:  # pragma: no cover - simple status
        return {"status": "error", "detail": str(exc)}
