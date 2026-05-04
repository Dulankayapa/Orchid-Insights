"""
Orchid Species Classifier — FastAPI Backend
==========================================
EfficientNetB0 ONNX + Mahalanobis OOD Detection

Place these files in the same directory as this script:
  - orchid_classifier_ood.onnx
  - orchid_feature_extractor.onnx
  - ood_config.json
  - labels.json

Run:
  pip install -r requirements.txt
  python main.py
"""

import os
import json
import time
import traceback
import logging
from pathlib import Path
from typing import List, Tuple, Optional

import numpy as np
import cv2
import onnxruntime as ort
from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger(__name__)

# ── Config ─────────────────────────────────────────────────────────────────────
BASE     = Path(__file__).parent
IMG_SIZE = (224, 224)   # must match training
TOP_K    = 3

CLASSIFIER_PATH = BASE / "orchid_classifier_ood.onnx"
EXTRACTOR_PATH  = BASE / "orchid_feature_extractor.onnx"
OOD_CONFIG_PATH = BASE / "ood_config.json"

# ── FastAPI app ────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Orchid Species Classifier API",
    description="EfficientNetB0 + Mahalanobis OOD Detection",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Shared state ───────────────────────────────────────────────────────────────
state: dict = {}


# ── Startup: load models ───────────────────────────────────────────────────────
def load_models() -> None:
    log.info("=" * 55)
    log.info("Loading Orchid Classifier models...")
    log.info("=" * 55)

    # 1. Check files exist
    for p in [CLASSIFIER_PATH, EXTRACTOR_PATH, OOD_CONFIG_PATH]:
        if not p.exists():
            raise FileNotFoundError(
                f"Required file not found: {p}\n"
                "Copy all four export files into the backend/ directory."
            )

    # 2. Pick execution provider
    available = ort.get_available_providers()
    providers = (
        ["CUDAExecutionProvider", "CPUExecutionProvider"]
        if "CUDAExecutionProvider" in available
        else ["CPUExecutionProvider"]
    )
    log.info(f"ONNX providers: {providers}")

    opts = ort.SessionOptions()
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

    # 3. Load ONNX sessions
    state["classifier"] = ort.InferenceSession(str(CLASSIFIER_PATH), sess_options=opts, providers=providers)
    state["extractor"]  = ort.InferenceSession(str(EXTRACTOR_PATH),  sess_options=opts, providers=providers)

    cls_input_name = state["classifier"].get_inputs()[0].name
    ext_input_name = state["extractor"].get_inputs()[0].name
    log.info(f"Classifier input  : '{cls_input_name}'  shape={state['classifier'].get_inputs()[0].shape}")
    log.info(f"Extractor  input  : '{ext_input_name}'  shape={state['extractor'].get_inputs()[0].shape}")
    state["cls_input_name"] = cls_input_name
    state["ext_input_name"] = ext_input_name

    # 4. Load OOD config
    with open(OOD_CONFIG_PATH, encoding="utf-8") as f:
        ood = json.load(f)

    log.info(f"ood_config.json keys: {list(ood.keys())}")

    state["threshold"]   = float(ood["threshold"])
    state["class_names"] = ood["class_names"]
    state["num_classes"] = int(ood.get("num_classes", len(ood["class_names"])))

    # 5. Parse class stats — tolerate all key names from different export versions
    raw_stats = (
        ood.get("class_stats")
        or ood.get("class_stats_for_flutter")
        or ood.get("class_stats_export")
    )
    if raw_stats is None:
        raise KeyError(
            f"Cannot find class stats in ood_config.json. "
            f"Keys present: {list(ood.keys())}. "
            "Re-export with the latest export_model.py."
        )

    class_stats = []
    for i, cs in enumerate(raw_stats):
        mean = np.array(cs["mean"], dtype=np.float64)

        if "cov_inv" in cs:
            cov_inv = np.array(cs["cov_inv"], dtype=np.float64)
        else:
            # Flutter export only stores means — fall back to scaled identity
            log.warning(
                f"Class {i} ('{cs.get('class_name', '?')}') has no cov_inv. "
                "Using identity matrix → Euclidean distance (less accurate OOD). "
                "Re-export with the latest export_model.py for true Mahalanobis."
            )
            cov_inv = np.eye(len(mean), dtype=np.float64)

        class_stats.append({
            "name":    cs.get("class_name", state["class_names"][i]),
            "mean":    mean,
            "cov_inv": cov_inv,
        })

    state["class_stats"] = class_stats

    # 6. Warm-up run (avoids slow first inference)
    dummy = np.zeros((1, *IMG_SIZE, 3), dtype=np.float32)
    state["classifier"].run(None, {cls_input_name: dummy})
    state["extractor"].run(None,  {ext_input_name: dummy})
    log.info("Warm-up run complete.")

    log.info(f"Classes   : {state['class_names']}")
    log.info(f"Threshold : {state['threshold']:.4f}")
    log.info("Models ready ✓")
    log.info("=" * 55)


@app.on_event("startup")
def startup() -> None:
    load_models()


