"""
Vendor-neutral Stripe Checkout adapter.

Replaces `emergentintegrations.payments.stripe.checkout.StripeCheckout`
with the official `stripe` Python SDK so the app can run on any host.

Why a tiny wrapper?
-------------------
The original code passed a `CheckoutSessionRequest` dataclass-style object
in 5 different routes. Mirroring that shape locally means we can ship a
2-line diff per call site (just swap the import) instead of touching
every endpoint's request building.

Public API (all keep the same names as the upstream library):
  • CheckoutSessionRequest(amount, currency, success_url, cancel_url,
                            metadata=..., mode='payment'|'subscription',
                            line_items=...)
  • StripeCheckout(api_key, webhook_url=None, webhook_secret=None)
      .create_checkout_session(req)            -> {url, session_id}
      .retrieve_checkout_status(session_id)    -> {payment_status, amount_total, currency, metadata}
      .verify_webhook(body, sig)               -> stripe Event

Reads from the standard Stripe env vars:
  STRIPE_SECRET_KEY        (required at runtime)
  STRIPE_WEBHOOK_SECRET    (required for webhook validation)
"""
from __future__ import annotations
import logging
from dataclasses import dataclass, field
from typing import Optional, Dict, Any, List

import stripe

logger = logging.getLogger(__name__)


@dataclass
class CheckoutSessionRequest:
    amount: float = 0.0
    currency: str = "usd"
    success_url: str = ""
    cancel_url: str = ""
    metadata: Dict[str, Any] = field(default_factory=dict)
    mode: str = "payment"                     # 'payment' | 'subscription'
    line_items: Optional[List[Dict[str, Any]]] = None
    customer_email: Optional[str] = None


@dataclass
class CheckoutSessionResponse:
    url: str
    session_id: str


@dataclass
class CheckoutStatusResponse:
    payment_status: str
    amount_total: int
    currency: str
    metadata: Dict[str, Any]


class StripeCheckout:
    def __init__(self, api_key: str, webhook_url: Optional[str] = None, webhook_secret: Optional[str] = None):
        self.api_key = api_key
        self.webhook_url = webhook_url
        self.webhook_secret = webhook_secret
        # The Stripe SDK uses module-level state; setting it here is fine
        # because all routes go through this one factory.
        stripe.api_key = api_key

    async def create_checkout_session(self, req: CheckoutSessionRequest) -> CheckoutSessionResponse:
        """Build a Checkout Session. Falls back to constructing a single
        line_item from (amount, currency) when no `line_items` provided."""
        kwargs: Dict[str, Any] = {
            "mode": req.mode,
            "success_url": req.success_url,
            "cancel_url": req.cancel_url,
            "metadata": (req.metadata or {}),
        }
        if req.customer_email:
            kwargs["customer_email"] = req.customer_email
        if req.line_items:
            kwargs["line_items"] = req.line_items
        else:
            # Cents conversion for legacy `amount` field
            cents = int(round(float(req.amount or 0) * 100))
            kwargs["line_items"] = [{
                "price_data": {
                    "currency": (req.currency or "usd").lower(),
                    "product_data": {"name": (req.metadata or {}).get("description", "IFEELINCOLOR")},
                    "unit_amount": cents,
                },
                "quantity": 1,
            }]
        # `stripe.checkout.Session.create` is sync but I/O bound → run in
        # the default executor so we don't block the event loop.
        import asyncio
        sess = await asyncio.to_thread(stripe.checkout.Session.create, **kwargs)
        return CheckoutSessionResponse(url=sess.url, session_id=sess.id)

    async def retrieve_checkout_status(self, session_id: str) -> CheckoutStatusResponse:
        import asyncio
        sess = await asyncio.to_thread(stripe.checkout.Session.retrieve, session_id)
        return CheckoutStatusResponse(
            payment_status=sess.payment_status or "",
            amount_total=int(sess.amount_total or 0),
            currency=sess.currency or "usd",
            metadata=dict(sess.metadata or {}),
        )

    async def handle_webhook(self, body: bytes, sig_header: str):
        """Verify + parse a Stripe webhook event."""
        if not self.webhook_secret:
            raise RuntimeError("STRIPE_WEBHOOK_SECRET not configured")
        return stripe.Webhook.construct_event(
            payload=body, sig_header=sig_header, secret=self.webhook_secret
        )
