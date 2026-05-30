"""
Gmail SMTP email provider — runtime-configurable.

The active Gmail "from" credentials are resolved at SEND time using this
precedence:

  1. Database override in `app_settings.email_provider` (set via the
     Admin → Email Settings UI). Encrypted-at-rest on disk by Mongo;
     password is masked in API responses.
  2. Environment variables (`GMAIL_SENDER_EMAIL`, `GMAIL_APP_PASSWORD`,
     etc.) — the legacy single-tenant default, useful for local dev.
  3. None → returns status `mock_sent` so flows never crash.

Why this design:
- Lets the super-admin rotate the sending mailbox WITHOUT a redeploy.
- Lets us add multiple senders later (per-organization "from") by just
  swapping the lookup key — every code path already routes through
  `send_via_gmail(...)`.
"""
from __future__ import annotations
import os
import ssl
import asyncio
import smtplib
import logging
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr, make_msgid
from typing import Optional, Tuple

logger = logging.getLogger(__name__)

# ── Default env config (used as a fallback when no DB row is present) ──
ENV_SMTP_HOST = os.environ.get("GMAIL_SMTP_HOST", "smtp.gmail.com")
ENV_SMTP_PORT = int(os.environ.get("GMAIL_SMTP_PORT", "587"))
ENV_SENDER_EMAIL = os.environ.get("GMAIL_SENDER_EMAIL", "").strip()
ENV_SENDER_NAME = os.environ.get("GMAIL_SENDER_NAME", "IFEELINCOLOR").strip()
# Gmail app passwords have spaces in the displayed copy — strip them.
ENV_APP_PASSWORD = os.environ.get("GMAIL_APP_PASSWORD", "").replace(" ", "").strip()

# ── DB handle. Lazy-imported to avoid circular imports during startup. ──
_db = None


def _get_db():
    """Returns the shared Motor db handle (initialised by server.py)."""
    global _db
    if _db is not None:
        return _db
    try:
        from server import db as srv_db
        _db = srv_db
    except Exception:
        try:
            from motor.motor_asyncio import AsyncIOMotorClient
            mongo_url = os.environ.get("MONGO_URL")
            db_name = os.environ.get("DB_NAME")
            if mongo_url and db_name:
                _db = AsyncIOMotorClient(mongo_url)[db_name]
        except Exception as e:
            logger.warning("email_provider: could not bind to db: %s", e)
            _db = None
    return _db


async def get_active_config() -> dict:
    """Return the live SMTP config the next send_via_gmail() call will use.

    Shape: {host, port, sender_email, sender_name, app_password, source}
    where `source` ∈ {'db', 'env', 'none'}. The password is always returned
    raw for the sender helper — UI consumers should call `get_safe_config`.
    """
    db = _get_db()
    if db is not None:
        try:
            doc = await db.app_settings.find_one(
                {"_id": "email_provider"}, {"_id": 0}
            )
            if doc and doc.get("sender_email") and doc.get("app_password"):
                return {
                    "host": doc.get("smtp_host", "smtp.gmail.com"),
                    "port": int(doc.get("smtp_port", 587)),
                    "sender_email": doc["sender_email"].strip(),
                    "sender_name": (doc.get("sender_name") or "IFEELINCOLOR").strip(),
                    "app_password": doc["app_password"].replace(" ", "").strip(),
                    "source": "db",
                }
        except Exception as e:
            logger.warning("email_provider: db lookup failed: %s", e)
    if ENV_SENDER_EMAIL and ENV_APP_PASSWORD:
        return {
            "host": ENV_SMTP_HOST,
            "port": ENV_SMTP_PORT,
            "sender_email": ENV_SENDER_EMAIL,
            "sender_name": ENV_SENDER_NAME,
            "app_password": ENV_APP_PASSWORD,
            "source": "env",
        }
    return {
        "host": ENV_SMTP_HOST,
        "port": ENV_SMTP_PORT,
        "sender_email": "",
        "sender_name": ENV_SENDER_NAME,
        "app_password": "",
        "source": "none",
    }


async def get_safe_config() -> dict:
    """Same as `get_active_config` but the password is replaced with a mask
    suitable for showing in the Admin UI. Never leaks the real secret."""
    cfg = await get_active_config()
    masked = ""
    if cfg["app_password"]:
        # Show first 2 + last 2 chars with •••• in the middle.
        p = cfg["app_password"]
        masked = (p[:2] + "•" * max(4, len(p) - 4) + p[-2:]) if len(p) >= 6 else "•" * len(p)
    return {
        "smtp_host": cfg["host"],
        "smtp_port": cfg["port"],
        "sender_email": cfg["sender_email"],
        "sender_name": cfg["sender_name"],
        "app_password_masked": masked,
        "configured": bool(cfg["sender_email"] and cfg["app_password"]),
        "source": cfg["source"],
    }


