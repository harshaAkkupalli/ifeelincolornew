# WebAuthn imports — uses webauthn 2.x (pyOpenSSL/cryptography backend, no oscrypto)
try:
    from webauthn import (
        generate_registration_options, verify_registration_response,
        generate_authentication_options, verify_authentication_response,
        options_to_json,
    )
    from webauthn.helpers import parse_registration_credential_json, parse_authentication_credential_json
    from webauthn.helpers.structs import (
        AuthenticatorSelectionCriteria, UserVerificationRequirement,
        ResidentKeyRequirement, PublicKeyCredentialDescriptor,
    )
    WEBAUTHN_AVAILABLE = True
except Exception as _e:
    WEBAUTHN_AVAILABLE = False
    print(f"WebAuthn not available: {_e}")

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timezone, timedelta
import uuid, os, json, base64
from admin_auth import verify_password, hash_password


def _rp_id_and_origin(request: Request) -> tuple[str, str]:
    """Derive the WebAuthn relying-party id + expected origin from the
    incoming request.

    Behind the Emergent / Cloudflare ingress the upstream `Origin` and `Host`
    headers are rewritten to the internal cluster domain
    (e.g. `*.preview.emergentcf.cloud`), while the actual browser-facing
    domain is preserved in `X-Forwarded-Host` and `Referer`. WebAuthn
    requires rp_id to match the page's effective domain, so we **must** use
    the forwarded headers — not the upstream Origin.

    Priority order:
      1. WEBAUTHN_RP_ID env var (explicit override for self-hosted deploys)
      2. X-Forwarded-Host (set by Cloudflare / k8s ingress)
      3. Referer (full URL — parse host out)
      4. Origin (often rewritten, last resort)
      5. Host header
    """
    env_rp = os.environ.get("WEBAUTHN_RP_ID", "").strip()
    if env_rp:
        return env_rp, f"https://{env_rp}"

    h = request.headers

    forwarded_host = h.get("x-forwarded-host", "").strip()
    if forwarded_host:
        rp = forwarded_host.split(",")[0].strip().split(":")[0]
        proto = h.get("x-forwarded-proto", "https").split(",")[0].strip() or "https"
        return rp, f"{proto}://{rp}"

    ref = h.get("referer", "").strip()
    if "://" in ref:
        try:
            scheme, rest = ref.split("://", 1)
            host_part = rest.split("/", 1)[0]
            rp = host_part.split(":")[0]
            return rp, f"{scheme}://{host_part}"
        except Exception:
            pass

    origin = h.get("origin", "").strip()
    if "://" in origin:
        scheme, rest = origin.split("://", 1)
        host_part = rest.split("/", 1)[0]
        rp = host_part.split(":")[0]
        return rp, f"{scheme}://{host_part}"

    host_hdr = h.get("host", "localhost").split(":")[0]
    return host_hdr, f"https://{host_hdr}"

auth_ext_router = APIRouter(prefix="/api/auth")
db = None

def set_auth_ext_db(database):
    global db
    db = database

def _create_session_token():
    return f"sess_{uuid.uuid4().hex[:16]}"

