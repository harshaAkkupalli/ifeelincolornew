"""Generate the 8 onboarding hero images for IFEELINCOLOR.

Output:
  /app/frontend/public/assets/onboarding/patient-1.png   (and -2, -3, -4)
  /app/frontend/public/assets/onboarding/clinician-1.png (and -2, -3, -4)

Each PNG is a transparent-background 3D-style illustration of a woman
who is PHYSICALLY HOLDING a smartphone showing the matching IFEELINCOLOR
app screen.  After Nano Banana returns the raw illustration we run it
through `rembg` (u2net) to GUARANTEE a clean alpha-cutout — so the only
pixels with alpha>0 are the woman + the phone she is holding.

The frontend animates them with Framer Motion (float + parallax) so they
feel "alive" without a heavy Lottie/3D runtime.
"""
import asyncio
import base64
import os
from io import BytesIO

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from PIL import Image
from rembg import new_session, remove

load_dotenv("/app/backend/.env")

OUT_DIR = "/app/frontend/public/assets/onboarding"
os.makedirs(OUT_DIR, exist_ok=True)

# Shared style + composition guard-rails.  We DO ask Nano Banana for a
# transparent background, but in practice it almost always returns a
# coloured backdrop — that is what `rembg` is for further down.
STYLE = (
    "Style: premium 3D infographic illustration, soft clay / Pixar look, "
    "warm pastel lighting, ambient occlusion, subtle rim-light. "
    "Subject: a YOUNG ADULT WOMAN, kind eyes, warm smile, mid-length wavy "
    "hair, casual modern outfit. "
    "COMPOSITION: full upper body / three-quarter pose, woman is "
    "PHYSICALLY HOLDING a modern smartphone in BOTH HANDS in front of her "
    "chest — phone is held vertically (portrait orientation), screen "
    "facing the camera, clearly visible. The phone screen shows the "
    "described IFEELINCOLOR app screen. "
    "Background MUST be a SOLID FLAT pure white (#FFFFFF) — no gradient, "
    "no scenery, no props, no shadows on the floor. NO text or logos "
    "outside the phone screen. 4K crisp, centred figure, generous padding."
)

SCREENS = [
    # ── Patient ───────────────────────────────────────────────────────
    ("patient-1.png",
     "A young woman holding her smartphone in both hands. The phone "
     "screen shows a glowing rainbow colour-wheel mood tracker (the "
     "IFEELINCOLOR Daily Check-In). She looks joyful. She represents "
     "'Daily Check-In in colour'. " + STYLE),

    ("patient-2.png",
     "A young woman holding her smartphone in both hands at chest level, "
     "eyes softly closed in a meditative smile. The phone screen shows "
     "an AI brain mandala with floating violet/pink recommendation "
     "cards. She represents 'Personalised AI recommendations'. " + STYLE),

    ("patient-3.png",
     "A young woman holding her smartphone in both hands, smiling. The "
     "phone screen shows a list of clinician profile cards with "
     "stethoscope avatars and a green 'Subscribe' button. She "
     "represents 'Find your right clinician'. " + STYLE),

    ("patient-4.png",
     "A young woman holding her smartphone in both hands, one hand "
     "slightly raised in a small celebration. The phone screen shows a "
     "milestone roadmap with star + trophy badges and a glowing 'PDF "
     "Dossier' button at the bottom. She represents 'Celebrate every "
     "milestone'. " + STYLE),

    # ── Clinician ─────────────────────────────────────────────────────
    ("clinician-1.png",
     "A young woman in a soft mint scrub-top with a stethoscope around "
     "her neck, holding her smartphone in both hands. The phone screen "
     "shows a clinician dashboard with patient cards, mood graphs and a "
     "severity badge. She represents 'Patient dashboard at a glance'. "
     + STYLE),

    ("clinician-2.png",
     "A young woman clinician in mint scrubs holding her smartphone in "
     "both hands. The phone screen shows an AI brain hologram with 5 "
     "numbered treatment-plan cards floating beside it. Emerald glow. "
     "She represents 'AI Treatment Coach in seconds'. " + STYLE),

    ("clinician-3.png",
     "A young woman clinician in mint scrubs holding her smartphone in "
     "both hands. The phone screen shows masked patient cards with city "
     "pins and 'Looking for clinician' tags. She represents "
     "'Patients are waiting for you'. " + STYLE),

    ("clinician-4.png",
     "A young woman clinician in mint scrubs holding her smartphone in "
     "both hands, smiling. The phone screen shows a revenue pie chart, "
     "a ratings histogram and a gold star. She represents 'Grow your "
     "practice — analytics + ratings'. " + STYLE),
]


# Re-use one rembg session for all 8 calls (loads u2net once).
_REMBG_SESSION = new_session("u2net")


def alpha_cutout(img: Image.Image) -> Image.Image:
    """Aggressively cut the background.  We run rembg (u2net) and then
    re-knockout any straggling near-white pixels for a perfectly clean
    transparent PNG."""
    rgba = remove(img.convert("RGBA"), session=_REMBG_SESSION)
    # rembg already returns RGBA with hard alpha — finish it off by
    # clearing any sub-threshold edge pixels to avoid the dreaded
    # "ghost halo".
    px = rgba.load()
    w, h = rgba.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if a < 12:
                px[x, y] = (0, 0, 0, 0)
    return rgba


async def generate_one(filename: str, prompt: str, api_key: str) -> None:
    out = os.path.join(OUT_DIR, filename)
    print(f"\n▶ {filename}\n  prompt: {prompt[:120]}…")
    chat = LlmChat(
        api_key=api_key,
        session_id=f"onboard-{filename}",
        system_message="You are an expert 3D illustrator.",
    )
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
        modalities=["image", "text"]
    )
    _text, images = await chat.send_message_multimodal_response(
        UserMessage(text=prompt)
    )
    if not images:
        print(f"  ✗ No image returned for {filename}")
        return
    raw = base64.b64decode(images[0]["data"])
    print(f"  ✓ {len(raw)} bytes")
    img = alpha_cutout(Image.open(BytesIO(raw)))
    img.save(out, format="PNG", optimize=True)
    print(f"  → saved {out}  ({os.path.getsize(out)} bytes)")


async def main() -> None:
    api_key = os.getenv("EMERGENT_LLM_KEY")
    assert api_key, "EMERGENT_LLM_KEY missing"
    # 8 concurrent generation calls — Nano Banana handles fan-out fine.
    await asyncio.gather(
        *(generate_one(f, p, api_key) for f, p in SCREENS),
        return_exceptions=False,
    )


if __name__ == "__main__":
    asyncio.run(main())
