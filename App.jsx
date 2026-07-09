import React, { useState, useEffect } from 'react';
import {
  Activity, Users, CreditCard, Pill,
  LogOut, Check, X, Plus, ActivitySquare, Shield,
  Stethoscope, Clock, FileText, Trash2,
  Search, Bell, Menu, BarChart3, TestTube, UserPlus, FileArchive,
  Syringe, Save, CheckCircle2, History, AlertCircle,
  DollarSign, UserCheck, UserX, ShoppingCart, Droplet,
  FlaskConical, TrendingUp, Wallet, Package, Link2,
  RefreshCw, ClipboardCheck, PieChart, Receipt
} from 'lucide-react';

// ============================================================================
// API CLIENT
// ============================================================================
const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'An error occurred with the API request');
  return data;
};

const fmtMoney = (n) => `₦${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const fmtDate = (d) => d ? new Date(d).toLocaleString() : '—';
const fmtDateOnly = (d) => d ? new Date(d).toLocaleDateString() : '—';

// ============================================================================
// ROOT APP
// ============================================================================
// Sidebar navigation definitions per role. The `key` values map directly to
// the internal `activeTab` state each dashboard already uses, so clicking a
// sidebar item and clicking an in-page tab pill both drive the same state.
const NAV_CONFIG = {
  admin: [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'reports', label: 'Reports & Analytics', icon: TrendingUp },
    { key: 'staff', label: 'Staff Directory', icon: Users },
    { key: 'audit', label: 'Audit Logs', icon: FileArchive }
  ],
  // Front Desk: Reception and Nursing/Triage duties are merged into a single
  // role to streamline the patient journey through one team.
  receptionist: [
    { key: 'register', label: 'Patient Registration', icon: UserPlus },
    { key: 'checkin', label: 'Check-In', icon: Clock },
    { key: 'triage', label: 'Triage & Vitals', icon: Activity },
    { key: 'immunization', label: 'Immunizations', icon: Syringe },
    { key: 'billing', label: 'Billing & Payments', icon: CreditCard }
  ],
  // Retained only so any pre-existing 'nurse' accounts keep working;
  // new staff should be created with the 'receptionist' role.
  nurse: [
    { key: 'triage', label: 'Triage & Vitals', icon: Activity },
    { key: 'immunization', label: 'Immunizations', icon: Syringe }
  ],
  doctor: [
    { key: 'workspace', label: 'EMR Workspace', icon: Stethoscope }
  ],
  lab_tech: [
    { key: 'lab', label: 'Lab Requests', icon: TestTube }
  ],
  pharmacist: [
    { key: 'queue', label: 'E-Dispensary', icon: Pill },
    { key: 'inventory', label: 'Inventory Control', icon: BarChart3 }
  ],
  patient: [
    { key: 'record', label: 'My Health Record', icon: History },
    { key: 'billing', label: 'My Invoices', icon: CreditCard }
  ]
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [authView, setAuthView] = useState('landing'); // 'landing' | 'login' | 'signup'
  const [navView, setNavView] = useState(() => {
    try {
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        const role = JSON.parse(storedUser).role;
        return NAV_CONFIG[role]?.[0]?.key || null;
      }
    } catch (e) { /* ignore malformed storage */ }
    return null;
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) setCurrentUser(JSON.parse(user));
    setIsInitializing(false);
  }, []);

  const handleLoginSuccess = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setCurrentUser(data.user);
    setNavView(NAV_CONFIG[data.user.role]?.[0]?.key || null);
    setAuthView('landing');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
    setAuthView('landing');
  };

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <ActivitySquare className="animate-pulse h-16 w-16 text-blue-600" />
      </div>
    );
  }

  if (!currentUser) {
    if (authView === 'landing') {
      return <MarketingLandingPage onLogin={() => setAuthView('login')} onSignup={() => setAuthView('signup')} />;
    }
    return (
      <AuthPage
        initialMode={authView === 'signup' ? 'signup' : 'login'}
        onSuccess={handleLoginSuccess}
        onBackHome={() => setAuthView('landing')}
      />
    );
  }

  const navItems = NAV_CONFIG[currentUser.role] || [];

  return (
    <DashboardLayout user={currentUser} onLogout={handleLogout} navItems={navItems} activeNav={navView} onNavClick={setNavView}>
      {currentUser.role === 'admin' && <AdminDashboard activeTab={navView} setActiveTab={setNavView} />}
      {(currentUser.role === 'receptionist' || currentUser.role === 'nurse') && <FrontDeskDashboard activeTab={navView} setActiveTab={setNavView} />}
      {currentUser.role === 'doctor' && <DoctorDashboard currentUser={currentUser} />}
      {currentUser.role === 'lab_tech' && <LabDashboard />}
      {currentUser.role === 'pharmacist' && <PharmacistDashboard activeTab={navView} setActiveTab={setNavView} />}
      {currentUser.role === 'patient' && <PatientDashboard activeTab={navView} setActiveTab={setNavView} />}
    </DashboardLayout>
  );
}

// ============================================================================
// PATIENT DASHBOARD — the patient portal: own EMR + mock online payments
// ============================================================================
function PatientDashboard({ activeTab, setActiveTab }) {
  const [loading, setLoading] = useState(true);
  const [notLinked, setNotLinked] = useState(false);
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState({ consultations: [], vitals: [], lab_requests: [], prescriptions: [], certificates: [], immunizations: [] });
  const [invoices, setInvoices] = useState([]);
  const [payingId, setPayingId] = useState(null);

  useEffect(() => { loadAll(); }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const profileData = await apiFetch('/api/patients/me');
      setProfile(profileData);
      setNotLinked(false);
      const [hist, inv] = await Promise.all([
        apiFetch('/api/emr/history/me'),
        apiFetch('/api/billing/me')
      ]);
      setHistory(hist);
      setInvoices(inv);
    } catch (e) {
      setNotLinked(true);
    } finally {
      setLoading(false);
    }
  };

  const payMock = async (invoiceId) => {
    if (!window.confirm('Simulate an online card payment for this invoice? This is a mock payment for demonstration purposes.')) return;
    setPayingId(invoiceId);
    try {
      const res = await apiFetch(`/api/billing/${invoiceId}/pay-mock`, { method: 'POST' });
      alert(`${res.message}\n\nReference: ${res.reference}`);
      const inv = await apiFetch('/api/billing/me');
      setInvoices(inv);
    } catch (e) { alert(e.message); } finally { setPayingId(null); }
  };

  const timelineIcon = {
    consultation: { icon: Stethoscope, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    vitals: { icon: Activity, color: 'text-blue-600', bg: 'bg-blue-100' },
    lab: { icon: TestTube, color: 'text-amber-600', bg: 'bg-amber-100' },
    prescription: { icon: Pill, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    certificate: { icon: FileText, color: 'text-purple-600', bg: 'bg-purple-100' },
    immunization: { icon: Syringe, color: 'text-rose-600', bg: 'bg-rose-100' }
  };

  const buildTimeline = () => {
    const entries = [];
    history.consultations.forEach(c => entries.push({ type: 'consultation', date: c.created_at, data: c }));
    history.vitals.forEach(v => entries.push({ type: 'vitals', date: v.recorded_at, data: v }));
    history.lab_requests.forEach(l => entries.push({ type: 'lab', date: l.requested_at, data: l }));
    history.prescriptions.forEach(p => entries.push({ type: 'prescription', date: p.created_at, data: p }));
    history.certificates.forEach(c => entries.push({ type: 'certificate', date: c.created_at, data: c }));
    history.immunizations.forEach(i => entries.push({ type: 'immunization', date: i.administered_at, data: i }));
    return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const statusBadge = (status) => {
    const map = { unpaid: 'bg-red-100 text-red-700', processing: 'bg-amber-100 text-amber-700', paid: 'bg-emerald-100 text-emerald-700' };
    return map[status] || 'bg-slate-100 text-slate-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <ActivitySquare className="animate-pulse h-12 w-12 text-blue-500" />
      </div>
    );
  }

  if (notLinked) {
    return (
      <div className="max-w-xl mx-auto mt-10 bg-white p-10 rounded-2xl border border-slate-200 shadow-sm text-center">
        <ActivitySquare className="h-14 w-14 text-blue-600 mx-auto mb-4" />
        <h2 className="text-xl font-bold text-slate-900 mb-2">No Clinical Record Linked Yet</h2>
        <p className="text-slate-500">Your patient portal account is registered, but isn't linked to a clinical record yet. Please visit the Health Centre reception desk with your university ID — they can link your record to this account in seconds.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">My Health Record</h1>
          <p className="text-slate-500 text-sm mt-1">Welcome back, {profile?.full_name}</p>
        </div>
        <div className="flex bg-slate-200 p-1 rounded-xl">
          <button onClick={() => setActiveTab('record')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'record' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Health Record</button>
          <button onClick={() => setActiveTab('billing')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'billing' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>My Invoices</button>
        </div>
      </div>

      {activeTab === 'record' && (
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex flex-wrap gap-4 items-center justify-between">
              <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
                <span className="capitalize px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-bold">{profile.patient_type}</span>
                {profile.university_id && <span className="font-medium">{profile.university_id}</span>}
                {profile.blood_group && <span className="flex items-center font-medium"><Droplet className="h-3.5 w-3.5 mr-1 text-red-500"/> {profile.blood_group}</span>}
                {profile.genotype && <span className="font-medium">Genotype: {profile.genotype}</span>}
                {profile.dob && <span className="font-medium">DOB: {fmtDateOnly(profile.dob)}</span>}
              </div>
            </div>
            {profile.allergies && (
              <div className="mt-4 inline-flex items-center px-3 py-1.5 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs font-bold">
                <AlertCircle className="h-3.5 w-3.5 mr-1.5"/> Allergy Alert: {profile.allergies}
              </div>
            )}
          </div>

          {history.vitals.length > 0 && (
            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
              <h4 className="font-bold text-blue-900 mb-3 flex items-center"><Activity className="h-4 w-4 mr-2"/> Latest Vitals</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                <div><span className="text-slate-400 block mb-1">BP</span><span className="font-bold text-slate-800 text-lg">{history.vitals[0].blood_pressure}</span></div>
                <div><span className="text-slate-400 block mb-1">Heart Rate</span><span className="font-bold text-slate-800 text-lg">{history.vitals[0].heart_rate} bpm</span></div>
                <div><span className="text-slate-400 block mb-1">Temp</span><span className="font-bold text-slate-800 text-lg">{history.vitals[0].temperature} °C</span></div>
                <div><span className="text-slate-400 block mb-1">Weight</span><span className="font-bold text-slate-800 text-lg">{history.vitals[0].weight} kg</span></div>
              </div>
            </div>
          )}

          <div>
            <h4 className="font-bold text-slate-800 mb-3 flex items-center"><History className="h-4 w-4 mr-2"/> Full Medical Timeline</h4>
            <div className="space-y-3">
              {buildTimeline().length === 0 && <p className="text-sm text-slate-400 italic bg-white p-6 rounded-xl border border-slate-200">No records yet. Your history will appear here after your first visit.</p>}
              {buildTimeline().map((entry, idx) => {
                const cfg = timelineIcon[entry.type];
                return (
                  <div key={idx} className="flex space-x-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                    <div className={`p-2.5 h-fit rounded-lg ${cfg.bg}`}><cfg.icon className={`h-4 w-4 ${cfg.color}`} /></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <span className="font-bold text-slate-800 text-sm capitalize">{entry.type.replace('_', ' ')}</span>
                        <span className="text-xs text-slate-400 flex-shrink-0 ml-2">{fmtDate(entry.date)}</span>
                      </div>
                      {entry.type === 'consultation' && <p className="text-sm text-slate-600 mt-1"><b>Diagnosis:</b> {entry.data.diagnosis} <span className="text-slate-400">— seen by Dr. {entry.data.doctor_name}</span></p>}
                      {entry.type === 'vitals' && <p className="text-sm text-slate-600 mt-1">BP {entry.data.blood_pressure}, {entry.data.heart_rate} bpm, {entry.data.temperature}°C, {entry.data.weight}kg</p>}
                      {entry.type === 'lab' && <p className="text-sm text-slate-600 mt-1">{entry.data.test_name} — <span className={`font-bold ${entry.data.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}`}>{entry.data.status}</span></p>}
                      {entry.type === 'prescription' && <p className="text-sm text-slate-600 mt-1">{entry.data.items?.map(i => i.item_name).join(', ')} — <span className={`font-bold ${entry.data.status === 'dispensed' ? 'text-emerald-600' : 'text-amber-600'}`}>{entry.data.status}</span></p>}
                      {entry.type === 'certificate' && <p className="text-sm text-slate-600 mt-1 capitalize">{entry.data.certificate_type.replace('_',' ')}: {fmtDateOnly(entry.data.start_date)} → {fmtDateOnly(entry.data.end_date)}</p>}
                      {entry.type === 'immunization' && <p className="text-sm text-slate-600 mt-1">{entry.data.vaccine_name} ({entry.data.dose_number})</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="space-y-4">
          {invoices.length === 0 ? (
            <div className="bg-white p-10 rounded-2xl border border-slate-200 shadow-sm text-center text-slate-400">
              <Receipt className="h-12 w-12 mx-auto mb-3 text-slate-200" />
              No invoices on your account yet.
            </div>
          ) : invoices.map(inv => (
            <div key={inv.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between flex-wrap gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-slate-900">{inv.purpose}</span>
                  <span className={`px-2 py-0.5 text-xs font-bold rounded-full capitalize ${statusBadge(inv.status)}`}>{inv.status}</span>
                </div>
                <div className="text-xs text-slate-400 mt-1">Issued {fmtDate(inv.created_at)}</div>
                {inv.status === 'processing' && <div className="text-xs font-mono text-amber-600 mt-1">Ref: {inv.payment_reference} — awaiting Reception confirmation</div>}
                {inv.status === 'paid' && <div className="text-xs text-emerald-600 mt-1">Paid & confirmed {fmtDate(inv.paid_at)}</div>}
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xl font-extrabold text-slate-900">{fmtMoney(inv.total_amount)}</span>
                {inv.status === 'unpaid' && (
                  <button onClick={() => payMock(inv.id)} disabled={payingId === inv.id} className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center disabled:opacity-60">
                    <Wallet className="h-4 w-4 mr-2"/> {payingId === inv.id ? 'Processing...' : 'Pay Now (Mock)'}
                  </button>
                )}
              </div>
            </div>
          ))}
          <p className="text-xs text-slate-400 text-center pt-2">Payments are simulated for demonstration. No real transaction is processed — Reception confirms each payment before it's marked as paid.</p>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// LANDING / AUTH
// ============================================================================
function MarketingLandingPage({ onLogin, onSignup }) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const roles = [
    { icon: Shield, label: 'Admin' },
    { icon: UserPlus, label: 'Receptionist' },
    { icon: Syringe, label: 'Nurse' },
    { icon: Stethoscope, label: 'Doctor' },
    { icon: TestTube, label: 'Lab Tech' },
    { icon: Pill, label: 'Pharmacist' }
  ];

  const features = [
    { icon: History, title: 'Unified Electronic Medical Records', desc: 'A single, chronological patient timeline spanning vitals, consultations, lab results, prescriptions, certificates and immunizations.' },
    { icon: Shield, title: 'Role-Based Access Control', desc: 'Six distinct portals with scoped permissions, so every staff member sees exactly what their role requires — nothing more.' },
    { icon: Clock, title: 'Live Queue & Triage Routing', desc: 'Patients move automatically from check-in to triage to the doctor\'s desk as vitals are logged, in real time.' },
    { icon: Pill, title: 'E-Prescription & Inventory Sync', desc: 'Prescriptions are dispensed directly against pharmacy stock, with automatic inventory deduction and low-stock alerts.' },
    { icon: CreditCard, title: 'Automated Billing', desc: 'Consultations, lab tests and dispensed medication generate itemized invoices for Reception automatically — no manual entry.' },
    { icon: FileArchive, title: 'Immutable Audit Trail', desc: 'Every create, update and delete across the system is permanently logged and attributable to a specific staff account.' }
  ];

  const steps = [
    { step: '01', title: 'Registration', desc: 'Reception captures university ID, demographics and clinical baseline data.' },
    { step: '02', title: 'Triage', desc: 'Nurses log vitals; the patient is queued to the assigned doctor automatically.' },
    { step: '03', title: 'Consultation', desc: 'Doctors record diagnoses, request labs, and issue e-prescriptions from one workspace.' },
    { step: '04', title: 'Lab & Pharmacy', desc: 'Results and dispensing update the EMR and inventory instantly.' },
    { step: '05', title: 'Billing', desc: 'Invoices are raised automatically and settled at Reception.' }
  ];

  return (
    <div className="min-h-screen bg-white font-sans text-slate-900">
      {/* HEADER */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
              <ActivitySquare className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="text-lg font-extrabold tracking-tight leading-none text-slate-900">FUD HIMS</div>
              <div className="text-[11px] font-medium text-slate-400 leading-none mt-0.5">Federal University Dutse</div>
            </div>
          </div>

          <nav className="hidden md:flex items-center space-x-10 text-sm font-semibold text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#portals" className="hover:text-blue-600 transition-colors">Portals</a>
            <a href="#workflow" className="hover:text-blue-600 transition-colors">How It Works</a>
            <a href="#contact" className="hover:text-blue-600 transition-colors">Contact</a>
          </nav>

          <div className="flex items-center space-x-3">
            <button onClick={onLogin} className="px-5 py-2.5 text-sm font-bold text-slate-700 hover:text-blue-600 transition-colors">Sign In</button>
            <button onClick={onSignup} className="px-5 py-2.5 text-sm font-bold text-white bg-blue-600 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-600/20">Get Started</button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="relative pt-40 pb-28 px-6 md:px-8 overflow-hidden bg-gradient-to-b from-slate-50 to-white">
        <div className="absolute -top-24 -right-24 h-96 w-96 bg-blue-100 rounded-full blur-3xl opacity-60"></div>
        <div className="absolute top-40 -left-24 h-72 w-72 bg-indigo-100 rounded-full blur-3xl opacity-50"></div>

        <div className="relative max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <div className="inline-flex items-center px-4 py-1.5 bg-blue-50 border border-blue-100 rounded-full text-xs font-bold text-blue-700 mb-6 tracking-wide uppercase">
              Federal University Dutse Health Centre
            </div>
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-slate-900 mb-6">
              Enterprise Healthcare Management, Built for Campus Life
            </h1>
            <p className="text-lg text-slate-500 leading-relaxed mb-10 max-w-xl">
              A single, secure platform connecting Reception, Nursing, Doctors, Laboratory, Pharmacy and Administration — from patient check-in to billing, without the paperwork.
            </p>
            <div className="flex flex-wrap items-center gap-4">
              <button onClick={onLogin} className="px-8 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-xl shadow-blue-600/20 flex items-center">
                Access Your Portal
              </button>
              <button onClick={onSignup} className="px-8 py-4 bg-white text-slate-700 rounded-xl font-bold border-2 border-slate-200 hover:border-slate-300 transition-all">
                Create Patient Account
              </button>
            </div>
          </div>

          {/* Stylised product preview panel */}
          <div className="relative">
            <div className="absolute -inset-4 bg-gradient-to-tr from-blue-200/40 to-indigo-200/40 rounded-3xl blur-2xl"></div>
            <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-100 overflow-hidden">
              <div className="h-11 bg-slate-50 border-b border-slate-100 flex items-center px-4 space-x-2">
                <span className="h-2.5 w-2.5 rounded-full bg-red-300"></span>
                <span className="h-2.5 w-2.5 rounded-full bg-amber-300"></span>
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-300"></span>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[{l:'Patients',v:'1,204',c:'text-blue-600',b:'bg-blue-50'},{l:'Consults Today',v:'38',c:'text-indigo-600',b:'bg-indigo-50'},{l:'Pending Labs',v:'6',c:'text-amber-600',b:'bg-amber-50'}].map((s,i)=>(
                    <div key={i} className={`rounded-xl p-4 ${s.b}`}>
                      <div className={`text-xl font-extrabold ${s.c}`}>{s.v}</div>
                      <div className="text-[11px] font-semibold text-slate-500 mt-0.5">{s.l}</div>
                    </div>
                  ))}
                </div>
                <div className="rounded-xl border border-slate-100 p-4">
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Live Queue</div>
                  <div className="space-y-2.5">
                    {[{n:'A. Mohammed',s:'Waiting Doctor',c:'bg-blue-100 text-blue-700'},{n:'F. Bello',s:'In Triage',c:'bg-amber-100 text-amber-700'},{n:'S. Yusuf',s:'Pharmacy',c:'bg-emerald-100 text-emerald-700'}].map((q,i)=>(
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700">{q.n}</span>
                        <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${q.c}`}>{q.s}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between rounded-xl bg-slate-900 p-4 text-white">
                  <div className="flex items-center space-x-2">
                    <FileArchive className="h-4 w-4 text-blue-400" />
                    <span className="text-xs font-semibold">Audit trail active</span>
                  </div>
                  <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ROLE STRIP */}
      <section id="portals" className="py-16 border-y border-slate-100 bg-slate-50/50">
        <div className="max-w-7xl mx-auto px-6 md:px-8">
          <p className="text-center text-sm font-bold text-slate-400 uppercase tracking-widest mb-10">One System, Six Dedicated Portals</p>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-6">
            {roles.map((r, i) => (
              <div key={i} className="flex flex-col items-center text-center group">
                <div className="h-16 w-16 rounded-2xl bg-white border border-slate-200 shadow-sm flex items-center justify-center mb-3 group-hover:border-blue-300 group-hover:shadow-md transition-all">
                  <r.icon className="h-7 w-7 text-slate-500 group-hover:text-blue-600 transition-colors" />
                </div>
                <span className="text-sm font-bold text-slate-700">{r.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="py-28 px-6 md:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="max-w-2xl mx-auto text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-900 mb-4">Everything the Health Centre Needs, Deeply Connected</h2>
            <p className="text-slate-500 text-lg">Not a collection of separate forms — a single record that flows from department to department automatically.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f, i) => (
              <div key={i} className="p-8 rounded-2xl border border-slate-200 hover:border-blue-200 hover:shadow-xl hover:shadow-slate-100 transition-all duration-300 bg-white">
                <div className="h-12 w-12 rounded-xl bg-blue-50 flex items-center justify-center mb-5">
                  <f.icon className="h-6 w-6 text-blue-600" />
                </div>
                <h3 className="font-bold text-lg text-slate-900 mb-2">{f.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* WORKFLOW / HOW IT WORKS */}
      <section id="workflow" className="py-28 px-6 md:px-8 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 h-96 w-96 bg-blue-600/10 rounded-full blur-3xl"></div>
        <div className="max-w-7xl mx-auto relative">
          <div className="max-w-2xl mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold mb-4">A Patient Journey, Fully Tracked</h2>
            <p className="text-slate-400 text-lg">From the front desk to the pharmacy counter, every step updates the same record in real time.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8">
            {steps.map((s, i) => (
              <div key={i} className="relative">
                <div className="text-5xl font-extrabold text-white/10 mb-4">{s.step}</div>
                <h3 className="font-bold text-lg mb-2">{s.title}</h3>
                <p className="text-sm text-slate-400 leading-relaxed">{s.desc}</p>
                {i < steps.length - 1 && <div className="hidden md:block absolute top-6 -right-4 w-8 h-px bg-white/20"></div>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA BANNER */}
      <section className="py-24 px-6 md:px-8">
        <div className="max-w-5xl mx-auto rounded-3xl bg-gradient-to-br from-blue-600 to-indigo-700 px-10 py-16 text-center shadow-2xl shadow-blue-600/20 relative overflow-hidden">
          <div className="absolute -bottom-16 -right-16 h-64 w-64 bg-white/10 rounded-full blur-2xl"></div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-white mb-4 relative">Ready to Modernize Campus Healthcare?</h2>
          <p className="text-blue-100 text-lg mb-10 max-w-xl mx-auto relative">Sign in with your staff credentials, or register a patient portal account to get started.</p>
          <div className="flex flex-wrap justify-center gap-4 relative">
            <button onClick={onLogin} className="px-8 py-4 bg-white text-blue-700 rounded-xl font-bold hover:bg-blue-50 transition-all shadow-lg">Staff Sign In</button>
            <button onClick={onSignup} className="px-8 py-4 bg-blue-500/30 text-white border-2 border-white/40 rounded-xl font-bold hover:bg-blue-500/50 transition-all">Create Patient Account</button>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer id="contact" className="bg-slate-950 text-slate-400 pt-20 pb-10 px-6 md:px-8">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="md:col-span-2">
            <div className="flex items-center space-x-3 mb-5">
              <div className="h-9 w-9 bg-blue-600 rounded-lg flex items-center justify-center">
                <ActivitySquare className="h-5 w-5 text-white" />
              </div>
              <span className="text-lg font-extrabold text-white">FUD HIMS</span>
            </div>
            <p className="text-sm leading-relaxed max-w-sm">
              The Health Information Management System of the Federal University Dutse Health Centre — securing and streamlining clinical care for students, staff and dependents.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-5">Quick Links</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#portals" className="hover:text-white transition-colors">Staff Portals</a></li>
              <li><a href="#workflow" className="hover:text-white transition-colors">How It Works</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold text-sm uppercase tracking-wider mb-5">Health Centre</h4>
            <ul className="space-y-3 text-sm">
              <li>Federal University Dutse, Jigawa State, Nigeria</li>
              <li>healthcentre@fud.edu.ng</li>
              <li>Mon – Fri, 8:00am – 5:00pm</li>
            </ul>
          </div>
        </div>
        <div className="max-w-7xl mx-auto pt-8 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center text-xs text-slate-500 gap-3">
          <span>© {new Date().getFullYear()} Federal University Dutse Health Centre. All rights reserved.</span>
          <span className="flex items-center"><Shield className="h-3.5 w-3.5 mr-1.5" /> Secured by Role-Based Access Control & Immutable Audit Logging</span>
        </div>
      </footer>
    </div>
  );
}

// ============================================================================
// DEDICATED AUTH PAGE (separate from the marketing site)
// ============================================================================
function AuthPage({ initialMode, onSuccess, onBackHome }) {
  const [isLogin, setIsLogin] = useState(initialMode !== 'signup');
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);
    try {
      if (isLogin) {
        const data = await apiFetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email: formData.email, password: formData.password })
        });
        onSuccess(data);
      } else {
        const data = await apiFetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify(formData)
        });
        setSuccessMsg(data.message);
        setIsLogin(true);
        setFormData({ ...formData, password: '' });
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const autofillAdmin = () => {
    setFormData({ ...formData, email: 'admin@fud.edu.ng', password: 'admin123' });
    setIsLogin(true);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <div className="h-20 flex items-center px-6 md:px-10">
        <button onClick={onBackHome} className="flex items-center space-x-3 group">
          <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-600/20">
            <ActivitySquare className="h-6 w-6 text-white" />
          </div>
          <span className="text-lg font-extrabold text-slate-900 group-hover:text-blue-600 transition-colors">FUD HIMS</span>
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center px-6 pb-16">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 md:p-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-extrabold text-slate-900 mb-2">{isLogin ? 'Welcome Back' : 'Create Patient Account'}</h2>
              <p className="text-slate-500 text-sm">{isLogin ? 'Sign in to access your secure portal' : 'Register for a FUD HIMS patient account'}</p>
            </div>

            <div className="flex p-1 bg-slate-100 rounded-xl mb-8">
              <button onClick={() => { setIsLogin(true); setError(''); setSuccessMsg(''); }} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Sign In</button>
              <button onClick={() => { setIsLogin(false); setError(''); setSuccessMsg(''); }} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Create Account</button>
            </div>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {error && (
                <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg flex items-start">
                  <X className="h-5 w-5 text-red-500 mr-2 flex-shrink-0 mt-0.5"/>
                  <span className="text-sm text-red-700 font-medium">{error}</span>
                </div>
              )}
              {successMsg && (
                <div className="bg-emerald-50 border-l-4 border-emerald-500 p-4 rounded-lg flex items-start">
                  <CheckCircle2 className="h-5 w-5 text-emerald-500 mr-2 flex-shrink-0 mt-0.5"/>
                  <span className="text-sm text-emerald-700 font-medium">{successMsg}</span>
                </div>
              )}

              {!isLogin && (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">Full Name</label>
                  <input required type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})}
                    className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" placeholder="John Doe" />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Email Address</label>
                <input required type="email" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})}
                  className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" placeholder="name@example.com" />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Password</label>
                <input required type="password" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})}
                  className="block w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all" placeholder="••••••••" />
              </div>

              <button type="submit" disabled={loading}
                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-lg shadow-blue-600/20 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 mt-2">
                {loading ? (
                  <ActivitySquare className="animate-spin h-5 w-5 mr-2" />
                ) : (
                  isLogin ? 'Access Secure Portal' : 'Register Account'
                )}
              </button>
            </form>
          </div>

          <div className="mt-6 bg-white/60 border border-slate-200 border-dashed p-5 rounded-2xl">
            <div className="flex items-center space-x-2 mb-2">
              <AlertCircle className="h-4 w-4 text-amber-500" />
              <h3 className="font-bold text-sm text-slate-800">MSc Evaluation Access</h3>
            </div>
            <p className="text-xs text-slate-500 mb-3">Auto-fill the System Administrator credentials to evaluate the full RBAC architecture.</p>
            <button onClick={autofillAdmin} type="button" className="px-4 py-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-xs font-bold transition-all text-slate-700 flex items-center w-fit">
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5"/> Auto-Fill Admin Credentials
            </button>
          </div>

          <p className="text-center text-xs text-slate-400 mt-8">
            Secured by AES-256 Encryption & Role-Based Access Control
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DASHBOARD SHELL
// ============================================================================
function DashboardLayout({ children, user, onLogout, navItems = [], activeNav, onNavClick }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeLabel = navItems.find(i => i.key === activeNav)?.label || 'Dashboard';

  const handleNavClick = (key) => {
    onNavClick?.(key);
    setSidebarOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-slate-900/50 z-30 md:hidden" onClick={() => setSidebarOpen(false)}></div>
      )}

      <aside className={`fixed md:static inset-y-0 left-0 z-40 w-72 bg-slate-900 text-slate-300 flex flex-col shadow-2xl transform transition-transform duration-300 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-950/50">
          <ActivitySquare className="h-8 w-8 text-blue-500 mr-3" />
          <span className="text-xl font-bold text-white tracking-wide">FUD HIMS</span>
        </div>

        <div className="p-6 flex items-center space-x-4 border-b border-slate-800">
          <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-slate-800 flex-shrink-0">
            {user?.name?.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <div className="text-white font-medium truncate">{user?.name}</div>
            <div className="text-xs text-blue-400 font-semibold tracking-wider uppercase mt-0.5">{user?.role?.replace('_', ' ')}</div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = item.key === activeNav;
            return (
              <button key={item.key} onClick={() => handleNavClick(item.key)}
                className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${isActive ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' : 'hover:bg-slate-800 hover:text-white'}`}>
                <item.icon className={`h-5 w-5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span className="font-medium text-left">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={onLogout} className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-colors text-slate-400 font-medium">
            <LogOut className="h-5 w-5" /> <span>Secure Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-5 md:px-8 z-10 shadow-sm">
          <div className="flex items-center text-slate-500 min-w-0">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden mr-3 p-1.5 -ml-1.5 text-slate-500 hover:text-slate-800">
              <Menu className="h-6 w-6" />
            </button>
            <div className="min-w-0">
              <div className="text-xs text-slate-400 font-medium hidden sm:block">Federal University Dutse Health Centre</div>
              <div className="text-base font-bold text-slate-800 truncate">{activeLabel}</div>
            </div>
          </div>
          <div className="flex items-center space-x-4 md:space-x-6">
            <div className="relative hidden sm:block">
              <Search className="h-5 w-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input type="text" placeholder="Search records..." className="pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all w-48 md:w-64" />
            </div>
            <button className="relative p-2 text-slate-400 hover:text-blue-600 transition">
              <Bell className="h-6 w-6" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-5 md:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// ADMIN DASHBOARD
// ============================================================================
function AdminDashboard({ activeTab: tab, setActiveTab: setTab }) {
  const [stats, setStats] = useState({ totalPatients: 0, consultationsToday: 0, pendingLabs: 0, lowStock: 0, revenue: 0, lowStockItems: [] });
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', role: 'doctor' });
  const [reports, setReports] = useState(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  useEffect(() => { loadData(); }, []);
  useEffect(() => { if (tab === 'reports' && !reports) loadReports(); }, [tab]);

  const loadData = async () => {
    try {
      const [statsData, logsData, usersData] = await Promise.all([
        apiFetch('/api/analytics'),
        apiFetch('/api/audit-logs'),
        apiFetch('/api/users')
      ]);
      setStats(statsData);
      setLogs(logsData);
      setUsers(usersData);
    } catch (e) { console.error(e); }
  };

  const loadReports = async () => {
    setReportsLoading(true);
    try {
      setReports(await apiFetch('/api/analytics/detailed'));
    } catch (e) { console.error(e); } finally { setReportsLoading(false); }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(staffForm) });
      setStaffForm({ name: '', email: '', password: '', role: 'doctor' });
      loadData();
      alert('Staff account created successfully.');
    } catch (e) { alert(e.message); }
  };

  const toggleStaffStatus = async (u) => {
    if (!window.confirm(`${u.is_active ? 'Deactivate' : 'Activate'} ${u.name}'s account?`)) return;
    try {
      await apiFetch(`/api/users/${u.id}/status`, { method: 'PATCH', body: JSON.stringify({ is_active: !u.is_active }) });
      loadData();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900">System Overview</h1>
        <div className="flex bg-slate-200 p-1 rounded-xl flex-wrap">
          <button onClick={() => setTab('overview')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'overview' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Overview</button>
          <button onClick={() => setTab('reports')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'reports' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Reports & Analytics</button>
          <button onClick={() => setTab('staff')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'staff' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Staff Directory</button>
          <button onClick={() => setTab('audit')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'audit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Audit Logs</button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6">
        {[
          { label: 'Total Patients', value: stats.totalPatients, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
          { label: 'Consultations Today', value: stats.consultationsToday, icon: Stethoscope, color: 'text-indigo-600', bg: 'bg-indigo-100' },
          { label: 'Pending Lab Tests', value: stats.pendingLabs, icon: TestTube, color: 'text-amber-600', bg: 'bg-amber-100' },
          { label: 'Low Stock Alerts', value: stats.lowStock, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
          { label: 'Awaiting Payment Confirmation', value: stats.processingCount || 0, icon: RefreshCw, color: 'text-amber-600', bg: 'bg-amber-100' },
          { label: 'Total Revenue', value: fmtMoney(stats.revenue), icon: DollarSign, color: 'text-emerald-600', bg: 'bg-emerald-100' },
        ].map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
            <div className={`p-4 rounded-xl ${card.bg}`}>
              <card.icon className={`h-7 w-7 ${card.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <h3 className="text-xl font-bold text-slate-900 truncate">{card.value}</h3>
            </div>
          </div>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center"><UserPlus className="mr-2 h-5 w-5 text-blue-600"/> Add New Staff</h2>
            <form onSubmit={handleAddStaff} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input required type="text" value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email Address</label>
                <input required type="email" value={staffForm.email} onChange={e => setStaffForm({...staffForm, email: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Temporary Password</label>
                <input required type="password" value={staffForm.password} onChange={e => setStaffForm({...staffForm, password: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Assign Role</label>
                <select value={staffForm.role} onChange={e => setStaffForm({...staffForm, role: e.target.value})} className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-blue-500 focus:border-blue-500">
                  <option value="doctor">Doctor</option>
                  <option value="pharmacist">Pharmacist</option>
                  <option value="lab_tech">Lab Technician</option>
                  <option value="receptionist">Receptionist (Front Desk & Triage)</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium hover:bg-blue-700 transition">Create Account</button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden flex flex-col">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center"><AlertCircle className="mr-2 h-5 w-5 text-red-600"/> Low Stock Alerts</h2>
            {stats.lowStockItems?.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 font-medium"><CheckCircle2 className="h-6 w-6 mr-2 text-emerald-400"/> All inventory levels are healthy.</div>
            ) : (
              <div className="space-y-3 overflow-y-auto">
                {stats.lowStockItems?.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-4 bg-red-50 border border-red-100 rounded-xl">
                    <div className="font-bold text-slate-800">{item.item_name}</div>
                    <div className="text-sm font-bold text-red-600">{item.quantity} left <span className="text-slate-400 font-normal">/ reorder at {item.reorder_level}</span></div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'reports' && (
        <AdminReportsPanel reports={reports} loading={reportsLoading} />
      )}

      {tab === 'staff' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Name</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Email</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Role</th>
                <th className="px-6 py-3 text-left text-xs font-bold text-slate-500 uppercase">Status</th>
                <th className="px-6 py-3 text-right text-xs font-bold text-slate-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(u => (
                <tr key={u.id} className="hover:bg-slate-50">
                  <td className="px-6 py-4 font-medium text-slate-900">{u.name}</td>
                  <td className="px-6 py-4 text-sm text-slate-500">{u.email}</td>
                  <td className="px-6 py-4 text-sm capitalize"><span className="px-2.5 py-1 bg-slate-100 rounded-full font-bold text-slate-700 text-xs">{u.role.replace('_',' ')}</span></td>
                  <td className="px-6 py-4">
                    <span className={`px-2.5 py-1 text-xs font-bold rounded-full ${u.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{u.is_active ? 'Active' : 'Deactivated'}</span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => toggleStaffStatus(u)} className={`inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-bold transition ${u.is_active ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'}`}>
                      {u.is_active ? <UserX className="h-3.5 w-3.5 mr-1.5"/> : <UserCheck className="h-3.5 w-3.5 mr-1.5"/>}
                      {u.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'audit' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden flex flex-col">
          <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center"><FileArchive className="mr-2 h-5 w-5 text-indigo-600"/> Immutable Security Audit Logs</h2>
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Target Table</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Record ID</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{fmtDate(log.created_at)}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{log.acting_user || 'System'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        log.action === 'INSERT' ? 'bg-green-100 text-green-700' :
                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                      }`}>{log.action}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{log.table_name}</td>
                    <td className="px-4 py-3 text-sm text-slate-400">#{log.record_id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// ADMIN REPORTS & ANALYTICS PANEL — EMR activity, prescriptions, payments,
// inventory value, and patient demographics. Built with lightweight CSS bar
// charts (no external charting library) to stay within the file-count budget.
// ============================================================================
function AdminReportsPanel({ reports, loading }) {
  if (loading || !reports) {
    return (
      <div className="flex items-center justify-center h-96 bg-white rounded-2xl border border-slate-200">
        <ActivitySquare className="animate-pulse h-10 w-10 text-blue-500" />
      </div>
    );
  }

  const { emr, prescriptions, payments, inventory, patients } = reports;

  const BarRow = ({ label, value, max, color = 'bg-blue-500', formatter = (v) => v }) => (
    <div className="space-y-1">
      <div className="flex justify-between text-xs font-semibold text-slate-600">
        <span className="truncate pr-2">{label}</span>
        <span className="flex-shrink-0">{formatter(value)}</span>
      </div>
      <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all`} style={{ width: `${max > 0 ? Math.max(4, (value / max) * 100) : 0}%` }}></div>
      </div>
    </div>
  );

  const TrendChart = ({ data, dateKey, valueKey, color = 'bg-indigo-500', formatter = (v) => v }) => {
    const max = Math.max(1, ...data.map(d => Number(d[valueKey])));
    return (
      <div className="flex items-end space-x-1.5 h-32">
        {data.length === 0 && <p className="text-xs text-slate-400 self-center">No activity in this period yet.</p>}
        {data.map((d, i) => (
          <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
            <div className={`w-full ${color} rounded-t transition-all`} style={{ height: `${Math.max(4, (Number(d[valueKey]) / max) * 100)}%` }}></div>
            <span className="text-[9px] text-slate-400 mt-1 rotate-0">{new Date(d[dateKey]).toLocaleDateString(undefined, { day: '2-digit', month: 'short' })}</span>
            <div className="absolute -top-6 opacity-0 group-hover:opacity-100 transition bg-slate-900 text-white text-[10px] font-bold px-2 py-1 rounded pointer-events-none whitespace-nowrap">{formatter(d[valueKey])}</div>
          </div>
        ))}
      </div>
    );
  };

  const maxDiagnosis = Math.max(1, ...emr.topDiagnoses.map(d => Number(d.count)));
  const maxDrug = Math.max(1, ...prescriptions.topDrugsDispensed.map(d => Number(d.total_qty)));
  const rxByStatus = Object.fromEntries(prescriptions.totalsByStatus.map(r => [r.status, Number(r.count)]));
  const totalRx = Object.values(rxByStatus).reduce((a, b) => a + b, 0);
  const maxRevenueType = Math.max(1, ...payments.revenueByType.map(r => Number(r.total)));
  const maxInvValue = Math.max(1, ...inventory.topDispensedByValue.map(d => Number(d.total_value)));
  const totalPatientsByType = patients.byType.reduce((a, r) => a + Number(r.count), 0);
  const totalPatientsByGender = patients.byGender.reduce((a, r) => a + Number(r.count), 0);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* EMR ACTIVITY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-1 flex items-center"><Stethoscope className="h-4 w-4 mr-2 text-indigo-600"/> Consultations — Last 14 Days</h3>
          <p className="text-xs text-slate-400 mb-4">Daily EMR consultation activity across all doctors</p>
          <TrendChart data={emr.consultationsTrend} dateKey="day" valueKey="count" color="bg-indigo-500" />
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center"><ClipboardCheck className="h-4 w-4 mr-2 text-indigo-600"/> Top Diagnoses</h3>
          <div className="space-y-3">
            {emr.topDiagnoses.length === 0 && <p className="text-xs text-slate-400">No consultations recorded yet.</p>}
            {emr.topDiagnoses.map((d, i) => (
              <BarRow key={i} label={d.diagnosis} value={Number(d.count)} max={maxDiagnosis} color="bg-indigo-500" />
            ))}
          </div>
        </div>
      </div>

      {/* PRESCRIPTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center"><Pill className="h-4 w-4 mr-2 text-emerald-600"/> Prescription Status</h3>
          <div className="space-y-4">
            {['pending', 'dispensed', 'cancelled'].map(status => (
              <BarRow key={status} label={status} value={rxByStatus[status] || 0} max={Math.max(1, totalRx)} color={status === 'dispensed' ? 'bg-emerald-500' : status === 'pending' ? 'bg-amber-500' : 'bg-slate-400'} />
            ))}
            <div className="pt-2 text-xs text-slate-400">{totalRx} prescriptions total</div>
          </div>
        </div>
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center"><FlaskConical className="h-4 w-4 mr-2 text-emerald-600"/> Most Dispensed Medications</h3>
          <div className="space-y-3">
            {prescriptions.topDrugsDispensed.length === 0 && <p className="text-xs text-slate-400">No medications dispensed yet.</p>}
            {prescriptions.topDrugsDispensed.map((d, i) => (
              <BarRow key={i} label={d.item_name} value={Number(d.total_qty)} max={maxDrug} color="bg-emerald-500" formatter={(v) => `${v} units`} />
            ))}
          </div>
        </div>
      </div>

      {/* PAYMENTS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-1 flex items-center"><Wallet className="h-4 w-4 mr-2 text-blue-600"/> Confirmed Revenue — Last 14 Days</h3>
          <p className="text-xs text-slate-400 mb-4">Daily total of payments confirmed by Reception</p>
          <TrendChart data={payments.revenueTrend} dateKey="day" valueKey="total" color="bg-blue-500" formatter={fmtMoney} />
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center"><PieChart className="h-4 w-4 mr-2 text-blue-600"/> Revenue by Source</h3>
          <div className="space-y-3">
            {payments.revenueByType.length === 0 && <p className="text-xs text-slate-400">No confirmed payments yet.</p>}
            {payments.revenueByType.map((r, i) => (
              <BarRow key={i} label={r.reference_type || 'manual'} value={Number(r.total)} max={maxRevenueType} color="bg-blue-500" formatter={fmtMoney} />
            ))}
          </div>
          <div className="mt-5 pt-4 border-t border-slate-100 flex justify-between text-sm">
            <span className="text-slate-500 font-medium">Outstanding (Unpaid)</span>
            <span className="font-bold text-red-600">{fmtMoney(payments.outstandingTotal)} <span className="text-slate-400 font-normal">({payments.outstandingCount})</span></span>
          </div>
        </div>
      </div>

      {/* INVENTORY */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center"><Package className="h-4 w-4 mr-2 text-amber-600"/> Inventory Value</h3>
          <div className="text-3xl font-extrabold text-slate-900 mb-4">{fmtMoney(inventory.totalValue)}</div>
          <div className="space-y-3">
            {inventory.byCategory.map((c, i) => (
              <div key={i} className="flex justify-between text-sm bg-slate-50 p-3 rounded-lg">
                <span className="font-semibold text-slate-700">{c.category}</span>
                <span className="text-slate-500">{c.items} items · {c.units} units</span>
              </div>
            ))}
          </div>
        </div>
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center"><TrendingUp className="h-4 w-4 mr-2 text-amber-600"/> Highest-Value Dispensed Items</h3>
          <div className="space-y-3">
            {inventory.topDispensedByValue.length === 0 && <p className="text-xs text-slate-400">No dispensing activity yet.</p>}
            {inventory.topDispensedByValue.map((d, i) => (
              <BarRow key={i} label={d.item_name} value={Number(d.total_value)} max={maxInvValue} color="bg-amber-500" formatter={fmtMoney} />
            ))}
          </div>
        </div>
      </div>

      {/* PATIENT DEMOGRAPHICS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center"><Users className="h-4 w-4 mr-2 text-slate-600"/> Patients by Type</h3>
          <div className="space-y-3">
            {patients.byType.map((p, i) => (
              <BarRow key={i} label={p.patient_type} value={Number(p.count)} max={Math.max(1, totalPatientsByType)} color="bg-slate-500" />
            ))}
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-4 flex items-center"><Users className="h-4 w-4 mr-2 text-slate-600"/> Patients by Gender</h3>
          <div className="space-y-3">
            {patients.byGender.length === 0 && <p className="text-xs text-slate-400">No demographic data yet.</p>}
            {patients.byGender.map((p, i) => (
              <BarRow key={i} label={p.gender} value={Number(p.count)} max={Math.max(1, totalPatientsByGender)} color="bg-slate-500" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// FRONT DESK DASHBOARD — Reception + Triage/Nursing merged into one team
// ============================================================================
function FrontDeskDashboard({ activeTab, setActiveTab }) {
  // --- Registration ---
  const emptyPatientForm = { university_id: '', patient_type: 'student', full_name: '', dob: '', gender: 'Male', blood_group: '', genotype: '', allergies: '', phone: '', address: '', linked_user_email: '' };
  const [patientForm, setPatientForm] = useState(emptyPatientForm);
  const [lastRegistered, setLastRegistered] = useState(null);

  // --- Check-In ---
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [checkinForm, setCheckinForm] = useState({ assigned_doctor_id: '', priority: 'normal' });
  const [activeQueue, setActiveQueue] = useState([]);

  // --- Triage & Vitals ---
  const [triageQueue, setTriageQueue] = useState([]);
  const [triagePatient, setTriagePatient] = useState(null);
  const [vitals, setVitals] = useState({ blood_pressure: '', temperature: '', weight: '', heart_rate: '' });

  // --- Immunizations ---
  const [immSearchTerm, setImmSearchTerm] = useState('');
  const [immSearchResults, setImmSearchResults] = useState([]);
  const [immPatient, setImmPatient] = useState(null);
  const [immHistory, setImmHistory] = useState([]);
  const [immForm, setImmForm] = useState({ vaccine_name: '', dose_number: '', next_due_date: '' });

  // --- Billing & Payments ---
  const [billingForm, setBillingForm] = useState({ patient_id: '', total_amount: '', purpose: '' });
  const [patients, setPatients] = useState([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [processingInvoices, setProcessingInvoices] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);

  useEffect(() => {
    if (activeTab === 'checkin') {
      apiFetch('/api/staff/doctors').then(setDoctors).catch(console.error);
      loadQueue();
    }
    if (activeTab === 'triage') loadTriageQueue();
    if (activeTab === 'billing') {
      apiFetch('/api/patients').then(setPatients).catch(console.error);
      loadInvoices();
    }
  }, [activeTab]);

  const loadQueue = () => apiFetch('/api/queue/active').then(setActiveQueue).catch(console.error);

  const loadTriageQueue = async () => {
    try {
      const data = await apiFetch('/api/queue/active');
      setTriageQueue(data.filter(q => q.status === 'waiting_triage'));
    } catch (e) { console.error(e); }
  };

  const loadInvoices = () => {
    apiFetch('/api/billing/unpaid').then(setUnpaidInvoices).catch(console.error);
    apiFetch('/api/billing/processing').then(setProcessingInvoices).catch(console.error);
    apiFetch('/api/billing/recent').then(setRecentInvoices).catch(console.error);
  };

  const registerPatient = async (e) => {
    e.preventDefault();
    try {
      const created = await apiFetch('/api/patients', { method: 'POST', body: JSON.stringify(patientForm) });
      setLastRegistered(created);
      setPatientForm(emptyPatientForm);
    } catch (e) { alert(e.message); }
  };

  const runSearch = async (term) => {
    setSearchTerm(term);
    setSelectedPatient(null);
    if (term.trim().length < 2) { setSearchResults([]); return; }
    try {
      const data = await apiFetch(`/api/patients?search=${encodeURIComponent(term)}`);
      setSearchResults(data);
    } catch (e) { console.error(e); }
  };

  const checkInPatient = async () => {
    if (!selectedPatient) return;
    try {
      await apiFetch('/api/queue', { method: 'POST', body: JSON.stringify({ patient_id: selectedPatient.id, ...checkinForm }) });
      alert(`${selectedPatient.full_name} checked in to Triage.`);
      setSelectedPatient(null);
      setSearchTerm('');
      setSearchResults([]);
      setCheckinForm({ assigned_doctor_id: '', priority: 'normal' });
      loadQueue();
    } catch (e) { alert(e.message); }
  };

  const submitVitals = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/vitals', {
        method: 'POST',
        body: JSON.stringify({ patient_id: triagePatient.patient_id, ...vitals })
      });
      alert("Vitals logged securely! Patient has been moved to the Doctor's queue.");
      setTriagePatient(null);
      setVitals({ blood_pressure: '', temperature: '', weight: '', heart_rate: '' });
      loadTriageQueue();
    } catch (e) { alert(e.message); }
  };

  const runImmSearch = async (term) => {
    setImmSearchTerm(term);
    setImmPatient(null);
    setImmHistory([]);
    if (term.trim().length < 2) { setImmSearchResults([]); return; }
    try {
      const data = await apiFetch(`/api/patients?search=${encodeURIComponent(term)}`);
      setImmSearchResults(data);
    } catch (e) { console.error(e); }
  };

  const selectImmPatient = async (p) => {
    setImmPatient(p);
    setImmSearchResults([]);
    setImmSearchTerm(p.full_name);
    try {
      const hist = await apiFetch(`/api/immunizations/${p.id}`);
      setImmHistory(hist);
    } catch (e) { console.error(e); }
  };

  const submitImmunization = async (e) => {
    e.preventDefault();
    if (!immPatient) return alert('Select a patient first.');
    try {
      await apiFetch('/api/immunizations', { method: 'POST', body: JSON.stringify({ patient_id: immPatient.id, ...immForm }) });
      alert('Vaccination record saved successfully!');
      setImmForm({ vaccine_name: '', dose_number: '', next_due_date: '' });
      const hist = await apiFetch(`/api/immunizations/${immPatient.id}`);
      setImmHistory(hist);
    } catch (e) { alert(e.message); }
  };

  const generateInvoice = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/billing', { method: 'POST', body: JSON.stringify(billingForm) });
      alert('Invoice generated successfully!');
      setBillingForm({ patient_id: '', total_amount: '', purpose: '' });
      loadInvoices();
    } catch (e) { alert(e.message); }
  };

  const confirmPayment = async (inv) => {
    const msg = inv.status === 'processing'
      ? `Confirm receipt of mock payment ${inv.payment_reference}?`
      : 'Confirm cash/in-person payment received?';
    if (!window.confirm(msg)) return;
    try {
      await apiFetch(`/api/billing/${inv.id}/confirm`, { method: 'PUT' });
      alert('Payment confirmed and receipt generated.');
      loadInvoices();
    } catch (e) { alert(e.message); }
  };

  const queueStatusBadge = (status) => {
    const map = {
      waiting_triage: 'bg-amber-100 text-amber-700',
      waiting_doctor: 'bg-blue-100 text-blue-700',
      waiting_lab: 'bg-purple-100 text-purple-700',
      waiting_pharmacy: 'bg-emerald-100 text-emerald-700',
      completed: 'bg-slate-200 text-slate-600'
    };
    return map[status] || 'bg-slate-100 text-slate-600';
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center flex-wrap gap-4">
        <h1 className="text-3xl font-bold text-slate-900">Front Desk Operations</h1>
        <div className="flex bg-slate-200 p-1 rounded-xl flex-wrap">
          <button onClick={() => setActiveTab('register')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'register' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Registration</button>
          <button onClick={() => setActiveTab('checkin')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'checkin' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Check-In</button>
          <button onClick={() => setActiveTab('triage')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'triage' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Triage & Vitals</button>
          <button onClick={() => setActiveTab('immunization')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'immunization' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Immunizations</button>
          <button onClick={() => setActiveTab('billing')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'billing' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Billing & Payments</button>
        </div>
      </div>

      {activeTab === 'register' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 bg-white p-8 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center border-b pb-4"><UserPlus className="mr-3 h-6 w-6 text-blue-600"/> New Patient Registration</h2>
            <form onSubmit={registerPatient} className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">University ID</label>
                <input type="text" placeholder="e.g. FUD/CSC/20/1234" value={patientForm.university_id} onChange={e => setPatientForm({...patientForm, university_id: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Patient Type</label>
                <select required value={patientForm.patient_type} onChange={e => setPatientForm({...patientForm, patient_type: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500">
                  <option value="student">Student</option>
                  <option value="staff">Staff</option>
                  <option value="dependent">Dependent</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input required type="text" value={patientForm.full_name} onChange={e => setPatientForm({...patientForm, full_name: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Date of Birth</label>
                <input type="date" value={patientForm.dob} onChange={e => setPatientForm({...patientForm, dob: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Gender</label>
                <select value={patientForm.gender} onChange={e => setPatientForm({...patientForm, gender: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Blood Group</label>
                <select value={patientForm.blood_group} onChange={e => setPatientForm({...patientForm, blood_group: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500">
                  <option value="">Unknown</option>
                  {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => <option key={bg} value={bg}>{bg}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Genotype</label>
                <select value={patientForm.genotype} onChange={e => setPatientForm({...patientForm, genotype: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500">
                  <option value="">Unknown</option>
                  {['AA','AS','SS','AC'].map(g => <option key={g} value={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Phone Number</label>
                <input type="tel" value={patientForm.phone} onChange={e => setPatientForm({...patientForm, phone: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <input type="text" value={patientForm.address} onChange={e => setPatientForm({...patientForm, address: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700 mb-1">Known Allergies (optional)</label>
                <input type="text" placeholder="e.g. Penicillin" value={patientForm.allergies} onChange={e => setPatientForm({...patientForm, allergies: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="md:col-span-2 pt-2 border-t border-slate-100 mt-2">
                <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center"><Link2 className="h-3.5 w-3.5 mr-1.5 text-blue-500"/> Link Patient Portal Account (optional)</label>
                <input type="email" placeholder="Email used for their patient portal account" value={patientForm.linked_user_email} onChange={e => setPatientForm({...patientForm, linked_user_email: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500" />
                <p className="text-xs text-slate-400 mt-1">If the patient has a portal account, linking it here lets them view this record and pay invoices online.</p>
              </div>
              <div className="md:col-span-2 pt-2">
                <button type="submit" className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200">Complete Registration</button>
              </div>
            </form>
          </div>

          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm h-fit">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center"><CheckCircle2 className="h-5 w-5 mr-2 text-emerald-500"/> Last Registered</h3>
            {!lastRegistered ? (
              <p className="text-sm text-slate-400">New registrations will appear here, with a shortcut to check them in immediately.</p>
            ) : (
              <div className="space-y-3">
                <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="font-bold text-slate-900">{lastRegistered.full_name}</div>
                  <div className="text-xs text-slate-500 mt-1">{lastRegistered.university_id || 'No University ID'} · {lastRegistered.patient_type}</div>
                  {lastRegistered.linked_user_id && <div className="text-xs text-blue-600 font-bold mt-1 flex items-center"><Link2 className="h-3 w-3 mr-1"/> Portal account linked</div>}
                </div>
                <button onClick={() => { setActiveTab('checkin'); setSearchTerm(lastRegistered.full_name); runSearch(lastRegistered.full_name); }} className="w-full py-2.5 bg-slate-800 text-white rounded-xl font-bold text-sm hover:bg-slate-900 transition flex items-center justify-center">
                  <Clock className="h-4 w-4 mr-2"/> Check In Now
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'checkin' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center"><Search className="mr-2 h-5 w-5 text-blue-600"/> Find Patient</h2>
            <input type="text" placeholder="Search by name or university ID..." value={searchTerm} onChange={e => runSearch(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 mb-4" />
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {searchResults.map(p => (
                <div key={p.id} onClick={() => setSelectedPatient(p)} className={`p-3 rounded-xl cursor-pointer border transition ${selectedPatient?.id === p.id ? 'bg-blue-50 border-blue-200' : 'hover:bg-slate-50 border-transparent'}`}>
                  <div className="font-bold text-slate-900">{p.full_name}</div>
                  <div className="text-xs text-slate-500">{p.university_id || 'No ID'} · {p.patient_type}</div>
                </div>
              ))}
            </div>

            {selectedPatient && (
              <div className="mt-6 pt-6 border-t border-slate-100 space-y-4">
                <h3 className="font-bold text-slate-800">Check In: {selectedPatient.full_name}</h3>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Assign Doctor (optional)</label>
                  <select value={checkinForm.assigned_doctor_id} onChange={e => setCheckinForm({...checkinForm, assigned_doctor_id: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500">
                    <option value="">Unassigned (first available)</option>
                    {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
                  <select value={checkinForm.priority} onChange={e => setCheckinForm({...checkinForm, priority: e.target.value})} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500">
                    <option value="normal">Normal</option>
                    <option value="urgent">Urgent</option>
                  </select>
                </div>
                <button onClick={checkInPatient} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200">Check-In to Triage</button>
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[560px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Live Patient Pipeline</h3>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">{activeQueue.length} active</span>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-slate-100">
              {activeQueue.length === 0 ? <p className="p-6 text-sm text-slate-400">No patients currently in the pipeline.</p> : activeQueue.map(q => (
                <div key={q.id} className="p-4 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-slate-900">{q.patient_name}</div>
                    <div className="text-xs text-slate-500">{q.doctor_name ? `Dr. ${q.doctor_name}` : 'Unassigned'} · {fmtDate(q.check_in_time)}</div>
                  </div>
                  <span className={`px-2.5 py-1 text-xs font-bold rounded-full capitalize ${queueStatusBadge(q.status)}`}>{q.status.replace('_',' ')}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'triage' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center"><Clock className="h-5 w-5 mr-2 text-blue-600"/> Waiting Triage</h3>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">{triageQueue.length}</span>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-2">
              {triageQueue.map(p => (
                <div key={p.id} onClick={() => setTriagePatient(p)} className={`p-4 rounded-xl cursor-pointer border transition-all duration-200 ${triagePatient?.id === p.id ? 'bg-blue-50 border-blue-200 shadow-sm' : 'hover:bg-slate-50 border-transparent hover:border-slate-200'}`}>
                  <div className="font-bold text-slate-900">{p.patient_name}</div>
                  <div className="text-xs text-slate-400 mt-2 flex justify-between">
                    <span className="capitalize text-blue-600 font-medium">{p.patient_type}</span>
                    <span>{new Date(p.check_in_time).toLocaleTimeString()}</span>
                  </div>
                  {p.priority === 'urgent' && <span className="inline-block mt-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">URGENT</span>}
                </div>
              ))}
              {triageQueue.length === 0 && <p className="p-6 text-sm text-slate-400 text-center">No patients waiting for triage.</p>}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-8 h-[600px] flex flex-col">
            {!triagePatient ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Activity className="h-16 w-16 mb-4 text-slate-200" />
                <p className="font-medium text-lg text-slate-500">Select a patient from the queue to record vitals</p>
              </div>
            ) : (
              <form onSubmit={submitVitals} className="space-y-6 flex-1 flex flex-col">
                <div className="mb-2 pb-4 border-b border-slate-100 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">{triagePatient.patient_name}</h3>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                      {triagePatient.blood_group && <span className="flex items-center"><Droplet className="h-3 w-3 mr-1"/> {triagePatient.blood_group}</span>}
                      {triagePatient.gender && <span>{triagePatient.gender}</span>}
                    </div>
                  </div>
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{triagePatient.patient_type}</span>
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Blood Pressure (mmHg)</label>
                    <input required type="text" placeholder="e.g. 120/80" value={vitals.blood_pressure} onChange={e => setVitals({...vitals, blood_pressure: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Heart Rate (BPM)</label>
                    <input required type="number" placeholder="e.g. 75" value={vitals.heart_rate} onChange={e => setVitals({...vitals, heart_rate: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Temperature (°C)</label>
                    <input required type="number" step="0.1" placeholder="e.g. 36.5" value={vitals.temperature} onChange={e => setVitals({...vitals, temperature: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 mb-1">Weight (kg)</label>
                    <input required type="number" step="0.1" placeholder="e.g. 70.5" value={vitals.weight} onChange={e => setVitals({...vitals, weight: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 transition" />
                  </div>
                </div>
                <div className="pt-6 border-t border-slate-100 mt-auto">
                  <button type="submit" className="w-full flex items-center justify-center px-8 py-4 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200">
                    <Save className="h-5 w-5 mr-2" /> Save Vitals & Send to Doctor
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {activeTab === 'immunization' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center border-b pb-4"><Search className="mr-3 h-5 w-5 text-emerald-600"/> Find Patient</h2>
            <input type="text" placeholder="Search by name or university ID..." value={immSearchTerm} onChange={e => runImmSearch(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 mb-3" />
            <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
              {immSearchResults.map(p => (
                <div key={p.id} onClick={() => selectImmPatient(p)} className="p-3 rounded-xl cursor-pointer border border-transparent hover:bg-slate-50 hover:border-slate-200 transition">
                  <div className="font-bold text-slate-900">{p.full_name}</div>
                  <div className="text-xs text-slate-500">{p.university_id || 'No ID'}</div>
                </div>
              ))}
            </div>

            {immPatient && (
              <form onSubmit={submitImmunization} className="space-y-4 pt-4 border-t border-slate-100">
                <h3 className="font-bold text-slate-800">New record for {immPatient.full_name}</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Vaccine Name</label>
                    <input required type="text" placeholder="e.g. Hepatitis B" value={immForm.vaccine_name} onChange={e => setImmForm({...immForm, vaccine_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Dose Number</label>
                    <input required type="text" placeholder="e.g. Dose 1" value={immForm.dose_number} onChange={e => setImmForm({...immForm, dose_number: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition" />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Next Due Date (Optional)</label>
                  <input type="date" value={immForm.next_due_date} onChange={e => setImmForm({...immForm, next_due_date: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 transition" />
                </div>
                <button type="submit" className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200">Save Vaccination Record</button>
              </form>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50">
              <h3 className="font-bold text-slate-800 flex items-center"><Syringe className="h-5 w-5 mr-2 text-emerald-600"/> Vaccination History {immPatient && `— ${immPatient.full_name}`}</h3>
            </div>
            <div className="overflow-y-auto flex-1 p-4 space-y-3">
              {!immPatient ? (
                <p className="text-sm text-slate-400">Select a patient to view their immunization record.</p>
              ) : immHistory.length === 0 ? (
                <p className="text-sm text-slate-400">No prior immunizations on file.</p>
              ) : immHistory.map(im => (
                <div key={im.id} className="p-4 bg-emerald-50/60 border border-emerald-100 rounded-xl">
                  <div className="flex justify-between items-start">
                    <div className="font-bold text-slate-800">{im.vaccine_name}</div>
                    <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">{im.dose_number}</span>
                  </div>
                  <div className="text-xs text-slate-500 mt-1">Administered by {im.nurse_name} on {fmtDateOnly(im.administered_at)}</div>
                  {im.next_due_date && <div className="text-xs text-amber-600 font-medium mt-1">Next dose due: {fmtDateOnly(im.next_due_date)}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'billing' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="space-y-8">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center"><CreditCard className="mr-2 h-5 w-5 text-blue-600"/> Generate Ad-hoc Invoice</h2>
              <form onSubmit={generateInvoice} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Select Patient</label>
                  <select required value={billingForm.patient_id} onChange={e => setBillingForm({...billingForm, patient_id: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-blue-500">
                    <option value="">Choose...</option>
                    {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.university_id})</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Purpose / Service</label>
                  <input required type="text" placeholder="e.g. Medical Report, Referral Letter" value={billingForm.purpose} onChange={e => setBillingForm({...billingForm, purpose: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Total Amount (₦)</label>
                  <input required type="number" min="0" value={billingForm.total_amount} onChange={e => setBillingForm({...billingForm, total_amount: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-blue-500" />
                </div>
                <button type="submit" className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition shadow-lg">Create Invoice</button>
              </form>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <h3 className="font-bold text-slate-800 mb-4">Recently Paid</h3>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {recentInvoices.length === 0 ? <p className="text-sm text-slate-400">No payments recorded yet.</p> : recentInvoices.map(inv => (
                  <div key={inv.id} className="p-3 bg-slate-50 rounded-xl flex justify-between items-center text-sm">
                    <div>
                      <div className="font-bold text-slate-800">{inv.patient_name}</div>
                      <div className="text-xs text-slate-400">{inv.purpose}</div>
                    </div>
                    <div className="font-bold text-emerald-600">{fmtMoney(inv.total_amount)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            {processingInvoices.length > 0 && (
              <div className="bg-white p-6 rounded-2xl border border-amber-200 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center"><RefreshCw className="mr-2 h-5 w-5 text-amber-600"/> Awaiting Payment Confirmation</h2>
                <div className="space-y-3">
                  {processingInvoices.map(inv => (
                    <div key={inv.id} className="p-4 border border-amber-100 bg-amber-50 rounded-xl">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-bold text-slate-900">{inv.patient_name}</div>
                          <div className="text-xs text-slate-500">{inv.purpose}</div>
                          <div className="text-xs font-mono text-amber-700 mt-1">Ref: {inv.payment_reference}</div>
                        </div>
                        <div className="text-sm font-bold text-amber-700">{fmtMoney(inv.total_amount)}</div>
                      </div>
                      <button onClick={() => confirmPayment(inv)} className="w-full mt-3 px-4 py-2 bg-amber-600 text-white text-sm font-bold rounded-lg hover:bg-amber-700 transition flex items-center justify-center">
                        <ClipboardCheck className="h-4 w-4 mr-2"/> Confirm Payment Received
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
              <h2 className="text-lg font-bold text-slate-900 mb-4">Unpaid Invoices <span className="text-sm font-normal text-slate-400">(auto-generated from consultations, labs & pharmacy)</span></h2>
              <div className="overflow-y-auto flex-1 space-y-3">
                {unpaidInvoices.length === 0 ? <p className="text-slate-400 text-sm">No pending payments.</p> : unpaidInvoices.map(inv => (
                  <div key={inv.id} className="p-4 border border-slate-100 bg-slate-50 rounded-xl flex justify-between items-center">
                    <div>
                      <div className="font-bold text-slate-900">{inv.patient_name}</div>
                      <div className="text-xs text-slate-500">{inv.purpose}</div>
                      <div className="text-sm font-bold text-red-600 mt-1">{fmtMoney(inv.total_amount)}</div>
                    </div>
                    <button onClick={() => confirmPayment(inv)} className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition">Clear Payment</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ============================================================================
// DOCTOR DASHBOARD — the core EMR workspace
// ============================================================================
function DoctorDashboard({ currentUser }) {
  const [queue, setQueue] = useState([]);
  const [pendingTriage, setPendingTriage] = useState([]);
  const [activePatient, setActivePatient] = useState(null);
  const [patientProfile, setPatientProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('history');
  const [history, setHistory] = useState({ consultations: [], vitals: [], lab_requests: [], prescriptions: [], certificates: [], immunizations: [], invoices: [] });
  const [inventory, setInventory] = useState([]);
  const [currentConsultationId, setCurrentConsultationId] = useState(null);

  const [consultForm, setConsultForm] = useState({ chief_complaint: '', diagnosis: '', treatment_plan: '', notes: '' });
  const [labForm, setLabForm] = useState({ test_name: '' });
  const [rxDraft, setRxDraft] = useState({ inventory_id: '', dosage: '', quantity_prescribed: 1 });
  const [rxCart, setRxCart] = useState([]);
  const [certForm, setCertForm] = useState({ certificate_type: 'sick_leave', start_date: '', end_date: '', remarks: '' });

  useEffect(() => {
    loadQueue();
    apiFetch('/api/inventory').then(setInventory).catch(console.error);
    // Live-ish refresh so a doctor sees patients land the moment a nurse finishes triage
    const interval = setInterval(loadQueue, 15000);
    return () => clearInterval(interval);
  }, []);

  const loadQueue = async () => {
    try {
      const data = await apiFetch('/api/queue/active');
      const myId = currentUser?.id;
      // A patient reaches the doctor only after triage (status flips to
      // waiting_doctor once a nurse logs vitals). Show patients explicitly
      // assigned to this doctor, plus any unassigned pool patients.
      setQueue(data.filter(q => q.status === 'waiting_doctor' && (!q.assigned_doctor_id || q.assigned_doctor_id === myId)));
      // Patients already checked in and assigned to this doctor, but still
      // sitting with the Nurse — surfaced so the queue never looks silently empty.
      setPendingTriage(data.filter(q => q.status === 'waiting_triage' && q.assigned_doctor_id === myId));
    } catch (e) { console.error(e); }
  };

  const loadHistory = async (patientId) => {
    try {
      const data = await apiFetch(`/api/emr/history/${patientId}`);
      setHistory(data);
      setCurrentConsultationId(data.consultations.length > 0 ? data.consultations[0].id : null);
    } catch (e) { console.error(e); }
  };

  const selectPatient = async (p) => {
    setActivePatient(p);
    setActiveTab('history');
    setCurrentConsultationId(null);
    setConsultForm({ chief_complaint: '', diagnosis: '', treatment_plan: '', notes: '' });
    setRxCart([]);
    try {
      const [hist, profile] = await Promise.all([
        apiFetch(`/api/emr/history/${p.patient_id}`),
        apiFetch(`/api/patients/${p.patient_id}`)
      ]);
      setHistory(hist);
      setPatientProfile(profile);
      setCurrentConsultationId(hist.consultations.length > 0 ? hist.consultations[0].id : null);
    } catch (e) { console.error(e); }
  };

  const submitConsultation = async (e) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/consultations', { method: 'POST', body: JSON.stringify({ patient_id: activePatient.patient_id, ...consultForm }) });
      setCurrentConsultationId(res.consultation_id);
      alert('Consultation saved — a consultation fee invoice has been auto-generated for Reception.');
      setConsultForm({ chief_complaint: '', diagnosis: '', treatment_plan: '', notes: '' });
      loadHistory(activePatient.patient_id);
      setActiveTab('history');
    } catch (e) { alert(e.message); }
  };

  const submitLabRequest = async (e) => {
    e.preventDefault();
    if (!currentConsultationId) return alert('Save a consultation for this visit before requesting labs.');
    try {
      await apiFetch('/api/lab/request', { method: 'POST', body: JSON.stringify({ patient_id: activePatient.patient_id, consultation_id: currentConsultationId, test_name: labForm.test_name }) });
      alert('Lab test requested — billed automatically to Reception.');
      setLabForm({ test_name: '' });
      loadHistory(activePatient.patient_id);
    } catch (e) { alert(e.message); }
  };

  const addToCart = () => {
    if (!rxDraft.inventory_id || !rxDraft.dosage || !rxDraft.quantity_prescribed) return alert('Fill in medication, dosage and quantity first.');
    const item = inventory.find(i => String(i.id) === String(rxDraft.inventory_id));
    setRxCart([...rxCart, { ...rxDraft, _key: Date.now(), item_name: item?.item_name }]);
    setRxDraft({ inventory_id: '', dosage: '', quantity_prescribed: 1 });
  };

  const removeFromCart = (key) => setRxCart(rxCart.filter(i => i._key !== key));

  const submitPrescription = async (e) => {
    e.preventDefault();
    if (!currentConsultationId) return alert('Save a consultation for this visit before prescribing.');
    if (rxCart.length === 0) return alert('Add at least one medication to the prescription cart.');
    try {
      const items = rxCart.map(({ inventory_id, dosage, quantity_prescribed }) => ({ inventory_id, dosage, quantity_prescribed }));
      await apiFetch('/api/prescriptions', { method: 'POST', body: JSON.stringify({ patient_id: activePatient.patient_id, consultation_id: currentConsultationId, items }) });
      alert('E-Prescription generated & sent to Pharmacy!');
      setRxCart([]);
      loadHistory(activePatient.patient_id);
    } catch (e) { alert(e.message); }
  };

  const submitCertificate = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/certificates', { method: 'POST', body: JSON.stringify({ patient_id: activePatient.patient_id, ...certForm }) });
      alert('Medical certificate officially generated!');
      setCertForm({ certificate_type: 'sick_leave', start_date: '', end_date: '', remarks: '' });
      loadHistory(activePatient.patient_id);
    } catch (e) { alert(e.message); }
  };

  const updateQueueStatus = async (status) => {
    try {
      await apiFetch(`/api/queue/${activePatient.id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      alert(`Patient routed to: ${status.replace('_', ' ')}`);
      setActivePatient(null);
      setPatientProfile(null);
      loadQueue();
    } catch (e) { alert(e.message); }
  };

  // Build a unified, chronologically-sorted timeline across every EMR record type
  const buildTimeline = () => {
    const entries = [];
    history.consultations.forEach(c => entries.push({ type: 'consultation', date: c.created_at, data: c }));
    history.vitals.forEach(v => entries.push({ type: 'vitals', date: v.recorded_at, data: v }));
    history.lab_requests.forEach(l => entries.push({ type: 'lab', date: l.requested_at, data: l }));
    history.prescriptions.forEach(p => entries.push({ type: 'prescription', date: p.created_at, data: p }));
    history.certificates.forEach(c => entries.push({ type: 'certificate', date: c.created_at, data: c }));
    history.immunizations.forEach(i => entries.push({ type: 'immunization', date: i.administered_at, data: i }));
    return entries.sort((a, b) => new Date(b.date) - new Date(a.date));
  };

  const timelineIcon = {
    consultation: { icon: Stethoscope, color: 'text-indigo-600', bg: 'bg-indigo-100' },
    vitals: { icon: Activity, color: 'text-blue-600', bg: 'bg-blue-100' },
    lab: { icon: TestTube, color: 'text-amber-600', bg: 'bg-amber-100' },
    prescription: { icon: Pill, color: 'text-emerald-600', bg: 'bg-emerald-100' },
    certificate: { icon: FileText, color: 'text-purple-600', bg: 'bg-purple-100' },
    immunization: { icon: Syringe, color: 'text-rose-600', bg: 'bg-rose-100' }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900">Doctor's EMR Workspace</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Waiting List */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[750px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center"><Clock className="h-5 w-5 mr-2 text-indigo-600"/> Waiting Room</h3>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">{queue.length}</span>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {queue.map(p => (
              <div key={p.id} onClick={() => selectPatient(p)} className={`p-4 rounded-xl cursor-pointer border transition-all duration-200 ${activePatient?.id === p.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'hover:bg-slate-50 border-transparent hover:border-slate-200'}`}>
                <div className="font-bold text-slate-900">{p.patient_name}</div>
                <div className="text-xs text-slate-400 mt-2">Arrived: {new Date(p.check_in_time).toLocaleTimeString()}</div>
                {p.priority === 'urgent' && <span className="inline-block mt-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">URGENT</span>}
              </div>
            ))}
            {queue.length === 0 && <p className="p-6 text-sm text-slate-400 text-center">No patients waiting.</p>}
          </div>
          {pendingTriage.length > 0 && (
            <div className="p-3 border-t border-slate-100 bg-amber-50">
              <div className="text-xs font-bold text-amber-700 flex items-center">
                <AlertCircle className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                {pendingTriage.length} patient(s) checked in for you, awaiting Reception triage
              </div>
            </div>
          )}
        </div>

        {/* EMR Main Area */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[750px]">
          {!activePatient ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Stethoscope className="h-16 w-16 mb-4 text-slate-200" />
              <p className="font-medium text-lg text-slate-500">Select a patient to open their Electronic Medical Record</p>
            </div>
          ) : (
            <div className="flex flex-col h-full animate-in fade-in">
              {/* Header */}
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900">{activePatient.patient_name}</h2>
                    <div className="flex flex-wrap gap-3 text-sm text-slate-500 mt-1">
                      <span className="capitalize px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md font-medium">{activePatient.patient_type}</span>
                      {patientProfile?.blood_group && <span className="flex items-center"><Droplet className="h-3.5 w-3.5 mr-1 text-red-500"/> {patientProfile.blood_group}</span>}
                      {patientProfile?.genotype && <span>Genotype: {patientProfile.genotype}</span>}
                      {patientProfile?.dob && <span>DOB: {fmtDateOnly(patientProfile.dob)}</span>}
                    </div>
                    {patientProfile?.allergies && (
                      <div className="mt-2 inline-flex items-center px-3 py-1 bg-red-50 border border-red-100 text-red-700 rounded-lg text-xs font-bold">
                        <AlertCircle className="h-3.5 w-3.5 mr-1.5"/> Allergy Alert: {patientProfile.allergies}
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <button onClick={() => updateQueueStatus('waiting_lab')} className="px-4 py-2 bg-amber-100 text-amber-700 font-bold rounded-lg hover:bg-amber-200 transition text-sm flex items-center"><TestTube className="h-4 w-4 mr-2"/> Send to Lab</button>
                    <button onClick={() => updateQueueStatus('waiting_pharmacy')} className="px-4 py-2 bg-emerald-100 text-emerald-700 font-bold rounded-lg hover:bg-emerald-200 transition text-sm flex items-center"><Pill className="h-4 w-4 mr-2"/> Send to Pharmacy</button>
                    <button onClick={() => updateQueueStatus('completed')} className="px-4 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 transition text-sm flex items-center"><CheckCircle2 className="h-4 w-4 mr-2"/> Discharge</button>
                  </div>
                </div>
                {!currentConsultationId && (
                  <div className="mt-4 flex items-center text-xs font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                    <AlertCircle className="h-4 w-4 mr-2"/> No consultation logged yet for this visit — record one before requesting labs or prescriptions.
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="flex border-b border-slate-200 px-6 space-x-6 overflow-x-auto">
                {[
                  { id: 'history', icon: History, label: 'Medical History' },
                  { id: 'consult', icon: Stethoscope, label: 'New Consultation' },
                  { id: 'lab', icon: TestTube, label: 'Request Lab' },
                  { id: 'rx', icon: Pill, label: 'E-Prescribe' },
                  { id: 'cert', icon: FileText, label: 'Certificates' }
                ].map(t => (
                  <button key={t.id} onClick={() => setActiveTab(t.id)} className={`py-4 font-bold text-sm flex items-center border-b-2 transition-colors whitespace-nowrap ${activeTab === t.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                    <t.icon className="h-4 w-4 mr-2" /> {t.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="flex-1 overflow-y-auto p-6 bg-slate-50/30">

                {activeTab === 'history' && (
                  <div className="space-y-6">
                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                      <h4 className="font-bold text-blue-900 mb-3 flex items-center"><Activity className="h-4 w-4 mr-2"/> Latest Vitals</h4>
                      {history.vitals.length > 0 ? (
                        <div className="grid grid-cols-4 gap-4 text-sm bg-white p-4 rounded-lg shadow-sm border border-slate-100">
                          <div><span className="text-slate-400 block mb-1">BP</span><span className="font-bold text-slate-800 text-lg">{history.vitals[0].blood_pressure}</span></div>
                          <div><span className="text-slate-400 block mb-1">Heart Rate</span><span className="font-bold text-slate-800 text-lg">{history.vitals[0].heart_rate} bpm</span></div>
                          <div><span className="text-slate-400 block mb-1">Temp</span><span className="font-bold text-slate-800 text-lg">{history.vitals[0].temperature} °C</span></div>
                          <div><span className="text-slate-400 block mb-1">Weight</span><span className="font-bold text-slate-800 text-lg">{history.vitals[0].weight} kg</span></div>
                        </div>
                      ) : <span className="text-slate-500 italic text-sm">No recent vitals found.</span>}
                    </div>

                    <div>
                      <h4 className="font-bold text-slate-800 mb-3 flex items-center"><History className="h-4 w-4 mr-2"/> Full Clinical Timeline</h4>
                      <div className="space-y-3">
                        {buildTimeline().length === 0 && <p className="text-sm text-slate-400 italic">No records yet for this patient.</p>}
                        {buildTimeline().map((entry, idx) => {
                          const cfg = timelineIcon[entry.type];
                          return (
                            <div key={idx} className="flex space-x-3 bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                              <div className={`p-2.5 h-fit rounded-lg ${cfg.bg}`}><cfg.icon className={`h-4 w-4 ${cfg.color}`} /></div>
                              <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start">
                                  <span className="font-bold text-slate-800 text-sm capitalize">{entry.type.replace('_', ' ')}</span>
                                  <span className="text-xs text-slate-400 flex-shrink-0 ml-2">{fmtDate(entry.date)}</span>
                                </div>
                                {entry.type === 'consultation' && <p className="text-sm text-slate-600 mt-1"><b>Dx:</b> {entry.data.diagnosis} — <span className="text-slate-500">{entry.data.chief_complaint}</span> <span className="text-slate-400">(Dr. {entry.data.doctor_name})</span></p>}
                                {entry.type === 'vitals' && <p className="text-sm text-slate-600 mt-1">BP {entry.data.blood_pressure}, {entry.data.heart_rate} bpm, {entry.data.temperature}°C, {entry.data.weight}kg — <span className="text-slate-400">by {entry.data.nurse_name}</span></p>}
                                {entry.type === 'lab' && <p className="text-sm text-slate-600 mt-1">{entry.data.test_name} — <span className={`font-bold ${entry.data.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}`}>{entry.data.status}</span>{entry.data.result_data && <span className="text-slate-500"> · {entry.data.result_data.findings}</span>}</p>}
                                {entry.type === 'prescription' && <p className="text-sm text-slate-600 mt-1">{entry.data.items?.map(i => i.item_name).join(', ')} — <span className={`font-bold ${entry.data.status === 'dispensed' ? 'text-emerald-600' : 'text-amber-600'}`}>{entry.data.status}</span></p>}
                                {entry.type === 'certificate' && <p className="text-sm text-slate-600 mt-1 capitalize">{entry.data.certificate_type.replace('_',' ')}: {fmtDateOnly(entry.data.start_date)} → {fmtDateOnly(entry.data.end_date)}</p>}
                                {entry.type === 'immunization' && <p className="text-sm text-slate-600 mt-1">{entry.data.vaccine_name} ({entry.data.dose_number}) — <span className="text-slate-400">by {entry.data.nurse_name}</span></p>}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {activeTab === 'consult' && (
                  <form onSubmit={submitConsultation} className="space-y-4 max-w-2xl bg-white p-6 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Chief Complaint</label>
                      <input required type="text" value={consultForm.chief_complaint} onChange={e => setConsultForm({...consultForm, chief_complaint: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Diagnosis</label>
                      <input required type="text" value={consultForm.diagnosis} onChange={e => setConsultForm({...consultForm, diagnosis: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Treatment Plan</label>
                      <textarea rows="3" value={consultForm.treatment_plan} onChange={e => setConsultForm({...consultForm, treatment_plan: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"></textarea>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Additional Notes</label>
                      <textarea rows="2" value={consultForm.notes} onChange={e => setConsultForm({...consultForm, notes: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"></textarea>
                    </div>
                    <button type="submit" className="w-full px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition flex justify-center items-center"><Save className="mr-2 h-5 w-5"/> Save Consultation</button>
                  </form>
                )}

                {activeTab === 'lab' && (
                  <div className="max-w-2xl space-y-6">
                    <form onSubmit={submitLabRequest} className="space-y-4 bg-white p-6 rounded-xl border border-slate-200">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Test Name</label>
                        <input required type="text" placeholder="e.g. Full Blood Count, Malaria Parasite Test" value={labForm.test_name} onChange={e => setLabForm({...labForm, test_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500" />
                      </div>
                      <button type="submit" className="w-full px-6 py-3 bg-amber-500 text-white font-bold rounded-xl shadow-lg hover:bg-amber-600 transition flex justify-center items-center"><FlaskConical className="mr-2 h-5 w-5"/> Request Lab Test</button>
                    </form>
                    <div className="bg-white p-6 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 mb-3">Lab History for this Patient</h4>
                      {history.lab_requests.length === 0 ? <p className="text-sm text-slate-400">No lab tests on record.</p> : (
                        <div className="space-y-2">
                          {history.lab_requests.map(l => (
                            <div key={l.id} className="p-3 bg-slate-50 rounded-lg flex justify-between items-center text-sm">
                              <span className="font-medium text-slate-800">{l.test_name}</span>
                              <span className={`font-bold px-2 py-0.5 rounded-full text-xs ${l.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{l.status}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'rx' && (
                  <div className="max-w-2xl space-y-6">
                    <div className="bg-white p-6 rounded-xl border border-slate-200 space-y-4">
                      <h4 className="font-bold text-slate-800 flex items-center"><ShoppingCart className="h-4 w-4 mr-2 text-emerald-600"/> Add Medication</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                          <label className="block text-sm font-bold text-slate-700 mb-1">Select Medication</label>
                          <select value={rxDraft.inventory_id} onChange={e => setRxDraft({...rxDraft, inventory_id: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500">
                            <option value="">Select from Inventory...</option>
                            {inventory.map(i => <option key={i.id} value={i.id} disabled={i.quantity === 0}>{i.item_name} ({i.quantity} in stock){i.quantity === 0 ? ' — OUT OF STOCK' : ''}</option>)}
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Quantity</label>
                          <input type="number" min="1" value={rxDraft.quantity_prescribed} onChange={e => setRxDraft({...rxDraft, quantity_prescribed: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Dosage Instructions</label>
                          <input type="text" placeholder="e.g. 2 tabs daily" value={rxDraft.dosage} onChange={e => setRxDraft({...rxDraft, dosage: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500" />
                        </div>
                      </div>
                      <button type="button" onClick={addToCart} className="w-full py-2.5 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition flex items-center justify-center"><Plus className="h-4 w-4 mr-2"/> Add to Prescription</button>
                    </div>

                    <div className="bg-white p-6 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 mb-3">Prescription Cart ({rxCart.length})</h4>
                      {rxCart.length === 0 ? <p className="text-sm text-slate-400">No medications added yet.</p> : (
                        <div className="space-y-2 mb-4">
                          {rxCart.map(item => (
                            <div key={item._key} className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                              <div>
                                <div className="font-bold text-slate-800 text-sm">{item.item_name} <span className="text-emerald-600">×{item.quantity_prescribed}</span></div>
                                <div className="text-xs text-slate-500">{item.dosage}</div>
                              </div>
                              <button onClick={() => removeFromCart(item._key)} className="text-red-500 hover:text-red-700"><Trash2 className="h-4 w-4"/></button>
                            </div>
                          ))}
                        </div>
                      )}
                      <button onClick={submitPrescription} className="w-full px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 transition flex justify-center items-center"><Save className="mr-2 h-5 w-5"/> Sign & Send E-Prescription</button>
                    </div>
                  </div>
                )}

                {activeTab === 'cert' && (
                  <div className="max-w-2xl space-y-6">
                    <form onSubmit={submitCertificate} className="space-y-4 bg-white p-6 rounded-xl border border-slate-200">
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Certificate Type</label>
                        <select required value={certForm.certificate_type} onChange={e => setCertForm({...certForm, certificate_type: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500">
                          <option value="sick_leave">Sick Leave / Excuse Duty</option>
                          <option value="medical_fitness">Certificate of Medical Fitness</option>
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">Start Date</label>
                          <input type="date" required value={certForm.start_date} onChange={e => setCertForm({...certForm, start_date: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                        </div>
                        <div>
                          <label className="block text-sm font-bold text-slate-700 mb-1">End Date</label>
                          <input type="date" required value={certForm.end_date} onChange={e => setCertForm({...certForm, end_date: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Doctor's Remarks</label>
                        <textarea rows="3" required value={certForm.remarks} onChange={e => setCertForm({...certForm, remarks: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"></textarea>
                      </div>
                      <button type="submit" className="w-full px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition flex justify-center items-center"><FileText className="mr-2 h-5 w-5"/> Generate Certificate</button>
                    </form>
                    <div className="bg-white p-6 rounded-xl border border-slate-200">
                      <h4 className="font-bold text-slate-800 mb-3">Previously Issued Certificates</h4>
                      {history.certificates.length === 0 ? <p className="text-sm text-slate-400">None on file.</p> : (
                        <div className="space-y-2">
                          {history.certificates.map(c => (
                            <div key={c.id} className="p-3 bg-slate-50 rounded-lg text-sm">
                              <span className="font-bold text-slate-800 capitalize">{c.certificate_type.replace('_',' ')}</span>
                              <span className="text-slate-500"> · {fmtDateOnly(c.start_date)} → {fmtDateOnly(c.end_date)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// LABORATORY DASHBOARD
// ============================================================================
function LabDashboard() {
  const [requests, setRequests] = useState([]);
  const [completed, setCompleted] = useState([]);
  const [activeRequest, setActiveRequest] = useState(null);
  const [resultForm, setResultForm] = useState({ findings: '', reference_range: '', remarks: '' });

  useEffect(() => { loadRequests(); loadCompleted(); }, []);

  const loadRequests = async () => {
    try { setRequests(await apiFetch('/api/lab/pending')); } catch (e) { console.error(e); }
  };
  const loadCompleted = async () => {
    try { setCompleted(await apiFetch('/api/lab/completed')); } catch (e) { console.error(e); }
  };

  const submitResults = async (e) => {
    e.preventDefault();
    try {
      await apiFetch(`/api/lab/results/${activeRequest.id}`, {
        method: 'PUT',
        body: JSON.stringify({ result_data: { ...resultForm, date_processed: new Date().toISOString() } })
      });
      alert('Lab Results successfully attached to Patient EMR!');
      setActiveRequest(null);
      setResultForm({ findings: '', reference_range: '', remarks: '' });
      loadRequests();
      loadCompleted();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold text-slate-900">Laboratory Operations</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[650px] flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-amber-50">
            <h3 className="font-bold text-amber-900 flex items-center"><AlertCircle className="h-5 w-5 mr-2 text-amber-600"/> Pending Tests ({requests.length})</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {requests.map(r => (
              <div key={r.id} onClick={() => setActiveRequest(r)} className={`p-4 rounded-xl cursor-pointer border ${activeRequest?.id === r.id ? 'bg-amber-50 border-amber-200' : 'hover:bg-slate-50 border-transparent'}`}>
                <div className="font-bold text-slate-900">{r.test_name}</div>
                <div className="text-sm text-slate-600 mt-1">Patient: {r.patient_name}</div>
                <div className="text-xs text-slate-400 mt-2 text-right">Req. by Dr. {r.doctor_name}</div>
              </div>
            ))}
            {requests.length === 0 && <p className="p-6 text-sm text-slate-400 text-center">No pending lab requests.</p>}
          </div>
          <div className="border-t border-slate-100 p-4 max-h-56 overflow-y-auto">
            <h4 className="text-xs font-bold text-slate-400 uppercase mb-2">Recently Completed</h4>
            {completed.slice(0, 6).map(c => (
              <div key={c.id} className="text-xs text-slate-500 py-1.5 flex justify-between">
                <span>{c.test_name} — {c.patient_name}</span>
                <span className="text-emerald-600 font-bold">✓</span>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-8 h-[650px]">
          {!activeRequest ? (
            <div className="h-full flex items-center justify-center text-slate-400 font-medium">Select a pending test from the list.</div>
          ) : (
            <div className="animate-in fade-in h-full flex flex-col">
              <div className="mb-6 pb-6 border-b border-slate-100">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">{activeRequest.test_name}</h2>
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Patient: <span className="font-bold text-slate-800">{activeRequest.patient_name}</span></span>
                  <span>Requested By: <span className="font-bold text-slate-800">Dr. {activeRequest.doctor_name}</span></span>
                </div>
              </div>
              <form onSubmit={submitResults} className="flex-1 flex flex-col space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Findings / Results</label>
                  <textarea required rows="5" value={resultForm.findings} onChange={e => setResultForm({...resultForm, findings: e.target.value})} placeholder="Input parameters and findings here..." className="w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 resize-none"></textarea>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Reference Range</label>
                    <input type="text" value={resultForm.reference_range} onChange={e => setResultForm({...resultForm, reference_range: e.target.value})} placeholder="e.g. Normal: 4.5–11.0" className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-2">Remarks</label>
                    <input type="text" value={resultForm.remarks} onChange={e => setResultForm({...resultForm, remarks: e.target.value})} placeholder="e.g. Recommend follow-up" className="w-full p-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500" />
                  </div>
                </div>
                <button type="submit" className="w-full py-4 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg transition text-lg mt-auto">Finalize & Submit Results</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// PHARMACIST DASHBOARD
// ============================================================================
function PharmacistDashboard({ activeTab, setActiveTab }) {
  const [queue, setQueue] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [invForm, setInvForm] = useState({ item_name: '', category: 'Drug', quantity: 0, unit_price: 0 });

  useEffect(() => {
    if (activeTab === 'queue') loadQueue();
    if (activeTab === 'inventory') loadInventory();
  }, [activeTab]);

  const loadQueue = async () => {
    try { setQueue(await apiFetch('/api/pharmacy/queue')); } catch (e) { console.error(e); }
  };

  const dispenseRx = async (id) => {
    if (!window.confirm("Are you sure you want to mark this as dispensed? This will deduct inventory and auto-generate a bill for Reception.")) return;
    try {
      const res = await apiFetch(`/api/pharmacy/dispense/${id}`, { method: 'PUT' });
      alert(res.message);
      loadQueue();
    } catch (e) { alert(e.message); }
  };

  const loadInventory = async () => {
    try { setInventory(await apiFetch('/api/inventory')); } catch (e) { console.error(e); }
  };

  const submitInventory = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/inventory', { method: 'POST', body: JSON.stringify(invForm) });
      alert('Inventory stock updated successfully!');
      setInvForm({ item_name: '', category: 'Drug', quantity: 0, unit_price: 0 });
      loadInventory();
    } catch (e) { alert(e.message); }
  };

  const lowStockCount = inventory.filter(i => i.quantity <= (i.reorder_level ?? 10)).length;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900">Pharmacy Operations</h1>
        <div className="flex bg-slate-200 p-1 rounded-xl">
          <button onClick={() => setActiveTab('queue')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'queue' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>E-Dispensary</button>
          <button onClick={() => setActiveTab('inventory')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'inventory' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Inventory Control</button>
        </div>
      </div>

      {activeTab === 'queue' ? (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {queue.length === 0 ? (
            <div className="p-12 text-center text-slate-400 font-medium">
              <CheckCircle2 className="h-16 w-16 mx-auto mb-4 text-emerald-200"/>
              No pending prescriptions. You are all caught up!
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {queue.map(rx => {
                const total = rx.items.reduce((sum, i) => sum + Number(i.unit_price) * i.quantity_prescribed, 0);
                const insufficientStock = rx.items.some(i => i.stock_available < i.quantity_prescribed);
                return (
                  <div key={rx.id} className="p-6 hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="font-bold text-lg text-slate-900">{rx.patient_name}</h3>
                        <span className="px-2.5 py-0.5 bg-rose-100 text-rose-700 text-xs font-bold rounded-full uppercase tracking-wide">Pending Rx</span>
                        {insufficientStock && <span className="px-2.5 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full uppercase tracking-wide">Stock Shortfall</span>}
                      </div>
                      <div className="text-sm text-slate-500 mb-4">Prescribed by Dr. {rx.doctor_name} on {fmtDate(rx.created_at)}</div>

                      <div className="bg-slate-100 rounded-lg p-4 grid gap-3">
                        {rx.items.map(item => (
                          <div key={item.id} className="flex items-center space-x-4 bg-white p-3 rounded shadow-sm border border-slate-200">
                            <Pill className="h-5 w-5 text-emerald-500 flex-shrink-0"/>
                            <div className="flex-1">
                              <div className="font-bold text-slate-800">{item.item_name}</div>
                              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">{item.dosage}</div>
                            </div>
                            <div className={`text-xs font-bold px-2 py-1 rounded ${item.stock_available < item.quantity_prescribed ? 'bg-red-50 text-red-600' : 'text-slate-400'}`}>{item.stock_available} in stock</div>
                            <div className="font-bold text-lg text-emerald-600 bg-emerald-50 px-3 py-1 rounded">×{item.quantity_prescribed}</div>
                          </div>
                        ))}
                      </div>
                      <div className="text-right text-sm font-bold text-slate-700 mt-2">Est. Total: {fmtMoney(total)}</div>
                    </div>

                    <button disabled={insufficientStock} onClick={() => dispenseRx(rx.id)} className="w-full md:w-auto px-8 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed">
                      <Check className="mr-2 h-5 w-5"/> Mark as Dispensed
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center"><Plus className="mr-2 h-5 w-5 text-emerald-600"/> Add / Restock Item</h2>
            {lowStockCount > 0 && (
              <div className="mb-4 flex items-center text-xs font-bold text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                <AlertCircle className="h-4 w-4 mr-2"/> {lowStockCount} item(s) at or below reorder level.
              </div>
            )}
            <form onSubmit={submitInventory} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Item Name</label>
                <input required type="text" value={invForm.item_name} onChange={e => setInvForm({...invForm, item_name: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
                <select required value={invForm.category} onChange={e => setInvForm({...invForm, category: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-emerald-500">
                  <option value="Drug">Drug / Medication</option>
                  <option value="Consumable">Consumable (Syringe, Gloves)</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Quantity to Add</label>
                <input required type="number" min="1" value={invForm.quantity} onChange={e => setInvForm({...invForm, quantity: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Unit Price (₦)</label>
                <input required type="number" min="0" value={invForm.unit_price} onChange={e => setInvForm({...invForm, unit_price: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-emerald-500" />
              </div>
              <button type="submit" className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg">Update Stock</button>
            </form>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center"><BarChart3 className="h-5 w-5 mr-2 text-slate-500"/> Current Stock Levels</h3>
            </div>
            <div className="overflow-y-auto flex-1 p-4">
              <table className="min-w-full divide-y divide-slate-200">
                <thead>
                  <tr>
                    <th className="text-left text-xs font-bold text-slate-500 uppercase pb-3">Item</th>
                    <th className="text-left text-xs font-bold text-slate-500 uppercase pb-3">Category</th>
                    <th className="text-right text-xs font-bold text-slate-500 uppercase pb-3">Stock Level</th>
                    <th className="text-right text-xs font-bold text-slate-500 uppercase pb-3">Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {inventory.map(item => (
                    <tr key={item.id}>
                      <td className="py-3 font-medium text-slate-900">{item.item_name}</td>
                      <td className="py-3 text-sm text-slate-500">{item.category}</td>
                      <td className="py-3 text-right">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${item.quantity <= (item.reorder_level ?? 10) ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {item.quantity} units
                        </span>
                      </td>
                      <td className="py-3 text-sm text-slate-500 text-right">{fmtMoney(item.unit_price)}</td>
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