# ── Image preprocessing ────────────────────────────────────────────────────────
def preprocess(img_bytes: bytes) -> np.ndarray:
    """
    Decode raw image bytes → float32 tensor (1, H, W, 3) in range [0, 255].
    EfficientNetB0 has internal Rescaling + Normalization layers — do NOT
    divide by 255 or apply preprocess_input here.
    """
    nparr = np.frombuffer(img_bytes, np.uint8)
    bgr   = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
    if bgr is None:
        raise ValueError(
            "Could not decode the uploaded file as an image. "
            "Please upload a valid JPG, PNG, or WEBP."
        )
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    rgb = cv2.resize(rgb, IMG_SIZE, interpolation=cv2.INTER_LINEAR)
    return np.expand_dims(rgb.astype(np.float32), axis=0) 


# ── Mahalanobis distance ───────────────────────────────────────────────────────
def compute_mahalanobis(features: np.ndarray) -> Tuple[float, int]:
    """Return (min_distance, closest_class_index)."""
    feat     = features.flatten().astype(np.float64)
    min_dist = float("inf")
    best_idx = 0
    for i, stats in enumerate(state["class_stats"]):
        diff     = feat - stats["mean"]
        raw      = float(np.dot(np.dot(diff, stats["cov_inv"]), diff))
        dist     = float(np.sqrt(max(0.0, raw)))   # clamp negatives from float error
        if dist < min_dist:
            min_dist = dist
            best_idx = i
    return min_dist, best_idx


# ── Pydantic response schemas ──────────────────────────────────────────────────
class Prediction(BaseModel):
    label: str
    confidence: float


class PredictResponse(BaseModel):
    is_ood:               bool
    status:               str    # "CONFIDENT" | "OUT-OF-DISTRIBUTION"
    message:              str
    mahalanobis_distance: float
    threshold:            float
    top_predictions:      List[Prediction]
    inference_ms:         float


# ── Routes ─────────────────────────────────────────────────────────────────────
@app.get("/health")
def health() -> dict:
    return {
        "status":      "ok",
        "classes":     state.get("class_names", []),
        "num_classes": state.get("num_classes"),
        "threshold":   state.get("threshold"),
    }


@app.post("/predict", response_model=PredictResponse)
async def predict(file: UploadFile = File(...)) -> PredictResponse:

    # ── Validate content type ──────────────────────────────────────────────────
    content_type = file.content_type or ""
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail=f"Expected an image, got '{content_type}'.")

    # ── Read bytes ─────────────────────────────────────────────────────────────
    img_bytes = await file.read()
    log.info(f"Received '{file.filename}'  size={len(img_bytes)} bytes  type={content_type}")

    if len(img_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(img_bytes) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large (max 20 MB).")

    # ── Preprocess ─────────────────────────────────────────────────────────────
    try:
        tensor = preprocess(img_bytes)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        log.error(f"Preprocessing error: {exc}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Image preprocessing failed: {exc}")

    t0 = time.perf_counter()

    try:
        # ── Feature extraction (OOD) ───────────────────────────────────────────
        features = state["extractor"].run(
            None, {state["ext_input_name"]: tensor}
        )[0]
        log.info(f"Feature shape: {features.shape}")
        # ── Mahalanobis OOD ───────────────────────────────────────────────────
        distance, closest_idx = compute_mahalanobis(features)
        is_ood = distance > state["threshold"]

        # ── Classification ────────────────────────────────────────────────────
        probs = state["classifier"].run(
            None, {state["cls_input_name"]: tensor}
        )[0][0]   # shape: (num_classes,) — already softmax probabilities

        # Sanity-check: if sum ≫ 1 the model exported logits, not probs
        prob_sum = float(np.sum(probs))
        if prob_sum > 5.0:
            log.warning(
                f"Classifier output sum={prob_sum:.2f} — looks like logits. "
                "Applying softmax as fallback."
            )
            probs = np.exp(probs - np.max(probs))
            probs /= probs.sum()

    except Exception as exc:
        log.error(f"Inference error: {exc}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Model inference failed: {exc}")

    inf_ms = (time.perf_counter() - t0) * 1000

    # ── Build top-K predictions ────────────────────────────────────────────────
    top_idx   = np.argsort(probs)[::-1][:TOP_K]
    top_preds = [
        Prediction(label=state["class_names"][i], confidence=round(float(probs[i]), 6))
        for i in top_idx
    ]

    CONFIDENCE_THRESHOLD = 0.70
    if top_preds[0].confidence < CONFIDENCE_THRESHOLD:
        is_ood = True
        log.info(
            f"Low confidence ({top_preds[0].confidence:.4f} < {CONFIDENCE_THRESHOLD}) "
            "→ flagged as OUT-OF-DISTRIBUTION."
        )

    log.info(
        f"Result: {'OOD' if is_ood else top_preds[0].label}  "
        f"dist={distance:.2f}  threshold={state['threshold']:.2f}  "
        f"conf={top_preds[0].confidence:.4f}  {inf_ms:.0f}ms"
    )

    return PredictResponse(
        is_ood=is_ood,
        status="OUT-OF-DISTRIBUTION" if is_ood else "CONFIDENT",
        message=(
            "This image does not resemble any known orchid species."
            if is_ood
            else "Prediction is reliable."
        ),
        mahalanobis_distance=round(distance, 4),
        threshold=round(state["threshold"], 4),
        top_predictions=top_preds,
        inference_ms=round(inf_ms, 1),
    )


# ── Entry point ────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)