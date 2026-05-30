"""
Email Templates module + Mock email sending + AI template generation.
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timezone
import uuid
import os

from email_provider import (
    send_via_gmail,
    is_configured as gmail_configured,
    get_safe_config as email_provider_safe,
    save_config as email_provider_save,
    clear_config as email_provider_clear,
    test_send as email_provider_test,
)
from admin_auth import get_current_admin

email_router = APIRouter(prefix="/api/admin")
db = None
LOGO_URL = "https://customer-assets.emergentagent.com/job_ifeel-backend/artifacts/p3d8qihf_WhatsApp%20Image%202026-05-21%20at%2012.45.51.jpeg"

def set_email_db(database):
    global db
    db = database


def _now():
    return datetime.now(timezone.utc).isoformat()


BRAND = {
    "primary": "#7C5BFF",
    "pink": "#FF4FBF",
    "orange": "#FF8C3F",
    "yellow": "#FFD23F",
    "green": "#22D67E",
    "blue": "#4EA8FF",
    "dark": "#1A2332",
}


def _app_ctas_block() -> str:
    """Branded App Store + Google Play download badges for email footers.
    Email-safe HTML — tables, inline styles, no flexbox."""
    APPSTORE = "https://apps.apple.com/ca/app/ifeelincolor/id6742043093"
    PLAY = "https://play.google.com/store/apps/details?id=com.ifeelin_color.ifeelin_color"
    # Pre-rendered PNG badges hosted by Apple/Google so every mail client renders them.
    APPSTORE_BADGE = "https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg"
    PLAY_BADGE = "https://play.google.com/intl/en_us/badges/static/images/badges/en_badge_web_generic.png"
    return f"""
    <tr><td align="center" style="padding: 8px 24px 24px 24px;">
      <p style="margin: 0 0 12px 0; font-family: Arial, sans-serif; font-size: 11px; letter-spacing: 0.22em; color: #6B7380; text-transform: uppercase;">Get the mobile app</p>
      <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
        <tr>
          <td style="padding: 0 6px;">
            <a href="{APPSTORE}" style="text-decoration:none; display:inline-block;">
              <img src="{APPSTORE_BADGE}" alt="Download on the App Store" height="44" style="height:44px; display:block; border:0;">
            </a>
          </td>
          <td style="padding: 0 6px;">
            <a href="{PLAY}" style="text-decoration:none; display:inline-block;">
              <img src="{PLAY_BADGE}" alt="Get it on Google Play" height="64" style="height:64px; display:block; border:0;">
            </a>
          </td>
        </tr>
      </table>
    </td></tr>"""


def wrap_html(subject: str, body_html: str, cta_label: str = "", cta_url: str = "",
              include_app_ctas: bool = False) -> str:
    """Wraps content in branded IFEELINCOLOR HTML email shell.
    If `include_app_ctas` is True, a pair of App Store + Google Play badges
    is rendered below the primary CTA, linking to the live mobile apps."""
    cta_block = ""
    if cta_label and cta_url:
        cta_block = f"""
        <tr><td align="center" style="padding: 24px 0 8px 0;">
          <a href="{cta_url}" style="display:inline-block; padding: 14px 34px; border-radius: 999px;
             background: linear-gradient(135deg, {BRAND['pink']}, {BRAND['orange']});
             color: white; text-decoration: none; font-family: Arial, sans-serif;
             font-weight: 700; font-size: 14px; letter-spacing: 0.5px;
             box-shadow: 0 12px 24px -8px rgba(255,79,191,0.5);">{cta_label}</a>
        </td></tr>"""
    app_ctas = _app_ctas_block() if include_app_ctas else ""
    return f"""<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>{subject}</title></head>