async def _set_session(user_id, response):
    token = _create_session_token()
    await db.user_sessions.insert_one({
        "session_token": token, "user_id": user_id,
        "expires_at": (datetime.now(timezone.utc) + timedelta(days=7)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    response.set_cookie(key="session_token", value=token, path="/", secure=True, httponly=True, samesite="none", max_age=7*24*3600)
    return token

# ─── Password Login ───
class LoginRequest(BaseModel):
    email: str
    password: str

@auth_ext_router.post("/login")
async def password_login(data: LoginRequest, response: Response):
    user = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Invalid email or password")
    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    await _set_session(user["user_id"], response)
    user.pop("password_hash", None)
    # Surface role_tier on every login response (Org_Admin default for legacy users)
    if user.get("role") == "organization" and not user.get("role_tier"):
        user["role_tier"] = "Org_Admin"
    return user


# ─── Organization-specific login (role-locked) ──────────────────────────
async def org_login_flow(data: LoginRequest, response: Response) -> dict:
    """Shared by /api/organization/login and /api/v1/auth/organization/login.

    Identical to the generic /api/auth/login flow EXCEPT it 403s when the
    authenticated user is not an organization user — so a patient who guesses
    an org's password still can't slip through the org portal.
    """
    user = await db.users.find_one({"email": data.email.lower()}, {"_id": 0})
    if not user or not user.get("password_hash"):
        raise HTTPException(401, "Invalid email or password")
    if not verify_password(data.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    if user.get("role") != "organization":
        raise HTTPException(403, "This account is not an organization account")
    await _set_session(user["user_id"], response)
    user.pop("password_hash", None)
    if not user.get("role_tier"):
        user["role_tier"] = "Org_Admin"
    return user

# ─── Email Verification (Mocked) ───
@auth_ext_router.post("/send-verification")
async def send_verification(request: Request):
    body = await request.json()
    email = body.get("email", "").lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        raise HTTPException(404, "User not found")
    code = str(uuid.uuid4().int)[:6]
    await db.verification_codes.delete_many({"email": email})
    await db.verification_codes.insert_one({
        "email": email, "user_id": user["user_id"],
        "code": code,
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=15)).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.email_logs.insert_one({
        "log_id": f"email_{uuid.uuid4().hex[:12]}",
        "to": email,
        "subject": "Verify Your Email - IFEELINCOLOR",
        "body": f"Your verification code is: {code}. This code expires in 15 minutes.",
        "status": "sent_mock",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    return {"message": "Verification code sent (mocked)", "mock_code": code}

@auth_ext_router.post("/verify-email")
async def verify_email(request: Request):
    body = await request.json()
    email = body.get("email", "").lower()
    code = body.get("code", "")
    record = await db.verification_codes.find_one({"email": email, "code": code}, {"_id": 0})
    if not record:
        raise HTTPException(400, "Invalid verification code")
    exp = record.get("expires_at", "")
    if exp:
        exp_dt = datetime.fromisoformat(exp)
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=timezone.utc)
        if exp_dt < datetime.now(timezone.utc):
            raise HTTPException(400, "Code expired")
    await db.users.update_one({"email": email}, {"$set": {"email_verified": True, "updated_at": datetime.now(timezone.utc).isoformat()}})
    await db.verification_codes.delete_many({"email": email})
    return {"message": "Email verified successfully"}

# ─── Forgot / Reset Password (Mocked) ───
@auth_ext_router.post("/forgot-password")
async def forgot_password(request: Request):
    body = await request.json()
    email = body.get("email", "").lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        return {"message": "If the email exists, a reset link has been sent", "mock_token": None}
    token = uuid.uuid4().hex[:32]
    await db.password_resets.delete_many({"email": email})
    await db.password_resets.insert_one({
        "email": email, "token": token,
        "expires_at": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        "used": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    await db.email_logs.insert_one({
        "log_id": f"email_{uuid.uuid4().hex[:12]}",
        "to": email,
        "subject": "Reset Your Password - IFEELINCOLOR",
        "body": f"Use this token to reset your password: {token}. Expires in 1 hour.",
        "status": "sent_mock",
        "created_at": datetime.now(timezone.utc).isoformat(),
    })
    # Also push to unified `sent_emails` collection so admins see it in Email Templates → Recent Sends
    sent_status = "mock_sent"
    sent_err = None
    try:
        from email_templates import wrap_html
        from email_provider import send_via_gmail
        tpl = await db.email_templates.find_one({"template_id": "tpl_password_reset"}, {"_id": 0})
        reset_link = f"/forgot-password/{user.get('role', 'patient')}?token={token}"
        subject = tpl["subject"] if tpl else "Reset Your Password - IFEELINCOLOR"
        if tpl:
            tpl_body = tpl["body"]
            cta_url = tpl.get("cta_url", reset_link).replace("{{token}}", token).replace("{{reset_link}}", reset_link)
            tpl_body = tpl_body.replace("{{name}}", user.get("name", "")).replace("{{token}}", token).replace("{{reset_link}}", reset_link)
            html = wrap_html(subject, tpl_body, tpl.get("cta_label", "Reset Password"), cta_url)
        else:
            html = wrap_html(
                subject,
                f"<p>Hi {user.get('name','')},</p><p>Use this token to reset your password:</p>"
                f"<p style='font-family:monospace;background:#f5f5f5;padding:12px;border-radius:8px;'>{token}</p>"
                f"<p>Or click the button below. Link expires in 1 hour.</p>",
                "Reset Password",
                reset_link,
            )
        ok, sent_status, sent_err = await send_via_gmail(
            to_email=email,
            to_name=user.get("name", ""),
            subject=subject,
            html_body=html,
        )
        await db.sent_emails.insert_one({
            "email_id": f"em_{uuid.uuid4().hex[:12]}",
            "to_email": email,
            "to_name": user.get("name", ""),
            "subject": subject,
            "template_id": "tpl_password_reset" if tpl else None,
            "token": token,
            "reset_link": reset_link,
            "status": sent_status,
            "error": sent_err,
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "trigger": "password_reset",
        })
    except Exception:
        pass
    # Return mock_token always for QA / test convenience — switch to None
    # once real-email QA is signed off.
    return {"message": "If the email exists, a reset link has been sent", "mock_token": token, "reset_link": f"/forgot-password/{user.get('role', 'patient')}?token={token}", "delivery_status": sent_status}

@auth_ext_router.post("/reset-password")
async def reset_password(request: Request):
    body = await request.json()
    token = body.get("token", "")
    new_password = body.get("new_password", "")
    if len(new_password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")
    record = await db.password_resets.find_one({"token": token, "used": False}, {"_id": 0})
    if not record:
        raise HTTPException(400, "Invalid or expired reset token")
    exp = record.get("expires_at", "")
    if exp:
        exp_dt = datetime.fromisoformat(exp)
        if exp_dt.tzinfo is None:
            exp_dt = exp_dt.replace(tzinfo=timezone.utc)
        if exp_dt < datetime.now(timezone.utc):
            raise HTTPException(400, "Reset token expired")
    await db.users.update_one({"email": record["email"]}, {"$set": {"password_hash": hash_password(new_password), "updated_at": datetime.now(timezone.utc).isoformat()}})
    await db.password_resets.update_one({"token": token}, {"$set": {"used": True}})
    # Invalidate all existing sessions for security
    user = await db.users.find_one({"email": record["email"]}, {"_id": 0})
    if user:
        await db.user_sessions.delete_many({"user_id": user["user_id"]})
    return {"message": "Password reset successfully"}

# ─── WebAuthn / Biometric ───
@auth_ext_router.post("/webauthn/register/options")
async def webauthn_register_options(request: Request):
    if not WEBAUTHN_AVAILABLE:
        raise HTTPException(503, "Biometric authentication not available on this server")

    body = await request.json()
    user_id_str = body.get("user_id", "")
    user = await db.users.find_one({"user_id": user_id_str}, {"_id": 0})
    if not user:
        raise HTTPException(404, "User not found")

    rp_id, _expected_origin = _rp_id_and_origin(request)

    existing_creds = await db.webauthn_credentials.find({"user_id": user_id_str}, {"_id": 0}).to_list(20)
    exclude = [PublicKeyCredentialDescriptor(id=base64.urlsafe_b64decode(c["credential_id"] + "==")) for c in existing_creds]

    options = generate_registration_options(
        rp_id=rp_id, rp_name="IFEELINCOLOR",
        user_id=user_id_str.encode("utf-8"),
        user_name=user.get("email", ""),
        user_display_name=user.get("name", ""),
        exclude_credentials=exclude,
        authenticator_selection=AuthenticatorSelectionCriteria(
            user_verification=UserVerificationRequirement.PREFERRED,
            resident_key=ResidentKeyRequirement.PREFERRED,
        ),
    )
    challenge_b64 = base64.urlsafe_b64encode(options.challenge).decode("utf-8").rstrip("=")
    await db.webauthn_challenges.delete_many({"user_id": user_id_str})
    await db.webauthn_challenges.insert_one({
        "user_id": user_id_str, "challenge": challenge_b64, "type": "registration",
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
    })
    return json.loads(options_to_json(options))

@auth_ext_router.post("/webauthn/register/verify")
async def webauthn_register_verify(request: Request):
    if not WEBAUTHN_AVAILABLE:
        raise HTTPException(503, "Biometric not available")

    body = await request.json()
    user_id_str = body.get("user_id", "")
    credential_json = body.get("credential", "")

    challenge_doc = await db.webauthn_challenges.find_one({"user_id": user_id_str, "type": "registration"}, {"_id": 0})
    if not challenge_doc:
        raise HTTPException(400, "No pending registration challenge")

    rp_id, expected_origin = _rp_id_and_origin(request)

    challenge_bytes = base64.urlsafe_b64decode(challenge_doc["challenge"] + "==")
    try:
        credential = parse_registration_credential_json(json.dumps(credential_json) if isinstance(credential_json, dict) else credential_json)
        verification = verify_registration_response(
            credential=credential,
            expected_challenge=challenge_bytes,
            expected_rp_id=rp_id,
            expected_origin=expected_origin,
        )
        cred_id_b64 = base64.urlsafe_b64encode(verification.credential_id).decode("utf-8").rstrip("=")
        pub_key_b64 = base64.urlsafe_b64encode(verification.credential_public_key).decode("utf-8").rstrip("=")
        await db.webauthn_credentials.insert_one({
            "credential_id": cred_id_b64,
            "user_id": user_id_str,
            "public_key": pub_key_b64,
            "sign_count": verification.sign_count,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        await db.webauthn_challenges.delete_many({"user_id": user_id_str})
        await db.users.update_one({"user_id": user_id_str}, {"$set": {"biometric_registered": True}})
        return {"message": "Biometric registered", "credential_id": cred_id_b64}
    except Exception as e:
        raise HTTPException(400, f"Registration failed: {str(e)}")

@auth_ext_router.post("/webauthn/login/options")
async def webauthn_login_options(request: Request):
    if not WEBAUTHN_AVAILABLE:
        raise HTTPException(503, "Biometric not available")

    body = await request.json()
    email = body.get("email", "").lower()
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        raise HTTPException(404, "User not found")

    creds = await db.webauthn_credentials.find({"user_id": user["user_id"]}, {"_id": 0}).to_list(20)
    if not creds:
        raise HTTPException(400, "No biometric credentials registered")

    rp_id, _expected_origin = _rp_id_and_origin(request)

    allow_creds = [PublicKeyCredentialDescriptor(id=base64.urlsafe_b64decode(c["credential_id"] + "==")) for c in creds]
    options = generate_authentication_options(
        rp_id=rp_id,
        allow_credentials=allow_creds,
        user_verification=UserVerificationRequirement.PREFERRED,
    )
    challenge_b64 = base64.urlsafe_b64encode(options.challenge).decode("utf-8").rstrip("=")
    await db.webauthn_challenges.delete_many({"user_id": user["user_id"]})
    await db.webauthn_challenges.insert_one({
        "user_id": user["user_id"], "challenge": challenge_b64, "type": "authentication",
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
    })
    return {**json.loads(options_to_json(options)), "user_id": user["user_id"]}

@auth_ext_router.post("/webauthn/login/verify")
async def webauthn_login_verify(request: Request, response: Response):
    if not WEBAUTHN_AVAILABLE:
        raise HTTPException(503, "Biometric not available")

    body = await request.json()
    user_id_str = body.get("user_id", "")
    credential_json = body.get("credential", "")

    challenge_doc = await db.webauthn_challenges.find_one({"user_id": user_id_str, "type": "authentication"}, {"_id": 0})
    if not challenge_doc:
        raise HTTPException(400, "No pending authentication challenge")

    rp_id, expected_origin = _rp_id_and_origin(request)

    challenge_bytes = base64.urlsafe_b64decode(challenge_doc["challenge"] + "==")
    credential = parse_authentication_credential_json(json.dumps(credential_json) if isinstance(credential_json, dict) else credential_json)
    cred_id_b64 = base64.urlsafe_b64encode(credential.raw_id).decode("utf-8").rstrip("=")

    stored = await db.webauthn_credentials.find_one({"credential_id": cred_id_b64, "user_id": user_id_str}, {"_id": 0})
    if not stored:
        raise HTTPException(400, "Unknown credential")

    try:
        verification = verify_authentication_response(
            credential=credential,
            expected_challenge=challenge_bytes,
            expected_rp_id=rp_id,
            expected_origin=expected_origin,
            credential_public_key=base64.urlsafe_b64decode(stored["public_key"] + "=="),
            credential_current_sign_count=stored.get("sign_count", 0),
        )
        await db.webauthn_credentials.update_one(
            {"credential_id": cred_id_b64},
            {"$set": {"sign_count": verification.new_sign_count}}
        )
        await _set_session(user_id_str, response)
        user = await db.users.find_one({"user_id": user_id_str}, {"_id": 0})
        user.pop("password_hash", None)
        return user
    except Exception as e:
        raise HTTPException(400, f"Authentication failed: {str(e)}")

# ─── Check biometric status ───
@auth_ext_router.get("/webauthn/status/{user_id}")
async def webauthn_status(user_id: str):
    count = await db.webauthn_credentials.count_documents({"user_id": user_id})
    return {"registered": count > 0, "credential_count": count}
