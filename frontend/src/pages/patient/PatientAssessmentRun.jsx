import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Check, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '../../components/ui/button';
import { BRAND } from '../../brand';
import CheckInFlow from '../../components/checkin/CheckInFlow';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function PatientAssessmentRun() {
  const { categoryId } = useParams();
  const navigate = useNavigate();
  const [qs, setQs] = useState([]);
  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null);
  const [error, setError] = useState('');

  const [pendingMsg, setPendingMsg] = useState('');
  // Step-3 only — `runCheckin` mounts the embedded 9-step CheckInFlow.
  // `checkinDone` flips true once the patient finishes the body-map flow
  // (ColorShiftSummary → Done) so we don't re-launch on re-render.
  const [runCheckin, setRunCheckin] = useState(false);
  const [checkinDone, setCheckinDone] = useState(false);

  // Only the final "assessment" category triggers the embedded Daily Check-in.
  const isFinalCat = categoryId === 'assessment';

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const r = await axios.get(`${API}/patient/assessment-questions/${categoryId}`, { withCredentials: true });
        if (!mounted) return;
        setQs(r.data.questions || []);
        if (r.data.source === 'admin_pending') {
          setPendingMsg(r.data.message || 'No questions configured yet.');
          return;
        }
        // Hydrate from saved draft (only for first two categories)
        if (categoryId !== 'assessment') {
          try {
            const dr = await axios.get(`${API}/patient/assessment-draft/${categoryId}`, { withCredentials: true });
            const draft = dr.data?.draft;
            if (draft && draft.answers) {
              setAnswers(draft.answers || {});
              const safe = Math.min(Math.max(0, draft.current_index || 0), (r.data.questions || []).length - 1);
              setIdx(safe);
            }
          } catch { /* */ }
        }
      } catch {
        setError('Could not load questions');
      }
    })();
    return () => { mounted = false; };
  }, [categoryId]);

  // Auto-save answers as a draft (debounced) for first two categories
  useEffect(() => {
    if (categoryId === 'assessment' || pendingMsg || !qs.length) return undefined;
    const t = setTimeout(() => {
      axios.post(`${API}/patient/assessment-draft`, {
        category_id: categoryId, answers, current_index: idx,
      }, { withCredentials: true }).catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [answers, idx, categoryId, pendingMsg, qs.length]);

  // Step-3 special: skip ALL static UI and jump straight into the embedded
  // 9-step Daily Check-In whenever the patient is on the "assessment" category.
  // - If qs.length === 0 (admin hasn't configured static questions) → straight to body map
  // - If qs.length > 0 we still ask the static questions first, then transition
  //   *directly* into the check-in flow (no intro bridge card).
  // Either path: once CheckInFlow.onComplete fires we POST assessment-submit
  // and render the result screen below.
  const submitStep3 = async (collectedAnswers) => {
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/patient/assessment-submit`,
        { category_id: categoryId, answers: { ...(collectedAnswers || {}), _daily_checkin: 'completed' } },
        { withCredentials: true });
      setDone(res.data.response);
    } catch (e) {
      setError(e.response?.data?.detail || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (pendingMsg) {
    if (isFinalCat) {
      // No static questions configured → directly render the check-in.
      return (
        <CheckInFlow
          onClose={() => navigate('/app/assessment')}
          onComplete={async () => {
            setCheckinDone(true);
            await submitStep3({});
            navigate('/app/home');
          }}
        />
      );
    }
    return (
      <div className="px-5 pt-10 pb-6 flex flex-col items-center text-center" data-testid="assessment-pending-empty">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center mb-4"
          style={{ background: 'linear-gradient(135deg, #FFD23F, #FF8C3F)', boxShadow: '0 18px 36px -8px rgba(255,140,63,0.45)' }}>
          <span style={{ fontSize: 38 }}>📝</span>
        </div>
        <h2 className="font-fredoka font-semibold text-2xl mb-2" style={{ color: '#2A1A4A' }}>Coming soon</h2>
        <p className="text-sm font-nunito mb-6 max-w-xs" style={{ color: '#6B5784' }}>{pendingMsg}</p>
        <Button onClick={() => navigate('/app/assessment')}
          className="rounded-2xl h-11 px-6 font-nunito font-bold text-white border-0"
          style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` }}>
          Back to Assessments
        </Button>
      </div>
    );
  }

  // Step-3 + static questions answered → directly mount CheckInFlow
  // (no intermediate "One more step" card).
  if (runCheckin) {
    return (
      <CheckInFlow
        onClose={() => setRunCheckin(false)}
        onComplete={async () => {
          setCheckinDone(true);
          setRunCheckin(false);
          await submitStep3(answers);
          navigate('/app/home');
        }}
      />
    );
  }

  if (!qs.length) {
    return (
      <div className="px-5 py-10 text-center">
        <p className="text-sm text-slate-500 font-nunito">{error || 'Loading questions...'}</p>
      </div>
    );
  }

  const q = qs[idx];
  const a = answers[q.question_id];
  const canNext = !q.required || (a !== undefined && a !== '' && a !== null);
  const isLast = idx === qs.length - 1;

  const setAnswer = (v) => setAnswers({ ...answers, [q.question_id]: v });

  const next = () => {
    if (!canNext) return;
    if (isLast) {
      // For the 3rd category ("assessment") jump straight into the embedded
      // Daily Check-in (no intro card).
      if (isFinalCat && !checkinDone) {
        setRunCheckin(true);
        return;
      }
      submit();
    } else {
      setIdx(idx + 1);
    }
  };
  const prev = () => idx > 0 && setIdx(idx - 1);

  const submit = async () => {
    setSubmitting(true);
    try {
      const res = await axios.post(`${API}/patient/assessment-submit`,
        { category_id: categoryId, answers },
        { withCredentials: true });
      setDone(res.data.response);
    } catch (e) {
      setError(e.response?.data?.detail || 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    const sev = done.severity;
    const sevColor = { critical: '#FF3B30', high: '#FF8C3F', moderate: '#FFD23F', low: '#22D67E' }[sev] || BRAND.green;
    const hasRecs = Array.isArray(done.admin_recs) && done.admin_recs.length > 0;
    const isFinal = categoryId === 'assessment';
    return (
      <div className="px-5 pt-10 pb-6 flex flex-col items-center text-center">
        <motion.div
          initial={{ scale: 0 }} animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200 }}
          className="w-24 h-24 rounded-full flex items-center justify-center mb-4"
          style={{ background: `linear-gradient(135deg, ${BRAND.green}, #34d399)`, boxShadow: `0 16px 40px ${BRAND.green}66` }}
        >
          <Check className="w-12 h-12 text-white" />
        </motion.div>
        <h2 className="font-fredoka font-semibold text-2xl mb-2" style={{ color: '#2A1A4A' }}>You did it!</h2>
        <p className="text-sm font-nunito mb-6 max-w-xs" style={{ color: '#6B5784' }}>
          Thank you for sharing. Your responses help us care for you better.
        </p>
        {isFinal && sev && (
          <div className="rounded-2xl px-4 py-2 mb-5 text-white font-bold text-sm"
            style={{ background: sevColor, boxShadow: `0 8px 18px -6px ${sevColor}88` }}>
            Severity: {sev.toUpperCase()}
          </div>
        )}
        {isFinal && (
          <Button
            data-testid="emergency-from-result"
            onClick={() => navigate('/app/emergency')}
            className="mb-3 rounded-2xl h-12 px-6 w-full font-nunito font-bold text-white border-0"
            style={{ background: 'linear-gradient(135deg, #FF3B30, #FF6B6B)' }}
          >
            {sev === 'critical' ? 'Get immediate help' : 'Open Emergency Help'}
          </Button>
        )}
        {isFinal && hasRecs && (
          <Button
            data-testid="view-recommendations-from-result"
            onClick={() => navigate('/app/recommendations')}
            className="mb-3 rounded-2xl h-12 px-6 w-full font-nunito font-bold text-white border-0"
            style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})`, boxShadow: `0 14px 28px -10px ${BRAND.pink}88` }}
          >
            View My {done.admin_recs.length} Portal Recommendation{done.admin_recs.length > 1 ? 's' : ''}
          </Button>
        )}
        {!isFinal && (
          <Button
            data-testid="continue-to-next-category"
            onClick={() => navigate('/app/assessment')}
            className="mb-3 rounded-2xl h-12 px-6 w-full font-nunito font-bold text-white border-0"
            style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})`, boxShadow: `0 14px 28px -10px ${BRAND.pink}88` }}
          >
            Continue to next step <ArrowRight className="w-4 h-4 ml-1.5 inline" />
          </Button>
        )}
        <Button
          data-testid="back-to-home-from-result"
          onClick={() => navigate(isFinal ? '/app/home' : '/app/assessment')}
          variant="ghost"
          className="rounded-2xl h-11 px-6 w-full font-nunito font-bold border"
          style={{ color: '#2A1A4A', borderColor: 'rgba(0,0,0,0.08)' }}
        >
          {isFinal ? (hasRecs ? 'Maybe later · Back to Home' : 'Back to Home') : 'Back to Assessment Hub'}
        </Button>
        {isFinal && !hasRecs && (
          <p className="text-[11px] font-nunito mt-3" style={{ color: '#8F84A8' }}>
            No portal recommendations yet — your care team will add them shortly.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="px-5 pt-4 pb-6">
      {/* Progress */}
      <div className="flex items-center gap-2 mb-5">
        <button data-testid="run-back" onClick={() => navigate('/app/assessment')} className="p-2 -ml-2">
          <ChevronLeft className="w-5 h-5" style={{ color: BRAND.pink }} />
        </button>
        <div className="flex-1">
          <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,79,191,0.15)' }}>
            <motion.div
              animate={{ width: `${((idx + 1) / qs.length) * 100}%` }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${BRAND.pink}, ${BRAND.orange})` }}
            />
          </div>
        </div>
        <span className="text-[11px] font-nunito font-bold" style={{ color: BRAND.pink }}>
          {idx + 1} / {qs.length}
        </span>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={q.question_id}
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -30 }}
          transition={{ duration: 0.25 }}
          className="rounded-3xl p-5"
          style={{ background: 'white', boxShadow: '0 16px 38px -16px rgba(26,35,50,0.12)' }}
        >
          <p className="text-[11px] font-nunito font-bold uppercase tracking-widest mb-3" style={{ color: BRAND.pink }}>
            Question {idx + 1}
          </p>
          <h2 className="font-fredoka font-semibold text-xl mb-5 leading-snug" style={{ color: '#2A1A4A' }}>
            {q.text}
          </h2>

          {/* Answer widgets */}
          {q.type === 'yes_no' && (
            <div className="grid grid-cols-2 gap-3">
              {['Yes', 'No'].map(opt => (
                <button
                  key={opt}
                  data-testid={`opt-${opt.toLowerCase()}`}
                  onClick={() => setAnswer(opt)}
                  className="rounded-2xl h-12 font-fredoka font-semibold transition-all"
                  style={{
                    background: a === opt ? `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` : 'rgba(255,79,191,0.08)',
                    color: a === opt ? 'white' : BRAND.pink,
                    boxShadow: a === opt ? `0 10px 22px -6px ${BRAND.pink}88` : 'none',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {q.type === 'multiple_choice' && (
            <div className="space-y-2">
              {(q.options || []).map(opt => (
                <button
                  key={opt}
                  data-testid={`opt-${opt.replace(/\s+/g, '-').toLowerCase()}`}
                  onClick={() => setAnswer(opt)}
                  className="w-full text-left rounded-2xl px-4 py-3 font-nunito font-semibold text-sm transition-all"
                  style={{
                    background: a === opt ? `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` : 'rgba(255,79,191,0.06)',
                    color: a === opt ? 'white' : '#2A1A4A',
                    boxShadow: a === opt ? `0 8px 18px -6px ${BRAND.pink}66` : 'none',
                  }}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}

          {q.type === 'long_answer' && (
            <textarea
              data-testid="long-answer-input"
              value={a || ''}
              onChange={e => setAnswer(e.target.value)}
              rows={5}
              placeholder="Take your time..."
              className="w-full rounded-2xl p-4 text-sm font-nunito border-0 outline-none resize-none"
              style={{ background: 'rgba(255,79,191,0.06)', color: '#2A1A4A' }}
            />
          )}

          {q.type === 'scale' && (
            <div>
              <div className="flex items-center justify-between text-[10px] font-nunito font-bold mb-2" style={{ color: '#8F84A8' }}>
                <span>{q.scale_min_label}</span><span>{q.scale_max_label}</span>
              </div>
              <input
                data-testid="scale-input"
                type="range"
                min={q.scale_min ?? 0}
                max={q.scale_max ?? 10}
                value={a ?? 5}
                onChange={e => setAnswer(parseInt(e.target.value, 10))}
                className="w-full accent-pink-500"
              />
              <div className="mt-2 text-center font-fredoka font-bold text-2xl" style={{ color: BRAND.pink }}>
                {a ?? 5}
              </div>
            </div>
          )}

          {q.type === 'date_picker' && (
            <input
              data-testid="date-input"
              type="date"
              value={a || ''}
              onChange={e => setAnswer(e.target.value)}
              className="w-full rounded-2xl p-4 text-sm font-nunito"
              style={{ background: 'rgba(255,79,191,0.06)' }}
            />
          )}

          {/* Default text */}
          {!['yes_no', 'multiple_choice', 'long_answer', 'scale', 'date_picker'].includes(q.type) && (
            <input
              type="text"
              value={a || ''}
              onChange={e => setAnswer(e.target.value)}
              className="w-full rounded-2xl p-4 text-sm font-nunito"
              style={{ background: 'rgba(255,79,191,0.06)' }}
            />
          )}
        </motion.div>
      </AnimatePresence>

      {error && <p className="mt-3 text-xs text-red-500 font-nunito text-center">{error}</p>}

      <div className="mt-5 flex gap-3">
        {idx > 0 && (
          <button
            data-testid="prev-question"
            onClick={prev}
            className="rounded-2xl h-12 px-5 font-nunito font-bold text-sm border-2 bg-white"
            style={{ borderColor: BRAND.pink, color: BRAND.pink }}
          >
            <ChevronLeft className="w-4 h-4 inline -ml-1" /> Back
          </button>
        )}
        <Button
          data-testid="next-question"
          onClick={next}
          disabled={!canNext || submitting}
          className="flex-1 rounded-2xl h-12 font-nunito font-bold text-white border-0 disabled:opacity-50"
          style={{ background: `linear-gradient(135deg, ${BRAND.pink}, ${BRAND.orange})` }}
        >
          {submitting ? 'Submitting...' : isLast ? (isFinalCat ? 'Begin Body Check-in' : 'Submit') : 'Next'}
          {!submitting && <ChevronRight className="w-4 h-4 ml-1" />}
        </Button>
      </div>

      <p className="mt-3 text-[10px] text-center font-nunito" style={{ color: '#A599B8' }}>
        Your answers are private and shared only with your care team.
      </p>
    </div>
  );
}

