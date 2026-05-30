"""Enumerate every message a patient can see in the Daily Check-In flow.

Output: a single Markdown catalogue grouped by step. Pulls from the live
`/api/assessments/active` payload so it reflects the current admin config.
"""
import json, re, textwrap, sys

with open('/tmp/checkin_config.json') as f:
    cfg = json.load(f)

body_parts = cfg.get('body_parts', [])
families   = cfg.get('families', [])
sens_map   = cfg.get('sensation_emotion_map', {})

LEGACY_RX = re.compile(r'\bmay be telling you (?:something about your|that you are feeling|about your)\b', re.I)
NEW_TEMPLATE = ("The [sensation] in your [body_part] often shows up when "
                "you're feeling [emotion]. Your body is sharing something — "
                "pause and listen with kindness.")

def render_reflection(template, body_part, sensation, emotion):
    """Mirror frontend fillTemplate() + display-time healer."""
    if not template:
        return ''
    if LEGACY_RX.search(template):
        # display-time healer kicks in
        template = NEW_TEMPLATE
    out = template
    out = re.sub(r'\[sensations?\]', sensation.lower(), out, flags=re.I)
    out = re.sub(r'\[emotion\]',     emotion.lower(),   out, flags=re.I)
    out = re.sub(r'\[body[_ ]?part\]', body_part.lower(), out, flags=re.I)
    out = re.sub(r'\[color\]',       '',                 out, flags=re.I)
    return out.replace('  ', ' ').strip()

out = []
w = out.append

w("# 📖 Daily Check-In — Complete Patient-Facing Message Catalogue\n")
w("_Generated live from `/api/assessments/active`._\n\n")
w("---\n")

# ─── STEP 1: BODY MAP ──────────────────────────────────────────────────────
w("## STEP 1 · Body Map — header & static prompts\n")
w("| Element | Message |")
w("|---|---|")
w("| Step label (top bar) | **Body Map** |")
w("| Close icon tooltip | (no text, ✕ icon) |")
w("| Body-zone labels (12 tappable areas) | " + " · ".join(f"**{bp['name']}**" for bp in body_parts) + " |")
w("\n---\n")

# ─── STEP 2: SENSATIONS — admin-authored per zone ─────────────────────────
w("## STEP 2 · Sensations — per body zone\n")
w("Every row below = one possible body-zone selection. The patient sees:")
w("- the zone label,")
w("- the admin question text,")
w("- the sensation chips,")
w("- (after picking sensations) the auto-derived **Suggested Match** emotion family.\n")
w("| Zone | Admin question | Sensation chips | Default emotion family |")
w("|---|---|---|---|")
for bp in body_parts:
    sens = " · ".join(bp.get('sensations', []))
    w(f"| **{bp['name']}** | _{bp.get('question_text','')}_ | {sens} | `{bp.get('default_emotion_key','—')}` |")
w("\n**Static prompts on this step:**")
w("- *Selected Zone* (uppercase label)")
w("- *How strong is this feeling in your body?*  (slider, 0–10)")
w("- *Barely there / Very strong*  (slider end-labels)")
w("- *Suggested Match*  (badge over the inferred emotion)")
w("- *Based on what you selected, these feelings may match your body signal. You can choose one, or explore the full Feelings Wheel.*")
w("- *Core emotion family*")
w("\n### Sensation → Emotion family map (drives the Suggested Match)\n")
w("| Sensation | Maps to family |")
w("|---|---|")
for s, e in sorted(sens_map.items()):
    w(f"| {s} | **{e}** |")
w("\n---\n")

# ─── STEP 3: FEELINGS WHEEL ───────────────────────────────────────────────
w("## STEP 3 · Feelings Wheel — every label the patient can tap\n")
w("Header: **Feelings Wheel**  ·  Prompt: _How specific can you go?_\n")
w("| Family (L1) | Color | Secondary (L2) | Specific (L3) |")
w("|---|---|---|---|")
for fam in families:
    for l2 in fam.get('level2', []):
        l3s = ", ".join(l2.get('level3', []))
        w(f"| **{fam['label']}** | `{fam['color_hex']}` | {l2['label']} | {l3s} |")
w("\n_Total wheel labels: 7 families × ~3 secondary × ~2 specific ≈ 42 selectable end-states._\n")
w("---\n")

