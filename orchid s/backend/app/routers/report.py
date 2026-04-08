import base64
import os
import smtplib
from email.message import EmailMessage
from typing import Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel


class Attachment(BaseModel):
    filename: str
    content: str  # base64 string (no data URL prefix)
    mimetype: str = "application/pdf"


class ReportEmailRequest(BaseModel):
    to: str
    subject: str
    body: str
    attachment: Optional[Attachment] = None


router = APIRouter(prefix="/reports", tags=["reports"])


def _smtp_settings():
    host = os.getenv("SMTP_HOST")
    port = int(os.getenv("SMTP_PORT", "587"))
    user = os.getenv("SMTP_USER")
    password = os.getenv("SMTP_PASS")
    from_email = os.getenv("SMTP_FROM") or user
    use_tls = os.getenv("SMTP_USE_TLS", "true").lower() != "false"

    if not host or not from_email:
        raise HTTPException(
            status_code=503,
            detail="Email is not configured. Set SMTP_HOST, SMTP_FROM, and optionally SMTP_USER/SMTP_PASS.",
        )
    return host, port, user, password, from_email, use_tls


def _send_email(payload: ReportEmailRequest):
    host, port, user, password, from_email, use_tls = _smtp_settings()

    msg = EmailMessage()
    msg["Subject"] = payload.subject
    msg["From"] = from_email
    msg["To"] = payload.to
    msg.set_content(payload.body)

    if payload.attachment:
        try:
            raw = base64.b64decode(payload.attachment.content)
        except Exception as exc:  # pragma: no cover - runtime guard
            raise HTTPException(status_code=400, detail=f"Invalid attachment base64: {exc}") from exc
        msg.add_attachment(raw, maintype=payload.attachment.mimetype.split("/")[0], subtype=payload.attachment.mimetype.split("/")[1], filename=payload.attachment.filename)

    client: smtplib.SMTP | smtplib.SMTP_SSL
    if use_tls and port == 465:
        client = smtplib.SMTP_SSL(host, port)
    else:
        client = smtplib.SMTP(host, port)
        if use_tls:
            client.starttls()
    if user:
        client.login(user, password or "")
    client.send_message(msg)
    client.quit()


@router.post("/email")
async def email_report(payload: ReportEmailRequest):
    try:
        _send_email(payload)
    except HTTPException:
        raise
    except Exception as exc:  # pragma: no cover - runtime guard
        raise HTTPException(status_code=500, detail=f"Failed to send report email: {exc}") from exc
    return {"status": "sent"}
