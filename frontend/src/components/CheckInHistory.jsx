import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Calendar, Clock, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import axios from 'axios';
import { healReflection } from '../lib/healReflection';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function CheckInHistory() {
  const [checkins, setCheckins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    fetchCheckins();
  }, []);

  const fetchCheckins = async () => {
    try {
      const res = await axios.get(`${API}/checkins`, { withCredentials: true });
      setCheckins(res.data.checkins || []);
      setTotal(res.data.total || 0);
    } catch (err) {
      console.error('Failed to fetch checkins:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = checkins.filter(c =>
    !searchTerm ||
    c.user_selected_emotion?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.starting_body_part?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.date?.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-24 rounded-3xl animate-pulse" style={{ background: 'rgba(7,59,76,0.06)' }} />
        ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-fredoka font-semibold" style={{ color: '#073B4C' }}>Check-in History</h2>
          <p className="text-sm font-nunito" style={{ color: '#4A6FA5' }}>{total} total check-ins</p>
        </div>
        <div className="relative w-60">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#4A6FA5' }} />
          <Input
            data-testid="checkin-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by emotion, body part..."
            className="pl-10 rounded-full border-2 font-nunito text-sm"
            style={{ borderColor: 'rgba(7,59,76,0.1)', background: '#FFFFFF', color: '#073B4C' }}
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-3xl border" style={{ borderColor: 'rgba(7,59,76,0.1)', background: '#FFFFFF' }}>
          <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center" style={{ background: 'rgba(255,209,102,0.2)' }}>
            <Calendar className="w-8 h-8" style={{ color: '#FFD166' }} />
          </div>
          <p className="font-nunito font-medium" style={{ color: '#073B4C' }}>No check-ins yet</p>
          <p className="text-sm font-nunito" style={{ color: '#4A6FA5' }}>Start your first check-in to see your history here</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((c, i) => (
            <motion.div
              key={c.checkin_id || i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-3xl border overflow-hidden"
              style={{ background: '#FFFFFF', borderColor: 'rgba(7,59,76,0.1)', boxShadow: '0 4px 15px rgba(7,59,76,0.05)' }}
            >
              <button
                data-testid={`checkin-item-${c.checkin_id}`}
                onClick={() => setExpandedId(expandedId === c.checkin_id ? null : c.checkin_id)}
                className="w-full p-5 flex items-center justify-between text-left cursor-pointer"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl shadow-md flex-shrink-0" style={{ background: c.user_selected_color || '#FFD166' }} />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-3 h-3" style={{ color: '#4A6FA5' }} />
                      <span className="text-sm font-nunito font-medium" style={{ color: '#073B4C' }}>{c.date}</span>
                      <Clock className="w-3 h-3 ml-2" style={{ color: '#4A6FA5' }} />
                      <span className="text-sm font-nunito" style={{ color: '#4A6FA5' }}>{c.time}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-nunito px-2 py-0.5 rounded-full" style={{ background: 'rgba(239,71,111,0.1)', color: '#EF476F' }}>
                        {c.user_selected_emotion?.charAt(0).toUpperCase() + c.user_selected_emotion?.slice(1)}
                      </span>
                      <span className="text-xs font-nunito" style={{ color: '#4A6FA5' }}>{c.starting_body_part?.split(/[\s/]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' / ')}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-nunito" style={{ color: '#EF476F' }}>{c.intensity_rating_before}</span>
                      <span className="text-xs font-nunito" style={{ color: '#4A6FA5' }}>→</span>
                      <span className="text-xs font-nunito" style={{ color: '#06D6A0' }}>{c.intensity_rating_after}</span>
                    </div>
                  </div>
                  {expandedId === c.checkin_id ? (
                    <ChevronUp className="w-4 h-4" style={{ color: '#4A6FA5' }} />
                  ) : (
                    <ChevronDown className="w-4 h-4" style={{ color: '#4A6FA5' }} />
                  )}
                </div>
              </button>

              {expandedId === c.checkin_id && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="px-5 pb-5 border-t"
                  style={{ borderColor: 'rgba(7,59,76,0.06)' }}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4">
                    {[
                      { label: 'Body Part', val: c.starting_body_part },
                      { label: 'Sensation', val: c.starting_sensation },
                      { label: 'Deeper Feeling', val: c.deeper_feeling || '-' },
                      { label: 'Regulation Step', val: c.regulation_step_chosen || '-' },
                      { label: 'Step Completed', val: c.step_completed ? 'Yes' : 'No' },
                      { label: 'Ending Emotion', val: c.ending_emotion || '-' },
                      { label: 'Ending Sensation', val: c.ending_body_sensation || '-' },
                    ].map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl" style={{ background: 'rgba(253,252,220,0.5)' }}>
                        <p className="text-xs font-nunito" style={{ color: '#4A6FA5' }}>{item.label}</p>
                        <p className="text-sm font-nunito font-medium" style={{ color: '#073B4C' }}>{item.val}</p>
                      </div>
                    ))}
                  </div>
                  {c.ending_color && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-xs font-nunito" style={{ color: '#4A6FA5' }}>Ending Color:</span>
                      <div className="w-6 h-6 rounded-full shadow-sm" style={{ background: c.ending_color }} />
                    </div>
                  )}
                  {c.app_reflection_text && (
                    <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(255,209,102,0.1)' }}>
                      <p className="text-xs font-nunito" style={{ color: '#4A6FA5' }}>Reflection</p>
                      <p className="text-sm font-nunito" style={{ color: '#073B4C' }} data-testid="checkin-reflection-text">
                        {healReflection(c.app_reflection_text, {
                          body_part: c.starting_body_part,
                          sensation: c.starting_sensation,
                          emotion: c.user_selected_emotion,
                        })}
                      </p>
                    </div>
                  )}
                  {c.journal_notes && (
                    <div className="mt-3 p-3 rounded-xl" style={{ background: 'rgba(17,138,178,0.05)' }}>
                      <p className="text-xs font-nunito" style={{ color: '#4A6FA5' }}>Journal Notes</p>
                      <p className="text-sm font-nunito" style={{ color: '#073B4C' }}>{c.journal_notes}</p>
                    </div>
                  )}
                </motion.div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
