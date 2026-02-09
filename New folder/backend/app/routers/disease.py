from fastapi import APIRouter, File, HTTPException, UploadFile
from fastapi.responses import JSONResponse
from PIL import UnidentifiedImageError

from app.services import disease

router = APIRouter(prefix="/disease", tags=["disease"])


@router.post("/predict")
async def predict_leaf(file: UploadFile = File(...)):
    try:
        content = await file.read()
        result = disease.predict(content)
        confidence_pct = round(result["confidence"] * 100, 2)
        return JSONResponse(
            {
                "prediction": {
                    "status": result["health"],
                    "disease": result["label"],
                    "confidence": result["confidence"],
                    "confidence_percent": confidence_pct,
                    "class_index": result["index"],
                }
            }
        )
    except FileNotFoundError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except UnidentifiedImageError as exc:
        raise HTTPException(status_code=400, detail="Invalid image file") from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc
