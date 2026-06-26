"""One-off script: generate an HD holographic human body PNG matching the
existing low-poly wireframe aesthetic on the IFEELINCOLOR Somatic Map.

Output: /app/frontend/public/assets/somatic-body-hd.png (transparent PNG).
After generation, post-process to keep a clean transparent background.
"""
import asyncio
import base64
import os
from io import BytesIO

from dotenv import load_dotenv
from emergentintegrations.llm.chat import LlmChat, UserMessage
from PIL import Image

load_dotenv("/app/backend/.env")

OUT_PATH = "/app/frontend/public/assets/somatic-body-hd.png"

PROMPT = (
    "Front-facing anatomical reference of a SINGLE adult human male body "
    "standing upright in a calm neutral T-pose with arms relaxed slightly "
    "out, legs straight, looking forward. Rendered as a HIGH-RESOLUTION "
    "holographic CYAN/ELECTRIC-BLUE wireframe with glowing low-poly "
    "triangular network across the entire body. Faint warm constellation "
    "points dot the muscles like a star map. Subtle inner-body glow with "
    "soft bloom and a thin rim-light. NO clothes, NO accessories, NO text, "
    "NO background — the background must be FULLY TRANSPARENT (alpha 0) "
    "with absolutely nothing visible outside the body silhouette. "
    "Photoreal anatomical proportions, head-to-toe centered in frame with "
    "small uniform padding. Crisp 4K detail, edges sharp, no motion blur. "
    "Style reference: science-fiction medical holographic display, neon "
    "wireframe overlay on top of dark voidless transparency, similar to "
    "anatomy scan UI in Iron Man / Star Trek tricorder. Portrait aspect "
    "ratio roughly 1:2.3 (taller than wide)."
)


async def main():
    api_key = os.getenv("EMERGENT_LLM_KEY")
    assert api_key, "EMERGENT_LLM_KEY missing from /app/backend/.env"
    chat = LlmChat(api_key=api_key, session_id="somatic-body-hd",
                   system_message="You are an expert anatomical illustrator.")
    chat.with_model("gemini", "gemini-3.1-flash-image-preview").with_params(
        modalities=["image", "text"]
    )

    text, images = await chat.send_message_multimodal_response(
        UserMessage(text=PROMPT)
    )
    print("Model text response (truncated):", (text or "")[:200])
    if not images:
        raise RuntimeError("No image returned from Nano Banana.")

    raw = base64.b64decode(images[0]["data"])
    print(f"Received {len(raw)} bytes ({images[0].get('mime_type')})")

    # Persist raw first
    img = Image.open(BytesIO(raw)).convert("RGBA")
    print("Image size:", img.size)

    # Background-knockout: any nearly-pure-black or near-white pixel that
    # is uniform across rows close to the border is likely background.
    # Defensive — only run if the corner pixels look opaque.
    px = img.load()
    w, h = img.size
    corners = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    print("Corner pixels:", corners)
    # If corners are not already transparent, knock out by black-threshold.
    if any(c[3] > 30 for c in corners):
        # Threshold tuned so dark grey "void" background goes transparent
        # while the body wireframe (cyan luminance > ~80) stays fully opaque.
        FULL_OUT = 55   # lum below this → fully transparent
        SOFT_END = 95   # soft alpha ramp ends here → fully opaque body
        new_data = []
        for r, g, b, a in img.getdata():
            lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
            if lum < FULL_OUT:
                new_data.append((r, g, b, 0))
            elif lum < SOFT_END:
                # Soft edge fade
                new_alpha = int((lum - FULL_OUT) / (SOFT_END - FULL_OUT) * 255)
                new_data.append((r, g, b, min(a, new_alpha)))
            else:
                new_data.append((r, g, b, a))
        img.putdata(new_data)
        print("Applied transparent-background knockout.")

    img.save(OUT_PATH, format="PNG", optimize=True)
    print("Saved →", OUT_PATH, "size", img.size)


if __name__ == "__main__":
    asyncio.run(main())
