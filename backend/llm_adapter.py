"""
Portable LLM adapter — vendor-agnostic chat completions for IFEELINCOLOR.

Why this exists
---------------
The original codebase relied on the Emergent-managed `emergentintegrations`
library (single-key access to OpenAI / Anthropic / Gemini). That ties the
deployment to Emergent's infrastructure. For self-hosting we replace it
with a thin wrapper that:

  1. Prefers official vendor SDKs (`openai`, `anthropic`, `google-genai`)
     when standard env vars are present.
  2. Falls back to `emergentintegrations` ONLY if `EMERGENT_LLM_KEY` is set
     and no vendor key is available — keeps existing tenants working.
  3. Exposes one async function `call_llm(...)` so feature code stays
     unchanged across providers.

Configure via standard env vars (see .env.example):
  • OPENAI_API_KEY            → official `openai` SDK
  • ANTHROPIC_API_KEY         → official `anthropic` SDK
  • GOOGLE_GENAI_API_KEY      → official `google-genai` SDK
  • EMERGENT_LLM_KEY          → legacy fallback only

`AI_DEFAULT_PROVIDER` (optional) pins a provider when multiple keys are
present. `AI_DEFAULT_MODEL` overrides the model id.

This file has zero Emergent imports unless the legacy fallback path is
actually taken at runtime.
"""
from __future__ import annotations
import os
import logging
import asyncio
from typing import Optional, List, Dict, Any

logger = logging.getLogger(__name__)


# ── Provider-specific default model ids ─────────────────────────────────
DEFAULT_MODELS = {
    "openai":    "gpt-4o-mini",          # safe, fast, broadly available
    "anthropic": "claude-sonnet-4-5",    # 4.5 family for hosted users
    "google":    "gemini-2.0-flash",
    # Emergent paths historically use gpt-5.2 / gpt-4o-mini — handled below.
}


def _pick_provider() -> str:
    """Decide which vendor to use this call."""
    forced = (os.environ.get("AI_DEFAULT_PROVIDER") or "").strip().lower()
    if forced in ("openai", "anthropic", "google", "emergent"):
        return forced
    if os.environ.get("OPENAI_API_KEY"):
        return "openai"
    if os.environ.get("ANTHROPIC_API_KEY"):
        return "anthropic"
    if os.environ.get("GOOGLE_GENAI_API_KEY") or os.environ.get("GOOGLE_API_KEY"):
        return "google"
    if os.environ.get("EMERGENT_LLM_KEY"):
        return "emergent"
    return ""


# ── Vendor adapters ────────────────────────────────────────────────────

async def _openai_chat(system: str, user_text: str, model: Optional[str]) -> str:
    """Official OpenAI Python SDK (>=1.0)."""
    from openai import AsyncOpenAI
    client = AsyncOpenAI(api_key=os.environ["OPENAI_API_KEY"])
    mdl = model or os.environ.get("AI_DEFAULT_MODEL") or DEFAULT_MODELS["openai"]
    resp = await client.chat.completions.create(
        model=mdl,
        messages=[
            {"role": "system", "content": system},
            {"role": "user", "content": user_text},
        ],
        temperature=0.7,
    )
    return (resp.choices[0].message.content or "").strip()


async def _anthropic_chat(system: str, user_text: str, model: Optional[str]) -> str:
    """Official Anthropic Python SDK."""
    try:
        from anthropic import AsyncAnthropic
    except ImportError as e:
        raise RuntimeError("anthropic SDK not installed — `pip install anthropic`") from e
    client = AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    mdl = model or os.environ.get("AI_DEFAULT_MODEL") or DEFAULT_MODELS["anthropic"]
    msg = await client.messages.create(
        model=mdl,
        max_tokens=2048,
        system=system,
        messages=[{"role": "user", "content": user_text}],
    )
    parts = []
    for block in (msg.content or []):
        if hasattr(block, "text") and block.text:
            parts.append(block.text)
    return ("".join(parts)).strip()


async def _google_chat(system: str, user_text: str, model: Optional[str]) -> str:
    """Official google-genai SDK."""
    from google import genai
    client = genai.Client(api_key=os.environ.get("GOOGLE_GENAI_API_KEY") or os.environ["GOOGLE_API_KEY"])
    mdl = model or os.environ.get("AI_DEFAULT_MODEL") or DEFAULT_MODELS["google"]
    # google-genai is sync — run in a thread so we don't block the loop.
    def _run():
        resp = client.models.generate_content(
            model=mdl,
            contents=[
                {"role": "user", "parts": [{"text": f"{system}\n\n{user_text}"}]}
            ],
        )
        return getattr(resp, "text", "") or ""
    return (await asyncio.to_thread(_run)).strip()


async def _emergent_chat(system: str, user_text: str, model: Optional[str]) -> str:
    """Legacy path — only invoked when no vendor key is present."""
    from emergentintegrations.llm.chat import LlmChat, UserMessage   # type: ignore
    import uuid as _uuid
    key = os.environ["EMERGENT_LLM_KEY"]
    # `model` may be like "openai/gpt-5.2" or just "gpt-4o-mini"
    provider, model_name = "openai", (model or "gpt-4o-mini")
    if model and "/" in model:
        provider, model_name = model.split("/", 1)
    chat = (
        LlmChat(
            api_key=key,
            session_id=f"adapter_{_uuid.uuid4().hex[:8]}",
            system_message=system,
        ).with_model(provider, model_name)
    )
    return (await chat.send_message(UserMessage(text=user_text))).strip()


# ── Public API ─────────────────────────────────────────────────────────

async def call_llm(
    system: str,
    user_text: str,
    *,
    model: Optional[str] = None,
    provider: Optional[str] = None,
) -> str:
    """
    Send a single (system, user) prompt and return the assistant string.

    Args:
        system    System prompt — IFEELINCOLOR brand voice etc.
        user_text The user's prompt content.
        model     Optional model override. May be 'gpt-4o', 'claude-sonnet-4-5',
                  'gemini-2.0-flash', or provider-prefixed 'openai/gpt-5.2'
                  for the Emergent fallback.
        provider  Force a specific provider for this call.

    Raises:
        RuntimeError if no provider is configured.
    """
    chosen = (provider or _pick_provider()).lower()
    if not chosen:
        raise RuntimeError(
            "No LLM provider configured. Set OPENAI_API_KEY (recommended) "
            "or ANTHROPIC_API_KEY / GOOGLE_GENAI_API_KEY / EMERGENT_LLM_KEY."
        )
    try:
        if chosen == "openai":    return await _openai_chat(system, user_text, model)
        if chosen == "anthropic": return await _anthropic_chat(system, user_text, model)
        if chosen == "google":    return await _google_chat(system, user_text, model)
        if chosen == "emergent":  return await _emergent_chat(system, user_text, model)
        raise RuntimeError(f"Unknown provider: {chosen}")
    except Exception as e:
        logger.warning("LLM call via %s failed: %s", chosen, e)
        raise


def has_llm_key() -> bool:
    return bool(_pick_provider())


def active_provider() -> str:
    return _pick_provider() or "none"
