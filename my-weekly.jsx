import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, Legend
} from 'recharts';
import {
  LayoutDashboard, CalendarDays, BookOpen, Dumbbell, ClipboardList,
  History as HistoryIcon, Settings as SettingsIcon, Plus, X, Check,
  ChevronLeft, ChevronRight, Play, Pause, Square, Search, Trash2, Pencil,
  Flame, Home
} from 'lucide-react';

/* ============================== Design tokens ============================== */
const C = {
  bg: '#F7F6F2', surface: '#FFFFFF', surface2: '#EFEDE7',
  text: '#252525', textSub: '#77736B', border: '#E5E2DA',
  sage: '#7D8F7A', blue: '#8394A3', terracotta: '#C28C6A',
};
const SUBJECT_PALETTE = ['#7D8F7A', '#8394A3', '#C28C6A', '#A98CC2', '#9BB08F', '#C2A98C'];
const FONT = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";

/* ============================== Date helpers ============================== */
function pad(n) { return String(n).padStart(2, '0'); }
function toISO(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function startOfWeek(date, weekStartsOn) {
  const d = new Date(date); d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = weekStartsOn === 'Sunday' ? -day : (day === 0 ? -6 : 1 - day);
  d.setDate(d.getDate() + diff);
  return d;
}
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function fmtRange(start, end) {
  const o = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en-US', o)} – ${end.toLocaleDateString('en-US', o)}`;
}
function isoWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}
function fmtDur(mins) {
  mins = Math.round(mins || 0);
  const h = Math.floor(mins / 60), m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MOODS = [
  { v: 'rough', e: '😞', label: 'Rough' },
  { v: 'okay', e: '😐', label: 'Okay' },
  { v: 'good', e: '🙂', label: 'Good' },
  { v: 'great', e: '😊', label: 'Great' },
  { v: 'excellent', e: '🔥', label: 'Excellent' },
];
const EXERCISE_TYPES = ['Walking', 'Running', 'Gym', 'Weight Training', 'Cycling', 'Swimming', 'Yoga', 'Basketball', 'Others'];

/* ============================== Storage layer ============================== */
async function loadJSON(key, fallback) {
  try {
    const res = await window.storage.get(key, false);
    return res ? JSON.parse(res.value) : fallback;
  } catch (e) { return fallback; }
}
async function saveJSON(key, value) {
  try { await window.storage.set(key, JSON.stringify(value), false); }
  catch (e) { console.error('storage save failed', key, e); }
}

const DEFAULT_SETTINGS = {
  weekStartsOn: 'Monday',
  scoreWeights: { study: 40, exercise: 30, review: 20, habit: 10 },
  exerciseWeeklyGoal: 5,
  defaultSessionDuration: 30,
};

/* ============================== Small UI atoms ============================== */
function Card({ children, style, className = '' }) {
  return (
    <div
      className={`rounded-2xl p-6 ${className}`}
      style={{ background: C.surface, border: `1px solid ${C.border}`, boxShadow: '0 2px 8px rgba(0,0,0,0.03)', ...style }}
    >
      {children}
    </div>
  );
}
function Label({ children }) {
  return <label className="block text-xs mb-1.5" style={{ color: C.textSub }}>{children}</label>;
}
function Input(props) {
  return <input {...props} className={`w-full rounded-lg px-3 py-2 text-sm outline-none transition ${props.className || ''}`}
    style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, ...props.style }} />;
}
function Select({ children, ...props }) {
  return <select {...props} className="w-full rounded-lg px-3 py-2 text-sm outline-none"
    style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text }}>{children}</select>;
}
function TextArea(props) {
  return <textarea {...props} className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
    style={{ background: C.bg, border: `1px solid ${C.border}`, color: C.text, ...props.style }} />;
}
function Btn({ children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: { background: C.sage, color: '#fff', border: '1px solid transparent' },
    ghost: { background: 'transparent', color: C.text, border: `1px solid ${C.border}` },
    subtle: { background: C.surface2, color: C.text, border: '1px solid transparent' },
    danger: { background: 'transparent', color: '#b3564a', border: `1px solid ${C.border}` },
  };
  return (
    <button {...props}
      className={`inline-flex items-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition hover:opacity-80 active:scale-[0.98] ${className}`}
      style={{ ...styles[variant], transitionDuration: '180ms' }}>
      {children}
    </button>
  );
}
function IconBtn({ children, ...props }) {
  return <button {...props} className="rounded-lg p-2 transition hover:opacity-70" style={{ color: C.textSub, transitionDuration: '180ms' }}>{children}</button>;
}
function ProgressBar({ value, color = C.sage, height = 6 }) {
  return (
    <div className="w-full rounded-full overflow-hidden" style={{ background: C.surface2, height }}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color, transitionDuration: '250ms' }} />
    </div>
  );
}
function EmptyState({ title, sub, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 gap-3">
      <p className="text-sm font-medium" style={{ color: C.text }}>{title}</p>
      {sub && <p className="text-xs" style={{ color: C.textSub }}>{sub}</p>}
      {actionLabel && <Btn onClick={onAction} className="mt-1">{actionLabel}</Btn>}
    </div>
  );
}
function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-[15px] font-medium" style={{ color: C.text }}>{children}</h3>
      {right}
    </div>
  );
}
function Modal({ open, onClose, title, children, width = 480 }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(37,37,37,0.35)', animation: 'fadeIn 180ms ease' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="w-full rounded-2xl p-6 max-h-[88vh] overflow-y-auto"
        style={{ maxWidth: width, background: C.surface, border: `1px solid ${C.border}`, animation: 'slideUp 200ms ease' }}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-base font-medium" style={{ color: C.text }}>{title}</h3>
          <IconBtn onClick={onClose}><X size={18} /></IconBtn>
        </div>
        {children}
      </div>
    </div>
  );
}
function Pill({ children, color }) {
  return <span className="text-[11px] px-2 py-0.5 rounded-full font-medium" style={{ background: color + '22', color }}>{children}</span>;
}

/* ============================== Nav config ============================== */
const NAV = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'today', label: 'Today', icon: CalendarDays },
  { id: 'study', label: 'Study', icon: BookOpen },
  { id: 'exercise', label: 'Exercise', icon: Dumbbell },
  { id: 'review', label: 'Weekly Review', icon: ClipboardList },
  { id: 'history', label: 'History', icon: HistoryIcon },
  { id: 'settings', label: 'Settings', icon: SettingsIcon },
];

