/**
 * PlacesAutocomplete — city/town search picker.
 *
 * Calls /api/places/autocomplete and /api/places/details (server proxies the
 * Google Places API key so the frontend never touches it).
 *
 * Props:
 *   value           current label (string) or null
 *   onPick(place)   called with { name, place_id, lat, lng } when user picks
 *   onClear()       called when user clears the pin
 *   placeholder     input placeholder
 *   accent          accent color for the button & highlights
 *   testid          base data-testid prefix (default 'places-autocomplete')
 */
import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { MapPin, X, Search, Loader2 } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PlacesAutocomplete({ value, onPick, onClear, placeholder = 'Search city or town…', accent = '#FF4FBF', testid = 'places-autocomplete' }) {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const [preds, setPreds] = useState([]);
  const [loading, setLoading] = useState(false);
  const [picking, setPicking] = useState(false);
  const debRef = useRef(null);

  const search = (text) => {
    if (debRef.current) clearTimeout(debRef.current);
    debRef.current = setTimeout(async () => {
      if (!text || text.length < 2) { setPreds([]); return; }
      setLoading(true);
      try {
        const r = await axios.get(`${API}/places/autocomplete`, { params: { q: text }, withCredentials: true });
        setPreds(r.data?.predictions || []);
      } catch { setPreds([]); }
      finally { setLoading(false); }
    }, 280);
  };

  useEffect(() => () => { if (debRef.current) clearTimeout(debRef.current); }, []);

  const pick = async (p) => {
    setPicking(true);
    try {
      const r = await axios.get(`${API}/places/details`, { params: { place_id: p.place_id }, withCredentials: true });
      const d = r.data;
      onPick?.({ name: d.formatted_address || d.name || p.description, place_id: d.place_id, lat: d.lat, lng: d.lng });
      setQ(''); setPreds([]); setOpen(false);
    } catch {
      // ignore — keep dropdown open so user can try another option
    } finally { setPicking(false); }
  };

  return (
    <div className="relative" data-testid={testid}>
      {value && !open ? (
        <div className="flex items-center gap-2 rounded-full pl-3 pr-1 py-1.5 text-xs"
          style={{ background: `${accent}14`, border: `1px solid ${accent}55`, color: accent }}
          data-testid={`${testid}-pinned`}>
          <MapPin className="w-3.5 h-3.5" />
          <span className="font-semibold truncate max-w-[200px]">{value}</span>
          <button type="button" onClick={() => setOpen(true)} className="text-[10px] font-bold ml-1 underline" data-testid={`${testid}-change`}>
            change
          </button>
          {onClear && (
            <button type="button" onClick={() => onClear()} className="ml-1 w-5 h-5 rounded-full flex items-center justify-center hover:bg-white/30" data-testid={`${testid}-clear`} aria-label="clear">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              autoFocus={open}
              type="text"
              value={q}
              onChange={(e) => { setQ(e.target.value); search(e.target.value); }}
              placeholder={placeholder}
              className="w-full rounded-2xl pl-9 pr-9 py-2.5 text-xs font-nunito bg-white border outline-none transition"
              style={{ borderColor: `${accent}55`, boxShadow: `0 1px 2px ${accent}14` }}
              data-testid={`${testid}-input`}
            />
            {(loading || picking) && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 animate-spin text-slate-400" />}
            {value && (
              <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 hover:text-slate-700" data-testid={`${testid}-cancel`}>
                cancel
              </button>
            )}
          </div>

          {preds.length > 0 && (
            <ul className="absolute z-50 left-0 right-0 mt-1.5 rounded-2xl overflow-hidden bg-white shadow-xl max-h-72 overflow-y-auto"
              style={{ border: `1px solid ${accent}33` }}
              data-testid={`${testid}-list`}>
              {preds.map((p) => (
                <li key={p.place_id}>
                  <button type="button" onClick={() => pick(p)}
                    data-testid={`${testid}-option-${p.place_id}`}
                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 flex items-start gap-2">
                    <MapPin className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: accent }} />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-slate-800 truncate">{p.main_text || p.description}</p>
                      {p.secondary_text && <p className="text-[10px] text-slate-500 truncate">{p.secondary_text}</p>}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