<body style="margin:0; padding:0; background: #FDFBF4; font-family: Arial, sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#FDFBF4;">
<tr><td align="center" style="padding: 36px 16px;">
  <table width="600" cellpadding="0" cellspacing="0" border="0" style="background:white;
     border-radius: 24px; overflow: hidden;
     box-shadow: 0 30px 60px -20px rgba(26,35,50,0.15);">
    <tr><td style="background: linear-gradient(135deg, {BRAND['pink']}, {BRAND['orange']}, {BRAND['yellow']});
        padding: 28px 32px; color: white;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td><img src="{LOGO_URL}" alt="IFEELINCOLOR" width="56" height="56"
              style="border-radius: 12px; background: white; padding: 4px; display: block;"></td>
          <td align="right" style="font-family: Arial, sans-serif; color: white;">
            <div style="font-size: 11px; opacity: 0.85; letter-spacing: 0.25em; text-transform: uppercase;">IFEELINCOLOR</div>
            <div style="font-size: 20px; font-weight: 700;">{subject}</div>
          </td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="padding: 36px 36px 16px 36px; color: #1A2332; font-family: Arial, sans-serif; font-size: 15px; line-height: 1.65;">
      {body_html}
    </td></tr>
    {cta_block}
    {app_ctas}
    <tr><td style="padding: 20px 36px 32px 36px; color: #6B7380; font-family: Arial, sans-serif; font-size: 12px; line-height: 1.5;">
      With warmth,<br>
      <strong>The IFEELINCOLOR Team</strong>
    </td></tr>
    <tr><td style="background: #1F1147; padding: 20px 36px; color: rgba(255,255,255,0.75); font-family: Arial, sans-serif; font-size: 10px; text-align: center;">
      Developed by <strong style="color: {BRAND['yellow']};">Projexino Solutions Pvt Ltd</strong> &nbsp;·&nbsp;
      © {datetime.now(timezone.utc).year} IFEELINCOLOR
    </td></tr>
  </table>