/* ============================== App ============================== */
export default function App() {
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('dashboard');
  const [subjects, setSubjects] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [exerciseLogs, setExerciseLogs] = useState([]);
  const [dailyFocus, setDailyFocus] = useState([]);
  const [weeklyGoals, setWeeklyGoals] = useState([]);
  const [weeklyReviews, setWeeklyReviews] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [today] = useState(new Date());
  const [currentWeekStart, setCurrentWeekStart] = useState(startOfWeek(new Date(), 'Monday'));
  const [mobileAddOpen, setMobileAddOpen] = useState(false);
  const [quickModal, setQuickModal] = useState(null); // 'study' | 'exercise'

  useEffect(() => { init(); }, []);
  async function init() {
    const [sub, ses, ex, df, wg, wr, st, flag] = await Promise.all([
      loadJSON('subjects', null), loadJSON('study_sessions', null), loadJSON('exercise_logs', null),
      loadJSON('daily_focus', null), loadJSON('weekly_goals', null), loadJSON('weekly_reviews', null),
      loadJSON('settings', null), loadJSON('app_initialized', false),
    ]);
    if (!flag) {
      const seed = buildSeed();
      setSubjects(seed.subjects); setSessions(seed.sessions); setExerciseLogs(seed.exerciseLogs);
      setWeeklyGoals(seed.weeklyGoals); setWeeklyReviews(seed.weeklyReviews); setDailyFocus([]);
      setSettings(DEFAULT_SETTINGS);
      await Promise.all([
        saveJSON('subjects', seed.subjects), saveJSON('study_sessions', seed.sessions),
        saveJSON('exercise_logs', seed.exerciseLogs), saveJSON('weekly_goals', seed.weeklyGoals),
        saveJSON('weekly_reviews', seed.weeklyReviews), saveJSON('daily_focus', []),
        saveJSON('settings', DEFAULT_SETTINGS), saveJSON('app_initialized', true),
      ]);
    } else {
      setSubjects(sub || []); setSessions(ses || []); setExerciseLogs(ex || []);
      setDailyFocus(df || []); setWeeklyGoals(wg || []); setWeeklyReviews(wr || []);
      setSettings(st || DEFAULT_SETTINGS);
    }
    setCurrentWeekStart(startOfWeek(new Date(), (st && st.weekStartsOn) || 'Monday'));
    setLoading(false);
  }

  /* ---------- persistence-wrapped setters ---------- */
  const persist = (key, setter) => (updater) => {
    setter(prev => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      saveJSON(key, next);
      return next;
    });
  };
  const setSubjectsP = persist('subjects', setSubjects);
  const setSessionsP = persist('study_sessions', setSessions);
  const setExerciseP = persist('exercise_logs', setExerciseLogs);
  const setDailyFocusP = persist('daily_focus', setDailyFocus);
  const setWeeklyGoalsP = persist('weekly_goals', setWeeklyGoals);
  const setWeeklyReviewsP = persist('weekly_reviews', setWeeklyReviews);
  const setSettingsP = persist('settings', setSettings);

  const weekEnd = addDays(currentWeekStart, 6);
  const weekStartISO = toISO(currentWeekStart), weekEndISO = toISO(weekEnd);
  const weekNum = isoWeekNumber(currentWeekStart);

  if (loading) {
    return (
      <div className="w-full h-full flex items-center justify-center min-h-[400px]" style={{ background: C.bg, fontFamily: FONT }}>
        <p className="text-sm" style={{ color: C.textSub }}>Loading your week…</p>
      </div>
    );
  }

  const ctx = {
    subjects, setSubjectsP, sessions, setSessionsP, exerciseLogs, setExerciseP,
    dailyFocus, setDailyFocusP, weeklyGoals, setWeeklyGoalsP, weeklyReviews, setWeeklyReviewsP,
    settings, setSettingsP, today, currentWeekStart, setCurrentWeekStart, weekStartISO, weekEndISO, weekNum,
  };

  return (
    <div className="w-full min-h-screen flex" style={{ background: C.bg, fontFamily: FONT, color: C.text }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 8px; height: 8px; }
        ::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 8px; }
      `}</style>

      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex flex-col shrink-0" style={{ width: 240, borderRight: `1px solid ${C.border}` }}>
        <div className="px-6 pt-7 pb-6">
          <p className="text-[15px] font-semibold" style={{ color: C.text }}>My Weekly</p>
          <p className="text-[11px] mt-0.5" style={{ color: C.textSub }}>Study · Move · Reflect</p>
        </div>
        <nav className="flex-1 px-3 space-y-0.5">
          {NAV.map(item => {
            const Icon = item.icon; const active = view === item.id;
            return (
              <button key={item.id} onClick={() => setView(item.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition"
                style={{ background: active ? C.surface2 : 'transparent', color: active ? C.text : C.textSub, fontWeight: active ? 500 : 400, transitionDuration: '150ms' }}>
                <Icon size={17} />{item.label}
              </button>
            );
          })}
        </nav>
        <div className="px-6 py-5" style={{ borderTop: `1px solid ${C.border}` }}>
          <p className="text-[11px]" style={{ color: C.textSub }}>Week {weekNum}</p>
          <p className="text-[13px] font-medium">{fmtRange(currentWeekStart, weekEnd)}</p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 min-w-0 pb-24 md:pb-10">
        <div className="mx-auto px-5 md:px-10 py-6 md:py-9" style={{ maxWidth: 1400 }}>
          {/* Mobile top bar */}
          <div className="md:hidden flex items-center justify-between mb-6">
            <div>
              <p className="text-[15px] font-semibold">My Weekly</p>
              <p className="text-[11px]" style={{ color: C.textSub }}>Week {weekNum} · {fmtRange(currentWeekStart, weekEnd)}</p>
            </div>
          </div>

          {view === 'dashboard' && <Dashboard ctx={ctx} />}
          {view === 'today' && <Today ctx={ctx} />}
          {view === 'study' && <Study ctx={ctx} />}
          {view === 'exercise' && <Exercise ctx={ctx} />}
          {view === 'review' && <WeeklyReview ctx={ctx} />}
          {view === 'history' && <HistoryPage ctx={ctx} goTo={(w) => { setCurrentWeekStart(w); setView('review'); }} />}
          {view === 'settings' && <SettingsPage ctx={ctx} />}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-40 flex items-center justify-around py-2"
        style={{ background: C.surface, borderTop: `1px solid ${C.border}` }}>
        {[{ id: 'dashboard', icon: Home, label: 'Home' }, { id: 'study', icon: BookOpen, label: 'Study' }].map(it => (
          <button key={it.id} onClick={() => setView(it.id)} className="flex flex-col items-center gap-0.5 px-3 py-1"
            style={{ color: view === it.id ? C.sage : C.textSub }}>
            <it.icon size={20} /><span className="text-[10px]">{it.label}</span>
          </button>
        ))}
        <button onClick={() => setMobileAddOpen(true)} className="rounded-full p-3 -mt-6" style={{ background: C.sage, color: '#fff', boxShadow: '0 4px 12px rgba(125,143,122,0.4)' }}>
          <Plus size={22} />
        </button>
        {[{ id: 'exercise', icon: Dumbbell, label: 'Exercise' }, { id: 'review', icon: ClipboardList, label: 'Review' }].map(it => (
          <button key={it.id} onClick={() => setView(it.id)} className="flex flex-col items-center gap-0.5 px-3 py-1"
            style={{ color: view === it.id ? C.sage : C.textSub }}>
            <it.icon size={20} /><span className="text-[10px]">{it.label}</span>
          </button>
        ))}
      </div>
      <Modal open={mobileAddOpen} onClose={() => setMobileAddOpen(false)} title="Quick add" width={340}>
        <div className="space-y-2">
          <Btn className="w-full justify-center" onClick={() => { setMobileAddOpen(false); setView('today'); }}>Add Study Session</Btn>
          <Btn variant="ghost" className="w-full justify-center" onClick={() => { setMobileAddOpen(false); setView('exercise'); }}>Add Exercise</Btn>
          <Btn variant="ghost" className="w-full justify-center" onClick={() => { setMobileAddOpen(false); setView('today'); }}>Add Note</Btn>
        </div>
      </Modal>
    </div>
  );
}

/* ============================== Derived-data helpers ============================== */
function inWeek(dateStr, startISO, endISO) { return dateStr >= startISO && dateStr <= endISO; }
function studyBySubject(sessions, subjects, startISO, endISO) {
  const wk = sessions.filter(s => inWeek(s.date, startISO, endISO));
  return subjects.map((s, i) => ({
    id: s.id, name: s.name, color: s.color || SUBJECT_PALETTE[i % SUBJECT_PALETTE.length],
    minutes: wk.filter(x => x.subjectId === s.id).reduce((a, b) => a + b.durationMinutes, 0),
  }));
}
function computeScore({ sessions, exerciseLogs, subjects, settings, weekStartISO, weekEndISO, review }) {
  const wkSessions = sessions.filter(s => inWeek(s.date, weekStartISO, weekEndISO));
  const wkExercise = exerciseLogs.filter(e => inWeek(e.date, weekStartISO, weekEndISO));
  const totalStudyMin = wkSessions.reduce((a, b) => a + b.durationMinutes, 0);
  const goalMin = subjects.reduce((a, b) => a + (b.weeklyGoalMinutes || 0), 0);
  const studyCompletion = goalMin > 0 ? Math.min(1, totalStudyMin / goalMin) : (totalStudyMin > 0 ? 1 : 0);
  const exerciseDays = new Set(wkExercise.map(e => e.date)).size;
  const exerciseCompletion = settings.exerciseWeeklyGoal > 0 ? Math.min(1, exerciseDays / settings.exerciseWeeklyGoal) : 0;
  const qFields = review ? ['learned', 'accomplishments', 'wentWell', 'didntGoWell', 'distractions', 'difficulties', 'proudOf', 'improvement'] : [];
  const reviewCompletion = review ? qFields.filter(f => (review[f] || '').trim().length > 0).length / 8 : 0;
  const activityDates = new Set([...wkSessions.map(s => s.date), ...wkExercise.map(e => e.date)]);
  const habitConsistency = activityDates.size / 7;
  const w = settings.scoreWeights;
  const score = Math.round(studyCompletion * w.study + exerciseCompletion * w.exercise + reviewCompletion * w.review + habitConsistency * w.habit);
  return { score, totalStudyMin, exerciseDays, sessionsCount: wkSessions.length, studyCompletion, exerciseCompletion };
}

/* ============================== Dashboard ============================== */
function Dashboard({ ctx }) {
  const { subjects, sessions, exerciseLogs, weeklyGoals, setWeeklyGoalsP, weeklyReviews, settings, today,
    currentWeekStart, setCurrentWeekStart, weekStartISO, weekEndISO, weekNum } = ctx;
  const weekEnd = addDays(currentWeekStart, 6);
  const prevWeekStart = addDays(currentWeekStart, -7), prevWeekEnd = addDays(currentWeekStart, -1);
  const prevStartISO = toISO(prevWeekStart), prevEndISO = toISO(prevWeekEnd);

  const wkSessions = sessions.filter(s => inWeek(s.date, weekStartISO, weekEndISO));
  const prevSessions = sessions.filter(s => inWeek(s.date, prevStartISO, prevEndISO));
  const totalMin = wkSessions.reduce((a, b) => a + b.durationMinutes, 0);
  const prevTotalMin = prevSessions.reduce((a, b) => a + b.durationMinutes, 0);
  const delta = totalMin - prevTotalMin;

  const wkExercise = exerciseLogs.filter(e => inWeek(e.date, weekStartISO, weekEndISO));
  const exerciseDays = new Set(wkExercise.map(e => e.date)).size;
  const existingReview = weeklyReviews.find(r => r.weekStart === weekStartISO);
  const { score } = computeScore({ sessions, exerciseLogs, subjects, settings, weekStartISO, weekEndISO, review: existingReview });

  const bySubj = studyBySubject(sessions, subjects, weekStartISO, weekEndISO).filter(s => s.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  const topSubj = bySubj[0];

  // heatmap: minutes per day this week
  const dayMinutes = Array.from({ length: 7 }, (_, i) => {
    const d = toISO(addDays(currentWeekStart, i));
    const daySessions = wkSessions.filter(s => s.date === d);
    return { date: d, minutes: daySessions.reduce((a, b) => a + b.durationMinutes, 0), sessions: daySessions };
  });
  function heatColor(m) {
    if (m <= 0) return C.surface2;
    if (m < 30) return '#C8D4C6';
    if (m < 60) return '#9FB39B';
    if (m < 120) return '#7D8F7A';
    return '#5C6B59';
  }

  const focusItems = weeklyGoals.filter(g => g.weekStart === weekStartISO && g.category === 'priority').slice(0, 3);
  function toggleFocus(id) {
    setWeeklyGoalsP(prev => prev.map(g => g.id === id ? { ...g, completed: !g.completed } : g));
  }
  function addFocus() {
    if (focusItems.length >= 3) return;
    const text = window.prompt('New focus item:');
    if (!text) return;
    setWeeklyGoalsP(prev => [...prev, { id: uid(), weekStart: weekStartISO, category: 'priority', title: text, completed: false }]);
  }

  const hour = today.getHours();
  const greeting = hour < 12 ? 'Good morning.' : hour < 18 ? 'Good afternoon.' : 'Good evening.';
  const [hoverDay, setHoverDay] = useState(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-medium leading-tight" style={{ color: C.text }}>{greeting}</h1>
          <p className="text-[15px]" style={{ color: C.textSub }}>Here's your week so far.</p>
        </div>
        <div className="flex items-center gap-3">
          <IconBtn onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))} style={{ border: `1px solid ${C.border}` }}><ChevronLeft size={16} /></IconBtn>
          <div className="text-right">
            <p className="text-[13px] font-medium">Week {weekNum}</p>
            <p className="text-[11px]" style={{ color: C.textSub }}>{fmtRange(currentWeekStart, weekEnd)}</p>
          </div>
          <IconBtn onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))} style={{ border: `1px solid ${C.border}` }}><ChevronRight size={16} /></IconBtn>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <Card>
          <p className="text-xs" style={{ color: C.textSub }}>Study Time</p>
          <p className="text-[28px] font-light mt-1" style={{ color: C.text }}>{fmtDur(totalMin)}</p>
          <p className="text-[11px] mt-1.5" style={{ color: delta >= 0 ? C.sage : '#b3564a' }}>{delta >= 0 ? '+' : '-'}{fmtDur(Math.abs(delta))} vs last week</p>
        </Card>
        <Card>
          <p className="text-xs" style={{ color: C.textSub }}>Study Sessions</p>
          <p className="text-[28px] font-light mt-1" style={{ color: C.text }}>{wkSessions.length}</p>
          <p className="text-[11px] mt-1.5" style={{ color: C.textSub }}>sessions this week</p>
        </Card>
        <Card>
          <p className="text-xs" style={{ color: C.textSub }}>Exercise</p>
          <p className="text-[28px] font-light mt-1" style={{ color: C.text }}>{exerciseDays} / {settings.exerciseWeeklyGoal}</p>
          <div className="mt-2.5"><ProgressBar value={(exerciseDays / (settings.exerciseWeeklyGoal || 1)) * 100} color={C.blue} /></div>
        </Card>
        <Card>
          <p className="text-xs" style={{ color: C.textSub }}>Weekly Score</p>
          <p className="text-[28px] font-light mt-1" style={{ color: C.text }}>{score} <span className="text-sm" style={{ color: C.textSub }}>/ 100</span></p>
          <div className="mt-2.5"><ProgressBar value={score} color={C.terracotta} /></div>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-start">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <SectionTitle>Study This Week</SectionTitle>
            {bySubj.length === 0 ? <EmptyState title="No study sessions yet." sub="Log your first session from Today." /> : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(120, bySubj.length * 42)}>
                  <BarChart data={bySubj} layout="vertical" margin={{ left: 10, right: 20 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 12, fill: C.textSub }} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v) => fmtDur(v)} contentStyle={{ fontSize: 12, borderRadius: 8, border: `1px solid ${C.border}` }} />
                    <Bar dataKey="minutes" radius={[0, 6, 6, 0]} barSize={18}>
                      {bySubj.map((s, i) => <Cell key={i} fill={s.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div className="flex items-center justify-between mt-3 pt-3 text-xs" style={{ borderTop: `1px solid ${C.border}`, color: C.textSub }}>
                  <span>Most studied — <b style={{ color: C.text }}>{topSubj?.name}</b> {totalMin > 0 ? Math.round((topSubj.minutes / totalMin) * 100) : 0}%</span>
                  <span>Total <b style={{ color: C.text }}>{fmtDur(totalMin)}</b></span>
                </div>
              </>
            )}
          </Card>

          <Card>
            <SectionTitle>Weekly Study Heatmap</SectionTitle>
            <div className="grid grid-cols-7 gap-2">
              {dayMinutes.map((d, i) => (
                <div key={d.date} className="flex flex-col items-center gap-1.5 relative"
                  onMouseEnter={() => setHoverDay(i)} onMouseLeave={() => setHoverDay(null)}>
                  <span className="text-[10px]" style={{ color: C.textSub }}>{DAY_LABELS[i]}</span>
                  <div className="w-full aspect-square rounded-lg" style={{ background: heatColor(d.minutes), minHeight: 36 }} />
                  {hoverDay === i && (
                    <div className="absolute top-full mt-1 z-10 rounded-lg p-2.5 text-[11px] whitespace-nowrap" style={{ background: C.text, color: '#fff' }}>
                      <p className="font-medium mb-1">{new Date(d.date).toLocaleDateString('en-US', { weekday: 'long' })}</p>
                      {d.sessions.length === 0 ? <p>No study logged</p> : d.sessions.map(s => (
                        <p key={s.id}>{subjects.find(x => x.id === s.subjectId)?.name || 'Subject'} — {fmtDur(s.durationMinutes)}</p>
                      ))}
                      <p className="mt-0.5 pt-1" style={{ borderTop: '1px solid rgba(255,255,255,0.2)' }}>Total {fmtDur(d.minutes)}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionTitle>Exercise</SectionTitle>
            <ExerciseWeekRow ctx={ctx} />
          </Card>
        </div>

        <Card style={{ height: 'fit-content' }}>
          <SectionTitle right={focusItems.length < 3 && <IconBtn onClick={addFocus} style={{ border: `1px solid ${C.border}` }}><Plus size={14} /></IconBtn>}>Weekly Focus</SectionTitle>
          {focusItems.length === 0 ? (
            <EmptyState title="No focus set for this week." sub="Add up to three priorities." actionLabel="Add focus" onAction={addFocus} />
          ) : (
            <div className="space-y-3">
              {focusItems.map((it, i) => (
                <div key={it.id} className="flex items-start gap-3">
                  <span className="text-xs mt-0.5" style={{ color: C.textSub }}>{pad(i + 1)}</span>
                  <button onClick={() => toggleFocus(it.id)}
                    className="mt-0.5 w-4 h-4 rounded-full flex items-center justify-center shrink-0 transition"
                    style={{ border: `1.5px solid ${it.completed ? C.sage : C.border}`, background: it.completed ? C.sage : 'transparent', transitionDuration: '180ms' }}>
                    {it.completed && <Check size={10} color="#fff" />}
                  </button>
                  <p className="text-sm" style={{ color: it.completed ? C.textSub : C.text, textDecoration: it.completed ? 'line-through' : 'none' }}>{it.title}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function ExerciseWeekRow({ ctx }) {
  const { exerciseLogs, setExerciseP, currentWeekStart, weekStartISO, weekEndISO, settings } = ctx;
  const wk = exerciseLogs.filter(e => inWeek(e.date, weekStartISO, weekEndISO));
  const daysWithLog = new Set(wk.map(e => e.date));
  function toggle(dateISO) {
    if (daysWithLog.has(dateISO)) {
      setExerciseP(prev => prev.filter(e => !(e.date === dateISO)));
    } else {
      setExerciseP(prev => [...prev, { id: uid(), date: dateISO, type: 'Workout', durationMinutes: 30, intensity: 'Moderate', calories: null, notes: '' }]);
    }
  }
  return (
    <div>
      <div className="grid grid-cols-7 gap-2">
        {Array.from({ length: 7 }, (_, i) => {
          const d = toISO(addDays(currentWeekStart, i));
          const done = daysWithLog.has(d);
          return (
            <div key={d} className="flex flex-col items-center gap-1.5">
              <span className="text-[10px]" style={{ color: C.textSub }}>{DAY_LABELS[i]}</span>
              <button onClick={() => toggle(d)} className="w-9 h-9 rounded-full flex items-center justify-center transition"
                style={{ border: `1.5px solid ${done ? C.blue : C.border}`, background: done ? C.blue : 'transparent', transitionDuration: '180ms' }}>
                {done && <Check size={15} color="#fff" />}
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-4 text-xs" style={{ color: C.textSub }}>
        <span>{daysWithLog.size} workouts</span>
        <span>Goal: {settings.exerciseWeeklyGoal} workouts</span>
        <span>{Math.round((daysWithLog.size / (settings.exerciseWeeklyGoal || 1)) * 100)}%</span>
      </div>
      <div className="mt-2"><ProgressBar value={(daysWithLog.size / (settings.exerciseWeeklyGoal || 1)) * 100} color={C.blue} /></div>
    </div>
  );
}

/* ============================== Today ============================== */
function Today({ ctx }) {
  const { today, dailyFocus, setDailyFocusP, subjects, setSessionsP, settings } = ctx;
  const todayISO = toISO(today);
  const items = dailyFocus.filter(f => f.date === todayISO);
  const [newFocus, setNewFocus] = useState('');
  const [timer, setTimer] = useState({ running: false, seconds: 0 });
  const [showLogForm, setShowLogForm] = useState(false);
  const [prefillMin, setPrefillMin] = useState(null);

  useEffect(() => {
    if (!timer.running) return;
    const t = setInterval(() => setTimer(s => ({ ...s, seconds: s.seconds + 1 })), 1000);
    return () => clearInterval(t);
  }, [timer.running]);

  function addFocus() {
    if (!newFocus.trim() || items.length >= 3) return;
    setDailyFocusP(prev => [...prev, { id: uid(), date: todayISO, text: newFocus.trim(), completed: false }]);
    setNewFocus('');
  }
  function toggleFocus(id) { setDailyFocusP(prev => prev.map(f => f.id === id ? { ...f, completed: !f.completed } : f)); }
  function delFocus(id) { setDailyFocusP(prev => prev.filter(f => f.id !== id)); }

  function finishTimer() {
    setTimer(s => ({ ...s, running: false }));
    setPrefillMin(Math.max(1, Math.round(timer.seconds / 60)));
    setShowLogForm(true);
  }

  const mm = pad(Math.floor(timer.seconds / 60)), ss = pad(timer.seconds % 60);

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-[26px] font-medium">Today</h1>
        <p className="text-[15px]" style={{ color: C.textSub }}>{today.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
      </div>

      <Card>
        <SectionTitle>Today's Focus</SectionTitle>
        <div className="space-y-2.5 mb-3">
          {items.map(it => (
            <div key={it.id} className="flex items-center gap-3 group">
              <button onClick={() => toggleFocus(it.id)} className="w-4 h-4 rounded-full flex items-center justify-center shrink-0"
                style={{ border: `1.5px solid ${it.completed ? C.sage : C.border}`, background: it.completed ? C.sage : 'transparent' }}>
                {it.completed && <Check size={10} color="#fff" />}
              </button>
              <p className="text-sm flex-1" style={{ color: it.completed ? C.textSub : C.text, textDecoration: it.completed ? 'line-through' : 'none' }}>{it.text}</p>
              <button onClick={() => delFocus(it.id)} className="opacity-0 group-hover:opacity-100 transition" style={{ color: C.textSub }}><X size={14} /></button>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm" style={{ color: C.textSub }}>Nothing set for today yet.</p>}
        </div>
        {items.length < 3 && (
          <div className="flex gap-2">
            <Input placeholder="Add a focus item…" value={newFocus} onChange={e => setNewFocus(e.target.value)} onKeyDown={e => e.key === 'Enter' && addFocus()} />
            <Btn onClick={addFocus}><Plus size={15} /></Btn>
          </div>
        )}
      </Card>

      <Card>
        <SectionTitle>Study Session</SectionTitle>
        <div className="flex items-center justify-between rounded-xl p-5 mb-4" style={{ background: C.bg }}>
          <div>
            <p className="text-[11px]" style={{ color: C.textSub }}>Elapsed</p>
            <p className="text-3xl font-light tabular-nums">{mm}:{ss}</p>
          </div>
          <div className="flex gap-2">
            {!timer.running && timer.seconds === 0 && <Btn onClick={() => setTimer({ running: true, seconds: 0 })}><Play size={14} /> Start</Btn>}
            {timer.running && <Btn variant="ghost" onClick={() => setTimer(s => ({ ...s, running: false }))}><Pause size={14} /> Pause</Btn>}
            {!timer.running && timer.seconds > 0 && <Btn variant="ghost" onClick={() => setTimer(s => ({ ...s, running: true }))}><Play size={14} /> Resume</Btn>}
            {timer.seconds > 0 && <Btn onClick={finishTimer}><Square size={13} /> Finish</Btn>}
          </div>
        </div>
        <Btn variant="ghost" className="w-full justify-center" onClick={() => { setPrefillMin(null); setShowLogForm(true); }}>Manual Entry</Btn>
      </Card>

      <StudyLogModal open={showLogForm} onClose={() => setShowLogForm(false)} ctx={ctx} date={todayISO} prefillMinutes={prefillMin}
        onSaved={() => { setShowLogForm(false); setTimer({ running: false, seconds: 0 }); }} />
    </div>
  );
}

function StudyLogModal({ open, onClose, ctx, date, prefillMinutes, onSaved, editing }) {
  const { subjects, setSessionsP, settings } = ctx;
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (!open) return;
    setForm(editing || {
      subjectId: subjects[0]?.id || '', topic: '', durationMinutes: prefillMinutes || settings.defaultSessionDuration,
      difficulty: 'Normal', focusLevel: 3, notes: '', date,
    });
  }, [open, prefillMinutes]);
  if (!form) return null;
  function save() {
    if (!form.subjectId || !form.durationMinutes) return;
    if (editing) {
      setSessionsP(prev => prev.map(s => s.id === editing.id ? { ...form, updatedAt: Date.now() } : s));
    } else {
      setSessionsP(prev => [...prev, { ...form, id: uid(), createdAt: Date.now(), updatedAt: Date.now() }]);
    }
    onSaved && onSaved();
  }
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Study Session' : 'Log Study Session'}>
      <div className="space-y-3.5">
        <div><Label>Subject</Label>
          <Select value={form.subjectId} onChange={e => setForm({ ...form, subjectId: e.target.value })}>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.icon} {s.name}</option>)}
          </Select>
        </div>
        <div><Label>Topic</Label><Input value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} placeholder="e.g. Part 5 Tenses" /></div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div><Label>Duration (min)</Label><Input type="number" min={1} value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) })} /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Difficulty</Label>
            <Select value={form.difficulty} onChange={e => setForm({ ...form, difficulty: e.target.value })}>
              <option>Easy</option><option>Normal</option><option>Hard</option>
            </Select>
          </div>
          <div><Label>Focus Level (1–5)</Label>
            <Select value={form.focusLevel} onChange={e => setForm({ ...form, focusLevel: Number(e.target.value) })}>
              {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
            </Select>
          </div>
        </div>
        <div><Label>Notes</Label><TextArea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        <Btn className="w-full justify-center" onClick={save}>Save Session</Btn>
      </div>
    </Modal>
  );
}

/* ============================== Study ============================== */
function Study({ ctx }) {
  const { subjects, setSubjectsP, sessions, setSessionsP, weekStartISO, weekEndISO } = ctx;
  const [subjModal, setSubjModal] = useState(null); // {} for new, subject for edit
  const [logModal, setLogModal] = useState(null);
  const [scope, setScope] = useState('week');
  const [filterSubj, setFilterSubj] = useState('all');
  const [search, setSearch] = useState('');

  const wk = sessions.filter(s => inWeek(s.date, weekStartISO, weekEndISO));
  const totalMin = wk.reduce((a, b) => a + b.durationMinutes, 0);
  const avg = wk.length ? Math.round(totalMin / wk.length) : 0;
  const goalMin = subjects.reduce((a, b) => a + (b.weeklyGoalMinutes || 0), 0);
  const goalPct = goalMin > 0 ? Math.min(100, Math.round((totalMin / goalMin) * 100)) : 0;

  const bySubj = studyBySubject(sessions, subjects, weekStartISO, weekEndISO);
  const byDay = Array.from({ length: 7 }, (_, i) => {
    const d = toISO(addDays(new Date(weekStartISO), i));
    return { day: DAY_LABELS[i], hours: +(wk.filter(s => s.date === d).reduce((a, b) => a + b.durationMinutes, 0) / 60).toFixed(1) };
  });

  const now = new Date();
  const monthStart = toISO(new Date(now.getFullYear(), now.getMonth(), 1));
  let filtered = sessions;
  if (scope === 'week') filtered = filtered.filter(s => inWeek(s.date, weekStartISO, weekEndISO));
  else if (scope === 'month') filtered = filtered.filter(s => s.date >= monthStart);
  if (filterSubj !== 'all') filtered = filtered.filter(s => s.subjectId === filterSubj);
  if (search.trim()) filtered = filtered.filter(s => (s.topic + ' ' + s.notes).toLowerCase().includes(search.toLowerCase()));
  filtered = [...filtered].sort((a, b) => b.date.localeCompare(a.date));

  function deleteSession(id) { if (window.confirm('Delete this session?')) setSessionsP(prev => prev.filter(s => s.id !== id)); }
  function subjName(id) { return subjects.find(s => s.id === id)?.name || '—'; }
  function subjColor(id, i) { return subjects.find(s => s.id === id)?.color || SUBJECT_PALETTE[i % SUBJECT_PALETTE.length]; }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-medium">Study</h1>
        <Btn onClick={() => setLogModal({})}><Plus size={15} /> Log Session</Btn>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <Card><p className="text-xs" style={{ color: C.textSub }}>Study Time</p><p className="text-2xl font-light mt-1">{fmtDur(totalMin)}</p></Card>
        <Card><p className="text-xs" style={{ color: C.textSub }}>Sessions</p><p className="text-2xl font-light mt-1">{wk.length}</p></Card>
        <Card><p className="text-xs" style={{ color: C.textSub }}>Average Session</p><p className="text-2xl font-light mt-1">{fmtDur(avg)}</p></Card>
        <Card><p className="text-xs" style={{ color: C.textSub }}>Goal Completion</p><p className="text-2xl font-light mt-1">{goalPct}%</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <SectionTitle>Study Time by Subject</SectionTitle>
          {bySubj.every(s => s.minutes === 0) ? <EmptyState title="No data this week." /> : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={bySubj}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.textSub }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.textSub }} axisLine={false} tickLine={false} />
                <Tooltip formatter={v => fmtDur(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Bar dataKey="minutes" radius={[6, 6, 0, 0]}>{bySubj.map((s, i) => <Cell key={i} fill={s.color} />)}</Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card>
          <SectionTitle>Study Time by Day</SectionTitle>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11, fill: C.textSub }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: C.textSub }} axisLine={false} tickLine={false} />
              <Tooltip formatter={v => `${v}h`} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Line type="monotone" dataKey="hours" stroke={C.sage} strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card>
        <SectionTitle right={<Btn variant="ghost" onClick={() => setSubjModal({})}><Plus size={14} /> Subject</Btn>}>Subjects</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {subjects.map((s, i) => {
            const min = bySubj.find(b => b.id === s.id)?.minutes || 0;
            const pct = s.weeklyGoalMinutes ? Math.min(100, Math.round((min / s.weeklyGoalMinutes) * 100)) : 0;
            return (
              <div key={s.id} className="rounded-xl p-4 group relative" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium"><span>{s.icon}</span>{s.name}</span>
                  <div className="opacity-0 group-hover:opacity-100 flex gap-1 transition">
                    <IconBtn onClick={() => setSubjModal(s)}><Pencil size={13} /></IconBtn>
                    <IconBtn onClick={() => { if (window.confirm('Delete subject? Sessions will remain but be unassigned.')) setSubjectsP(prev => prev.filter(x => x.id !== s.id)); }}><Trash2 size={13} /></IconBtn>
                  </div>
                </div>
                <p className="text-xs mt-2" style={{ color: C.textSub }}>{fmtDur(min)} {s.weeklyGoalMinutes ? `of ${fmtDur(s.weeklyGoalMinutes)}` : 'goal'}</p>
                <div className="mt-2"><ProgressBar value={pct} color={s.color} /></div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card>
        <SectionTitle>Study Sessions</SectionTitle>
        <div className="flex flex-wrap gap-2 mb-4">
          <Select value={scope} onChange={e => setScope(e.target.value)} style={{ width: 140 }}>
            <option value="week">This Week</option><option value="month">This Month</option><option value="all">All Time</option>
          </Select>
          <Select value={filterSubj} onChange={e => setFilterSubj(e.target.value)} style={{ width: 160 }}>
            <option value="all">All subjects</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </Select>
          <div className="flex-1 min-w-[160px]"><Input placeholder="Search topic or notes…" value={search} onChange={e => setSearch(e.target.value)} /></div>
        </div>
        {filtered.length === 0 ? <EmptyState title="No study sessions found." actionLabel="Log a session" onAction={() => setLogModal({})} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs" style={{ color: C.textSub }}>
                <th className="pb-2 font-normal">Date</th><th className="pb-2 font-normal">Subject</th><th className="pb-2 font-normal">Topic</th>
                <th className="pb-2 font-normal">Duration</th><th className="pb-2 font-normal">Focus</th><th className="pb-2 font-normal"></th>
              </tr></thead>
              <tbody>
                {filtered.map((s, i) => (
                  <tr key={s.id} style={{ borderTop: `1px solid ${C.border}` }} className="group">
                    <td className="py-2.5">{s.date}</td>
                    <td className="py-2.5"><Pill color={subjColor(s.subjectId, i)}>{subjName(s.subjectId)}</Pill></td>
                    <td className="py-2.5" style={{ color: C.textSub }}>{s.topic || '—'}</td>
                    <td className="py-2.5">{fmtDur(s.durationMinutes)}</td>
                    <td className="py-2.5">{s.focusLevel}/5</td>
                    <td className="py-2.5">
                      <div className="opacity-0 group-hover:opacity-100 flex gap-1 justify-end transition">
                        <IconBtn onClick={() => setLogModal(s)}><Pencil size={13} /></IconBtn>
                        <IconBtn onClick={() => deleteSession(s.id)}><Trash2 size={13} /></IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <StudyLogModal open={!!logModal} onClose={() => setLogModal(null)} ctx={ctx} date={toISO(new Date())}
        editing={logModal && logModal.id ? logModal : null} onSaved={() => setLogModal(null)} />
      <SubjectModal open={!!subjModal} onClose={() => setSubjModal(null)} ctx={ctx} editing={subjModal && subjModal.id ? subjModal : null} />
    </div>
  );
}

function SubjectModal({ open, onClose, ctx, editing }) {
  const { setSubjectsP, subjects } = ctx;
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (!open) return;
    setForm(editing || { name: '', icon: '📘', color: SUBJECT_PALETTE[subjects.length % SUBJECT_PALETTE.length], weeklyGoalHours: 3 });
  }, [open]);
  if (!form) return null;
  function save() {
    if (!form.name.trim()) return;
    const weeklyGoalMinutes = editing ? form.weeklyGoalMinutes : Math.round(form.weeklyGoalHours * 60);
    if (editing) setSubjectsP(prev => prev.map(s => s.id === editing.id ? { ...form } : s));
    else setSubjectsP(prev => [...prev, { id: uid(), name: form.name, icon: form.icon, color: form.color, weeklyGoalMinutes, createdAt: Date.now() }]);
    onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Subject' : 'New Subject'}>
      <div className="space-y-3.5">
        <div className="grid grid-cols-[1fr_80px] gap-3">
          <div><Label>Name</Label><Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Icon</Label><Input maxLength={2} value={form.icon} onChange={e => setForm({ ...form, icon: e.target.value })} /></div>
        </div>
        <div><Label>Color</Label>
          <div className="flex gap-2">
            {SUBJECT_PALETTE.map(c => (
              <button key={c} onClick={() => setForm({ ...form, color: c })} className="w-7 h-7 rounded-full"
                style={{ background: c, border: form.color === c ? `2px solid ${C.text}` : '2px solid transparent' }} />
            ))}
          </div>
        </div>
        <div><Label>Weekly Goal (hours)</Label>
          <Input type="number" step="0.5" min={0} value={editing ? (form.weeklyGoalMinutes / 60) : form.weeklyGoalHours}
            onChange={e => editing ? setForm({ ...form, weeklyGoalMinutes: Math.round(Number(e.target.value) * 60) }) : setForm({ ...form, weeklyGoalHours: Number(e.target.value) })} />
        </div>
        <Btn className="w-full justify-center" onClick={save}>Save Subject</Btn>
      </div>
    </Modal>
  );
}

/* ============================== Exercise ============================== */
function Exercise({ ctx }) {
  const { exerciseLogs, setExerciseP, currentWeekStart, weekStartISO, weekEndISO, settings } = ctx;
  const [logModal, setLogModal] = useState(null);
  const wk = exerciseLogs.filter(e => inWeek(e.date, weekStartISO, weekEndISO));
  const days = new Set(wk.map(e => e.date)).size;
  const totalMin = wk.reduce((a, b) => a + b.durationMinutes, 0);
  const consistency = Math.round((days / (settings.exerciseWeeklyGoal || 1)) * 100);

  const typeCounts = {};
  wk.forEach(e => { typeCounts[e.type] = (typeCounts[e.type] || 0) + 1; });
  const pieData = Object.entries(typeCounts).map(([name, value]) => ({ name, value }));

  function deleteLog(id) { if (window.confirm('Delete this entry?')) setExerciseP(prev => prev.filter(e => e.id !== id)); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-medium">Exercise</h1>
        <Btn onClick={() => setLogModal({})}><Plus size={15} /> Log Exercise</Btn>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <Card><p className="text-xs" style={{ color: C.textSub }}>Workouts</p><p className="text-2xl font-light mt-1">{days}</p></Card>
        <Card><p className="text-xs" style={{ color: C.textSub }}>Total Time</p><p className="text-2xl font-light mt-1">{fmtDur(totalMin)}</p></Card>
        <Card><p className="text-xs" style={{ color: C.textSub }}>Goal</p><p className="text-2xl font-light mt-1">{settings.exerciseWeeklyGoal}</p></Card>
        <Card><p className="text-xs" style={{ color: C.textSub }}>Consistency</p><p className="text-2xl font-light mt-1">{consistency}%</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <Card>
          <SectionTitle>Weekly Exercise Calendar</SectionTitle>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }, (_, i) => {
              const d = toISO(addDays(currentWeekStart, i));
              const items = wk.filter(e => e.date === d);
              return (
                <div key={d} className="rounded-lg p-2 min-h-[90px]" style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                  <p className="text-[10px] mb-1" style={{ color: C.textSub }}>{DAY_LABELS[i]}</p>
                  {items.map(it => <p key={it.id} className="text-[10px] rounded px-1 py-0.5 mb-1" style={{ background: C.blue + '22', color: C.text }}>{it.type}</p>)}
                </div>
              );
            })}
          </div>
        </Card>
        <Card>
          <SectionTitle>Exercise Types</SectionTitle>
          {pieData.length === 0 ? <EmptyState title="No exercise logged this week." /> : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                  {pieData.map((_, i) => <Cell key={i} fill={SUBJECT_PALETTE[i % SUBJECT_PALETTE.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card>
        <SectionTitle>Exercise Log</SectionTitle>
        {wk.length === 0 ? <EmptyState title="No entries yet." actionLabel="Log Exercise" onAction={() => setLogModal({})} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead><tr className="text-left text-xs" style={{ color: C.textSub }}>
                <th className="pb-2 font-normal">Date</th><th className="pb-2 font-normal">Type</th><th className="pb-2 font-normal">Duration</th>
                <th className="pb-2 font-normal">Intensity</th><th className="pb-2 font-normal">Notes</th><th></th>
              </tr></thead>
              <tbody>
                {[...wk].sort((a, b) => b.date.localeCompare(a.date)).map(e => (
                  <tr key={e.id} style={{ borderTop: `1px solid ${C.border}` }} className="group">
                    <td className="py-2.5">{e.date}</td><td className="py-2.5">{e.type}</td><td className="py-2.5">{fmtDur(e.durationMinutes)}</td>
                    <td className="py-2.5">{e.intensity}</td><td className="py-2.5" style={{ color: C.textSub }}>{e.notes || '—'}</td>
                    <td><div className="opacity-0 group-hover:opacity-100 flex gap-1 justify-end transition">
                      <IconBtn onClick={() => setLogModal(e)}><Pencil size={13} /></IconBtn>
                      <IconBtn onClick={() => deleteLog(e.id)}><Trash2 size={13} /></IconBtn>
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <ExerciseModal open={!!logModal} onClose={() => setLogModal(null)} ctx={ctx} editing={logModal && logModal.id ? logModal : null} />
    </div>
  );
}

function ExerciseModal({ open, onClose, ctx, editing }) {
  const { setExerciseP } = ctx;
  const [form, setForm] = useState(null);
  useEffect(() => {
    if (!open) return;
    setForm(editing || { date: toISO(new Date()), type: 'Gym', durationMinutes: 30, intensity: 'Moderate', calories: '', notes: '' });
  }, [open]);
  if (!form) return null;
  function save() {
    const payload = { ...form, calories: form.calories === '' ? null : Number(form.calories) };
    if (editing) setExerciseP(prev => prev.map(e => e.id === editing.id ? payload : e));
    else setExerciseP(prev => [...prev, { ...payload, id: uid(), createdAt: Date.now() }]);
    onClose();
  }
  return (
    <Modal open={open} onClose={onClose} title={editing ? 'Edit Exercise' : 'Log Exercise'}>
      <div className="space-y-3.5">
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Date</Label><Input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} /></div>
          <div><Label>Type</Label>
            <Select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
              {EXERCISE_TYPES.map(t => <option key={t}>{t}</option>)}
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div><Label>Duration (min)</Label><Input type="number" min={1} value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: Number(e.target.value) })} /></div>
          <div><Label>Intensity</Label>
            <Select value={form.intensity} onChange={e => setForm({ ...form, intensity: e.target.value })}>
              <option>Low</option><option>Moderate</option><option>High</option>
            </Select>
          </div>
        </div>
        <div><Label>Calories (optional)</Label><Input type="number" value={form.calories} onChange={e => setForm({ ...form, calories: e.target.value })} /></div>
        <div><Label>Notes</Label><TextArea rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div>
        <Btn className="w-full justify-center" onClick={save}>Save</Btn>
      </div>
    </Modal>
  );
}

/* ============================== Weekly Review ============================== */
const QUESTIONS = [
  ['learned', 'What did I learn this week?'], ['accomplishments', 'What did I accomplish?'],
  ['wentWell', 'What went well?'], ['didntGoWell', "What didn't go well?"],
  ['distractions', 'What distracted me?'], ['difficulties', 'What was difficult?'],
  ['proudOf', 'What am I proud of?'], ['improvement', 'What should I improve next week?'],
];

function WeeklyReview({ ctx }) {
  const { subjects, sessions, exerciseLogs, weeklyReviews, setWeeklyReviewsP, setWeeklyGoalsP,
    settings, currentWeekStart, setCurrentWeekStart, weekStartISO, weekEndISO, weekNum } = ctx;
  const weekEnd = addDays(currentWeekStart, 6);
  const existing = weeklyReviews.find(r => r.weekStart === weekStartISO);
  const [form, setForm] = useState(null);

  useEffect(() => {
    setForm(existing || {
      mood: 'good', energyLevel: 3, stressLevel: 3, focusLevel: 3,
      learned: '', accomplishments: '', wentWell: '', didntGoWell: '', distractions: '', difficulties: '', proudOf: '', improvement: '',
      subjectReviews: {}, wins: [], lessonsLearned: '',
      nextWeekPriorities: ['', '', ''], nextWeekStudyGoals: {}, nextWeekExerciseGoal: settings.exerciseWeeklyGoal, personalGoal: '',
    });
  }, [weekStartISO, existing]);

  if (!form) return null;

  const wkSessions = sessions.filter(s => inWeek(s.date, weekStartISO, weekEndISO));
  const wkExercise = exerciseLogs.filter(e => inWeek(e.date, weekStartISO, weekEndISO));
  const bySubj = studyBySubject(sessions, subjects, weekStartISO, weekEndISO).filter(s => s.minutes > 0).sort((a, b) => b.minutes - a.minutes);
  const totalMin = wkSessions.reduce((a, b) => a + b.durationMinutes, 0);
  const exDays = new Set(wkExercise.map(e => e.date)).size;
  const { score } = computeScore({ sessions, exerciseLogs, subjects, settings, weekStartISO, weekEndISO, review: form });
  const priorityGoals = ctx.weeklyGoals.filter(g => g.weekStart === weekStartISO && g.category === 'priority');
  const goalsCompleted = priorityGoals.filter(g => g.completed).length;

  const subjectsWithData = subjects.filter(s => wkSessions.some(x => x.subjectId === s.id));

  function upd(field, val) { setForm(f => ({ ...f, [field]: val })); }

  function save() {
    const record = {
      ...form, id: existing?.id || uid(), weekStart: weekStartISO, weekEnd: weekEndISO,
      snapshot: { studyMinutes: totalMin, sessionsCount: wkSessions.length, topSubjectName: bySubj[0]?.name || null, exerciseDays: exDays, goalsTotal: priorityGoals.length, goalsCompleted, score },
      createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now(),
    };
    setWeeklyReviewsP(prev => existing ? prev.map(r => r.id === existing.id ? record : r) : [...prev, record]);

    // push next week planning into weekly_goals for next week
    const nextWeekStart = toISO(addDays(weekEnd, 1));
    setWeeklyGoalsP(prev => {
      const withoutNextAuto = prev.filter(g => !(g.weekStart === nextWeekStart && g.fromReview === weekStartISO));
      const additions = [];
      form.nextWeekPriorities.filter(p => p.trim()).forEach(p => additions.push({ id: uid(), weekStart: nextWeekStart, category: 'priority', title: p, completed: false, fromReview: weekStartISO }));
      Object.entries(form.nextWeekStudyGoals).forEach(([subjId, hours]) => {
        if (hours) additions.push({ id: uid(), weekStart: nextWeekStart, category: 'study', title: subjects.find(s => s.id === subjId)?.name, targetHours: Number(hours), completed: false, fromReview: weekStartISO });
      });
      if (form.nextWeekExerciseGoal) additions.push({ id: uid(), weekStart: nextWeekStart, category: 'exercise', title: `Exercise ${form.nextWeekExerciseGoal} times`, completed: false, fromReview: weekStartISO });
      if (form.personalGoal?.trim()) additions.push({ id: uid(), weekStart: nextWeekStart, category: 'personal', title: form.personalGoal, completed: false, fromReview: weekStartISO });
      return [...withoutNextAuto, ...additions];
    });
    window.alert('Weekly review saved.');
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[26px] font-medium">Weekly Review</h1>
          <p className="text-[15px]" style={{ color: C.textSub }}>Week {weekNum} · {fmtRange(currentWeekStart, weekEnd)}</p>
        </div>
        <div className="flex items-center gap-2">
          <IconBtn onClick={() => setCurrentWeekStart(addDays(currentWeekStart, -7))} style={{ border: `1px solid ${C.border}` }}><ChevronLeft size={16} /></IconBtn>
          <IconBtn onClick={() => setCurrentWeekStart(addDays(currentWeekStart, 7))} style={{ border: `1px solid ${C.border}` }}><ChevronRight size={16} /></IconBtn>
        </div>
      </div>

      {existing && <SummaryCard review={existing} weekNum={weekNum} range={fmtRange(currentWeekStart, weekEnd)} />}

      <Card>
        <SectionTitle>This Week in Numbers</SectionTitle>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-4 text-center">
          {[['Study', fmtDur(totalMin)], ['Sessions', wkSessions.length], ['Top Subject', bySubj[0]?.name || '—'],
            ['Exercise', `${exDays} days`], ['Goals', `${goalsCompleted}/${priorityGoals.length || 0}`], ['Score', score]].map(([l, v]) => (
            <div key={l}><p className="text-lg font-light">{v}</p><p className="text-[10px] mt-0.5" style={{ color: C.textSub }}>{l}</p></div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Reflection</SectionTitle>
        <div className="space-y-4">
          {QUESTIONS.map(([key, q]) => (
            <div key={key}><Label>{q}</Label><TextArea rows={2} value={form[key]} onChange={e => upd(key, e.target.value)} /></div>
          ))}
        </div>
      </Card>

      {subjectsWithData.length > 0 && (
        <Card>
          <SectionTitle>Subject Review</SectionTitle>
          <div className="space-y-4">
            {subjectsWithData.map(s => {
              const min = bySubj.find(b => b.id === s.id)?.minutes || 0;
              const topics = [...new Set(wkSessions.filter(x => x.subjectId === s.id).map(x => x.topic).filter(Boolean))];
              return (
                <div key={s.id} className="rounded-xl p-4" style={{ background: C.bg }}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{s.icon} {s.name}</span>
                    <span className="text-xs" style={{ color: C.textSub }}>{fmtDur(min)}</span>
                  </div>
                  {topics.length > 0 && <p className="text-xs mb-2" style={{ color: C.textSub }}>Topics: {topics.join(', ')}</p>}
                  <TextArea rows={2} placeholder="Reflection…" value={form.subjectReviews[s.id] || ''}
                    onChange={e => setForm(f => ({ ...f, subjectReviews: { ...f.subjectReviews, [s.id]: e.target.value } }))} />
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <Card>
        <SectionTitle>How was this week?</SectionTitle>
        <div className="flex gap-2 mb-4">
          {MOODS.map(m => (
            <button key={m.v} onClick={() => upd('mood', m.v)} className="flex-1 flex flex-col items-center gap-1 rounded-xl py-3 transition"
              style={{ background: form.mood === m.v ? C.surface2 : C.bg, border: `1px solid ${form.mood === m.v ? C.sage : C.border}` }}>
              <span className="text-xl">{m.e}</span><span className="text-[10px]" style={{ color: C.textSub }}>{m.label}</span>
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[['energyLevel', 'Energy'], ['stressLevel', 'Stress'], ['focusLevel', 'Focus']].map(([k, l]) => (
            <div key={k}><Label>{l} Level ({form[k]}/5)</Label>
              <input type="range" min={1} max={5} value={form[k]} onChange={e => upd(k, Number(e.target.value))} className="w-full" style={{ accentColor: C.sage }} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Weekly Wins</SectionTitle>
        <div className="space-y-2">
          {form.wins.map((w, i) => (
            <div key={i} className="flex gap-2">
              <Input value={w} onChange={e => { const wins = [...form.wins]; wins[i] = e.target.value; upd('wins', wins); }} />
              <IconBtn onClick={() => upd('wins', form.wins.filter((_, idx) => idx !== i))}><X size={15} /></IconBtn>
            </div>
          ))}
          {form.wins.length < 5 && <Btn variant="ghost" onClick={() => upd('wins', [...form.wins, ''])}><Plus size={14} /> Add win</Btn>}
        </div>
      </Card>

      <Card>
        <SectionTitle>Lessons Learned</SectionTitle>
        <TextArea rows={3} placeholder="What did I really learn this week?" value={form.lessonsLearned} onChange={e => upd('lessonsLearned', e.target.value)} />
      </Card>

      <Card>
        <SectionTitle>Next Week</SectionTitle>
        <div className="space-y-4">
          <div><Label>Top 3 Priorities</Label>
            <div className="space-y-2">
              {form.nextWeekPriorities.map((p, i) => (
                <Input key={i} value={p} placeholder={`Priority ${i + 1}`} onChange={e => { const arr = [...form.nextWeekPriorities]; arr[i] = e.target.value; upd('nextWeekPriorities', arr); }} />
              ))}
            </div>
          </div>
          <div><Label>Study Goals (hours)</Label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {subjects.map(s => (
                <div key={s.id} className="flex items-center gap-2">
                  <span className="text-xs w-24 truncate">{s.icon} {s.name}</span>
                  <Input type="number" min={0} step="0.5" value={form.nextWeekStudyGoals[s.id] || ''} onChange={e => setForm(f => ({ ...f, nextWeekStudyGoals: { ...f.nextWeekStudyGoals, [s.id]: e.target.value } }))} />
                </div>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Exercise Goal (workouts)</Label><Input type="number" min={0} value={form.nextWeekExerciseGoal} onChange={e => upd('nextWeekExerciseGoal', Number(e.target.value))} /></div>
            <div><Label>Personal Goal</Label><Input value={form.personalGoal} onChange={e => upd('personalGoal', e.target.value)} placeholder="e.g. Sleep before 12:30" /></div>
          </div>
        </div>
      </Card>

      <Btn onClick={save} className="w-full justify-center py-3">Save Weekly Review</Btn>
    </div>
  );
}

function SummaryCard({ review, weekNum, range }) {
  const s = review.snapshot || {};
  const moodObj = MOODS.find(m => m.v === review.mood);
  return (
    <Card style={{ background: C.surface2 }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-medium">Weekly Summary — Week {weekNum}</p>
        <span className="text-xs" style={{ color: C.textSub }}>{range}</span>
      </div>
      <div className="grid grid-cols-5 gap-3 text-center mb-4">
        {[['Study', fmtDur(s.studyMinutes)], ['Exercise', `${s.exerciseDays ?? 0} days`], ['Goals', `${s.goalsCompleted ?? 0}/${s.goalsTotal ?? 0}`], ['Mood', moodObj?.e || '—'], ['Score', s.score ?? '—']].map(([l, v]) => (
          <div key={l}><p className="text-lg font-light">{v}</p><p className="text-[10px]" style={{ color: C.textSub }}>{l}</p></div>
        ))}
      </div>
      <div className="text-xs space-y-1" style={{ color: C.textSub, borderTop: `1px solid ${C.border}`, paddingTop: 10 }}>
        <p><b style={{ color: C.text }}>Best:</b> {review.wins?.[0] || review.accomplishments || '—'}</p>
        <p><b style={{ color: C.text }}>Challenge:</b> {review.didntGoWell || '—'}</p>
        <p><b style={{ color: C.text }}>Next focus:</b> {review.nextWeekPriorities?.[0] || '—'}</p>
      </div>
    </Card>
  );
}

/* ============================== History ============================== */
function HistoryPage({ ctx, goTo }) {
  const { weeklyReviews, sessions, exerciseLogs } = ctx;
  const sorted = [...weeklyReviews].sort((a, b) => b.weekStart.localeCompare(a.weekStart));

  const trend = sorted.slice(0, 12).reverse().map(r => ({ week: `W${isoWeekNumber(new Date(r.weekStart))}`, score: r.snapshot?.score ?? 0, hours: +((r.snapshot?.studyMinutes || 0) / 60).toFixed(1) }));

  // monthly insights
  const months = {};
  sessions.forEach(s => { const m = s.date.slice(0, 7); months[m] = months[m] || { study: 0, exercise: new Set(), weeks: {} }; months[m].study += s.durationMinutes; });
  exerciseLogs.forEach(e => { const m = e.date.slice(0, 7); months[m] = months[m] || { study: 0, exercise: new Set(), weeks: {} }; months[m].exercise.add(e.date); });
  sorted.forEach(r => { const m = r.weekStart.slice(0, 7); months[m] = months[m] || { study: 0, exercise: new Set(), weeks: {} }; months[m].weeks[r.weekStart] = r.snapshot?.score ?? 0; });
  const monthKeys = Object.keys(months).sort().reverse().slice(0, 1);

  return (
    <div className="space-y-6">
      <h1 className="text-[26px] font-medium">History</h1>

      {monthKeys.map(mk => {
        const d = months[mk];
        const weekScores = Object.values(d.weeks);
        const bestWeek = Object.entries(d.weeks).sort((a, b) => b[1] - a[1])[0];
        const label = new Date(mk + '-01').toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
        return (
          <Card key={mk}>
            <SectionTitle>Monthly Insights — {label}</SectionTitle>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
              <div><p className="text-lg font-light">{fmtDur(d.study)}</p><p className="text-[10px]" style={{ color: C.textSub }}>Total Study</p></div>
              <div><p className="text-lg font-light">{fmtDur(d.study / (Object.keys(d.weeks).length || 1))}</p><p className="text-[10px]" style={{ color: C.textSub }}>Average Weekly</p></div>
              <div><p className="text-lg font-light">{d.exercise.size}</p><p className="text-[10px]" style={{ color: C.textSub }}>Workouts</p></div>
              <div><p className="text-lg font-light">{bestWeek ? `W${isoWeekNumber(new Date(bestWeek[0]))}` : '—'}</p><p className="text-[10px]" style={{ color: C.textSub }}>Best Week</p></div>
            </div>
          </Card>
        );
      })}

      {trend.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Card>
            <SectionTitle>Weekly Score Trend</SectionTitle>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: C.textSub }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.textSub }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="score" stroke={C.terracotta} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
          <Card>
            <SectionTitle>Study Hours Trend</SectionTitle>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trend}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} vertical={false} />
                <XAxis dataKey="week" tick={{ fontSize: 11, fill: C.textSub }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: C.textSub }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                <Line type="monotone" dataKey="hours" stroke={C.sage} strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>
      )}

      <Card>
        <SectionTitle>Weekly Reviews</SectionTitle>
        {sorted.length === 0 ? <EmptyState title="No weekly reviews yet." sub="Complete your first Weekly Review to see it here." /> : (
          <div className="space-y-2">
            {sorted.map(r => (
              <button key={r.id} onClick={() => goTo(new Date(r.weekStart))} className="w-full flex items-center justify-between rounded-xl p-4 transition hover:opacity-80"
                style={{ background: C.bg, border: `1px solid ${C.border}` }}>
                <div className="text-left">
                  <p className="text-sm font-medium">Week {isoWeekNumber(new Date(r.weekStart))}</p>
                  <p className="text-xs" style={{ color: C.textSub }}>{fmtRange(new Date(r.weekStart), new Date(r.weekEnd))}</p>
                </div>
                <p className="text-lg font-light">{r.snapshot?.score ?? '—'}</p>
              </button>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

/* ============================== Settings ============================== */
function SettingsPage({ ctx }) {
  const { settings, setSettingsP, subjects } = ctx;
  const [local, setLocal] = useState(settings);
  useEffect(() => setLocal(settings), [settings]);
  const weightSum = Object.values(local.scoreWeights).reduce((a, b) => a + Number(b || 0), 0);

  function save() { setSettingsP(local); window.alert('Settings saved.'); }

  return (
    <div className="space-y-6 max-w-xl">
      <h1 className="text-[26px] font-medium">Settings</h1>

      <Card>
        <SectionTitle>General</SectionTitle>
        <div className="space-y-4">
          <div><Label>Week starts on</Label>
            <Select value={local.weekStartsOn} onChange={e => setLocal({ ...local, weekStartsOn: e.target.value })}>
              <option>Monday</option><option>Sunday</option>
            </Select>
          </div>
          <div><Label>Exercise weekly goal (workouts)</Label>
            <Input type="number" min={1} value={local.exerciseWeeklyGoal} onChange={e => setLocal({ ...local, exerciseWeeklyGoal: Number(e.target.value) })} />
          </div>
          <div><Label>Default study session duration (min)</Label>
            <Input type="number" min={5} value={local.defaultSessionDuration} onChange={e => setLocal({ ...local, defaultSessionDuration: Number(e.target.value) })} />
          </div>
        </div>
      </Card>

      <Card>
        <SectionTitle right={<span className="text-xs" style={{ color: weightSum === 100 ? C.textSub : '#b3564a' }}>{weightSum} / 100</span>}>Weekly Score Weights</SectionTitle>
        <div className="grid grid-cols-2 gap-3">
          {[['study', 'Study Goal'], ['exercise', 'Exercise Goal'], ['review', 'Review Completion'], ['habit', 'Habit Consistency']].map(([k, l]) => (
            <div key={k}><Label>{l} (%)</Label>
              <Input type="number" min={0} max={100} value={local.scoreWeights[k]} onChange={e => setLocal({ ...local, scoreWeights: { ...local.scoreWeights, [k]: Number(e.target.value) } })} />
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <SectionTitle>Subjects</SectionTitle>
        <p className="text-xs mb-2" style={{ color: C.textSub }}>Manage subjects — add, edit icons, colors, and weekly goals — from the Study page.</p>
        <div className="flex flex-wrap gap-2">
          {subjects.map(s => <Pill key={s.id} color={s.color}>{s.icon} {s.name}</Pill>)}
        </div>
      </Card>

      <Btn onClick={save} className="w-full justify-center py-3">Save Settings</Btn>
    </div>
  );
}

/* ============================== Seed data ============================== */
function buildSeed() {
  const monday = startOfWeek(new Date(), 'Monday');
  const subjects = [
    { id: 'toeic', name: 'TOEIC', icon: '📘', color: SUBJECT_PALETTE[0], weeklyGoalMinutes: 300, createdAt: Date.now() },
    { id: 'grammar', name: 'English Grammar', icon: '✏️', color: SUBJECT_PALETTE[1], weeklyGoalMinutes: 180, createdAt: Date.now() },
    { id: 'research', name: 'Research', icon: '🔬', color: SUBJECT_PALETTE[2], weeklyGoalMinutes: 180, createdAt: Date.now() },
    { id: 'aitools', name: 'AI Tools', icon: '🤖', color: SUBJECT_PALETTE[3], weeklyGoalMinutes: 120, createdAt: Date.now() },
  ];
  const sessions = [], exerciseLogs = [], weeklyReviews = [], weeklyGoals = [];
  const topics = { toeic: ['Part 5 Tenses', 'Part 7 Reading', 'Vocabulary'], grammar: ['Conditionals', 'Present Perfect'], research: ['Paper review', 'Literature notes'], aitools: ['Prompting', 'Automation'] };
  const plan = [
    { subj: 'toeic', mins: [70, 60, 50, 70, 70] }, { subj: 'grammar', mins: [40, 0, 50, 40, 60] },
    { subj: 'research', mins: [0, 50, 60, 0, 70] }, { subj: 'aitools', mins: [30, 0, 40, 0, 30] },
  ];
  const exercisePlan = [{ day: 0, type: 'Gym', dur: 45, int: 'High' }, { day: 1, type: 'Walking', dur: 30, int: 'Low' }, { day: 3, type: 'Running', dur: 35, int: 'Moderate' }, { day: 5, type: 'Gym', dur: 50, int: 'High' }];

  for (let w = 3; w >= 1; w--) {
    const weekStart = addDays(monday, -7 * w);
    const weekEnd = addDays(weekStart, 6);
    const weekStartISO = toISO(weekStart), weekEndISO = toISO(weekEnd);
    plan.forEach(p => {
      p.mins.forEach((m, i) => {
        if (m > 0) {
          const t = topics[p.subj][i % topics[p.subj].length];
          sessions.push({ id: uid(), subjectId: p.subj, date: toISO(addDays(weekStart, i)), topic: t, durationMinutes: m + (w - 2) * 3, difficulty: ['Easy', 'Normal', 'Hard'][i % 3], focusLevel: 3 + (i % 3), notes: '', createdAt: Date.now(), updatedAt: Date.now() });
        }
      });
    });
    exercisePlan.forEach(e => exerciseLogs.push({ id: uid(), date: toISO(addDays(weekStart, e.day)), type: e.type, durationMinutes: e.dur, intensity: e.int, calories: null, notes: '', createdAt: Date.now() }));

    const weekSessions = sessions.filter(s => inWeek(s.date, weekStartISO, weekEndISO));
    const studyMinutes = weekSessions.reduce((a, b) => a + b.durationMinutes, 0);
    const exDays = new Set(exerciseLogs.filter(e => inWeek(e.date, weekStartISO, weekEndISO)).map(e => e.date)).size;
    const scoreBase = 74 + w * 3;
    weeklyReviews.push({
      id: uid(), weekStart: weekStartISO, weekEnd: weekEndISO, mood: ['good', 'great', 'okay'][w % 3],
      energyLevel: 3, stressLevel: 2, focusLevel: 4,
      learned: 'Worked through TOEIC Part 5 tense drills and reviewed two research papers.',
      accomplishments: 'Finished the grammar unit and logged workouts on plan.',
      wentWell: 'Consistent daily study blocks.', didntGoWell: 'Reading speed on Part 7 still slow.',
      distractions: 'Phone notifications in the evening.', difficulties: 'Long-form reading comprehension.',
      proudOf: 'Stuck to the exercise plan all week.', improvement: 'Add timed reading drills.',
      subjectReviews: { toeic: 'Tenses more stable, reading speed still needs work.' },
      wins: ['Finished TOEIC Unit 5', 'Worked out 4 times'], lessonsLearned: 'Short focused sessions beat long unfocused ones.',
      nextWeekPriorities: ['', '', ''], nextWeekStudyGoals: {}, nextWeekExerciseGoal: 5, personalGoal: '',
      snapshot: { studyMinutes, sessionsCount: weekSessions.length, topSubjectName: 'TOEIC', exerciseDays: exDays, goalsTotal: 3, goalsCompleted: 2, score: scoreBase },
      createdAt: Date.now(), updatedAt: Date.now(),
    });
  }

  // current week: a small head start (today only) + weekly focus carried from last review
  weeklyGoals.push(
    { id: uid(), weekStart: toISO(monday), category: 'priority', title: 'Finish TOEIC Unit 6', completed: false },
    { id: uid(), weekStart: toISO(monday), category: 'priority', title: 'Read 3 research papers', completed: false },
    { id: uid(), weekStart: toISO(monday), category: 'priority', title: 'Exercise 5 times', completed: false },
  );

  return { subjects, sessions, exerciseLogs, weeklyReviews, weeklyGoals };
}
