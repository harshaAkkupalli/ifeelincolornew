"""Public documentation endpoints — renders markdown docs as styled HTML and PDF.

The PDF generator uses WeasyPrint to produce a pixel-faithful copy of the
HTML page (logo, gradients, tables, code blocks, page numbers).
"""
import base64
import io
import logging
from pathlib import Path
from functools import lru_cache

import httpx
import markdown as md
from fastapi import APIRouter, HTTPException
from fastapi.responses import HTMLResponse, FileResponse, PlainTextResponse, Response

logger = logging.getLogger(__name__)

docs_router = APIRouter(prefix="/api/docs", tags=["docs"])

DOCS_DIR = Path("/app")

# Brand logo URL — same one used in the frontend (see /app/frontend/src/brand.js).
LOGO_URL = (
    "https://customer-assets.emergentagent.com/job_ifeel-backend/artifacts/"
    "p3d8qihf_WhatsApp%20Image%202026-05-21%20at%2012.45.51.jpeg"
)


@lru_cache(maxsize=2)
def _logo_data_uri() -> str:
    """Download the logo once and return a data: URI so WeasyPrint can embed
    it without network access at PDF render time."""
    try:
        with httpx.Client(timeout=10.0, follow_redirects=True) as client:
            r = client.get(LOGO_URL)
            r.raise_for_status()
        mime = r.headers.get("content-type", "image/jpeg").split(";")[0].strip()
        if "jpeg" in mime or "jpg" in mime:
            mime = "image/jpeg"
        elif "png" in mime:
            mime = "image/png"
        b64 = base64.b64encode(r.content).decode("ascii")
        return f"data:{mime};base64,{b64}"
    except Exception as e:  # noqa: BLE001
        logger.warning("Could not fetch logo for docs: %s", e)
        return ""


