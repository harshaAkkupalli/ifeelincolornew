/**
 * Heals legacy check-in reflections that were saved with the original broken
 * template — "Your <body> feeling <Sensation> may be telling you something
 * about your <emotion>." (grammatically off when emotion is an adjective like
 * "grateful", and doesn't clearly connect body↔emotion).
 *
 * If the stored text matches that legacy pattern, regenerate a cleaner sentence
 * on the fly from the structured fields. Otherwise return the stored text as-is
 * (admin-customised templates and new-template reflections both pass through).
 *
 * Usage:
 *   const text = healReflection(checkin.app_reflection_text, {
 *     body_part: checkin.starting_body_part,
 *     sensation: checkin.starting_sensation,
 *     emotion:   checkin.user_selected_emotion,
 *   });
 */
const LEGACY_RX = /\bmay be telling you (?:something about your|that you are feeling|about your)\b/i;

export function healReflection(rawText, fields = {}) {
  if (!rawText) return rawText;
  if (!LEGACY_RX.test(rawText)) return rawText;
  const sensation = (fields.sensation || '').toString().toLowerCase().trim();
  const bodyPart  = (fields.body_part || 'body').toString().toLowerCase().trim();
  const emotion   = (fields.emotion   || '').toString().toLowerCase().trim();
  if (!emotion || !sensation) return rawText; // not enough info to heal
  return `The ${sensation} in your ${bodyPart} often shows up when you're feeling ${emotion}. Your body is sharing something — pause and listen with kindness.`;
}