# ─── STEP 4: REFLECTION ──────────────────────────────────────────────────
w("## STEP 4 · Reflection — templated sentence per zone\n")
w("Header: **Reflection**  ·  Title: _Your Reflection_  ·  Subtitle: _Here is what your body might be telling you_\n")
w("Below: 12 zones × representative sensation × representative emotion =")
w("**12 worked examples** rendered exactly as the patient would see them.\n")
w("(Tokens `[sensation]`, `[emotion]`, `[body_part]` are filled live; legacy templates auto-heal on display.)\n")
w("| Zone | Patient picks (sensation, emotion) | Patient sees |")
w("|---|---|---|")
for bp in body_parts:
    sens = bp.get('sensations', [])
    if not sens: continue
    sample_sens = sens[0]
    # pick an emotion derived from this zone's default_emotion_key
    default_key = bp.get('default_emotion_key', 'bad')
    fam = next((f for f in families if f['key'] == default_key), families[0])
    l2_label = (fam.get('level2') or [{}])[0].get('label', fam['label'])
    rendered = render_reflection(
        bp.get('reflection_template', ''),
        bp['name'],
        sample_sens,
        l2_label,
    )
    w(f"| {bp['name']} | _{sample_sens}_, **{l2_label}** ({fam['label']}) | {rendered} |")
w("\n**Default template (applied to 11/12 zones today):**")
w(f"> {NEW_TEMPLATE}\n")
w("**Connected color label** (small footer): the family's color name (e.g. *Yellow*, *Blue*, *Red*).\n")
w("---\n")

# ─── STEP 5: REGULATION — every message per family ────────────────────────
w("## STEP 5 · Regulation — every message routed by the emotion family\n")
w("Header: **Regulation**.\n")
w("**3 phases.** Static prompts shown in every phase:\n")
w("- *Try this step for 60 seconds.*  (intro title)")
w("- *A guided activity tailored for you*  (intro subtitle)")
w("- *Start Activity*  (button)")
w("- _Countdown shows the remaining seconds; each step auto-advances every 60/N seconds with TTS._")
w("- Control buttons during countdown:")
w("    - *I did it*  → end activity")
w("    - *I need another step*  → cycles to next activity in this family")
w("    - *I want to choose a different feeling*  → sends back to the Feelings Wheel")
w("    - *I want to pause*  → exits check-in (not saved)")
w("- *Great job! How do you feel now?*  (post-regulation title)")
w("- *How strong is it now?*  (post slider)")
w("- *After doing the step, what color are you ending with?*  (post color picker)")
w("- *What feeling are you ending with?*  (post text input, placeholder: _e.g. calmer, lighter, settled..._)")
w("- *See my color shift*  (next button)\n")
w("### Per-family regulation messages + activity scripts\n")
for fam in families:
    w(f"#### {fam['label']}  ·  `{fam['color_hex']}`")
    w(f"**Regulation message (colored, top of intro):**")
    w(f"> *{fam.get('regulation_message','')}*\n")
    acts = fam.get('regulation_activities', [])
    for idx, act in enumerate(acts, 1):
        w(f"**Activity {idx}: {act.get('title','')}** — steps shown 1-by-1 over 60s:")
        for i, step in enumerate(act.get('steps', []), 1):
            w(f"  {i}. {step}")
        w("")
    w("")
w("---\n")

# ─── STEP 6: COLOR SHIFT SUMMARY ─────────────────────────────────────────
w("## STEP 6 · Color Shift Summary — narrative formula\n")
w("Header: **Summary**.\n")
w("**Started / Ended dots** show the patient's specific Feelings-Wheel pick (level 3 → level 2 → family) and the chosen ending color.\n")
w("**Narrative formula (rendered with the patient's exact picks):**\n")
w("> You started with **`{zone}`**, **`{sensation(s)}`**, and **`{startLabel}`**.  ")
w("> After regulation, you ended with **`{endingEmotion or endingColorLabel}`**.  ")
w("> Your body shifted from **`{startState}`** toward **`{endState}`**.\n")
w("**Start/end state lookup (dynamic from intensity slider):**")
w("| Intensity | Start state | End state |")
w("|---|---|---|")
w("| ≥ 7 | high intensity | still processing |")
w("| 4–6 | moderate intensity | settling down |")
w("| < 4 | mild awareness | a calmer place |")
w("\n**Intensity delta line (separate sub-paragraph):**")
w("- If `endingIntensity == intensity` → *Your intensity stayed the same. Your body may need more time, or a different step.*")
w("- Else → *Your body intensity moved from `{before}` to `{after}`.*\n")
w("**Other static prompts:**")
w("- *Started / Ended*  (small column headers)")
w("- *Anything you want to remember? (Optional)*  (notes field)")
w("- *Today I noticed that...*  (notes placeholder)")
w("- *Save Check-in*  → on success: *Check-in Saved* + *Great job exploring your feelings today* + *Back to Dashboard*\n")
w("---\n")

# ─── ENDING COLORS ───────────────────────────────────────────────────────
w("## Ending color picker — every chip the patient can tap on post-regulation\n")
w("| Label | Hex |")
w("|---|---|")
for fam in families:
    w(f"| {fam['label']} | `{fam['color_hex']}` |")
w("\n---\n")
w("_End of catalogue._\n")

text = '\n'.join(out)
with open('/tmp/checkin_message_catalogue.md', 'w') as f:
    f.write(text)
print(text)