HTML_SHELL = """<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=Fraunces:ital,wght@0,500;0,700;1,500&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
<style>
  :root {{
    --pink: #FF5A6A;
    --teal: #14b8a6;
    --indigo: #4f46e5;
    --gold: #d4a017;
    --ink: #1a1530;
    --ink-2: #2a2542;
    --muted: #6b6485;
    --paper: #fdfaf6;
  }}
  * {{ box-sizing: border-box; }}
  html, body {{ margin: 0; padding: 0; }}
  body {{
    font-family: 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif;
    background:
      radial-gradient(1200px 800px at 10% -10%, #ffe4ec 0%, transparent 60%),
      radial-gradient(1000px 700px at 110% 10%, #e0f7f4 0%, transparent 55%),
      radial-gradient(1200px 900px at 50% 110%, #efe7ff 0%, transparent 60%),
      var(--paper);
    color: var(--ink);
    line-height: 1.7;
    min-height: 100vh;
  }}
  .doc-shell {{
    max-width: 880px;
    margin: 0 auto;
    padding: 56px 28px 96px;
  }}
  .doc-card {{
    background: rgba(255,255,255,0.85);
    border: 1px solid rgba(255,255,255,0.6);
    border-radius: 28px;
    padding: 56px clamp(28px, 5vw, 64px);
    box-shadow: 0 24px 80px -20px rgba(80, 30, 120, 0.18), 0 4px 12px rgba(0,0,0,0.04);
  }}

  /* ── Brand header ───────────────────────────────────────────── */
  .brand-header {{
    display: flex;
    align-items: center;
    gap: 18px;
    margin-bottom: 28px;
    padding-bottom: 24px;
    border-bottom: 1px solid rgba(80, 30, 120, 0.08);
  }}
  .brand-logo {{
    width: 64px;
    height: 64px;
    border-radius: 18px;
    object-fit: cover;
    box-shadow: 0 12px 28px -8px rgba(192, 38, 211, 0.35), 0 2px 8px rgba(0,0,0,0.06);
    background: white;
    padding: 4px;
    flex-shrink: 0;
  }}
  .brand-meta {{ display: flex; flex-direction: column; }}
  .brand-name {{
    font-family: 'Fraunces', Georgia, serif;
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.01em;
    background: linear-gradient(135deg, #FF5A6A 0%, #c026d3 50%, #4f46e5 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    line-height: 1.1;
  }}
  .brand-tag {{
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: var(--muted);
    margin-top: 4px;
    font-weight: 600;
  }}

  .doc-banner {{
    display: inline-flex;
    align-items: center;
    gap: 10px;
    padding: 10px 20px;
    border-radius: 999px;
    background: linear-gradient(135deg, #FF5A6A 0%, #c026d3 50%, #14b8a6 100%);
    color: white;
    font-weight: 700;
    font-size: 12px;
    letter-spacing: 0.4px;
    text-transform: uppercase;
    width: auto;
    margin-bottom: 28px;
    box-shadow: 0 12px 32px -8px rgba(255, 90, 106, 0.5);
  }}
  .doc-banner::before {{
    content: '';
    width: 8px; height: 8px; border-radius: 50%;
    background: white;
    box-shadow: 0 0 12px white;
  }}

  h1 {{
    font-family: 'Fraunces', Georgia, serif;
    font-size: 44px;
    line-height: 1.08;
    letter-spacing: -0.02em;
    margin: 0 0 18px;
    background: linear-gradient(135deg, #1a1530 0%, #4f46e5 50%, #FF5A6A 100%);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    page-break-after: avoid;
  }}
  h2 {{
    font-family: 'Fraunces', Georgia, serif;
    font-size: 28px;
    margin: 48px 0 14px;
    padding-top: 24px;
    border-top: 1px solid rgba(80,30,120,0.08);
    color: #2a1f4a;
    letter-spacing: -0.01em;
    page-break-after: avoid;
    page-break-before: auto;
  }}
  h2:first-of-type {{ border-top: none; padding-top: 0; margin-top: 24px; }}
  h3 {{
    font-size: 20px;
    margin: 32px 0 10px;
    color: #4a3a7a;
    font-weight: 700;
    page-break-after: avoid;
  }}
  h4 {{
    font-size: 15px;
    margin: 24px 0 8px;
    color: #6b3aa3;
    text-transform: uppercase;
    letter-spacing: 0.6px;
    font-weight: 700;
    page-break-after: avoid;
  }}
  p {{ margin: 10px 0; color: var(--ink-2); font-size: 15px; }}

  blockquote {{
    margin: 20px 0;
    padding: 16px 22px;
    background: linear-gradient(135deg, rgba(255,90,106,0.06), rgba(20,184,166,0.06));
    border-left: 4px solid var(--pink);
    border-radius: 12px;
    font-style: italic;
    color: #4a3a7a;
    page-break-inside: avoid;
  }}
  blockquote p {{ margin: 0; }}
  blockquote em {{ color: #6b3aa3; }}

  ul {{ padding-left: 26px; margin: 12px 0; }}
  ul li {{ margin: 6px 0; color: var(--ink-2); }}

  /* Ordered lists with circular step numbers */
  ol {{
    counter-reset: step;
    list-style: none;
    padding-left: 0;
    margin: 14px 0;
  }}
  ol > li {{
    position: relative;
    padding: 8px 0 8px 52px;
    counter-increment: step;
    color: var(--ink-2);
    page-break-inside: avoid;
  }}
  ol > li::before {{
    content: counter(step);
    position: absolute;
    left: 0; top: 8px;
    width: 34px; height: 34px;
    border-radius: 50%;
    background: linear-gradient(135deg, #FF5A6A, #c026d3);
    color: white;
    font-weight: 700;
    font-size: 13px;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 6px 16px -4px rgba(192, 38, 211, 0.4);
  }}
  ol ol > li::before {{ background: linear-gradient(135deg, #14b8a6, #4f46e5); }}

  strong {{ color: var(--ink); font-weight: 700; }}
  em {{ color: #4a3a7a; }}

  /* Inline code */
  code {{
    background: rgba(80,30,120,0.08);
    padding: 2px 7px;
    border-radius: 5px;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 0.88em;
    color: #6b3aa3;
  }}

  /* Code block */
  pre {{
    background: #1a1530;
    color: #f3e8ff;
    padding: 18px 22px;
    border-radius: 14px;
    overflow-x: auto;
    font-family: 'JetBrains Mono', ui-monospace, monospace;
    font-size: 12.5px;
    line-height: 1.55;
    margin: 16px 0;
    box-shadow: 0 8px 24px -8px rgba(26, 21, 48, 0.4);
    page-break-inside: avoid;
    white-space: pre-wrap;
    word-wrap: break-word;
  }}
  pre code {{
    background: transparent;
    color: inherit;
    padding: 0;
    font-size: inherit;
  }}

  hr {{
    border: none;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(80,30,120,0.2), transparent);
    margin: 40px 0;
  }}

  /* Tables */
  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 20px 0;
    background: white;
    border-radius: 14px;
    overflow: hidden;
    box-shadow: 0 4px 20px -8px rgba(80,30,120,0.15);
    page-break-inside: avoid;
    font-size: 13px;
  }}
  th {{
    background: linear-gradient(135deg, #4f46e5, #c026d3);
    color: white;
    padding: 12px 14px;
    text-align: left;
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.4px;
    font-weight: 700;
  }}
  td {{
    padding: 10px 14px;
    border-top: 1px solid rgba(80,30,120,0.06);
    vertical-align: top;
    color: var(--ink-2);
  }}
  tr:nth-child(even) td {{ background: rgba(245, 237, 255, 0.4); }}

  a {{
    color: #c026d3;
    text-decoration: none;
    border-bottom: 1px dashed rgba(192,38,211,0.4);
    word-break: break-word;
  }}
  a:hover {{ color: #4f46e5; border-bottom-color: #4f46e5; }}

  .doc-footer {{
    text-align: center;
    margin-top: 56px;
    padding-top: 28px;
    border-top: 1px solid rgba(80,30,120,0.08);
    color: var(--muted);
    font-size: 13px;
  }}

  .toolbar {{
    position: sticky; top: 16px;
    display: flex; gap: 10px; justify-content: flex-end;
    margin-bottom: -32px;
    z-index: 10;
  }}
  .toolbar a {{
    background: white;
    border: 1px solid rgba(80,30,120,0.12);
    border-radius: 999px;
    padding: 8px 16px;
    font-size: 13px;
    font-weight: 600;
    color: #4f46e5;
    box-shadow: 0 4px 14px -4px rgba(80,30,120,0.18);
    text-decoration: none;
  }}
  .toolbar a:hover {{ background: #4f46e5; color: white; border-color: #4f46e5; }}
  .toolbar a.pdf {{
    background: linear-gradient(135deg, #FF5A6A, #c026d3);
    color: white;
    border-color: transparent;
  }}
  .toolbar a.pdf:hover {{ filter: brightness(1.05); }}

  /* ── Print / PDF styles (used by both browser print AND WeasyPrint) ── */
  @page {{
    size: A4;
    margin: 14mm 10mm 18mm 10mm;
    @bottom-center {{
      content: "IFEELINCOLOR  ·  Page " counter(page) "  of  " counter(pages);
      font-family: 'Plus Jakarta Sans', sans-serif;
      font-size: 9pt;
      color: #8F8493;
    }}
  }}
  @media print {{
    body {{
      background: white;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      font-size: 11pt;
    }}
    .doc-shell {{ padding: 0; max-width: 100%; }}
    .doc-card {{
      box-shadow: none;
      border: none;
      padding: 0;
      background: white;
      border-radius: 0;
      max-width: 100%;
    }}
    .toolbar {{ display: none !important; }}
    a {{ color: #c026d3; }}

    /* ── Page-break strategy ──
       Big elements (long tables, long code blocks) MUST be allowed to
       break across pages, otherwise the previous page is left with a
       huge empty gap. Only small atomic elements stay together. ── */
    pre {{ page-break-inside: auto; }}        /* long code blocks: let them flow */
    table {{ page-break-inside: auto; }}      /* long tables: let them flow */
    thead {{ display: table-header-group; }}  /* repeat header on each page */
    tr {{ page-break-inside: avoid; }}        /* but don't split a row in half */
    blockquote, ol > li {{ page-break-inside: avoid; }}
    h1, h2, h3, h4 {{ page-break-after: avoid; }}

    /* ── CRITICAL: WeasyPrint does NOT support `background-clip: text`.
       Without this override the gradient renders as a colored BAR and
       the heading text becomes invisible. We force solid brand colors
       in print mode so every heading is fully readable in the PDF. ── */
    h1, .brand-name {{
      background: none !important;
      -webkit-background-clip: unset !important;
      background-clip: unset !important;
      -webkit-text-fill-color: initial !important;
      color: #4f46e5 !important;
    }}

    /* ── CRITICAL: aggressive wrapping for code blocks, inline code and
       table cells so nothing overflows the printable page width. Long
       env-var values, URLs and SQL/JS strings will wrap inside the block
       instead of being clipped at the right edge. ── */
    pre, pre code {{
      white-space: pre-wrap !important;
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
      overflow: visible !important;
    }}
    pre {{
      font-size: 9.2pt !important;
      line-height: 1.5 !important;
      padding: 12px 14px !important;
      max-width: 100% !important;
      box-sizing: border-box;
    }}
    code {{
      word-break: break-all !important;
      overflow-wrap: anywhere !important;
      white-space: pre-wrap !important;
    }}
    table {{
      table-layout: fixed;
      width: 100% !important;
      font-size: 10pt !important;
    }}
    th, td {{
      word-break: break-word !important;
      overflow-wrap: anywhere !important;
      padding: 8px 10px !important;
    }}
    a {{ word-break: break-word; overflow-wrap: anywhere; }}
    /* Force backgrounds to print (Chrome/Safari) */
    th {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
  }}
</style>
</head>
<body>
  <div class="doc-shell">
    <div class="toolbar no-print">
      <a href="{download_url}" data-testid="download-md">Download .md</a>
      <a href="{pdf_url}" class="pdf" data-testid="download-pdf">📄 Download PDF</a>
    </div>
    <div class="doc-card">
      <div class="brand-header">
        {logo_html}
        <div class="brand-meta">
          <div class="brand-name">IFEELINCOLOR</div>
          <div class="brand-tag">Every feeling has a color. Every voice matters.</div>
        </div>
      </div>
      <div class="doc-banner">{banner}</div>
      {body}
      <div class="doc-footer">
        Crafted with care · IFEELINCOLOR © 2026 · Developed by Projexino Solutions Pvt Ltd
      </div>
    </div>
  </div>
</body>
</html>"""


