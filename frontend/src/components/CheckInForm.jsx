import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '../components/ui/button';
import { Slider } from '../components/ui/slider';
import { Textarea } from '../components/ui/textarea';
import { ChevronLeft, ChevronRight, Sparkles, Check, Loader2 } from 'lucide-react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const BODY_PARTS = ['Head', 'Chest', 'Stomach', 'Hands', 'Legs', 'Back'];
const SENSATIONS = ['Tingling', 'Tightness', 'Warmth', 'Heaviness', 'Lightness', 'Pain', 'Buzzing', 'Numbness'];
const COLORS = [
  { name: 'Sunny Yellow', hex: '#FFD166' },
  { name: 'Ocean Blue', hex: '#118AB2' },
  { name: 'Calm Teal', hex: '#06D6A0' },
  { name: 'Coral Pink', hex: '#EF476F' },
  { name: 'Soft Purple', hex: '#B56576' },
  { name: 'Sky Blue', hex: '#4A6FA5' },
  { name: 'Warm Orange', hex: '#F4845F' },
  { name: 'Mint Green', hex: '#7DCEA0' },
];
const EMOTIONS = ['Happy', 'Sad', 'Calm', 'Worried', 'Angry', 'Excited', 'Tired', 'Confused', 'Loved', 'Scared'];
const REGULATION_STEPS = ['Deep Breathing', 'Body Scan', 'Grounding (5-4-3-2-1)', 'Gentle Movement', 'Drawing', 'Listening to Music'];

const STEPS = ['body', 'sensation', 'ai_suggest', 'color', 'emotion', 'deeper', 'regulation', 'ending', 'intensity', 'journal', 'review'];

