"""Server-side PDF dossier generator using ReportLab.

Renders a richly branded multi-page A4 health-dossier PDF for a patient on
the server, so the file downloads identically on every device — including
Android WebView APKs built via Median.co / WebViewGold where the client-side
jsPDF.save() trigger is silently blocked.

Output is streamed back via FastAPI as ``application/pdf`` with a
``Content-Disposition: attachment`` header so the browser / WebView / system
PDF viewer takes over.
"""
from __future__ import annotations

import io
from datetime import datetime
from typing import Any, Dict, List, Optional

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak,
    KeepInFrame,
)


# ── Brand palette ─────────────────────────────────────────────────────────
BRAND_PINK = colors.HexColor("#FF4FBF")
BRAND_VIOLET = colors.HexColor("#A78BFA")
BRAND_TEAL = colors.HexColor("#22D3C5")
BRAND_GREEN = colors.HexColor("#22D67E")
BRAND_YELLOW = colors.HexColor("#FFD23F")
BRAND_ORANGE = colors.HexColor("#FF7A00")
BRAND_BLUE = colors.HexColor("#60A5FA")
INK = colors.HexColor("#141438")
INK2 = colors.HexColor("#28284A")
MUTED = colors.HexColor("#787C94")
SURFACE = colors.HexColor("#F8F9FC")

SEVERITY_COLORS = {
    "critical": BRAND_PINK,
    "high": BRAND_ORANGE,
    "moderate": BRAND_YELLOW,
    "low": BRAND_GREEN,
}

# Friendly text for legacy seed question IDs (th1, hs1, a1, ...) that don't
# match the current admin question template. Keeps older patient dossiers
# readable instead of printing the raw key.
LEGACY_Q_TEXT = {
    "th1": "Have you been hospitalised in the past 5 years?",
    "th2": "Any chronic conditions or ongoing treatments?",
    "th3": "Are you currently on any medication?",
    "th4": "Have you spoken to a mental-health professional before?",
    "hs1": "How would you describe your current social support?",
    "hs2": "Are you experiencing any major life stressors right now?",
    "hs3": "How is your overall sleep quality?",
    "hs4": "How active have you been this week?",
    "a1": "Over the past 2 weeks, how often have you felt down or hopeless?",
    "a2": "Over the past 2 weeks, how often have you felt anxious or on edge?",
    "a3": "Over the past 2 weeks, how often have you lost interest in things you usually enjoy?",
    "a4": "How would you describe your energy levels?",
    "a5": "Do you currently have thoughts of harming yourself?",
}


CATEGORY_META = {
    "treatment_history": ("Treatment History", BRAND_PINK),
    "health_social": ("Health & Social Info", BRAND_TEAL),
    "assessment": ("Assessment", BRAND_YELLOW),
}


# ── Helpers ───────────────────────────────────────────────────────────────
def _styles():
    """Brand-coloured Paragraph styles built on top of ReportLab's defaults."""
    base = getSampleStyleSheet()
    return {
        "title": ParagraphStyle(
            "t", parent=base["Title"], fontSize=22, leading=26,
            textColor=INK, fontName="Helvetica-Bold", spaceAfter=4,
        ),
        "subtitle": ParagraphStyle(
            "st", parent=base["Normal"], fontSize=10, leading=13,
            textColor=MUTED, fontName="Helvetica",
        ),
        "h2": ParagraphStyle(
            "h2", parent=base["Heading2"], fontSize=14, leading=18,
            textColor=INK, fontName="Helvetica-Bold", spaceBefore=10,
            spaceAfter=4,
        ),
        "h3": ParagraphStyle(
            "h3", parent=base["Heading3"], fontSize=11, leading=15,
            textColor=INK2, fontName="Helvetica-Bold", spaceBefore=6,
            spaceAfter=2,
        ),
        "body": ParagraphStyle(
            "b", parent=base["Normal"], fontSize=9.5, leading=13,
            textColor=INK2, fontName="Helvetica",
        ),
        "bodySmall": ParagraphStyle(
            "bs", parent=base["Normal"], fontSize=8.5, leading=11,
            textColor=MUTED, fontName="Helvetica",
        ),
        "qLabel": ParagraphStyle(
            "ql", parent=base["Normal"], fontSize=9, leading=12,
            textColor=INK2, fontName="Helvetica-Bold",
        ),
        "qAnswer": ParagraphStyle(
            "qa", parent=base["Normal"], fontSize=9, leading=12,
            textColor=INK, fontName="Helvetica",
            leftIndent=10, spaceAfter=4,
        ),
        "recTitle": ParagraphStyle(
            "rt", parent=base["Normal"], fontSize=10.5, leading=13,
            textColor=INK, fontName="Helvetica-Bold",
        ),
        "recBody": ParagraphStyle(
            "rb", parent=base["Normal"], fontSize=9, leading=12,
            textColor=INK2, fontName="Helvetica",
        ),
        "centered": ParagraphStyle(
            "c", parent=base["Normal"], fontSize=9, leading=12,
            textColor=MUTED, alignment=1, fontName="Helvetica",
        ),
    }


