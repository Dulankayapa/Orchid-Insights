from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services import classifier as classifier_service

router = APIRouter(prefix="/orchid-classifier", tags=["orchid-classifier"])


@router.get("/health")
async def classifier_health():
    # Return whatever the service knows; always 200 to simplify probes
    return classifier_service.health()


@router.post("/predict")
async def predict(file: UploadFile = File(...)):
    content_type = (file.content_type or "").lower()
    if content_type and not content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Please upload an image file.")

    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    if len(data) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Image too large (max 20MB).")

    try:
        result = classifier_service.predict_image(data)
    except classifier_service.ModelNotReady as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=f"Inference failed: {exc}") from exc

    if result.get("is_ood"):
        if not result.get("ood_enabled"):
            raise HTTPException(
                status_code=422,
                detail=(
                    "Prediction is low confidence and OOD calibration is unavailable. "
                    "Add ood_config.json in backend/models/classifier for reliable rejection."
                ),
            )
        raise HTTPException(
            status_code=422,
            detail=(
                "This classifier only supports the trained orchid species: "
                "cattleya, dendrobium, oncidium, phalaenopsis, and vanda. "
                "Please upload a clear photo of one of those orchids."
            ),
        )

    # Shape response for the frontend normalizer (top_k, ood, label, confidence)
    return {
        **result,
        "status": "OK",
        "message": "Prediction computed",
        "predictions": result.get("top_k", []),
    }