def _build_html(md_text: str, *, title: str, banner: str, download_url: str, pdf_url: str) -> str:
    """Render a markdown string with the IFEELINCOLOR doc shell."""
    body_html = md.markdown(
        md_text,
        extensions=["extra", "tables", "toc", "sane_lists", "fenced_code", "nl2br"],
    )
    logo_uri = _logo_data_uri()
    logo_html = (
        f'<img src="{logo_uri}" alt="IFEELINCOLOR" class="brand-logo" />'
        if logo_uri else
        '<div class="brand-logo" style="background:linear-gradient(135deg,#FF5A6A,#c026d3,#14b8a6);"></div>'
    )
    return HTML_SHELL.format(
        title=title,
        banner=banner,
        body=body_html,
        download_url=download_url,
        pdf_url=pdf_url,
        logo_html=logo_html,
    )


def _render_pdf(html: str) -> bytes:
    """Convert the HTML into a print-ready PDF using WeasyPrint."""
    from weasyprint import HTML  # imported lazily so module load stays cheap

    buf = io.BytesIO()
    # base_url='.' lets WeasyPrint resolve any relative URLs; the logo is a
    # data: URI so this is mostly belt-and-braces.
    HTML(string=html, base_url=str(DOCS_DIR)).write_pdf(target=buf)
    return buf.getvalue()