def _header(canv, doc):
    """Painted on every page: thin pink/violet bar + page number."""
    canv.saveState()
    w, h = A4
    # Top gradient bar (solid rectangles approximate the brand gradient).
    canv.setFillColor(BRAND_PINK)
    canv.rect(0, h - 12, w * 0.35, 12, fill=1, stroke=0)
    canv.setFillColor(BRAND_VIOLET)
    canv.rect(w * 0.35, h - 12, w * 0.35, 12, fill=1, stroke=0)
    canv.setFillColor(BRAND_TEAL)
    canv.rect(w * 0.70, h - 12, w * 0.30, 12, fill=1, stroke=0)
    # Footer
    canv.setFillColor(MUTED)
    canv.setFont("Helvetica", 8)
    canv.drawCentredString(
        w / 2, 18, "IFEELINCOLOR · Confidential health dossier",
    )
    canv.drawRightString(w - 18, 18, f"Page {doc.page}")
    canv.restoreState()


def _sev_pill(label: str, sev: str) -> Table:
    """Coloured severity / category pill."""
    color = SEVERITY_COLORS.get(sev, BRAND_TEAL)
    t = Table([[Paragraph(
        f'<font name="Helvetica-Bold" size="9" color="white">{label}</font>',
        ParagraphStyle("p", fontName="Helvetica-Bold", fontSize=9,
                       textColor=colors.white, alignment=1),
    )]], colWidths=[3 * mm + 4.5 * mm * (len(label) + 1)])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("ROUNDEDCORNERS", [6, 6, 6, 6]),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
    ]))
    return t


def _section_header(text: str, color, styles, w: float) -> Table:
    """Coloured rounded section header band."""
    p = Paragraph(
        f'<font name="Helvetica-Bold" size="11" color="white">{text.upper()}</font>',
        styles["h3"],
    )
    t = Table([[p]], colWidths=[w])
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), color),
        ("ROUNDEDCORNERS", [8, 8, 8, 8]),
        ("LEFTPADDING", (0, 0), (-1, -1), 14),
        ("RIGHTPADDING", (0, 0), (-1, -1), 14),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ]))
    return t


def _escape(text: Any) -> str:
    """Make a value safe to drop into ReportLab Paragraph (which uses an XML-like syntax)."""
    if text is None:
        return ""
    s = str(text)
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _format_answer(val: Any) -> str:
    if val is None or val == "":
        return "—"
    if isinstance(val, list):
        return ", ".join(_escape(v) for v in val)
    if isinstance(val, dict):
        # render dicts as key: value pairs
        return ", ".join(f"{_escape(k)}: {_escape(v)}" for k, v in val.items())
    return _escape(val)


