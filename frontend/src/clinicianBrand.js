// Shared clinician portal palette — emerald/pine light theme (mirrors the
// Patient portal aesthetic with a distinct medical green identity).
//
// Keys are kept intentionally compatible with the previous dark-theme
// palette so any page that imported `CLIN.accent`/`CLIN.sub`/etc keeps
// working without code changes — values are just re-mapped to emerald.
export const CLIN = {
  bg1: '#E6F7F1',                       // very light mint
  bg2: '#DBF1E6',                       // soft seafoam
  bg3: '#FFF6E5',                       // warm butter (gradient end)
  primary: '#1F6F54',                   // deep pine (was teal)
  accent: '#1F6F54',                    // deep pine for labels/headers
  highlight: '#A5DCC7',                 // mint
  lilac: '#2FA37A',                     // re-purposed → emerald
  gold: '#D97706',                      // amber-orange
  text: '#0A2A20',                      // deep ink (was white)
  sub: 'rgba(10,42,32,0.62)',           // muted ink (was white/65)
  faint: 'rgba(31,111,84,0.08)',        // soft pine tint (was white/8)
  border: 'rgba(31,111,84,0.22)',       // pine border
};

// Light gradient backdrop — replaces the old midnight indigo gradient.
export const CLIN_BG =
  'linear-gradient(180deg, #E6F7F1 0%, #DBF1E6 35%, #E8F8EF 70%, #FFF6E5 100%)';