# ─── User Guide ───────────────────────────────────────────────────────────

@docs_router.get("/user-guide", response_class=HTMLResponse)
async def render_user_guide():
    path = DOCS_DIR / "IFEELINCOLOR_USER_GUIDE.md"
    if not path.exists():
        raise HTTPException(404, "User guide not found")
    html = _build_html(
        path.read_text(encoding="utf-8"),
        title="IFEELINCOLOR — Ultimate User Guide",
        banner="IFEELINCOLOR · Client Documentation",
        download_url="/api/docs/user-guide.md",
        pdf_url="/api/docs/user-guide.pdf",
    )
    return HTMLResponse(html)


@docs_router.get("/user-guide.md", response_class=PlainTextResponse)
async def download_user_guide_md():
    path = DOCS_DIR / "IFEELINCOLOR_USER_GUIDE.md"
    if not path.exists():
        raise HTTPException(404, "User guide not found")
    return FileResponse(
        path, media_type="text/markdown", filename="IFEELINCOLOR_USER_GUIDE.md",
    )


@docs_router.get("/user-guide.pdf")
async def download_user_guide_pdf():
    path = DOCS_DIR / "IFEELINCOLOR_USER_GUIDE.md"
    if not path.exists():
        raise HTTPException(404, "User guide not found")
    html = _build_html(
        path.read_text(encoding="utf-8"),
        title="IFEELINCOLOR — Ultimate User Guide",
        banner="IFEELINCOLOR · Client Documentation",
        download_url="/api/docs/user-guide.md",
        pdf_url="/api/docs/user-guide.pdf",
    )
    pdf_bytes = _render_pdf(html)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="IFEELINCOLOR_User_Guide.pdf"',
        },
    )


