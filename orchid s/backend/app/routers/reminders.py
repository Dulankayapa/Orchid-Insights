from typing import List, Optional

from fastapi import APIRouter, Header, HTTPException

from app.models.schemas import ReminderCreateRequest, ReminderItem
from app.services import reminders as reminders_service

router = APIRouter(prefix="/reminders", tags=["reminders"])


@router.get("", response_model=List[ReminderItem])
async def list_reminders(authorization: Optional[str] = Header(default=None)):
    return reminders_service.list_reminders(authorization)


@router.post("", response_model=ReminderItem)
async def create_reminder(payload: ReminderCreateRequest, authorization: Optional[str] = Header(default=None)):
    if not payload.title.strip():
        raise HTTPException(status_code=400, detail="title is required")

    try:
        return reminders_service.create_reminder(
            title=payload.title,
            reminder_type=payload.type,
            reminder_time=payload.reminderTime,
            authorization=authorization,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@router.delete("/{reminder_id}")
async def delete_reminder(reminder_id: str, authorization: Optional[str] = Header(default=None)):
    deleted = reminders_service.delete_reminder(reminder_id, authorization)
    if not deleted:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return {"status": "deleted", "id": reminder_id}