export default function CheckInForm() {
  const [step, setStep] = useState(0);
  const [loadingAI, setLoadingAI] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [form, setForm] = useState({
    starting_body_part: '',
    starting_sensation: '',
    suggested_color: null,
    suggested_emotions: [],
    user_selected_color: '',
    user_selected_emotion: '',
    deeper_feeling: '',
    app_reflection_text: '',
    regulation_step_chosen: '',
    step_completed: false,
    ending_color: '',
    ending_emotion: '',
    ending_body_sensation: '',
    intensity_rating_before: 5,
    intensity_rating_after: 5,
    journal_notes: '',
  });

  const update = (key, val) => setForm(p => ({ ...p, [key]: val }));

  const getAISuggestions = async () => {
    setLoadingAI(true);
    try {
      const res = await axios.post(`${API}/ai/suggestions`, {
        body_part: form.starting_body_part,
        sensation: form.starting_sensation,
        current_feeling: form.deeper_feeling || null
      }, { withCredentials: true });
      setAiSuggestion(res.data);
      update('suggested_color', res.data.suggested_color);
      update('suggested_emotions', res.data.suggested_emotions || []);
      update('app_reflection_text', res.data.reflection || '');
    } catch (err) {
      console.error('AI suggestion failed:', err);
    } finally {
      setLoadingAI(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const now = new Date();
      await axios.post(`${API}/checkins`, {
        ...form,
        date: now.toISOString().split('T')[0],
        time: now.toTimeString().split(' ')[0].slice(0, 5),
      }, { withCredentials: true });
      setSubmitted(true);
    } catch (err) {
      console.error('Submit failed:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const canNext = () => {
    const s = STEPS[step];
    if (s === 'body') return !!form.starting_body_part;
    if (s === 'sensation') return !!form.starting_sensation;
    if (s === 'color') return !!form.user_selected_color;
    if (s === 'emotion') return !!form.user_selected_emotion;
    return true;
  };

  const next = () => {
    if (STEPS[step] === 'sensation') {
      getAISuggestions();
    }
    if (step < STEPS.length - 1) setStep(step + 1);
  };
  const prev = () => { if (step > 0) setStep(step - 1); };

  if (submitted) {
    return (
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center py-16">
        <motion.div
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 0.6 }}
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: '#06D6A0' }}
        >
          <Check className="w-10 h-10 text-white" />
        </motion.div>
        <h2 className="text-2xl font-fredoka font-semibold mb-2" style={{ color: '#073B4C' }}>Check-in Complete!</h2>
        <p className="text-base font-nunito mb-6" style={{ color: '#4A6FA5' }}>Great job exploring your feelings today</p>
        <Button
          data-testid="new-checkin-button"
          onClick={() => { setSubmitted(false); setStep(0); setForm({
            starting_body_part: '', starting_sensation: '', suggested_color: null, suggested_emotions: [],
            user_selected_color: '', user_selected_emotion: '', deeper_feeling: '', app_reflection_text: '',
            regulation_step_chosen: '', step_completed: false, ending_color: '', ending_emotion: '',
            ending_body_sensation: '', intensity_rating_before: 5, intensity_rating_after: 5, journal_notes: ''
          }); setAiSuggestion(null); }}
          className="rounded-full px-8 py-3 font-nunito font-bold text-white border-0"
          style={{ background: '#118AB2' }}
        >
          New Check-in
        </Button>
      </motion.div>
    );
  }

  const renderStep = () => {
    const current = STEPS[step];

    if (current === 'body') {
      return (
        <div>
          <h2 className="text-2xl font-fredoka font-semibold mb-2" style={{ color: '#073B4C' }}>Where in your body do you feel something?</h2>
          <p className="text-sm font-nunito mb-6" style={{ color: '#4A6FA5' }}>Tap the body part that stands out right now</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {BODY_PARTS.map(part => (
              <motion.button
                key={part}
                data-testid={`body-part-${part.toLowerCase()}`}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => update('starting_body_part', part)}
                className="p-5 rounded-3xl border-2 text-center transition-all cursor-pointer"
                style={{
                  background: form.starting_body_part === part ? 'rgba(255,209,102,0.2)' : '#FFFFFF',
                  borderColor: form.starting_body_part === part ? '#FFD166' : 'rgba(7,59,76,0.1)',
                  boxShadow: form.starting_body_part === part ? '0 4px 20px rgba(255,209,102,0.3)' : '0 4px 15px rgba(7,59,76,0.05)'
                }}
              >
                <span className="text-3xl block mb-2">{
                  { Head: '🧠', Chest: '💗', Stomach: '🌀', Hands: '🤲', Legs: '🦵', Back: '🔙' }[part]
                }</span>
                <span className="text-sm font-nunito font-medium" style={{ color: '#073B4C' }}>{part}</span>
              </motion.button>
            ))}
          </div>
        </div>
      );
    }

    if (current === 'sensation') {
      return (
        <div>
          <h2 className="text-2xl font-fredoka font-semibold mb-2" style={{ color: '#073B4C' }}>What does it feel like?</h2>
          <p className="text-sm font-nunito mb-6" style={{ color: '#4A6FA5' }}>Pick the sensation that matches best</p>
          <div className="flex flex-wrap gap-3">
            {SENSATIONS.map(s => (
              <motion.button
                key={s}
                data-testid={`sensation-${s.toLowerCase()}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => update('starting_sensation', s)}
                className="px-5 py-3 rounded-full border-2 font-nunito font-medium text-sm transition-all cursor-pointer"
                style={{
                  background: form.starting_sensation === s ? 'rgba(17,138,178,0.15)' : '#FFFFFF',
                  borderColor: form.starting_sensation === s ? '#118AB2' : 'rgba(7,59,76,0.1)',
                  color: form.starting_sensation === s ? '#118AB2' : '#073B4C'
                }}
              >
                {s}
              </motion.button>
            ))}
          </div>
        </div>
      );
    }

    if (current === 'ai_suggest') {
      return (
        <div>
          <h2 className="text-2xl font-fredoka font-semibold mb-2" style={{ color: '#073B4C' }}>Here's what we think...</h2>
          {loadingAI ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#118AB2' }} />
              <span className="ml-3 font-nunito" style={{ color: '#4A6FA5' }}>Getting suggestions...</span>
            </div>
          ) : aiSuggestion ? (
            <div className="space-y-4">
              <div className="p-5 rounded-3xl border" style={{ background: '#FFFFFF', borderColor: 'rgba(7,59,76,0.1)' }}>
                <p className="text-sm font-nunito font-medium mb-2" style={{ color: '#4A6FA5' }}>Suggested Color</p>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full border-2 border-white shadow-md" style={{ background: aiSuggestion.suggested_color }} />
                  <span className="font-nunito font-medium" style={{ color: '#073B4C' }}>{aiSuggestion.suggested_color}</span>
                </div>
              </div>
              <div className="p-5 rounded-3xl border" style={{ background: '#FFFFFF', borderColor: 'rgba(7,59,76,0.1)' }}>
                <p className="text-sm font-nunito font-medium mb-2" style={{ color: '#4A6FA5' }}>Suggested Emotions</p>
                <div className="flex flex-wrap gap-2">
                  {(aiSuggestion.suggested_emotions || []).map(e => (
                    <span key={e} className="px-3 py-1 rounded-full text-sm font-nunito" style={{ background: 'rgba(17,138,178,0.1)', color: '#118AB2' }}>{e}</span>
                  ))}
                </div>
              </div>
              {aiSuggestion.reflection && (
                <div className="p-5 rounded-3xl" style={{ background: 'rgba(255,209,102,0.1)' }}>
                  <p className="text-sm font-nunito font-medium mb-1" style={{ color: '#4A6FA5' }}>Reflection</p>
                  <p className="font-nunito text-sm leading-relaxed" style={{ color: '#073B4C' }}>{aiSuggestion.reflection}</p>
                </div>
              )}
            </div>
          ) : (
            <p className="font-nunito py-8 text-center" style={{ color: '#4A6FA5' }}>No suggestions available. Continue to pick your own colors and emotions!</p>
          )}
        </div>
      );
    }

    if (current === 'color') {
      return (
        <div>
          <h2 className="text-2xl font-fredoka font-semibold mb-2" style={{ color: '#073B4C' }}>Pick a color for this feeling</h2>
          <p className="text-sm font-nunito mb-6" style={{ color: '#4A6FA5' }}>Which color matches how you feel?</p>
          <div className="grid grid-cols-4 gap-4">
            {COLORS.map(c => (
              <motion.button
                key={c.hex}
                data-testid={`color-${c.hex.replace('#', '')}`}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => update('user_selected_color', c.hex)}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl transition-all cursor-pointer"
                style={{
                  background: form.user_selected_color === c.hex ? `${c.hex}22` : 'transparent',
                  border: form.user_selected_color === c.hex ? `3px solid ${c.hex}` : '3px solid transparent'
                }}
              >
                <div className="w-14 h-14 rounded-full shadow-lg" style={{ background: c.hex }} />
                <span className="text-xs font-nunito" style={{ color: '#073B4C' }}>{c.name}</span>
              </motion.button>
            ))}
          </div>
        </div>
      );
    }

    if (current === 'emotion') {
      return (
        <div>
          <h2 className="text-2xl font-fredoka font-semibold mb-2" style={{ color: '#073B4C' }}>How do you feel?</h2>
          <p className="text-sm font-nunito mb-6" style={{ color: '#4A6FA5' }}>Pick the emotion that fits best</p>
          <div className="flex flex-wrap gap-3">
            {EMOTIONS.map(e => (
              <motion.button
                key={e}
                data-testid={`emotion-${e.toLowerCase()}`}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => update('user_selected_emotion', e)}
                className="px-5 py-3 rounded-full border-2 font-nunito font-medium text-sm transition-all cursor-pointer"
                style={{
                  background: form.user_selected_emotion === e ? 'rgba(239,71,111,0.15)' : '#FFFFFF',
                  borderColor: form.user_selected_emotion === e ? '#EF476F' : 'rgba(7,59,76,0.1)',
                  color: form.user_selected_emotion === e ? '#EF476F' : '#073B4C'
                }}
              >
                {e}
              </motion.button>
            ))}
          </div>
        </div>
      );
    }

    if (current === 'deeper') {
      return (
        <div>
          <h2 className="text-2xl font-fredoka font-semibold mb-2" style={{ color: '#073B4C' }}>Can you tell me more?</h2>
          <p className="text-sm font-nunito mb-6" style={{ color: '#4A6FA5' }}>What's the deeper feeling underneath? (Optional)</p>
          <Textarea
            data-testid="deeper-feeling-input"
            value={form.deeper_feeling}
            onChange={(e) => update('deeper_feeling', e.target.value)}
            placeholder="Maybe you feel like... it's hard to... I wish..."
            className="rounded-2xl border-2 p-4 font-nunito min-h-[120px] resize-none"
            style={{ borderColor: 'rgba(7,59,76,0.1)', background: '#FFFFFF', color: '#073B4C' }}
          />
          {form.app_reflection_text && (
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mt-4 p-4 rounded-2xl" style={{ background: 'rgba(255,209,102,0.1)' }}>
              <p className="text-xs font-nunito font-medium mb-1" style={{ color: '#4A6FA5' }}>Reflection from your guide</p>
              <p className="text-sm font-nunito" style={{ color: '#073B4C' }}>{form.app_reflection_text}</p>
            </motion.div>
          )}
        </div>
      );
    }

    if (current === 'regulation') {
      return (
        <div>
          <h2 className="text-2xl font-fredoka font-semibold mb-2" style={{ color: '#073B4C' }}>Let's try something calming</h2>
          <p className="text-sm font-nunito mb-6" style={{ color: '#4A6FA5' }}>Pick a regulation step (Optional)</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {REGULATION_STEPS.map(rs => (
              <motion.button
                key={rs}
                data-testid={`regulation-${rs.toLowerCase().replace(/[^a-z]/g, '-')}`}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => update('regulation_step_chosen', rs)}
                className="p-4 rounded-2xl border-2 text-left font-nunito font-medium text-sm transition-all cursor-pointer"
                style={{
                  background: form.regulation_step_chosen === rs ? 'rgba(6,214,160,0.15)' : '#FFFFFF',
                  borderColor: form.regulation_step_chosen === rs ? '#06D6A0' : 'rgba(7,59,76,0.1)',
                  color: '#073B4C'
                }}
              >
                {rs}
              </motion.button>
            ))}
          </div>
          {form.regulation_step_chosen && (
            <div className="mt-4 flex items-center gap-3">
              <span className="text-sm font-nunito" style={{ color: '#4A6FA5' }}>Did you complete this step?</span>
              <Button
                data-testid="step-completed-toggle"
                onClick={() => update('step_completed', !form.step_completed)}
                className="rounded-full px-4 py-1.5 text-sm font-nunito font-bold border-0"
                style={{ background: form.step_completed ? '#06D6A0' : 'rgba(7,59,76,0.1)', color: form.step_completed ? 'white' : '#073B4C' }}
              >
                {form.step_completed ? 'Yes!' : 'Not yet'}
              </Button>
            </div>
          )}
        </div>
      );
    }

    if (current === 'ending') {
      return (
        <div>
          <h2 className="text-2xl font-fredoka font-semibold mb-2" style={{ color: '#073B4C' }}>How do you feel now?</h2>
          <p className="text-sm font-nunito mb-6" style={{ color: '#4A6FA5' }}>After the regulation step, pick your ending state</p>
          <div className="space-y-6">
            <div>
              <p className="text-sm font-nunito font-medium mb-3" style={{ color: '#073B4C' }}>Ending Color</p>
              <div className="flex flex-wrap gap-3">
                {COLORS.map(c => (
                  <motion.button
                    key={c.hex}
                    data-testid={`ending-color-${c.hex.replace('#', '')}`}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => update('ending_color', c.hex)}
                    className="cursor-pointer"
                    style={{ border: form.ending_color === c.hex ? `3px solid ${c.hex}` : '3px solid transparent', borderRadius: '50%', padding: '2px' }}
                  >
                    <div className="w-10 h-10 rounded-full" style={{ background: c.hex }} />
                  </motion.button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-nunito font-medium mb-3" style={{ color: '#073B4C' }}>Ending Emotion</p>
              <div className="flex flex-wrap gap-2">
                {EMOTIONS.map(e => (
                  <motion.button
                    key={e}
                    data-testid={`ending-emotion-${e.toLowerCase()}`}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => update('ending_emotion', e)}
                    className="px-4 py-2 rounded-full border-2 text-xs font-nunito font-medium transition-all cursor-pointer"
                    style={{
                      background: form.ending_emotion === e ? 'rgba(6,214,160,0.15)' : '#FFFFFF',
                      borderColor: form.ending_emotion === e ? '#06D6A0' : 'rgba(7,59,76,0.1)',
                      color: form.ending_emotion === e ? '#06D6A0' : '#073B4C'
                    }}
                  >
                    {e}
                  </motion.button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-sm font-nunito font-medium mb-3" style={{ color: '#073B4C' }}>Ending Body Sensation</p>
              <div className="flex flex-wrap gap-2">
                {SENSATIONS.map(s => (
                  <motion.button
                    key={s}
                    data-testid={`ending-sensation-${s.toLowerCase()}`}
                    whileHover={{ scale: 1.05 }}
                    onClick={() => update('ending_body_sensation', s)}
                    className="px-4 py-2 rounded-full border-2 text-xs font-nunito font-medium transition-all cursor-pointer"
                    style={{
                      background: form.ending_body_sensation === s ? 'rgba(6,214,160,0.15)' : '#FFFFFF',
                      borderColor: form.ending_body_sensation === s ? '#06D6A0' : 'rgba(7,59,76,0.1)',
                      color: form.ending_body_sensation === s ? '#06D6A0' : '#073B4C'
                    }}
                  >
                    {s}
                  </motion.button>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (current === 'intensity') {
      return (
        <div>
          <h2 className="text-2xl font-fredoka font-semibold mb-2" style={{ color: '#073B4C' }}>Intensity Check</h2>
          <p className="text-sm font-nunito mb-8" style={{ color: '#4A6FA5' }}>Rate how strong your feelings were</p>
          <div className="space-y-8">
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-nunito font-medium" style={{ color: '#073B4C' }}>Before Check-in</span>
                <span className="text-2xl font-fredoka font-semibold" style={{ color: '#EF476F' }}>{form.intensity_rating_before}</span>
              </div>
              <Slider
                data-testid="intensity-before-slider"
                value={[form.intensity_rating_before]}
                onValueChange={([v]) => update('intensity_rating_before', v)}
                min={0}
                max={10}
                step={1}
                className="py-2"
              />
              <div className="flex justify-between text-xs font-nunito mt-1" style={{ color: '#4A6FA5' }}>
                <span>Calm</span><span>Very Strong</span>
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-nunito font-medium" style={{ color: '#073B4C' }}>After Check-in</span>
                <span className="text-2xl font-fredoka font-semibold" style={{ color: '#06D6A0' }}>{form.intensity_rating_after}</span>
              </div>
              <Slider
                data-testid="intensity-after-slider"
                value={[form.intensity_rating_after]}
                onValueChange={([v]) => update('intensity_rating_after', v)}
                min={0}
                max={10}
                step={1}
                className="py-2"
              />
              <div className="flex justify-between text-xs font-nunito mt-1" style={{ color: '#4A6FA5' }}>
                <span>Calm</span><span>Very Strong</span>
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (current === 'journal') {
      return (
        <div>
          <h2 className="text-2xl font-fredoka font-semibold mb-2" style={{ color: '#073B4C' }}>Journal Notes</h2>
          <p className="text-sm font-nunito mb-6" style={{ color: '#4A6FA5' }}>Write anything you want to remember (Optional)</p>
          <Textarea
            data-testid="journal-notes-input"
            value={form.journal_notes}
            onChange={(e) => update('journal_notes', e.target.value)}
            placeholder="Today I learned that... I want to remember..."
            className="rounded-2xl border-2 p-4 font-nunito min-h-[150px] resize-none"
            style={{ borderColor: 'rgba(7,59,76,0.1)', background: '#FFFFFF', color: '#073B4C' }}
          />
        </div>
      );
    }

    if (current === 'review') {
      return (
        <div>
          <h2 className="text-2xl font-fredoka font-semibold mb-4" style={{ color: '#073B4C' }}>Review Your Check-in</h2>
          <div className="space-y-3">
            {[
              { label: 'Body Part', val: form.starting_body_part },
              { label: 'Sensation', val: form.starting_sensation },
              { label: 'Color', val: form.user_selected_color, isColor: true },
              { label: 'Emotion', val: form.user_selected_emotion },
              { label: 'Deeper Feeling', val: form.deeper_feeling || 'Not specified' },
              { label: 'Regulation Step', val: form.regulation_step_chosen || 'None' },
              { label: 'Step Completed', val: form.step_completed ? 'Yes' : 'No' },
              { label: 'Ending Color', val: form.ending_color || 'Not specified', isColor: !!form.ending_color },
              { label: 'Ending Emotion', val: form.ending_emotion || 'Not specified' },
              { label: 'Intensity Before', val: `${form.intensity_rating_before}/10` },
              { label: 'Intensity After', val: `${form.intensity_rating_after}/10` },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between py-2 border-b" style={{ borderColor: 'rgba(7,59,76,0.06)' }}>
                <span className="text-sm font-nunito" style={{ color: '#4A6FA5' }}>{item.label}</span>
                <div className="flex items-center gap-2">
                  {item.isColor && <div className="w-5 h-5 rounded-full" style={{ background: item.val }} />}
                  <span className="text-sm font-nunito font-medium" style={{ color: '#073B4C' }}>{item.isColor ? '' : item.val}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      );
    }
  };

  return (
    <div className="rounded-3xl border p-6 sm:p-8" style={{ background: '#FFFFFF', borderColor: 'rgba(7,59,76,0.1)', boxShadow: '0 8px 30px rgba(7,59,76,0.08)' }}>
      {/* Progress */}
      <div className="flex gap-1 mb-8">
        {STEPS.map((_, i) => (
          <div key={i} className="flex-1 h-2 rounded-full transition-all" style={{ background: i <= step ? '#118AB2' : 'rgba(7,59,76,0.08)' }} />
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>
          {renderStep()}
        </motion.div>
      </AnimatePresence>

      {/* Navigation */}
      <div className="flex items-center justify-between mt-8 pt-6 border-t" style={{ borderColor: 'rgba(7,59,76,0.06)' }}>
        <Button
          data-testid="checkin-prev-button"
          onClick={prev}
          disabled={step === 0}
          variant="ghost"
          className="rounded-full px-4 py-2 font-nunito disabled:opacity-30"
          style={{ color: '#073B4C' }}
        >
          <ChevronLeft className="w-4 h-4 mr-1" /> Back
        </Button>

        <span className="text-xs font-nunito" style={{ color: '#4A6FA5' }}>{step + 1} / {STEPS.length}</span>

        {step === STEPS.length - 1 ? (
          <Button
            data-testid="submit-checkin-button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-full px-6 py-2 font-nunito font-bold text-white border-0"
            style={{ background: '#06D6A0' }}
          >
            {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Sparkles className="w-4 h-4 mr-1" />}
            {submitting ? 'Saving...' : 'Submit'}
          </Button>
        ) : (
          <Button
            data-testid="checkin-next-button"
            onClick={next}
            disabled={!canNext()}
            className="rounded-full px-6 py-2 font-nunito font-bold text-white border-0 disabled:opacity-50"
            style={{ background: '#118AB2' }}
          >
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        )}
      </div>
    </div>
  );
}