# ─── Developer Handover ───────────────────────────────────────────────────

@docs_router.get("/developer-handover", response_class=HTMLResponse)
async def render_developer_handover():
    path = DOCS_DIR / "IFEELINCOLOR_DEVELOPER_HANDOVER.md"
    if not path.exists():
        raise HTTPException(404, "Developer handover not found")
    html = _build_html(
        path.read_text(encoding="utf-8"),
        title="IFEELINCOLOR — Developer Specification & Handover",
        banner="IFEELINCOLOR · Developer Specification &amp; Handover",
        download_url="/api/docs/developer-handover.md",
        pdf_url="/api/docs/developer-handover.pdf",
    )
    return HTMLResponse(html)


@docs_router.get("/developer-handover.md", response_class=PlainTextResponse)
async def download_developer_handover_md():
    path = DOCS_DIR / "IFEELINCOLOR_DEVELOPER_HANDOVER.md"
    if not path.exists():
        raise HTTPException(404, "Developer handover not found")
    return FileResponse(
        path, media_type="text/markdown", filename="IFEELINCOLOR_DEVELOPER_HANDOVER.md",
    )


@docs_router.get("/developer-handover.pdf")
async def download_developer_handover_pdf():
    path = DOCS_DIR / "IFEELINCOLOR_DEVELOPER_HANDOVER.md"
    if not path.exists():
        raise HTTPException(404, "Developer handover not found")
    html = _build_html(
        path.read_text(encoding="utf-8"),
        title="IFEELINCOLOR — Developer Specification & Handover",
        banner="IFEELINCOLOR · Developer Specification &amp; Handover",
        download_url="/api/docs/developer-handover.md",
        pdf_url="/api/docs/developer-handover.pdf",
    )
    pdf_bytes = _render_pdf(html)
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'attachment; filename="IFEELINCOLOR_Developer_Handover.pdf"',
        },
    )
