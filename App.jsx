import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Activity, Users, Calendar, CreditCard, Pill,
  LogOut, Check, X, Plus, ActivitySquare, Shield,
  Stethoscope, Clock, FileText, ChevronRight,
  Search, Bell, BarChart3, TestTube, UserPlus, FileArchive,
  ClipboardList, Syringe, Save, CheckCircle2, History, AlertCircle,
  TrendingUp, Package, RefreshCw, Eye, ChevronDown, AlertTriangle,
  Heart, Thermometer, Scale, Zap, UserCheck, XCircle, Loader2,
  Receipt, BadgeCheck, FlaskConical, Microscope, Pill as PillIcon,
  DollarSign, ArrowRight, Info
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────────────────
// API UTILITY
// ─────────────────────────────────────────────────────────────────────────────
const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem('hims_token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || `HTTP ${response.status}`);
  return data;
};

// ─────────────────────────────────────────────────────────────────────────────
// TOAST NOTIFICATION SYSTEM  (replaces all alert() / confirm())
// ─────────────────────────────────────────────────────────────────────────────
const ToastContext = React.createContext(null);

function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(0);

  const toast = useCallback((message, type = 'info', duration = 4500) => {
    const id = ++idRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
    return id;
  }, []);

  const dismiss = useCallback(id => setToasts(prev => prev.filter(t => t.id !== id)), []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-3 max-w-sm pointer-events-none">
        {toasts.map(t => (
          <div key={t.id} className={`
            pointer-events-auto flex items-start gap-3 px-5 py-4 rounded-2xl shadow-2xl border backdrop-blur-sm
            animate-in slide-in-from-right-6 fade-in duration-300 text-sm font-medium
            ${t.type === 'success' ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-100' : ''}
            ${t.type === 'error'   ? 'bg-red-950/90    border-red-500/30    text-red-100'   : ''}
            ${t.type === 'warning' ? 'bg-amber-950/90  border-amber-500/30  text-amber-100' : ''}
            ${t.type === 'info'    ? 'bg-slate-900/90  border-slate-500/30  text-slate-100' : ''}
          `}>
            {t.type === 'success' && <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5"/>}
            {t.type === 'error'   && <XCircle      className="h-5 w-5 text-red-400    flex-shrink-0 mt-0.5"/>}
            {t.type === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5"/>}
            {t.type === 'info'    && <Info          className="h-5 w-5 text-blue-400  flex-shrink-0 mt-0.5"/>}
            <span className="flex-1">{t.message}</span>
            <button onClick={() => dismiss(t.id)} className="opacity-60 hover:opacity-100 transition flex-shrink-0">
              <X className="h-4 w-4"/>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const useToast = () => React.useContext(ToastContext);

// ─────────────────────────────────────────────────────────────────────────────
// CONFIRM DIALOG  (replaces window.confirm())
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel = 'Confirm', danger = false }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl p-8 max-w-sm w-full mx-4 shadow-2xl animate-in zoom-in-95 duration-200">
        <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-4 mx-auto ${danger ? 'bg-red-500/20' : 'bg-blue-500/20'}`}>
          {danger ? <AlertTriangle className="h-6 w-6 text-red-400"/> : <Info className="h-6 w-6 text-blue-400"/>}
        </div>
        <h3 className="text-lg font-bold text-white text-center mb-2">{title}</h3>
        <p className="text-slate-400 text-sm text-center mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-800 font-medium transition text-sm">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 py-2.5 rounded-xl font-bold transition text-sm text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}

function useConfirm() {
  const [state, setState] = useState({ open: false });
  const resolve = useRef(null);

  const confirm = useCallback((title, message, { danger = false, confirmLabel = 'Confirm' } = {}) => {
    return new Promise(res => {
      resolve.current = res;
      setState({ open: true, title, message, danger, confirmLabel });
    });
  }, []);

  const Dialog = (
    <ConfirmDialog
      open={state.open}
      title={state.title}
      message={state.message}
      danger={state.danger}
      confirmLabel={state.confirmLabel}
      onConfirm={() => { setState({ open: false }); resolve.current(true); }}
      onCancel={() => { setState({ open: false }); resolve.current(false); }}
    />
  );

  return [confirm, Dialog];
}

// ─────────────────────────────────────────────────────────────────────────────
// SHARED UI HELPERS
// ─────────────────────────────────────────────────────────────────────────────
const inputCls = "block w-full px-4 py-3 bg-slate-800/60 border border-slate-700/60 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/60 focus:border-blue-500/40 transition-all text-sm";
const labelCls = "block text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1.5";
const cardCls  = "bg-slate-900/60 backdrop-blur-sm border border-slate-700/50 rounded-2xl";

function StatCard({ icon: Icon, label, value, color = 'blue', sub }) {
  const colors = {
    blue:   { bg: 'bg-blue-500/10',   icon: 'text-blue-400',   val: 'text-blue-300' },
    indigo: { bg: 'bg-indigo-500/10', icon: 'text-indigo-400', val: 'text-indigo-300' },
    amber:  { bg: 'bg-amber-500/10',  icon: 'text-amber-400',  val: 'text-amber-300' },
    red:    { bg: 'bg-red-500/10',    icon: 'text-red-400',    val: 'text-red-300' },
    emerald:{ bg: 'bg-emerald-500/10',icon: 'text-emerald-400',val: 'text-emerald-300' },
    purple: { bg: 'bg-purple-500/10', icon: 'text-purple-400', val: 'text-purple-300' },
  };
  const c = colors[color] || colors.blue;
  return (
    <div className={`${cardCls} p-6 flex items-center gap-5`}>
      <div className={`w-14 h-14 rounded-2xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
        <Icon className={`h-7 w-7 ${c.icon}`}/>
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-0.5">{label}</p>
        <p className={`text-3xl font-black ${c.val}`}>{value}</p>
        {sub && <p className="text-xs text-slate-500 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function Badge({ children, color = 'slate' }) {
  const cls = {
    slate:   'bg-slate-700/60 text-slate-300',
    blue:    'bg-blue-500/20 text-blue-300',
    emerald: 'bg-emerald-500/20 text-emerald-300',
    amber:   'bg-amber-500/20 text-amber-300',
    red:     'bg-red-500/20 text-red-300',
    indigo:  'bg-indigo-500/20 text-indigo-300',
    rose:    'bg-rose-500/20 text-rose-300',
  };
  return <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${cls[color] || cls.slate}`}>{children}</span>;
}

function SectionTitle({ children, icon: Icon }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      {Icon && <Icon className="h-5 w-5 text-blue-400"/>}
      <h2 className="text-lg font-bold text-white">{children}</h2>
    </div>
  );
}

function Spinner() {
  return <Loader2 className="h-5 w-5 animate-spin text-blue-400"/>;
}

function EmptyState({ icon: Icon, title, sub }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-2xl bg-slate-800/60 flex items-center justify-center mb-4">
        <Icon className="h-8 w-8 text-slate-600"/>
      </div>
      <p className="font-bold text-slate-500 text-base">{title}</p>
      {sub && <p className="text-slate-600 text-sm mt-1">{sub}</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isInit, setIsInit] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('hims_token');
    const user  = localStorage.getItem('hims_user');
    if (token && user) setCurrentUser(JSON.parse(user));
    setIsInit(false);
  }, []);

  const handleLogin  = (data) => {
    localStorage.setItem('hims_token', data.token);
    localStorage.setItem('hims_user',  JSON.stringify(data.user));
    setCurrentUser(data.user);
  };

  const handleLogout = () => {
    localStorage.removeItem('hims_token');
    localStorage.removeItem('hims_user');
    setCurrentUser(null);
  };

  if (isInit) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950">
        <ActivitySquare className="animate-pulse h-16 w-16 text-blue-500"/>
      </div>
    );
  }

  return (
    <ToastProvider>
      {!currentUser
        ? <LandingPage onSuccess={handleLogin}/>
        : <DashboardLayout user={currentUser} onLogout={handleLogout}>
            {currentUser.role === 'admin'        && <AdminDashboard/>}
            {currentUser.role === 'receptionist' && <ReceptionistDashboard/>}
            {currentUser.role === 'nurse'        && <NurseDashboard/>}
            {currentUser.role === 'doctor'       && <DoctorDashboard/>}
            {currentUser.role === 'lab_tech'     && <LabDashboard/>}
            {currentUser.role === 'pharmacist'   && <PharmacistDashboard/>}
            {currentUser.role === 'patient'      && <PatientPortal user={currentUser}/>}
          </DashboardLayout>
      }
    </ToastProvider>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LANDING PAGE
// ─────────────────────────────────────────────────────────────────────────────
function LandingPage({ onSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setSuccess(''); setLoading(true);
    try {
      if (isLogin) {
        const data = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: form.email, password: form.password }) });
        onSuccess(data);
      } else {
        const data = await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(form) });
        setSuccess(data.message);
        setIsLogin(true);
        setForm({ ...form, password: '' });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const autofill = (email, password) => { setForm(f => ({ ...f, email, password })); setIsLogin(true); setError(''); setSuccess(''); };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row font-sans">
      {/* ── Left Hero ── */}
      <div className="md:w-[58%] bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white p-10 md:p-16 flex flex-col justify-between relative overflow-hidden">
        {/* Glassy orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none"/>
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none"/>

        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-14">
            <div className="h-12 w-12 bg-blue-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/50">
              <ActivitySquare className="h-7 w-7 text-white"/>
            </div>
            <div>
              <p className="text-xl font-black tracking-wide text-white">FUD HIMS</p>
              <p className="text-xs text-blue-300 tracking-widest uppercase">Health Centre</p>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-black leading-tight mb-5">
            Clinical<br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-indigo-400">Intelligence</span><br/>for Modern Care
          </h1>
          <p className="text-blue-200/70 text-lg leading-relaxed mb-10 max-w-lg">
            A fully-integrated Health Information Management System for Federal University Dutse — connecting triage, EMR, pharmacy, laboratory, and billing in a single secure platform.
          </p>

          <div className="grid grid-cols-2 gap-4 max-w-md mb-10">
            {[
              { icon: Activity,     label: 'Real-time EMR'    },
              { icon: Shield,       label: 'RBAC Security'    },
              { icon: Pill,         label: 'E-Dispensary'     },
              { icon: BarChart3,    label: 'System Analytics' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl px-4 py-3 backdrop-blur-sm">
                <Icon className="h-4 w-4 text-blue-400 flex-shrink-0"/>
                <span className="text-sm font-medium text-blue-100">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quick-access panel */}
        <div className="relative z-10 bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6">
          <p className="text-xs font-bold text-amber-400 uppercase tracking-widest mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4"/> MSc Evaluation — Quick Access
          </p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Admin',        email: 'admin@fud.edu.ng',        pw: 'admin123' },
              { label: 'Receptionist', email: 'recept@fud.edu.ng',       pw: 'staff123' },
              { label: 'Doctor',       email: 'doctor@fud.edu.ng',       pw: 'staff123' },
              { label: 'Nurse',        email: 'nurse@fud.edu.ng',        pw: 'staff123' },
              { label: 'Lab Tech',     email: 'labtech@fud.edu.ng',      pw: 'staff123' },
              { label: 'Pharmacist',   email: 'pharmacist@fud.edu.ng',   pw: 'staff123' },
            ].map(({ label, email, pw }) => (
              <button key={label} onClick={() => autofill(email, pw)}
                className="py-2 px-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-400/20 text-xs font-bold text-blue-300 transition-all hover:text-white">
                {label}
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3">Click a role to pre-fill credentials, then sign in. Staff accounts must be created in DB or via Admin panel.</p>
        </div>
      </div>

      {/* ── Right Auth Panel ── */}
      <div className="md:w-[42%] bg-slate-950 flex items-center justify-center p-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-black text-white mb-1">
              {isLogin ? 'Welcome back' : 'Create account'}
            </h2>
            <p className="text-slate-500 text-sm">
              {isLogin ? 'Access your secure clinical portal' : 'Register as a new patient'}
            </p>
          </div>

          <div className="flex p-1 bg-slate-900 rounded-xl mb-8 border border-slate-800">
            <button onClick={() => { setIsLogin(true); setError(''); setSuccess(''); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-white'}`}>
              Sign In
            </button>
            <button onClick={() => { setIsLogin(false); setError(''); setSuccess(''); }}
              className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-blue-600 text-white shadow-md' : 'text-slate-500 hover:text-white'}`}>
              Register
            </button>
          </div>

          {error && (
            <div className="mb-5 flex items-start gap-3 bg-red-950/60 border border-red-500/30 rounded-xl p-4">
              <XCircle className="h-5 w-5 text-red-400 flex-shrink-0 mt-0.5"/>
              <span className="text-sm text-red-300">{error}</span>
            </div>
          )}
          {success && (
            <div className="mb-5 flex items-start gap-3 bg-emerald-950/60 border border-emerald-500/30 rounded-xl p-4">
              <CheckCircle2 className="h-5 w-5 text-emerald-400 flex-shrink-0 mt-0.5"/>
              <span className="text-sm text-emerald-300">{success}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div>
                <label className={labelCls}>Full Name</label>
                <input required type="text" className={inputCls} placeholder="e.g. Aisha Ibrahim"
                  value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/>
              </div>
            )}
            <div>
              <label className={labelCls}>Email Address</label>
              <input required type="email" className={inputCls} placeholder="name@example.com"
                value={form.email} onChange={e => setForm({ ...form, email: e.target.value })}/>
            </div>
            <div>
              <label className={labelCls}>Password</label>
              <input required type="password" className={inputCls} placeholder="••••••••"
                value={form.password} onChange={e => setForm({ ...form, password: e.target.value })}/>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg shadow-blue-900/40 disabled:opacity-60 flex items-center justify-center gap-2 mt-2">
              {loading ? <Spinner/> : (isLogin ? 'Access Portal' : 'Create Patient Account')}
            </button>
          </form>
          <p className="text-center text-xs text-slate-600 mt-8">
            Secured by JWT + bcrypt · Role-Based Access Control
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD LAYOUT
// ─────────────────────────────────────────────────────────────────────────────
const roleNavMap = {
  admin:        [{ icon: BarChart3, label: 'Overview', view: 'overview' }, { icon: Users, label: 'Staff Management', view: 'staff' }, { icon: FileArchive, label: 'Audit Logs', view: 'audit' }],
  receptionist: [{ icon: BarChart3, label: 'Overview', view: 'overview' }, { icon: UserPlus, label: 'Register Patient', view: 'register' }, { icon: ClipboardList, label: 'Queue Check-In', view: 'queue' }, { icon: CreditCard, label: 'Billing & Invoices', view: 'billing' }],
  nurse:        [{ icon: Clock, label: 'Triage Queue', view: 'triage' }, { icon: Syringe, label: 'Immunizations', view: 'immunization' }],
  doctor:       [{ icon: Stethoscope, label: 'Patient Queue', view: 'queue' }],
  lab_tech:     [{ icon: FlaskConical, label: 'Lab Requests', view: 'requests' }],
  pharmacist:   [{ icon: PillIcon, label: 'E-Dispensary', view: 'dispensary' }, { icon: Package, label: 'Inventory', view: 'inventory' }],
  patient:      [{ icon: FileText, label: 'My Records', view: 'records' }],
};

function DashboardLayout({ children, user, onLogout }) {
  const navItems = roleNavMap[user.role] || [];

  const roleColors = {
    admin: 'from-blue-600 to-indigo-600',
    receptionist: 'from-sky-500 to-blue-600',
    nurse: 'from-emerald-500 to-teal-600',
    doctor: 'from-indigo-500 to-purple-600',
    lab_tech: 'from-amber-500 to-orange-600',
    pharmacist: 'from-emerald-500 to-green-600',
    patient: 'from-slate-500 to-slate-600',
  };

  return (
    <div className="flex h-screen bg-slate-950 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 border-r border-slate-800 flex flex-col shadow-2xl z-20 flex-shrink-0">
        {/* Logo */}
        <div className="h-20 flex items-center px-6 border-b border-slate-800">
          <div className="h-9 w-9 bg-blue-600 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-blue-900/50">
            <ActivitySquare className="h-5 w-5 text-white"/>
          </div>
          <div>
            <span className="text-lg font-black text-white">FUD HIMS</span>
            <p className="text-xs text-slate-500 leading-none">Health Centre</p>
          </div>
        </div>

        {/* User info */}
        <div className="p-5 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className={`h-11 w-11 rounded-full bg-gradient-to-br ${roleColors[user.role] || 'from-slate-600 to-slate-700'} flex items-center justify-center text-white font-black text-lg shadow-lg flex-shrink-0`}>
              {user.name?.charAt(0)?.toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-bold text-white truncate">{user.name}</p>
              <p className="text-xs text-slate-400 font-medium capitalize">{user.role?.replace('_', ' ')}</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <a key={item.view} href={`#${item.view}`}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-400 hover:bg-slate-800/80 hover:text-white transition-all duration-150 text-sm font-medium group">
              <item.icon className="h-4 w-4 group-hover:text-blue-400 transition-colors"/>
              <span>{item.label}</span>
            </a>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-slate-500 hover:bg-red-900/20 hover:text-red-400 transition-all font-medium text-sm">
            <LogOut className="h-4 w-4"/> Secure Logout
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-16 bg-slate-900/80 backdrop-blur-sm border-b border-slate-800 flex items-center justify-between px-8 flex-shrink-0">
          <p className="text-sm text-slate-400 font-medium">Federal University Dutse — Health Centre</p>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="h-4 w-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2"/>
              <input type="text" placeholder="Search records…" className="pl-9 pr-4 py-2 bg-slate-800/60 border border-slate-700/40 rounded-xl text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500/40 w-56"/>
            </div>
            <button className="relative p-2 text-slate-500 hover:text-blue-400 transition">
              <Bell className="h-5 w-5"/>
              <span className="absolute top-1.5 right-1.5 h-2 w-2 bg-red-500 rounded-full"/>
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8 bg-slate-950">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function AdminDashboard() {
  const [stats, setStats] = useState({});
  const [logs, setLogs]   = useState([]);
  const [users, setUsers] = useState([]);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', role: 'doctor' });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, l, u] = await Promise.all([
        apiFetch('/api/analytics'),
        apiFetch('/api/audit-logs'),
        apiFetch('/api/users'),
      ]);
      setStats(s); setLogs(l); setUsers(u);
    } catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const createStaff = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(staffForm) });
      toast('Staff account created successfully.', 'success');
      setStaffForm({ name: '', email: '', password: '', role: 'doctor' });
      load();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const actionColor = { INSERT: 'emerald', UPDATE: 'blue', DELETE: 'red' };

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">System Overview</h1>
          <p className="text-slate-500 text-sm mt-0.5">Real-time operational dashboard</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard icon={Users}       label="Total Patients"    value={stats.totalPatients      ?? '—'} color="blue"/>
        <StatCard icon={Stethoscope} label="Today's Consults"  value={stats.consultationsToday ?? '—'} color="indigo"/>
        <StatCard icon={TestTube}    label="Pending Labs"      value={stats.pendingLabs        ?? '—'} color="amber"/>
        <StatCard icon={AlertTriangle} label="Low Stock"       value={stats.lowStock           ?? '—'} color="red"/>
        <StatCard icon={DollarSign}  label="Revenue (₦)"       value={stats.totalRevenue ? `${Number(stats.totalRevenue).toLocaleString()}` : '—'} color="emerald"/>
        <StatCard icon={Receipt}     label="Paid Invoices"     value={stats.paidInvoices       ?? '—'} color="purple"/>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Create Staff */}
        <div className={`${cardCls} p-6`}>
          <SectionTitle icon={UserPlus}>Add Staff Account</SectionTitle>
          <form onSubmit={createStaff} className="space-y-4">
            {[['name','text','Full Name'],['email','email','Email Address'],['password','password','Temporary Password']].map(([k,t,ph]) => (
              <div key={k}>
                <label className={labelCls}>{ph}</label>
                <input required type={t} placeholder={ph} value={staffForm[k]} onChange={e => setStaffForm({...staffForm, [k]: e.target.value})} className={inputCls}/>
              </div>
            ))}
            <div>
              <label className={labelCls}>Role</label>
              <select value={staffForm.role} onChange={e => setStaffForm({...staffForm, role: e.target.value})} className={inputCls}>
                {['doctor','nurse','pharmacist','lab_tech','receptionist','admin'].map(r => (
                  <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1).replace('_',' ')}</option>
                ))}
              </select>
            </div>
            <button type="submit" disabled={submitting} className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition flex items-center justify-center gap-2 disabled:opacity-60">
              {submitting ? <Spinner/> : <><UserPlus className="h-4 w-4"/> Create Account</>}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-800">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Active Staff ({users.filter(u=>u.is_active && u.role!=='patient').length})</p>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {users.filter(u => u.role !== 'patient').map(u => (
                <div key={u.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium text-white">{u.name}</p>
                    <p className="text-xs text-slate-500 capitalize">{u.role.replace('_',' ')}</p>
                  </div>
                  <Badge color={u.is_active ? 'emerald' : 'red'}>{u.is_active ? 'Active' : 'Inactive'}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Audit Logs */}
        <div className={`${cardCls} p-6 lg:col-span-2 flex flex-col`}>
          <SectionTitle icon={FileArchive}>Security Audit Log</SectionTitle>
          <div className="overflow-x-auto flex-1">
            {loading ? (
              <div className="flex justify-center py-12"><Spinner/></div>
            ) : (
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">
                    <th className="pb-3 pr-4">Timestamp</th>
                    <th className="pb-3 pr-4">Actor</th>
                    <th className="pb-3 pr-4">Action</th>
                    <th className="pb-3">Table</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {logs.slice(0,50).map(log => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 pr-4 text-slate-400 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                      <td className="py-3 pr-4 text-white font-medium">{log.acting_user || 'System'}</td>
                      <td className="py-3 pr-4"><Badge color={actionColor[log.action] || 'slate'}>{log.action}</Badge></td>
                      <td className="py-3 text-slate-400">{log.table_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// RECEPTIONIST DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function ReceptionistDashboard() {
  const [view, setView] = useState('register');
  const [patientForm, setPatientForm] = useState({
    university_id: '', patient_type: 'student', full_name: '', dob: '',
    gender: 'Male', blood_group: '', genotype: '', phone: '', address: ''
  });
  const [billingForm, setBillingForm] = useState({ patient_id: '', total_amount: '', purpose: '' });
  const [queueForm, setQueueForm]     = useState({ patient_id: '', assigned_doctor_id: '', notes: '' });
  const [patients, setPatients]       = useState([]);
  const [doctors, setDoctors]         = useState([]);
  const [invoices, setInvoices]       = useState([]);
  const [queue, setQueue]             = useState([]);
  const [search, setSearch]           = useState('');
  const [loading, setLoading]         = useState(false);
  const [submitting, setSubmitting]   = useState(false);
  const toast = useToast();
  const [confirm, ConfirmUI] = useConfirm();

  useEffect(() => {
    apiFetch('/api/patients').then(setPatients).catch(console.error);
    apiFetch('/api/users/doctors').then(setDoctors).catch(console.error);
  }, []);

  useEffect(() => {
    if (view === 'billing') loadInvoices();
    if (view === 'queue')   loadQueue();
  }, [view]);

  const searchPatients = async () => {
    setLoading(true);
    try { setPatients(await apiFetch(`/api/patients?search=${encodeURIComponent(search)}`)); }
    catch (e) { toast(e.message, 'error'); }
    finally { setLoading(false); }
  };

  const loadInvoices = async () => {
    try { setInvoices(await apiFetch('/api/billing/unpaid')); }
    catch (e) { toast(e.message, 'error'); }
  };

  const loadQueue = async () => {
    try { setQueue(await apiFetch('/api/queue/active')); }
    catch (e) { toast(e.message, 'error'); }
  };

  const registerPatient = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await apiFetch('/api/patients', { method: 'POST', body: JSON.stringify(patientForm) });
      toast('Patient registered successfully in HIMS.', 'success');
      setPatientForm({ university_id:'', patient_type:'student', full_name:'', dob:'', gender:'Male', blood_group:'', genotype:'', phone:'', address:'' });
      apiFetch('/api/patients').then(setPatients).catch(console.error);
    } catch (e) { toast(e.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const checkinPatient = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await apiFetch('/api/queue', { method: 'POST', body: JSON.stringify(queueForm) });
      toast('Patient checked in and added to triage queue.', 'success');
      setQueueForm({ patient_id:'', assigned_doctor_id:'', notes:'' });
      loadQueue();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const createInvoice = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await apiFetch('/api/billing', { method: 'POST', body: JSON.stringify(billingForm) });
      toast('Invoice created successfully.', 'success');
      setBillingForm({ patient_id:'', total_amount:'', purpose:'' });
      loadInvoices();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const markPaid = async (inv) => {
    const ok = await confirm('Confirm Payment', `Mark invoice for ${inv.patient_name} (₦${Number(inv.total_amount).toLocaleString()}) as paid?`, { confirmLabel: 'Mark Paid' });
    if (!ok) return;
    try {
      await apiFetch(`/api/billing/${inv.id}/pay`, { method: 'PUT', body: JSON.stringify({ payment_method: 'Cash' }) });
      toast('Payment confirmed and receipt generated.', 'success');
      loadInvoices();
    } catch (e) { toast(e.message, 'error'); }
  };

  const tabs = [
    { key: 'register', label: 'Register Patient', icon: UserPlus },
    { key: 'queue',    label: 'Queue Check-In',   icon: ClipboardList },
    { key: 'billing',  label: 'Billing',           icon: CreditCard },
  ];

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {ConfirmUI}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Front Desk</h1>
          <p className="text-slate-500 text-sm">Patient registration, check-in, and billing</p>
        </div>
      </div>

      <div className="flex gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setView(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${view===t.key ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}>
            <t.icon className="h-4 w-4"/>{t.label}
          </button>
        ))}
      </div>

      {/* ── Register Patient ── */}
      {view === 'register' && (
        <div className={`${cardCls} p-8 max-w-4xl`}>
          <SectionTitle icon={UserPlus}>New Patient Registration</SectionTitle>
          <form onSubmit={registerPatient} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className={labelCls}>Full Name *</label>
              <input required type="text" placeholder="e.g. Musa Usman Aliyu" className={inputCls}
                value={patientForm.full_name} onChange={e => setPatientForm({...patientForm, full_name: e.target.value})}/>
            </div>
            <div>
              <label className={labelCls}>University ID</label>
              <input type="text" placeholder="e.g. FUD/2021/CSC/0042" className={inputCls}
                value={patientForm.university_id} onChange={e => setPatientForm({...patientForm, university_id: e.target.value})}/>
            </div>
            <div>
              <label className={labelCls}>Patient Type *</label>
              <select required className={inputCls} value={patientForm.patient_type} onChange={e => setPatientForm({...patientForm, patient_type: e.target.value})}>
                <option value="student">Student</option>
                <option value="staff">Staff</option>
                <option value="dependent">Dependent</option>
                <option value="external">External</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Date of Birth</label>
              <input type="date" className={inputCls} value={patientForm.dob} onChange={e => setPatientForm({...patientForm, dob: e.target.value})}/>
            </div>
            <div>
              <label className={labelCls}>Gender *</label>
              <select className={inputCls} value={patientForm.gender} onChange={e => setPatientForm({...patientForm, gender: e.target.value})}>
                <option>Male</option><option>Female</option><option>Other</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Phone Number</label>
              <input type="tel" placeholder="+234 800 000 0000" className={inputCls}
                value={patientForm.phone} onChange={e => setPatientForm({...patientForm, phone: e.target.value})}/>
            </div>
            <div>
              <label className={labelCls}>Blood Group</label>
              <select className={inputCls} value={patientForm.blood_group} onChange={e => setPatientForm({...patientForm, blood_group: e.target.value})}>
                <option value="">— Select —</option>
                {['A+','A-','B+','B-','O+','O-','AB+','AB-'].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Genotype</label>
              <select className={inputCls} value={patientForm.genotype} onChange={e => setPatientForm({...patientForm, genotype: e.target.value})}>
                <option value="">— Select —</option>
                {['AA','AS','SS','AC','SC'].map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className={labelCls}>Home Address</label>
              <input type="text" placeholder="House No, Street, City" className={inputCls}
                value={patientForm.address} onChange={e => setPatientForm({...patientForm, address: e.target.value})}/>
            </div>
            <div className="md:col-span-2">
              <button type="submit" disabled={submitting}
                className="px-8 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition shadow-lg shadow-blue-900/30 flex items-center gap-2 disabled:opacity-60">
                {submitting ? <Spinner/> : <><BadgeCheck className="h-5 w-5"/> Complete Registration</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Queue Check-In ── */}
      {view === 'queue' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className={`${cardCls} p-6`}>
            <SectionTitle icon={ClipboardList}>Check-In Patient to Triage</SectionTitle>
            <form onSubmit={checkinPatient} className="space-y-4">
              <div>
                <label className={labelCls}>Select Patient *</label>
                <div className="flex gap-2 mb-2">
                  <input type="text" placeholder="Search by name or ID…" className={inputCls} value={search} onChange={e => setSearch(e.target.value)}/>
                  <button type="button" onClick={searchPatients} className="px-4 py-3 rounded-xl bg-slate-700 hover:bg-slate-600 text-white transition flex-shrink-0"><Search className="h-4 w-4"/></button>
                </div>
                <select required className={inputCls} value={queueForm.patient_id} onChange={e => setQueueForm({...queueForm, patient_id: e.target.value})}>
                  <option value="">— Choose patient —</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.university_id || 'External'})</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Assign Doctor (optional)</label>
                <select className={inputCls} value={queueForm.assigned_doctor_id} onChange={e => setQueueForm({...queueForm, assigned_doctor_id: e.target.value})}>
                  <option value="">— Auto-assign —</option>
                  {doctors.map(d => <option key={d.id} value={d.id}>Dr. {d.name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Presenting Complaint (optional)</label>
                <input type="text" placeholder="Brief reason for visit" className={inputCls}
                  value={queueForm.notes} onChange={e => setQueueForm({...queueForm, notes: e.target.value})}/>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting ? <Spinner/> : <><ArrowRight className="h-4 w-4"/> Check In to Triage</>}
              </button>
            </form>
          </div>

          <div className={`${cardCls} p-6 flex flex-col max-h-[600px]`}>
            <SectionTitle icon={Activity}>Active Queue</SectionTitle>
            <div className="flex-1 overflow-y-auto space-y-2">
              {queue.length === 0
                ? <EmptyState icon={ClipboardList} title="Queue is empty" sub="No patients currently active"/>
                : queue.map(q => (
                  <div key={q.id} className="flex items-center justify-between bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-3">
                    <div>
                      <p className="font-bold text-white text-sm">{q.patient_name}</p>
                      <p className="text-xs text-slate-400">{new Date(q.check_in_time).toLocaleTimeString()} · {q.patient_type}</p>
                    </div>
                    <Badge color={
                      q.status === 'waiting_triage'   ? 'amber'   :
                      q.status === 'waiting_doctor'   ? 'blue'    :
                      q.status === 'waiting_lab'      ? 'indigo'  :
                      q.status === 'waiting_pharmacy' ? 'emerald' : 'slate'
                    }>{q.status.replace(/_/g,' ')}</Badge>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}

      {/* ── Billing ── */}
      {view === 'billing' && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className={`${cardCls} p-6 lg:col-span-2`}>
            <SectionTitle icon={CreditCard}>Generate Invoice</SectionTitle>
            <form onSubmit={createInvoice} className="space-y-4">
              <div>
                <label className={labelCls}>Patient *</label>
                <select required className={inputCls} value={billingForm.patient_id} onChange={e => setBillingForm({...billingForm, patient_id: e.target.value})}>
                  <option value="">— Select patient —</option>
                  {patients.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div>
                <label className={labelCls}>Purpose / Service *</label>
                <input required type="text" placeholder="e.g. Consultation Fee, Lab Tests" className={inputCls}
                  value={billingForm.purpose} onChange={e => setBillingForm({...billingForm, purpose: e.target.value})}/>
              </div>
              <div>
                <label className={labelCls}>Total Amount (₦) *</label>
                <input required type="number" min="0" step="0.01" className={inputCls}
                  value={billingForm.total_amount} onChange={e => setBillingForm({...billingForm, total_amount: e.target.value})}/>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition flex items-center justify-center gap-2 disabled:opacity-60">
                {submitting ? <Spinner/> : <><Receipt className="h-4 w-4"/> Create Invoice</>}
              </button>
            </form>
          </div>

          <div className={`${cardCls} p-6 lg:col-span-3 flex flex-col max-h-[600px]`}>
            <SectionTitle icon={CreditCard}>Unpaid Invoices</SectionTitle>
            <div className="flex-1 overflow-y-auto space-y-3">
              {invoices.length === 0
                ? <EmptyState icon={CheckCircle2} title="All clear" sub="No outstanding invoices"/>
                : invoices.map(inv => (
                  <div key={inv.id} className="flex items-center justify-between bg-slate-800/40 border border-slate-700/40 rounded-xl p-4">
                    <div>
                      <p className="font-bold text-white">{inv.patient_name}</p>
                      <p className="text-xs text-slate-400">{inv.purpose} · {new Date(inv.created_at).toLocaleDateString()}</p>
                      <p className="text-lg font-black text-red-400 mt-0.5">₦{Number(inv.total_amount).toLocaleString()}</p>
                    </div>
                    <button onClick={() => markPaid(inv)}
                      className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold transition flex items-center gap-2">
                      <Check className="h-4 w-4"/> Mark Paid
                    </button>
                  </div>
                ))
              }
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// NURSE DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function NurseDashboard() {
  const [view, setView]               = useState('triage');
  const [queue, setQueue]             = useState([]);
  const [patients, setPatients]       = useState([]);
  const [selected, setSelected]       = useState(null);
  const [vitals, setVitals]           = useState({ blood_pressure:'', temperature:'', weight:'', heart_rate:'', spo2:'' });
  const [immForm, setImmForm]         = useState({ patient_id:'', vaccine_name:'', dose_number:'', batch_number:'', next_due_date:'' });
  const [submitting, setSubmitting]   = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (view === 'triage')       loadQueue();
    if (view === 'immunization') apiFetch('/api/patients').then(setPatients).catch(console.error);
  }, [view]);

  const loadQueue = async () => {
    try {
      const data = await apiFetch('/api/queue/active');
      setQueue(data.filter(q => q.status === 'waiting_triage'));
    } catch (e) { toast(e.message, 'error'); }
  };

  const submitVitals = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await apiFetch('/api/vitals', { method: 'POST', body: JSON.stringify({ patient_id: selected.patient_id, ...vitals }) });
      toast('Vitals recorded. Patient moved to Doctor queue.', 'success');
      setSelected(null);
      setVitals({ blood_pressure:'', temperature:'', weight:'', heart_rate:'', spo2:'' });
      loadQueue();
    } catch (e) { toast(e.message, 'error'); }
    finally { setSubmitting(false); }
  };

  const submitImmunization = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await apiFetch('/api/immunizations', { method: 'POST', body: JSON.stringify(immForm) });
      toast('Immunization record saved.', 'success');
      setImmForm({ patient_id:'', vaccine_name:'', dose_number:'', batch_number:'', next_due_date:'' });
    } catch (e) { toast(e.message, 'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-black text-white">Clinical Nursing</h1>
        <p className="text-slate-500 text-sm">Triage, vitals, and immunization management</p>
      </div>

      <div className="flex gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {[{key:'triage',label:'Triage Queue',icon:Clock},{key:'immunization',label:'Immunizations',icon:Syringe}].map(t=>(
          <button key={t.key} onClick={() => setView(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${view===t.key ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            <t.icon className="h-4 w-4"/>{t.label}
          </button>
        ))}
      </div>

      {view === 'triage' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`${cardCls} lg:col-span-1 flex flex-col max-h-[680px]`}>
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <span className="font-bold text-white flex items-center gap-2"><Clock className="h-4 w-4 text-emerald-400"/> Triage Queue</span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/20 text-emerald-300">{queue.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {queue.length === 0 ? <EmptyState icon={Clock} title="Queue clear" sub="No patients awaiting triage"/> : queue.map(p=>(
                <div key={p.id} onClick={() => setSelected(p)}
                  className={`p-4 rounded-xl cursor-pointer border transition-all ${selected?.id===p.id ? 'bg-emerald-900/30 border-emerald-500/30' : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50'}`}>
                  <p className="font-bold text-white">{p.patient_name}</p>
                  <div className="flex justify-between mt-1">
                    <Badge color="blue">{p.patient_type}</Badge>
                    <span className="text-xs text-slate-500">{new Date(p.check_in_time).toLocaleTimeString()}</span>
                  </div>
                  {p.notes && <p className="text-xs text-slate-400 mt-1 italic">"{p.notes}"</p>}
                </div>
              ))}
            </div>
          </div>

          <div className={`${cardCls} lg:col-span-2 p-8 flex flex-col`}>
            {!selected ? (
              <EmptyState icon={Heart} title="Select a patient" sub="Click a patient from the triage queue to record vitals"/>
            ) : (
              <form onSubmit={submitVitals} className="flex flex-col h-full gap-5">
                <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-xl font-black text-white">{selected.patient_name}</h2>
                    <p className="text-slate-400 text-sm">{selected.patient_type} · {selected.blood_group || '—'}</p>
                  </div>
                  <Badge color="amber">Awaiting Triage</Badge>
                </div>
                <div className="grid grid-cols-2 gap-5">
                  {[
                    {key:'blood_pressure', label:'Blood Pressure (mmHg)', ph:'120/80', icon:Heart},
                    {key:'heart_rate',     label:'Heart Rate (BPM)',      ph:'72',    icon:Activity},
                    {key:'temperature',    label:'Temperature (°C)',      ph:'36.5',  icon:Thermometer},
                    {key:'weight',         label:'Weight (kg)',           ph:'70.5',  icon:Scale},
                    {key:'spo2',           label:'SpO₂ (%)',              ph:'99',    icon:Zap},
                  ].map(({key,label,ph,icon:Icon}) => (
                    <div key={key} className={key==='spo2' ? 'col-span-2 md:col-span-1' : ''}>
                      <label className={labelCls + ' flex items-center gap-1'}><Icon className="h-3 w-3"/>{label}</label>
                      <input type={key==='blood_pressure' ? 'text' : 'number'} step="any" placeholder={ph} className={inputCls}
                        value={vitals[key]} onChange={e => setVitals({...vitals, [key]: e.target.value})}
                        required={key !== 'spo2'}/>
                    </div>
                  ))}
                </div>
                <div className="mt-auto">
                  <button type="submit" disabled={submitting}
                    className="w-full py-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-emerald-900/30">
                    {submitting ? <Spinner/> : <><Save className="h-5 w-5"/> Save Vitals & Send to Doctor</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {view === 'immunization' && (
        <div className={`${cardCls} p-8 max-w-2xl`}>
          <SectionTitle icon={Syringe}>Record Immunization</SectionTitle>
          <form onSubmit={submitImmunization} className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className={labelCls}>Patient *</label>
              <select required className={inputCls} value={immForm.patient_id} onChange={e => setImmForm({...immForm, patient_id: e.target.value})}>
                <option value="">— Select patient —</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.university_id || 'Ext'})</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Vaccine Name *</label>
              <input required type="text" placeholder="e.g. Hepatitis B, COVID-19" className={inputCls}
                value={immForm.vaccine_name} onChange={e => setImmForm({...immForm, vaccine_name: e.target.value})}/>
            </div>
            <div>
              <label className={labelCls}>Dose Number</label>
              <input type="text" placeholder="e.g. Dose 1, Booster" className={inputCls}
                value={immForm.dose_number} onChange={e => setImmForm({...immForm, dose_number: e.target.value})}/>
            </div>
            <div>
              <label className={labelCls}>Batch Number</label>
              <input type="text" placeholder="e.g. BNT2022-001" className={inputCls}
                value={immForm.batch_number} onChange={e => setImmForm({...immForm, batch_number: e.target.value})}/>
            </div>
            <div>
              <label className={labelCls}>Next Due Date</label>
              <input type="date" className={inputCls}
                value={immForm.next_due_date} onChange={e => setImmForm({...immForm, next_due_date: e.target.value})}/>
            </div>
            <div className="md:col-span-2">
              <button type="submit" disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-emerald-900/30">
                {submitting ? <Spinner/> : <><Syringe className="h-4 w-4"/> Save Vaccination Record</>}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DOCTOR DASHBOARD (EMR)
// ─────────────────────────────────────────────────────────────────────────────
function DoctorDashboard() {
  const [queue, setQueue]           = useState([]);
  const [selected, setSelected]     = useState(null);
  const [tab, setTab]               = useState('history');
  const [history, setHistory]       = useState({ consultations:[], vitals:[], labs:[], prescriptions:[], immunizations:[] });
  const [inventory, setInventory]   = useState([]);
  const [lastConsultId, setLastConsultId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const [confirm, ConfirmUI] = useConfirm();

  const [cForm, setCForm] = useState({ chief_complaint:'', diagnosis:'', treatment_plan:'', notes:'' });
  const [labForm, setLabForm] = useState({ test_name:'' });
  const [rxItems, setRxItems] = useState([{ inventory_id:'', dosage:'', quantity_prescribed:1 }]);
  const [certForm, setCertForm] = useState({ certificate_type:'sick_leave', start_date:'', end_date:'', remarks:'' });

  useEffect(() => { loadQueue(); apiFetch('/api/inventory').then(setInventory).catch(console.error); }, []);

  const loadQueue = async () => {
    try {
      const data = await apiFetch('/api/queue/active');
      setQueue(data.filter(q => q.status === 'waiting_doctor'));
    } catch (e) { toast(e.message,'error'); }
  };

  const pickPatient = async (p) => {
    setSelected(p); setTab('history'); setLastConsultId(null);
    try {
      const data = await apiFetch(`/api/emr/history/${p.patient_id}`);
      setHistory(data);
      if (data.consultations.length > 0) setLastConsultId(data.consultations[0].id);
    } catch (e) { toast(e.message,'error'); }
  };

  const saveConsultation = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      const r = await apiFetch('/api/consultations', { method:'POST', body: JSON.stringify({ patient_id: selected.patient_id, ...cForm }) });
      toast('Consultation note saved.','success');
      setLastConsultId(r.consultation_id);
      setCForm({ chief_complaint:'', diagnosis:'', treatment_plan:'', notes:'' });
      pickPatient(selected);
    } catch (e) { toast(e.message,'error'); }
    finally { setSubmitting(false); }
  };

  const requestLab = async (e) => {
    e.preventDefault();
    if (!lastConsultId) { toast('Save a consultation first before requesting lab tests.','warning'); return; }
    setSubmitting(true);
    try {
      await apiFetch('/api/lab/request', { method:'POST', body: JSON.stringify({ patient_id: selected.patient_id, consultation_id: lastConsultId, test_name: labForm.test_name }) });
      toast('Lab test requested and queued.','success');
      setLabForm({ test_name:'' });
      pickPatient(selected);
    } catch (e) { toast(e.message,'error'); }
    finally { setSubmitting(false); }
  };

  const sendPrescription = async (e) => {
    e.preventDefault();
    if (!lastConsultId) { toast('Save a consultation before generating a prescription.','warning'); return; }
    const validItems = rxItems.filter(i => i.inventory_id && i.dosage);
    if (!validItems.length) { toast('Add at least one medication item.','warning'); return; }
    setSubmitting(true);
    try {
      await apiFetch('/api/prescriptions', { method:'POST', body: JSON.stringify({ patient_id: selected.patient_id, consultation_id: lastConsultId, items: validItems }) });
      toast('E-Prescription signed and sent to pharmacy.','success');
      setRxItems([{ inventory_id:'', dosage:'', quantity_prescribed:1 }]);
    } catch (e) { toast(e.message,'error'); }
    finally { setSubmitting(false); }
  };

  const issueCertificate = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await apiFetch('/api/certificates', { method:'POST', body: JSON.stringify({ patient_id: selected.patient_id, ...certForm }) });
      toast('Medical certificate issued.','success');
      setCertForm({ certificate_type:'sick_leave', start_date:'', end_date:'', remarks:'' });
    } catch (e) { toast(e.message,'error'); }
    finally { setSubmitting(false); }
  };

  const routePatient = async (status, label) => {
    const ok = await confirm('Route Patient', `Move ${selected.patient_name} to: ${label}?`, { confirmLabel: 'Confirm' });
    if (!ok) return;
    try {
      await apiFetch(`/api/queue/${selected.id}/status`, { method:'PUT', body: JSON.stringify({ status }) });
      toast(`Patient routed to ${label}.`,'success');
      setSelected(null);
      loadQueue();
    } catch (e) { toast(e.message,'error'); }
  };

  const tabs = [
    { id:'history', icon:History,      label:'History'       },
    { id:'consult', icon:Stethoscope,  label:'Consultation'  },
    { id:'lab',     icon:TestTube,     label:'Lab Request'   },
    { id:'rx',      icon:Pill,         label:'E-Prescribe'   },
    { id:'cert',    icon:FileText,     label:'Certificate'   },
  ];

  const addRxItem = () => setRxItems([...rxItems, { inventory_id:'', dosage:'', quantity_prescribed:1 }]);
  const updateRx  = (i, k, v) => { const a=[...rxItems]; a[i]={...a[i],[k]:v}; setRxItems(a); };
  const removeRx  = (i) => setRxItems(rxItems.filter((_,idx)=>idx!==i));

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {ConfirmUI}
      <div>
        <h1 className="text-2xl font-black text-white">EMR Workspace</h1>
        <p className="text-slate-500 text-sm">Electronic Medical Records — full patient clinical lifecycle</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Waiting list */}
        <div className={`${cardCls} lg:col-span-1 flex flex-col max-h-[780px]`}>
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-2"><Clock className="h-4 w-4 text-indigo-400"/> Waiting Room</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300">{queue.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {queue.length === 0 ? <EmptyState icon={Users} title="No patients" sub="Queue is empty"/> : queue.map(p => (
              <div key={p.id} onClick={() => pickPatient(p)}
                className={`p-4 rounded-xl cursor-pointer border transition-all ${selected?.id===p.id ? 'bg-indigo-900/30 border-indigo-500/30' : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50'}`}>
                <p className="font-bold text-white">{p.patient_name}</p>
                <div className="flex justify-between mt-1">
                  <Badge color="indigo">{p.patient_type}</Badge>
                  <span className="text-xs text-slate-500">{new Date(p.check_in_time).toLocaleTimeString()}</span>
                </div>
              </div>
            ))}
          </div>
          <button onClick={loadQueue} className="p-4 border-t border-slate-800 text-slate-500 hover:text-white text-sm flex items-center justify-center gap-2 transition">
            <RefreshCw className="h-4 w-4"/> Refresh Queue
          </button>
        </div>

        {/* EMR panel */}
        <div className={`${cardCls} lg:col-span-3 flex flex-col max-h-[780px]`}>
          {!selected ? (
            <EmptyState icon={Stethoscope} title="Select a patient" sub="Click a patient from the waiting room to open their EMR"/>
          ) : (
            <div className="flex flex-col h-full">
              {/* Patient header */}
              <div className="p-6 border-b border-slate-800 bg-slate-800/20">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-xl font-black text-white">{selected.patient_name}</h2>
                    <div className="flex gap-2 mt-1 flex-wrap">
                      <Badge color="indigo">{selected.patient_type}</Badge>
                      {selected.blood_group && <Badge color="red">{selected.blood_group}</Badge>}
                      <span className="text-xs text-slate-500">Queue ID: {selected.id}</span>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button onClick={() => routePatient('waiting_lab', 'Laboratory')}
                      className="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 hover:bg-amber-500/20 transition text-xs font-bold flex items-center gap-1.5">
                      <TestTube className="h-3.5 w-3.5"/> Send to Lab
                    </button>
                    <button onClick={() => routePatient('waiting_pharmacy', 'Pharmacy')}
                      className="px-3 py-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 hover:bg-emerald-500/20 transition text-xs font-bold flex items-center gap-1.5">
                      <Pill className="h-3.5 w-3.5"/> Pharmacy
                    </button>
                    <button onClick={() => routePatient('completed', 'Discharged')}
                      className="px-3 py-2 rounded-xl bg-slate-700 border border-slate-600 text-slate-200 hover:bg-slate-600 transition text-xs font-bold flex items-center gap-1.5">
                      <CheckCircle2 className="h-3.5 w-3.5"/> Discharge
                    </button>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-800 px-2 overflow-x-auto flex-shrink-0">
                {tabs.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)}
                    className={`flex items-center gap-1.5 px-4 py-3.5 text-xs font-bold border-b-2 transition-colors whitespace-nowrap ${tab===t.id ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                    <t.icon className="h-3.5 w-3.5"/>{t.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div className="flex-1 overflow-y-auto p-6">
                {/* History */}
                {tab === 'history' && (
                  <div className="space-y-6">
                    {/* Latest vitals */}
                    <div className="bg-indigo-900/20 border border-indigo-500/20 rounded-xl p-4">
                      <h4 className="font-bold text-indigo-300 mb-3 flex items-center gap-2 text-sm"><Activity className="h-4 w-4"/> Latest Vitals</h4>
                      {history.vitals.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                          {[
                            {label:'BP',    val: history.vitals[0].blood_pressure, unit:'mmHg'},
                            {label:'HR',    val: history.vitals[0].heart_rate,     unit:'bpm'},
                            {label:'Temp',  val: history.vitals[0].temperature,    unit:'°C'},
                            {label:'Wt',    val: history.vitals[0].weight,         unit:'kg'},
                            {label:'SpO₂',  val: history.vitals[0].spo2 || '—',   unit:'%'},
                          ].map(v => (
                            <div key={v.label} className="bg-slate-800/60 rounded-xl p-3 text-center">
                              <p className="text-xs text-slate-500 mb-1">{v.label}</p>
                              <p className="text-xl font-black text-white">{v.val}</p>
                              <p className="text-xs text-slate-500">{v.unit}</p>
                            </div>
                          ))}
                        </div>
                      ) : <p className="text-slate-500 text-sm italic">No vitals on record.</p>}
                    </div>

                    {/* Past consultations */}
                    <div>
                      <h4 className="font-bold text-white mb-3 flex items-center gap-2 text-sm"><FileText className="h-4 w-4 text-slate-400"/> Consultation History ({history.consultations.length})</h4>
                      {history.consultations.length === 0
                        ? <p className="text-slate-500 text-sm italic">No past consultations.</p>
                        : history.consultations.map(c => (
                          <div key={c.id} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 mb-3">
                            <div className="flex justify-between mb-2">
                              <span className="text-xs text-slate-500">{new Date(c.created_at).toLocaleString()}</span>
                              <span className="text-xs font-bold text-indigo-400">Dr. {c.doctor_name}</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                              <div><p className="text-xs text-slate-500 mb-0.5">Chief Complaint</p><p className="text-white">{c.chief_complaint}</p></div>
                              <div><p className="text-xs text-slate-500 mb-0.5">Diagnosis</p><p className="text-emerald-300 font-bold">{c.diagnosis}</p></div>
                              <div><p className="text-xs text-slate-500 mb-0.5">Treatment Plan</p><p className="text-white">{c.treatment_plan}</p></div>
                            </div>
                          </div>
                        ))
                      }
                    </div>

                    {/* Lab results */}
                    {history.labs.length > 0 && (
                      <div>
                        <h4 className="font-bold text-white mb-3 flex items-center gap-2 text-sm"><Microscope className="h-4 w-4 text-slate-400"/> Lab Results ({history.labs.filter(l=>l.status==='completed').length})</h4>
                        {history.labs.map(l => (
                          <div key={l.id} className="bg-amber-900/20 border border-amber-500/20 rounded-xl p-4 mb-2">
                            <div className="flex justify-between mb-2">
                              <span className="font-bold text-amber-300">{l.test_name}</span>
                              <Badge color={l.status==='completed' ? 'emerald' : 'amber'}>{l.status}</Badge>
                            </div>
                            {l.result_data && <p className="text-sm text-slate-300">{l.result_data.findings || JSON.stringify(l.result_data)}</p>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* New Consultation */}
                {tab === 'consult' && (
                  <form onSubmit={saveConsultation} className="space-y-4 max-w-2xl">
                    <div>
                      <label className={labelCls}>Chief Complaint *</label>
                      <textarea required rows="3" className={inputCls} placeholder="Patient's primary presenting complaint…"
                        value={cForm.chief_complaint} onChange={e => setCForm({...cForm, chief_complaint: e.target.value})}/>
                    </div>
                    <div>
                      <label className={labelCls}>Clinical Diagnosis *</label>
                      <input required type="text" className={inputCls} placeholder="e.g. Malaria, Typhoid Fever"
                        value={cForm.diagnosis} onChange={e => setCForm({...cForm, diagnosis: e.target.value})}/>
                    </div>
                    <div>
                      <label className={labelCls}>Treatment Plan *</label>
                      <textarea required rows="3" className={inputCls} placeholder="Planned interventions and management…"
                        value={cForm.treatment_plan} onChange={e => setCForm({...cForm, treatment_plan: e.target.value})}/>
                    </div>
                    <div>
                      <label className={labelCls}>Additional Notes</label>
                      <textarea rows="2" className={inputCls} placeholder="Optional remarks…"
                        value={cForm.notes} onChange={e => setCForm({...cForm, notes: e.target.value})}/>
                    </div>
                    <button type="submit" disabled={submitting}
                      className="px-8 py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center gap-2 disabled:opacity-60 shadow-lg">
                      {submitting ? <Spinner/> : <><Save className="h-4 w-4"/> Save Consultation Note</>}
                    </button>
                  </form>
                )}

                {/* Lab Request */}
                {tab === 'lab' && (
                  <div className="max-w-lg space-y-4">
                    {!lastConsultId && (
                      <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-500/20 rounded-xl p-4">
                        <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5"/>
                        <p className="text-sm text-amber-300">Save a consultation note first before requesting lab tests.</p>
                      </div>
                    )}
                    <form onSubmit={requestLab} className="space-y-4">
                      <div>
                        <label className={labelCls}>Test Name *</label>
                        <input required type="text" className={inputCls} placeholder="e.g. Full Blood Count (FBC), Malaria Parasite"
                          value={labForm.test_name} onChange={e => setLabForm({ test_name: e.target.value })}/>
                      </div>
                      <button type="submit" disabled={submitting || !lastConsultId}
                        className="w-full py-3.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition flex items-center justify-center gap-2 disabled:opacity-60">
                        {submitting ? <Spinner/> : <><FlaskConical className="h-4 w-4"/> Send to Lab</>}
                      </button>
                    </form>
                    {history.labs.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Existing Requests</p>
                        {history.labs.map(l => (
                          <div key={l.id} className="flex justify-between items-center bg-slate-800/40 border border-slate-700/40 rounded-xl px-4 py-3 mb-2">
                            <span className="text-sm text-white font-medium">{l.test_name}</span>
                            <Badge color={l.status==='completed'?'emerald':'amber'}>{l.status}</Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* E-Prescribe */}
                {tab === 'rx' && (
                  <div className="max-w-2xl space-y-4">
                    {!lastConsultId && (
                      <div className="flex items-start gap-3 bg-amber-900/20 border border-amber-500/20 rounded-xl p-4">
                        <AlertTriangle className="h-5 w-5 text-amber-400 flex-shrink-0 mt-0.5"/>
                        <p className="text-sm text-amber-300">Save a consultation note before generating a prescription.</p>
                      </div>
                    )}
                    <div className="space-y-3">
                      {rxItems.map((item, i) => (
                        <div key={i} className="bg-slate-800/40 border border-slate-700/40 rounded-xl p-4 relative">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            <div className="md:col-span-1">
                              <label className={labelCls}>Medication</label>
                              <select className={inputCls} value={item.inventory_id} onChange={e => updateRx(i,'inventory_id',e.target.value)}>
                                <option value="">— Select —</option>
                                {inventory.map(inv => <option key={inv.id} value={inv.id}>{inv.item_name} ({inv.quantity} in stock)</option>)}
                              </select>
                            </div>
                            <div>
                              <label className={labelCls}>Dosage Instructions</label>
                              <input type="text" className={inputCls} placeholder="e.g. 1 tab TDS for 5 days"
                                value={item.dosage} onChange={e => updateRx(i,'dosage',e.target.value)}/>
                            </div>
                            <div>
                              <label className={labelCls}>Quantity</label>
                              <input type="number" min="1" className={inputCls}
                                value={item.quantity_prescribed} onChange={e => updateRx(i,'quantity_prescribed',e.target.value)}/>
                            </div>
                          </div>
                          {rxItems.length > 1 && (
                            <button type="button" onClick={() => removeRx(i)} className="absolute top-3 right-3 text-slate-500 hover:text-red-400 transition">
                              <X className="h-4 w-4"/>
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                    <button type="button" onClick={addRxItem}
                      className="flex items-center gap-2 text-sm text-slate-400 hover:text-white transition">
                      <Plus className="h-4 w-4"/> Add another medication
                    </button>
                    <button onClick={sendPrescription} disabled={submitting || !lastConsultId}
                      className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-emerald-900/30">
                      {submitting ? <Spinner/> : <><Save className="h-5 w-5"/> Sign & Send E-Prescription</>}
                    </button>
                  </div>
                )}

                {/* Certificate */}
                {tab === 'cert' && (
                  <form onSubmit={issueCertificate} className="max-w-lg space-y-4">
                    <div>
                      <label className={labelCls}>Certificate Type *</label>
                      <select required className={inputCls} value={certForm.certificate_type} onChange={e => setCertForm({...certForm, certificate_type: e.target.value})}>
                        <option value="sick_leave">Sick Leave / Excuse Duty</option>
                        <option value="medical_fitness">Certificate of Medical Fitness</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className={labelCls}>Start Date *</label>
                        <input required type="date" className={inputCls} value={certForm.start_date} onChange={e => setCertForm({...certForm, start_date: e.target.value})}/>
                      </div>
                      <div>
                        <label className={labelCls}>End Date *</label>
                        <input required type="date" className={inputCls} value={certForm.end_date} onChange={e => setCertForm({...certForm, end_date: e.target.value})}/>
                      </div>
                    </div>
                    <div>
                      <label className={labelCls}>Doctor's Remarks *</label>
                      <textarea required rows="3" className={inputCls} placeholder="Clinical justification for certificate…"
                        value={certForm.remarks} onChange={e => setCertForm({...certForm, remarks: e.target.value})}/>
                    </div>
                    <button type="submit" disabled={submitting}
                      className="w-full py-3.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold transition flex items-center justify-center gap-2 disabled:opacity-60">
                      {submitting ? <Spinner/> : <><FileText className="h-4 w-4"/> Issue Certificate</>}
                    </button>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LABORATORY DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function LabDashboard() {
  const [requests, setRequests]   = useState([]);
  const [selected, setSelected]   = useState(null);
  const [result, setResult]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading]     = useState(true);
  const toast = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { setRequests(await apiFetch('/api/lab/pending')); }
    catch (e) { toast(e.message,'error'); }
    finally { setLoading(false); }
  };

  const submit = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await apiFetch(`/api/lab/results/${selected.id}`, {
        method: 'PUT',
        body: JSON.stringify({ result_data: { findings: result, date_processed: new Date().toISOString() } })
      });
      toast('Lab results submitted and attached to patient EMR.','success');
      setSelected(null); setResult(''); load();
    } catch (e) { toast(e.message,'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white">Laboratory Operations</h1>
          <p className="text-slate-500 text-sm">Process and record diagnostic test results</p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-sm font-medium transition">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/> Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${cardCls} lg:col-span-1 flex flex-col max-h-[700px]`}>
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <span className="font-bold text-white flex items-center gap-2"><AlertCircle className="h-4 w-4 text-amber-400"/> Pending Tests</span>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300">{requests.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {loading ? <div className="flex justify-center py-8"><Spinner/></div> :
              requests.length === 0 ? <EmptyState icon={CheckCircle2} title="All clear" sub="No pending lab requests"/> :
              requests.map(r => (
                <div key={r.id} onClick={() => setSelected(r)}
                  className={`p-4 rounded-xl cursor-pointer border transition-all ${selected?.id===r.id ? 'bg-amber-900/30 border-amber-500/30' : 'bg-slate-800/30 border-slate-700/30 hover:border-slate-600/50'}`}>
                  <p className="font-bold text-white">{r.test_name}</p>
                  <p className="text-sm text-slate-400 mt-0.5">{r.patient_name}</p>
                  <p className="text-xs text-slate-500 mt-1">Req: Dr. {r.doctor_name}</p>
                </div>
              ))
            }
          </div>
        </div>

        <div className={`${cardCls} lg:col-span-2 p-8 flex flex-col min-h-[500px]`}>
          {!selected ? (
            <EmptyState icon={Microscope} title="Select a pending test" sub="Click a request from the list to enter results"/>
          ) : (
            <div className="flex flex-col h-full gap-6 animate-in fade-in">
              <div className="pb-5 border-b border-slate-800">
                <h2 className="text-xl font-black text-white">{selected.test_name}</h2>
                <div className="flex gap-6 mt-2 text-sm text-slate-400">
                  <span>Patient: <span className="text-white font-bold">{selected.patient_name}</span></span>
                  <span>Requested by: <span className="text-white font-bold">Dr. {selected.doctor_name}</span></span>
                </div>
              </div>
              <form onSubmit={submit} className="flex-1 flex flex-col gap-4">
                <div className="flex-1">
                  <label className={labelCls}>Detailed Results & Findings *</label>
                  <textarea required rows="8" className={`${inputCls} resize-none h-full min-h-[160px]`}
                    placeholder="Enter test parameters, reference ranges, and clinical findings here…"
                    value={result} onChange={e => setResult(e.target.value)}/>
                </div>
                <button type="submit" disabled={submitting}
                  className="w-full py-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold transition flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-amber-900/30 text-base">
                  {submitting ? <Spinner/> : <><CheckCircle2 className="h-5 w-5"/> Finalise & Submit Results</>}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PHARMACIST DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function PharmacistDashboard() {
  const [view, setView]           = useState('dispensary');
  const [queue, setQueue]         = useState([]);
  const [inventory, setInventory] = useState([]);
  const [invForm, setInvForm]     = useState({ item_name:'', category:'Drug', quantity:'', unit_price:'', reorder_level:'10' });
  const [loading, setLoading]     = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();
  const [confirm, ConfirmUI] = useConfirm();

  useEffect(() => {
    if (view === 'dispensary') loadQueue();
    if (view === 'inventory')  loadInventory();
  }, [view]);

  const loadQueue     = async () => { setLoading(true); try { setQueue(await apiFetch('/api/pharmacy/queue')); } catch(e){toast(e.message,'error');} finally{setLoading(false);} };
  const loadInventory = async () => { setLoading(true); try { setInventory(await apiFetch('/api/inventory')); }  catch(e){toast(e.message,'error');} finally{setLoading(false);} };

  const dispense = async (rx) => {
    const ok = await confirm('Confirm Dispensing', `Dispense Rx for ${rx.patient_name}? Inventory will be automatically deducted.`, { confirmLabel:'Dispense', danger: false });
    if (!ok) return;
    try {
      await apiFetch(`/api/pharmacy/dispense/${rx.id}`, { method:'PUT' });
      toast('Medications dispensed. Inventory updated.','success');
      loadQueue();
    } catch (e) { toast(e.message,'error'); }
  };

  const addStock = async (e) => {
    e.preventDefault(); setSubmitting(true);
    try {
      await apiFetch('/api/inventory', { method:'POST', body: JSON.stringify(invForm) });
      toast('Inventory updated successfully.','success');
      setInvForm({ item_name:'', category:'Drug', quantity:'', unit_price:'', reorder_level:'10' });
      loadInventory();
    } catch (e) { toast(e.message,'error'); }
    finally { setSubmitting(false); }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {ConfirmUI}
      <div>
        <h1 className="text-2xl font-black text-white">Pharmacy Operations</h1>
        <p className="text-slate-500 text-sm">E-Dispensary and inventory control</p>
      </div>

      <div className="flex gap-2 bg-slate-900 border border-slate-800 rounded-xl p-1 w-fit">
        {[{key:'dispensary',label:'E-Dispensary',icon:Pill},{key:'inventory',label:'Inventory',icon:Package}].map(t => (
          <button key={t.key} onClick={() => setView(t.key)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-bold transition-all ${view===t.key ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            <t.icon className="h-4 w-4"/>{t.label}
          </button>
        ))}
      </div>

      {view === 'dispensary' && (
        <div className={`${cardCls} overflow-hidden`}>
          {loading ? (
            <div className="flex justify-center py-16"><Spinner/></div>
          ) : queue.length === 0 ? (
            <EmptyState icon={CheckCircle2} title="No pending prescriptions" sub="All prescriptions have been dispensed."/>
          ) : (
            <div className="divide-y divide-slate-800">
              {queue.map(rx => (
                <div key={rx.id} className="p-6 hover:bg-slate-800/20 transition flex flex-col md:flex-row md:items-start gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-black text-lg text-white">{rx.patient_name}</h3>
                      <Badge color="rose">Pending Rx</Badge>
                    </div>
                    <p className="text-sm text-slate-400 mb-4">Prescribed by Dr. {rx.doctor_name} · {new Date(rx.created_at).toLocaleString()}</p>
                    <div className="grid gap-2">
                      {rx.items?.map(item => (
                        <div key={item.id} className="flex items-center gap-4 bg-slate-800/60 border border-slate-700/40 rounded-xl p-3">
                          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                            <Pill className="h-4 w-4 text-emerald-400"/>
                          </div>
                          <div className="flex-1">
                            <p className="font-bold text-white text-sm">{item.item_name}</p>
                            <p className="text-xs text-slate-400">{item.dosage}</p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="text-xs text-slate-500">₦{item.unit_price} ea.</span>
                            <span className="px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-black">×{item.quantity_prescribed}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <button onClick={() => dispense(rx)}
                    className="md:w-40 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-900/30 flex-shrink-0">
                    <Check className="h-4 w-4"/> Dispense
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'inventory' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className={`${cardCls} p-6`}>
            <SectionTitle icon={Plus}>Add / Restock Item</SectionTitle>
            <form onSubmit={addStock} className="space-y-4">
              <div>
                <label className={labelCls}>Item Name *</label>
                <input required type="text" className={inputCls} placeholder="e.g. Amoxicillin 500mg"
                  value={invForm.item_name} onChange={e => setInvForm({...invForm, item_name: e.target.value})}/>
              </div>
              <div>
                <label className={labelCls}>Category</label>
                <select className={inputCls} value={invForm.category} onChange={e => setInvForm({...invForm, category: e.target.value})}>
                  <option value="Drug">Drug / Medication</option>
                  <option value="Consumable">Consumable</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>Quantity to Add *</label>
                <input required type="number" min="1" className={inputCls}
                  value={invForm.quantity} onChange={e => setInvForm({...invForm, quantity: e.target.value})}/>
              </div>
              <div>
                <label className={labelCls}>Unit Price (₦) *</label>
                <input required type="number" min="0" step="0.01" className={inputCls}
                  value={invForm.unit_price} onChange={e => setInvForm({...invForm, unit_price: e.target.value})}/>
              </div>
              <div>
                <label className={labelCls}>Reorder Level</label>
                <input type="number" min="0" className={inputCls}
                  value={invForm.reorder_level} onChange={e => setInvForm({...invForm, reorder_level: e.target.value})}/>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition flex items-center justify-center gap-2 disabled:opacity-60 shadow-lg shadow-emerald-900/30">
                {submitting ? <Spinner/> : <><Package className="h-4 w-4"/> Update Stock</>}
              </button>
            </form>
          </div>

          <div className={`${cardCls} p-6 lg:col-span-2 flex flex-col max-h-[680px]`}>
            <div className="flex items-center justify-between mb-5">
              <SectionTitle icon={Package}>Current Stock</SectionTitle>
              <button onClick={loadInventory} className="text-slate-500 hover:text-white transition"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}/></button>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-800">
                    <th className="pb-3 pr-4">Item</th>
                    <th className="pb-3 pr-4">Category</th>
                    <th className="pb-3 pr-4 text-right">Stock</th>
                    <th className="pb-3 text-right">Unit Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {inventory.map(item => (
                    <tr key={item.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 pr-4 font-medium text-white">{item.item_name}</td>
                      <td className="py-3 pr-4 text-slate-400">{item.category}</td>
                      <td className="py-3 pr-4 text-right">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${item.quantity <= item.reorder_level ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                          {item.quantity}
                          {item.quantity <= item.reorder_level && ' ⚠'}
                        </span>
                      </td>
                      <td className="py-3 text-slate-300 text-right">₦{Number(item.unit_price).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PATIENT PORTAL (read-only view of own records)
// ─────────────────────────────────────────────────────────────────────────────
function PatientPortal({ user }) {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div>
        <h1 className="text-2xl font-black text-white">Patient Portal</h1>
        <p className="text-slate-500 text-sm">Welcome, {user.name}. Your account is set up. Visit the health centre to register as a patient.</p>
      </div>
      <div className={`${cardCls} p-8`}>
        <EmptyState icon={FileText} title="No records yet" sub="Your clinical records will appear here after your first visit to the FUD Health Centre."/>
      </div>
    </div>
  );
}