async def save_config(
    sender_email: str,
    app_password: str,
    sender_name: str = "IFEELINCOLOR",
    smtp_host: str = "smtp.gmail.com",
    smtp_port: int = 587,
    updated_by: Optional[str] = None,
) -> dict:
    """Persist a new SMTP config. Caller is responsible for admin-only auth."""
    db = _get_db()
    if db is None:
        raise RuntimeError("Database not initialised")
    from datetime import datetime, timezone
    doc = {
        "_id": "email_provider",
        "sender_email": sender_email.strip(),
        "sender_name": (sender_name or "IFEELINCOLOR").strip(),
        "smtp_host": smtp_host.strip(),
        "smtp_port": int(smtp_port),
        "app_password": (app_password or "").replace(" ", "").strip(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "updated_by": updated_by,
    }
    await db.app_settings.replace_one({"_id": "email_provider"}, doc, upsert=True)
    return await get_safe_config()


async def clear_config() -> dict:
    """Remove the DB override so the env-var defaults take over again."""
    db = _get_db()
    if db is not None:
        await db.app_settings.delete_one({"_id": "email_provider"})
    return await get_safe_config()


def is_configured() -> bool:
    """Legacy sync helper retained for callers that only need a yes/no.

    Falls back to env-only knowledge — async callers should prefer
    `(await get_active_config())['source'] != 'none'` for the live answer.
    """
    return bool(ENV_SENDER_EMAIL and ENV_APP_PASSWORD)


def _send_sync(
    cfg: dict,
    to_email: str,
    to_name: Optional[str],
    subject: str,
    html_body: str,
    plain_fallback: str = "",
) -> Tuple[bool, Optional[str]]:
    """Blocking SMTP send. Returns (ok, error_str)."""
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject or "(no subject)"
    msg["From"] = formataddr((cfg["sender_name"], cfg["sender_email"]))
    msg["To"] = formataddr((to_name or "", to_email))
    msg["Message-ID"] = make_msgid(domain=(cfg["sender_email"].split("@")[-1] or "ifeelincolor"))

    if not plain_fallback:
        import re
        plain_fallback = re.sub(r"<[^>]+>", " ", html_body or "")
        plain_fallback = re.sub(r"\s+", " ", plain_fallback).strip()
    msg.attach(MIMEText(plain_fallback or " ", "plain", "utf-8"))
    msg.attach(MIMEText(html_body or " ", "html", "utf-8"))

    try:
        ctx = ssl.create_default_context()
        with smtplib.SMTP(cfg["host"], cfg["port"], timeout=20) as server:
            server.ehlo()
            server.starttls(context=ctx)
            server.ehlo()
            server.login(cfg["sender_email"], cfg["app_password"])
            server.sendmail(cfg["sender_email"], [to_email], msg.as_string())
        return True, None
    except smtplib.SMTPAuthenticationError as e:
        return False, f"auth_error: {e.smtp_code} {e.smtp_error.decode(errors='ignore') if isinstance(e.smtp_error, bytes) else e.smtp_error}"
    except smtplib.SMTPRecipientsRefused as e:
        return False, f"recipient_refused: {e.recipients}"
    except smtplib.SMTPException as e:
        return False, f"smtp_error: {e}"
    except (OSError, TimeoutError) as e:
        return False, f"network_error: {e}"
    except Exception as e:  # noqa: BLE001
        return False, f"unexpected: {type(e).__name__}: {e}"


async def send_via_gmail(
    to_email: str,
    to_name: Optional[str],
    subject: str,
    html_body: str,
    plain_fallback: str = "",
) -> Tuple[bool, str, Optional[str]]:
    """
    Async-safe send. Returns (success, status, error).
    `status` ∈ {'sent', 'failed', 'mock_sent'}.
    """
    cfg = await get_active_config()
    if cfg["source"] == "none" or not cfg["sender_email"] or not cfg["app_password"]:
        return False, "mock_sent", None
    if not to_email:
        return False, "failed", "missing_recipient"
    try:
        ok, err = await asyncio.to_thread(
            _send_sync, cfg, to_email, to_name, subject, html_body, plain_fallback
        )
    except Exception as e:  # noqa: BLE001
        return False, "failed", f"thread_error: {e}"
    if ok:
        return True, "sent", None
    logger.warning("Gmail send failed to %s via %s: %s", to_email, cfg["sender_email"], err)
    return False, "failed", err


async def test_send(to_email: str, sender_email: str, app_password: str,
                    sender_name: str = "IFEELINCOLOR",
                    smtp_host: str = "smtp.gmail.com",
                    smtp_port: int = 587) -> Tuple[bool, Optional[str]]:
    """Synchronous-style probe used by the admin 'Verify credentials' button.

    Sends a tiny diagnostic email using the SUPPLIED creds (not the saved
    ones). Lets the admin validate a new Gmail app password BEFORE saving
    so a typo can never break production sends.
    """
    cfg = {
        "host": smtp_host,
        "port": int(smtp_port),
        "sender_email": sender_email.strip(),
        "sender_name": (sender_name or "IFEELINCOLOR").strip(),
        "app_password": (app_password or "").replace(" ", "").strip(),
    }
    if not cfg["sender_email"] or not cfg["app_password"]:
        return False, "missing_credentials"
    html = (
        "<html><body style='font-family:Arial;background:#FDFBF4;padding:24px;'>"
        f"<h2 style='color:#FF4FBF;'>✅ IFEELINCOLOR Gmail test</h2>"
        f"<p>This email confirms that <b>{cfg['sender_email']}</b> can send mail "
        "from the IFEELINCOLOR Admin Portal.</p>"
        "<p style='color:#6B7380;font-size:12px;'>If you received this, the "
        "credentials are valid. You can now save them as the active sender.</p>"
        "</body></html>"
    )
    try:
        ok, err = await asyncio.to_thread(
            _send_sync, cfg, to_email, None,
            "IFEELINCOLOR — sender verification", html, ""
        )
        return ok, err
    except Exception as e:  # noqa: BLE001
        return False, f"thread_error: {e}"