# ── Main entrypoint ───────────────────────────────────────────────────────
def build_dossier_pdf(
    patient: Dict[str, Any],
    checkins: List[Dict[str, Any]],
    recommendations: List[Dict[str, Any]],
    assessments: List[Dict[str, Any]],
    questions_by_category: Dict[str, List[Dict[str, Any]]],
) -> bytes:
    """Render the dossier and return raw PDF bytes."""
    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=18 * mm, rightMargin=18 * mm,
        topMargin=22 * mm, bottomMargin=18 * mm,
        title="IFEELINCOLOR · Patient Dossier",
        author="IFEELINCOLOR",
    )
    styles = _styles()
    content_w = doc.width

    story: List[Any] = []

    # ── Cover ────────────────────────────────────────────────────────────
    story.append(Spacer(1, 8))
    story.append(Paragraph("IFEELINCOLOR", styles["title"]))
    story.append(Paragraph("Patient Assessment &amp; Wellbeing Report", styles["subtitle"]))
    story.append(Spacer(1, 6))
    today = datetime.utcnow().strftime("%A, %d %B %Y")
    story.append(Paragraph(today, styles["bodySmall"]))
    story.append(Spacer(1, 14))

    # ── Demographics card ────────────────────────────────────────────────
    demo_rows = [
        ["Name", patient.get("name") or "—"],
        ["Email", patient.get("email") or "—"],
        ["Role", (patient.get("role") or "patient").capitalize()],
        ["Member since",
         (patient.get("joinedAt") or "")[:10] or "—"],
        ["Total check-ins", str(len(checkins))],
        ["Recommendations received", str(len(recommendations))],
    ]
    demo = Table(demo_rows, colWidths=[55 * mm, content_w - 55 * mm])
    demo.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), SURFACE),
        ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
        ("TEXTCOLOR", (1, 0), (1, -1), INK),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTNAME", (1, 0), (1, -1), "Helvetica"),
        ("FONTSIZE", (0, 0), (-1, -1), 9.5),
        ("LEFTPADDING", (0, 0), (-1, -1), 10),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
        ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7F0")),
        ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#E5E7F0")),
    ]))
    story.append(_section_header("Patient Demographics", BRAND_VIOLET, styles, content_w))
    story.append(Spacer(1, 6))
    story.append(demo)
    story.append(Spacer(1, 14))

    # ── Today's Snapshot ─────────────────────────────────────────────────
    latest = checkins[0] if checkins else None
    if latest:
        sev = (latest.get("severity") or "low").lower()
        story.append(_section_header("Today's Snapshot", SEVERITY_COLORS.get(sev, BRAND_GREEN), styles, content_w))
        story.append(Spacer(1, 6))
        snap_rows = [
            ["Severity", sev.upper()],
            ["Starting color", latest.get("user_selected_color") or "—"],
            ["Ending color", latest.get("ending_color") or "—"],
            ["Intensity before → after",
             f"{latest.get('intensity_rating_before', '—')} → {latest.get('intensity_rating_after', '—')}"],
            ["Body focus", str(latest.get("starting_body_part") or "—").replace("_", " ")],
            ["Felt emotion", latest.get("user_selected_emotion") or "—"],
        ]
        snap = Table(snap_rows, colWidths=[55 * mm, content_w - 55 * mm])
        snap.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (0, -1), SURFACE),
            ("TEXTCOLOR", (0, 0), (0, -1), MUTED),
            ("TEXTCOLOR", (1, 0), (1, -1), INK),
            ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 9.5),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LINEBELOW", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7F0")),
            ("BOX", (0, 0), (-1, -1), 1, colors.HexColor("#E5E7F0")),
        ]))
        story.append(snap)
        if latest.get("app_reflection_text"):
            story.append(Spacer(1, 4))
            story.append(Paragraph(
                f'<i>"{_escape(latest["app_reflection_text"])}"</i>',
                styles["body"],
            ))
        story.append(Spacer(1, 14))

    # ── Assessments Q&A ──────────────────────────────────────────────────
    if assessments:
        story.append(PageBreak())
        story.append(_section_header("Assessment Responses", BRAND_TEAL, styles, content_w))
        story.append(Spacer(1, 8))

        # Group by category, keep newest first
        by_cat: Dict[str, List[Dict[str, Any]]] = {}
        for a in assessments:
            cid = a.get("category_id")
            if not cid:
                continue
            by_cat.setdefault(cid, []).append(a)
        for cid in ("treatment_history", "health_social", "assessment"):
            entries = by_cat.get(cid, [])
            if not entries:
                continue
            label, color = CATEGORY_META.get(cid, (cid.title(), BRAND_VIOLET))
            story.append(Paragraph(
                f'<font color="{color.hexval()}" name="Helvetica-Bold" size="12">'
                f'{label}</font> <font color="{MUTED.hexval()}" size="9">'
                f'· {len(entries)} submission{"s" if len(entries) != 1 else ""}</font>',
                styles["h3"],
            ))
            # Build a lookup of question_id → text. Also build a positional
            # fallback so legacy submissions that used "q1", "q2"... keys can
            # still be mapped to the current question template by index.
            qlist = questions_by_category.get(cid, []) or []
            q_lookup = {
                (q.get("question_id") or q.get("id") or q.get("key")): q
                for q in qlist if q
            }
            q_by_position = {
                f"q{i + 1}": q for i, q in enumerate(qlist)
            }
            # Render only the most recent submission per category for the Q&A section
            sub = entries[0]
            sub_date = (sub.get("submitted_at") or "")[:10]
            sev = (sub.get("severity") or "").lower()
            meta_bits = [f"Submitted {sub_date}"]
            if sev:
                meta_bits.append(f"Severity: {sev.upper()}")
            story.append(Paragraph(
                f'<font color="{MUTED.hexval()}" size="8.5">{" · ".join(meta_bits)}</font>',
                styles["bodySmall"],
            ))
            story.append(Spacer(1, 4))

            answers = sub.get("answers") or {}
            rendered = 0
            for q_id, val in answers.items():
                # Skip internal markers like _daily_checkin, _trigger, etc.
                if q_id.startswith("_") or q_id in ("marker", "triggered_from"):
                    continue
                q = q_lookup.get(q_id) or q_by_position.get(q_id)
                q_text = (
                    q.get("text") or q.get("label") or q.get("question")
                    if q else LEGACY_Q_TEXT.get(q_id, q_id)
                )
                story.append(Paragraph(
                    f'<b>Q.</b> {_escape(q_text)}',
                    styles["qLabel"],
                ))
                story.append(Paragraph(
                    f'<font color="{BRAND_GREEN.hexval()}"><b>A.</b></font> {_format_answer(val)}',
                    styles["qAnswer"],
                ))
                rendered += 1
            if rendered == 0:
                story.append(Paragraph(
                    "<i>This submission was driven by the embedded body check-in.</i>",
                    styles["bodySmall"],
                ))

            # AI plan
            ai_plan = sub.get("ai_plan") or {}
            if ai_plan.get("summary") or ai_plan.get("next_steps"):
                story.append(Spacer(1, 6))
                story.append(Paragraph(
                    f'<font color="{BRAND_VIOLET.hexval()}"><b>AI Wellness Plan</b></font>',
                    styles["qLabel"],
                ))
                if ai_plan.get("summary"):
                    story.append(Paragraph(
                        f'<i>"{_escape(ai_plan["summary"])}"</i>', styles["body"],
                    ))
                for step in (ai_plan.get("next_steps") or []):
                    story.append(Paragraph(
                        f'• {_escape(step)}', styles["body"],
                    ))
                if ai_plan.get("encouragement"):
                    story.append(Paragraph(
                        f'<font color="{BRAND_GREEN.hexval()}">{_escape(ai_plan["encouragement"])}</font>',
                        styles["bodySmall"],
                    ))
            story.append(Spacer(1, 12))

    # ── Care Recommendations ─────────────────────────────────────────────
    if recommendations:
        story.append(PageBreak())
        story.append(_section_header("Your Care Recommendations", BRAND_PINK, styles, content_w))
        story.append(Spacer(1, 8))
        for i, rec in enumerate(recommendations, start=1):
            title = _escape(rec.get("title") or "Recommendation")
            body = rec.get("description") or rec.get("body_md") or ""
            category = _escape(rec.get("category") or "")
            ctype = _escape(rec.get("content_type") or "text")
            # 2-column row: number badge + content card
            inner = [
                Paragraph(
                    f'<font name="Helvetica-Bold" size="11" color="{INK.hexval()}">{title}</font>',
                    styles["recTitle"],
                ),
            ]
            if body:
                inner.append(Spacer(1, 2))
                inner.append(Paragraph(_escape(body), styles["recBody"]))
            meta_chips = []
            if category:
                meta_chips.append(
                    f'<font color="{BRAND_BLUE.hexval()}" size="8"><b>{category.upper()}</b></font>'
                )
            if ctype and ctype != "text":
                meta_chips.append(
                    f'<font color="{BRAND_YELLOW.hexval()}" size="8"><b>{ctype.upper()}</b></font>'
                )
            if meta_chips:
                inner.append(Spacer(1, 2))
                inner.append(Paragraph(" · ".join(meta_chips), styles["bodySmall"]))

            # Number badge cell
            badge = Table(
                [[Paragraph(
                    f'<font color="white" size="11" name="Helvetica-Bold">{i}</font>',
                    ParagraphStyle("nb", alignment=1, fontName="Helvetica-Bold",
                                   fontSize=11, textColor=colors.white),
                )]],
                colWidths=[10 * mm], rowHeights=[10 * mm],
            )
            badge.setStyle(TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), BRAND_VIOLET),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("ROUNDEDCORNERS", [12, 12, 12, 12]),
            ]))

            row = Table(
                [[badge, inner]],
                colWidths=[14 * mm, content_w - 14 * mm],
            )
            row.setStyle(TableStyle([
                ("BACKGROUND", (1, 0), (1, -1), SURFACE),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (1, 0), (1, -1), 10),
                ("RIGHTPADDING", (1, 0), (1, -1), 10),
                ("TOPPADDING", (0, 0), (-1, -1), 8),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
                ("BOX", (1, 0), (1, -1), 0.5, colors.HexColor("#E5E7F0")),
                ("ROUNDEDCORNERS", [8, 8, 8, 8]),
            ]))
            story.append(row)
            story.append(Spacer(1, 6))

    # ── Recent Check-in History ──────────────────────────────────────────
    if len(checkins) > 1:
        story.append(PageBreak())
        story.append(_section_header("Recent Check-in History", BRAND_BLUE, styles, content_w))
        story.append(Spacer(1, 8))
        rows = [["Date", "Starting", "Ending", "Δ", "Severity", "Focus"]]
        for c in checkins[:20]:
            date = (c.get("created_at") or c.get("date") or "")[:10]
            before = c.get("intensity_rating_before") or 0
            after = c.get("intensity_rating_after") or 0
            delta = after - before
            rows.append([
                date,
                str(c.get("user_selected_color") or "—")[:18],
                str(c.get("ending_color") or "—")[:18],
                f"{delta:+d}" if delta else "0",
                (c.get("severity") or "—").upper()[:8],
                str(c.get("starting_body_part") or "—").replace("_", " ")[:18],
            ])
        tbl = Table(rows, colWidths=[
            22 * mm, 28 * mm, 28 * mm, 14 * mm, 22 * mm, content_w - 114 * mm,
        ])
        tbl.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), BRAND_VIOLET),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
            ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
            ("FONTSIZE", (0, 0), (-1, -1), 8.5),
            ("ALIGN", (0, 0), (-1, -1), "LEFT"),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, SURFACE]),
            ("BOX", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E7F0")),
            ("LINEBELOW", (0, 0), (-1, -1), 0.3, colors.HexColor("#E5E7F0")),
        ]))
        story.append(tbl)

    story.append(Spacer(1, 12))
    story.append(Paragraph(
        "This dossier is generated by IFEELINCOLOR for your personal reference. "
        "It is not a substitute for medical advice. Please discuss the data with your "
        "clinician.",
        styles["centered"],
    ))

    doc.build(story, onFirstPage=_header, onLaterPages=_header)
    return buf.getvalue()
