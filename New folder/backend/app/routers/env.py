from datetime import datetime
from typing import List

from fastapi import APIRouter, HTTPException

from app.models.schemas import FirebasePlant, FirebaseWriteRequest
from app.services import env as env_service

router = APIRouter(prefix="/env", tags=["environment"])


@router.get("/plants", response_model=List[FirebasePlant])
async def list_plants():
    try:
        return await env_service.list_plants()
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.put("/plants/{plant_id}", response_model=FirebasePlant)
async def upsert_plant(plant_id: str, payload: FirebaseWriteRequest):
    data = payload.dict()
    data["id"] = plant_id
    if not data.get("updated_at"):
        data["updated_at"] = datetime.utcnow().isoformat()
    try:
        return await env_service.write_plant(data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc


@router.delete("/plants/{plant_id}")
async def delete_plant(plant_id: str):
    try:
        await env_service.delete_plant(plant_id)
        return {"status": "deleted", "id": plant_id}
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:  # pragma: no cover
        raise HTTPException(status_code=500, detail=str(exc)) from exc
