"""External provider adapters. All integrations fail safely when unconfigured."""
import io
import smtplib
from email.message import EmailMessage
from pathlib import Path
import boto3
import httpx
from reportlab.pdfgen import canvas
from app.config import get_settings

settings = get_settings()


def validate_gstin(gstin: str | None) -> bool:
    if not gstin:
        return True
    if not settings.gst_validation_url:
        return len(gstin.strip()) >= 15  # format-level fallback for development
    response = httpx.post(settings.gst_validation_url, json={"gstin": gstin}, headers={"Authorization": f"Bearer {settings.gst_validation_api_key}"}, timeout=10)
    response.raise_for_status()
    return bool(response.json().get("valid"))


def geocode(location: str) -> tuple[float | None, float | None]:
    if not settings.google_maps_api_key:
        return None, None
    response = httpx.get("https://maps.googleapis.com/maps/api/geocode/json", params={"address": location, "key": settings.google_maps_api_key}, timeout=10)
    response.raise_for_status()
    results = response.json().get("results", [])
    if not results:
        return None, None
    point = results[0]["geometry"]["location"]
    return point["lat"], point["lng"]


def send_email(recipient: str, subject: str, body: str) -> None:
    if not settings.smtp_host:
        return
    message = EmailMessage(); message["From"] = settings.smtp_from_email; message["To"] = recipient; message["Subject"] = subject; message.set_content(body)
    with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=15) as client:
        client.starttls()
        if settings.smtp_username: client.login(settings.smtp_username, settings.smtp_password or "")
        client.send_message(message)


def store_file(key: str, content: bytes, content_type: str) -> str:
    if settings.s3_bucket:
        boto3.client("s3", region_name=settings.s3_region).put_object(Bucket=settings.s3_bucket, Key=key, Body=content, ContentType=content_type)
        return key
    path = Path("uploads") / key
    path.parent.mkdir(parents=True, exist_ok=True); path.write_bytes(content)
    return str(path)


def invoice_pdf(invoice_number: str, amount: float, gst_amount: float) -> bytes:
    buffer = io.BytesIO(); pdf = canvas.Canvas(buffer)
    pdf.setTitle(f"Invoice {invoice_number}"); pdf.drawString(72, 780, "AdSpace Marketplace Tax Invoice")
    pdf.drawString(72, 745, f"Invoice: {invoice_number}"); pdf.drawString(72, 720, f"Taxable amount: INR {amount - gst_amount:.2f}")
    pdf.drawString(72, 695, f"GST: INR {gst_amount:.2f}"); pdf.drawString(72, 670, f"Total: INR {amount:.2f}")
    pdf.save(); return buffer.getvalue()