</td></tr></table>
</body></html>"""


# ─── Default starter templates ───
DEFAULT_TEMPLATES = [
    {
        "template_id": "tpl_welcome_patient",
        "name": "Welcome — Patient",
        "subject": "Welcome to IFEELINCOLOR, {{name}} 🌈",
        "body": "<p>Hi <strong>{{name}}</strong>,</p><p>Welcome to IFEELINCOLOR — a safe, gentle space to understand and share what you're feeling.</p><p>Your journey starts whenever you're ready. There's no rush — just one small step at a time.</p>",
        "cta_label": "Open IFEELINCOLOR",
        "cta_url": "{{login_url}}",
        "category": "onboarding",
    },
    {
        "template_id": "tpl_welcome_clinician",
        "name": "Welcome — Clinician",
        "subject": "Welcome aboard, Dr. {{name}}",
        "body": "<p>Dear Dr. <strong>{{name}}</strong>,</p><p>Thank you for joining IFEELINCOLOR. You're now part of a community committed to helping patients understand their emotions — one color at a time.</p><p>Your clinician dashboard is ready. Use the link below to sign in and start supporting your caseload.</p>",
        "cta_label": "Sign in to your dashboard",
        "cta_url": "{{login_url}}",
        "category": "onboarding",
    },
    {
        "template_id": "tpl_assistant_invite",
        "name": "Assistant Invite",
        "subject": "You're invited to IFEELINCOLOR Admin",
        "body": "<p>Hi <strong>{{name}}</strong>,</p><p>You've been invited to join the IFEELINCOLOR admin team as an <strong>Assistant</strong>.</p><p>Your temporary password is: <code style='background:#F4EEF7; padding:6px 10px; border-radius:6px; font-size:14px; color:#7C5BFF;'>{{temp_password}}</code></p><p>Please sign in and change your password right away.</p>",
        "cta_label": "Open Admin Panel",
        "cta_url": "{{admin_url}}",
        "category": "team",
    },
    {
        "template_id": "tpl_password_reset",
        "name": "Password Reset",
        "subject": "Reset your IFEELINCOLOR password",
        "body": "<p>Hi <strong>{{name}}</strong>,</p><p>We received a request to reset your password. If this was you, use the button below — the link expires in 30 minutes.</p><p>If you didn't request this, you can safely ignore this email.</p>",
        "cta_label": "Reset password",
        "cta_url": "{{reset_url}}",
        "category": "auth",
    },
    {
        "template_id": "tpl_assessment_complete",
        "name": "Assessment Complete",
        "subject": "Your IFEELINCOLOR report is ready",
        "body": "<p>Hi <strong>{{name}}</strong>,</p><p>You've completed your assessment — that's a big step, and we're proud of you.</p><p>Your care team has been notified. Open the app to download your branded report and explore your personalized recommendations.</p>",
        "cta_label": "View my report",
        "cta_url": "{{app_url}}",
        "category": "engagement",
    },
]


async def seed_email_templates():
    if db is None:
        return
    for t in DEFAULT_TEMPLATES:
        exists = await db.email_templates.find_one({"template_id": t["template_id"]})
        if not exists:
            await db.email_templates.insert_one({**t, "created_at": _now(), "system": True})


@email_router.get("/email-templates")
async def list_templates(request: Request):
    items = await db.email_templates.find({}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return {"templates": items}


class TemplateUpsert(BaseModel):
    template_id: Optional[str] = None
    name: str
    subject: str
    body: str  # HTML
    cta_label: Optional[str] = ""
    cta_url: Optional[str] = ""
    category: Optional[str] = "general"
    include_app_ctas: Optional[bool] = False


@email_router.post("/email-templates")
async def save_template(payload: TemplateUpsert, request: Request):
    data = payload.model_dump()
    if data.get("template_id"):
        await db.email_templates.update_one(
            {"template_id": data["template_id"]},
            {"$set": {**data, "updated_at": _now()}},
            upsert=True,
        )
    else:
        data["template_id"] = f"tpl_{uuid.uuid4().hex[:12]}"
        data["created_at"] = _now()
        data["system"] = False
        await db.email_templates.insert_one(data)
    return {"ok": True, "template_id": data["template_id"]}


@email_router.delete("/email-templates/{template_id}")
async def delete_template(template_id: str):
    tpl = await db.email_templates.find_one({"template_id": template_id}, {"_id": 0})
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    if tpl.get("system"):
        raise HTTPException(status_code=403, detail="System templates cannot be deleted")
    await db.email_templates.delete_one({"template_id": template_id})
    return {"ok": True}


class PreviewRequest(BaseModel):
    subject: str
    body: str
    cta_label: Optional[str] = ""
    cta_url: Optional[str] = ""
    include_app_ctas: Optional[bool] = False


@email_router.post("/email-templates/preview")
async def preview_template(payload: PreviewRequest, request: Request):
    # Resolve placeholders so the admin sees the REAL URLs the recipient
    # would click — not literal {{login_url}} text.
    vars_ = _resolve_default_vars({"name": "Jamie"}, request)
    subject = payload.subject or ""
    body = payload.body or ""
    cta_label = payload.cta_label or ""
    cta_url = payload.cta_url or ""
    for k, v in vars_.items():
        token = f"{{{{{k}}}}}"
        subject = subject.replace(token, str(v))
        body = body.replace(token, str(v))
        cta_url = cta_url.replace(token, str(v))
        cta_label = cta_label.replace(token, str(v))
    if cta_url and "{{" in cta_url:
        cta_url = vars_["app_url"]
    html = wrap_html(subject, body, cta_label, cta_url,
                     include_app_ctas=bool(payload.include_app_ctas))
    return {"html": html, "resolved_cta_url": cta_url}


class AIGenerateRequest(BaseModel):
    prompt: str
    audience: Optional[str] = "patient"  # patient | clinician | assistant | organization


COPYWRITER_SYSTEM = (
    "You are the email copywriter for IFEELINCOLOR — a sensory-friendly emotional wellness "
    "platform. Voice: warm, humanizing, gentle, slightly poetic, never clinical or robotic. "
    "Output ONLY a valid compact JSON object with keys: subject (short, friendly), "
    "body (HTML using <p>, <strong>, <em> — no styling, no head/body tags), "
    "cta_label (2-3 words), cta_url ('{{login_url}}' or '{{app_url}}' placeholder), "
    "include_app_ctas (boolean — set to true ONLY when the email promotes downloading the "
    "mobile app, references onboarding/launch, or otherwise benefits from showing the "
    "App Store + Google Play badges; otherwise false). "
    "Keep the body 2-4 short paragraphs. Use placeholders like {{name}} for personalization."
)


def _extract_json(text: str) -> dict:
    """Pull the first valid JSON object from an LLM response. Falls back to a
    safe stub so the UI never crashes on a malformed reply."""
    import json
    import re
    if not text:
        return {"subject": "From IFEELINCOLOR", "body": "<p></p>", "cta_label": "Open", "cta_url": "{{login_url}}"}
    # Strip ``` fences if present
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text.strip(), flags=re.MULTILINE)
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        try:
            return json.loads(m.group(0))
        except Exception:
            pass
    return {"subject": "From IFEELINCOLOR", "body": f"<p>{text[:400]}</p>", "cta_label": "Open", "cta_url": "{{login_url}}"}


async def _llm_email_call(system_message: str, user_text: str) -> dict:
    from llm_adapter import call_llm, has_llm_key
    if not has_llm_key():
        raise HTTPException(
            status_code=400,
            detail="No LLM provider configured (set OPENAI_API_KEY or ANTHROPIC_API_KEY).",
        )
    resp = await call_llm(system_message, user_text)
    return _extract_json(resp)


@email_router.post("/email-templates/ai-generate")
async def ai_generate_template(payload: AIGenerateRequest, request: Request):
    """Draft a brand-new template via GPT-5.2 using IFEELINCOLOR brand voice."""
    await get_current_admin(request, db)  # admin-only
    try:
        return await _llm_email_call(
            COPYWRITER_SYSTEM + f" Audience: {payload.audience}.",
            payload.prompt,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class AIEditRequest(BaseModel):
    """Edit an existing template via a natural-language instruction."""
    prompt: str  # e.g., "Make it shorter and add a warm thank-you line"
    subject: str
    body: str
    cta_label: Optional[str] = ""
    cta_url: Optional[str] = ""
    audience: Optional[str] = "patient"


@email_router.post("/email-templates/ai-edit")
async def ai_edit_template(payload: AIEditRequest, request: Request):
    """Refine an existing template in place, preserving placeholders like {{name}}."""
    await get_current_admin(request, db)  # admin-only
    user_text = (
        f"INSTRUCTION:\n{payload.prompt}\n\n"
        f"CURRENT SUBJECT:\n{payload.subject}\n\n"
        f"CURRENT BODY (HTML):\n{payload.body}\n\n"
        f"CURRENT CTA LABEL: {payload.cta_label or ''}\n"
        f"CURRENT CTA URL: {payload.cta_url or '{{login_url}}'}\n\n"
        "Return the FULL revised email as JSON (subject, body, cta_label, cta_url). "
        "Keep every {{placeholder}} that already exists unless the instruction asks "
        "to remove it. Do not invent new placeholders."
    )
    try:
        return await _llm_email_call(
            COPYWRITER_SYSTEM + f" Audience: {payload.audience}. You are EDITING an existing email.",
            user_text,
        )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ─── Mock email send ───
class SendEmailRequest(BaseModel):
    template_id: Optional[str] = None
    to_email: str
    to_name: Optional[str] = ""
    variables: Optional[dict] = {}
    # Or inline:
    subject: Optional[str] = None
    body: Optional[str] = None
    cta_label: Optional[str] = ""
    cta_url: Optional[str] = ""
    include_app_ctas: Optional[bool] = False


def _resolve_default_vars(custom: dict | None = None, request: Request | None = None) -> dict:
    """Build the canonical set of placeholder values every IFEELINCOLOR
    email needs. The caller can override any of these by passing them in
    `payload.variables`.

    Without these defaults, CTAs like `<a href="{{login_url}}">` render as
    literal placeholder text in the inbox — the user reported "CTA buttons
    not working" because clicking them either did nothing or navigated to
    a relative junk URL.

    Resolution order for the public app URL:
      1. APP_BASE_URL env var (explicit per-env override)
      2. The current request's scheme + host (works on preview / prod
         without any env config — same host serves the email and the SPA)
      3. PUBLIC_APP_URL / FRONTEND_URL env vars (legacy)
      4. Final hardcoded fallback (production brand domain)
    """
    base = os.environ.get("APP_BASE_URL")
    if not base and request is not None:
        try:
            # Prefer the X-Forwarded-Host header (CDN / ingress in front of us)
            host = request.headers.get("x-forwarded-host") or request.headers.get("host")
            proto = request.headers.get("x-forwarded-proto") or "https"
            if host:
                base = f"{proto}://{host}"
        except Exception:
            pass
    if not base:
        base = (
            os.environ.get("PUBLIC_APP_URL")
            or os.environ.get("FRONTEND_URL")
            or "https://ifeelincolor.com"
        )
    base = base.rstrip("/")
    admin_base = os.environ.get("ADMIN_BASE_URL", f"{base}/admin").rstrip("/")
    defaults = {
        "app_url":    base,                       # patient/clinician landing
        "login_url":  f"{base}/mobile-home",      # primary sign-in screen
        "signup_url": f"{base}/mobile-home",
        "admin_url":  admin_base,                 # /admin/login
        "reset_url":  f"{base}/reset-password",   # password reset (if patient asks)
        "report_url": f"{base}/app/journey",      # "View my report" CTA → Journey page
        "support_url": f"{base}/support",
        "year":       str(datetime.now(timezone.utc).year),
    }
    if custom:
        defaults.update({k: v for k, v in custom.items() if v is not None})
    return defaults


def _strip_unresolved(s: str) -> str:
    """Belt-and-braces: if any `{{placeholder}}` survived substitution
    (e.g. the admin invented a custom variable like {{patient_first_name}}
    and forgot to pass it), drop the literal token so the inbox doesn't
    show a broken link. We replace with an empty string for text fields
    and the app base URL for href-shaped strings."""
    if not s:
        return s
    import re
    return re.sub(r"\{\{[^{}\s]+\}\}", "", s)


@email_router.post("/email/send")
async def send_email(payload: SendEmailRequest, request: Request):
    """
    Real email sender — renders the branded HTML and dispatches via
    Gmail SMTP when GMAIL_APP_PASSWORD is configured. Falls back to
    audit-only `mock_sent` rows when creds are absent (keeps tests &
    local dev unblocked). Audit row in `sent_emails` always written.
    """
    # Validate: require either template_id OR (subject AND body)
    if not payload.template_id and not (payload.subject and payload.body):
        raise HTTPException(status_code=400, detail="Provide either template_id or both subject and body")
    subject = payload.subject
    body = payload.body
    cta_label = payload.cta_label or ""
    cta_url = payload.cta_url or ""
    include_app_ctas = bool(getattr(payload, "include_app_ctas", False))
    if payload.template_id:
        tpl = await db.email_templates.find_one({"template_id": payload.template_id}, {"_id": 0})
        if not tpl:
            raise HTTPException(status_code=404, detail="Template not found")
        subject = tpl["subject"]
        body = tpl["body"]
        cta_label = tpl.get("cta_label", "")
        cta_url = tpl.get("cta_url", "")
        # Template-level toggle wins unless caller explicitly set it on payload.
        if not include_app_ctas:
            include_app_ctas = bool(tpl.get("include_app_ctas", False))
    # Auto-resolve well-known placeholders FIRST, then layer caller overrides.
    vars_ = _resolve_default_vars({
        **(payload.variables or {}),
        "name": payload.to_name or (payload.to_email.split("@")[0] if payload.to_email else "there"),
        "email": payload.to_email or "",
    }, request)
    for k, v in vars_.items():
        token = f"{{{{{k}}}}}"
        subject = (subject or "").replace(token, str(v))
        body = (body or "").replace(token, str(v))
        cta_url = (cta_url or "").replace(token, str(v))
        cta_label = (cta_label or "").replace(token, str(v))
    # Strip any leftover unresolved placeholders so CTAs are never broken.
    subject = _strip_unresolved(subject)
    body = _strip_unresolved(body)
    cta_label = _strip_unresolved(cta_label)
    if cta_url and "{{" in cta_url:
        # Unresolved href → fall back to the app base so the click still lands
        # the recipient on a real page rather than a 404.
        cta_url = vars_["app_url"]
    # If the URL is somehow not absolute, prepend the base so email clients
    # don't treat it as a mailto: relative link.
    if cta_url and not cta_url.startswith(("http://", "https://", "mailto:", "tel:")):
        cta_url = vars_["app_url"].rstrip("/") + "/" + cta_url.lstrip("/")
    html = wrap_html(subject or "", body or "", cta_label, cta_url,
                     include_app_ctas=include_app_ctas)
    ok, status, err = await send_via_gmail(
        to_email=payload.to_email,
        to_name=payload.to_name,
        subject=subject or "",
        html_body=html,
    )
    record = {
        "email_id": f"em_{uuid.uuid4().hex[:12]}",
        "to_email": payload.to_email,
        "to_name": payload.to_name,
        "subject": subject,
        "template_id": payload.template_id,
        "status": status,  # 'sent' | 'failed' | 'mock_sent'
        "error": err,
        "sent_at": _now(),
    }
    await db.sent_emails.insert_one(record)
    record.pop("_id", None)
    return {"ok": ok, "status": status, "email": record, "rendered_html": html}


@email_router.get("/email/sent")
async def list_sent_emails():
    items = await db.sent_emails.find({}, {"_id": 0}).sort("sent_at", -1).to_list(100)
    return {"emails": items}


# ── Email Provider (Gmail SMTP) configuration — runtime switchable ──

class EmailProviderConfig(BaseModel):
    sender_email: str
    app_password: str
    sender_name: Optional[str] = "IFEELINCOLOR"
    smtp_host: Optional[str] = "smtp.gmail.com"
    smtp_port: Optional[int] = 587


class EmailProviderVerify(BaseModel):
    """Probe arbitrary credentials by sending a tiny diagnostic email."""
    sender_email: str
    app_password: str
    to_email: str
    sender_name: Optional[str] = "IFEELINCOLOR"
    smtp_host: Optional[str] = "smtp.gmail.com"
    smtp_port: Optional[int] = 587


@email_router.get("/email-provider")
async def get_email_provider(request: Request):
    """Return the currently active Gmail sender (password masked)."""
    await get_current_admin(request, db)
    return await email_provider_safe()


@email_router.post("/email-provider")
async def update_email_provider(payload: EmailProviderConfig, request: Request):
    """Persist a new Gmail sender. Future sends use the new mailbox immediately."""
    admin = await get_current_admin(request, db)
    cfg = await email_provider_save(
        sender_email=payload.sender_email,
        app_password=payload.app_password,
        sender_name=payload.sender_name or "IFEELINCOLOR",
        smtp_host=payload.smtp_host or "smtp.gmail.com",
        smtp_port=payload.smtp_port or 587,
        updated_by=admin.get("email") or admin.get("admin_id"),
    )
    return {"ok": True, "config": cfg}


@email_router.delete("/email-provider")
async def reset_email_provider(request: Request):
    """Revert to the env-var defaults (e.g., if a saved mailbox stops working)."""
    await get_current_admin(request, db)
    cfg = await email_provider_clear()
    return {"ok": True, "config": cfg}


@email_router.post("/email-provider/verify")
async def verify_email_provider(payload: EmailProviderVerify, request: Request):
    """Probe arbitrary creds (without saving) so admins can validate a new
    Gmail app password before committing. Sends a 1-line diagnostic email."""
    await get_current_admin(request, db)
    ok, err = await email_provider_test(
        to_email=payload.to_email,
        sender_email=payload.sender_email,
        app_password=payload.app_password,
        sender_name=payload.sender_name or "IFEELINCOLOR",
        smtp_host=payload.smtp_host or "smtp.gmail.com",
        smtp_port=payload.smtp_port or 587,
    )
    return {"ok": ok, "error": err}
