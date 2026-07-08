import React, { useState, useEffect } from 'react';
import {
  Activity, Users, CreditCard, Pill,
  LogOut, Check, X, Plus, ActivitySquare, Shield,
  Stethoscope, Clock, FileText, Trash2,
  Search, Bell, Menu, BarChart3, TestTube, UserPlus, FileArchive,
  Syringe, Save, CheckCircle2, History, AlertCircle,
  DollarSign, UserCheck, UserX, ShoppingCart, Droplet,
  FlaskConical
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
export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

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
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
  };

  if (isInitializing) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <ActivitySquare className="animate-pulse h-16 w-16 text-blue-600" />
      </div>
    );
  }

  if (!currentUser) return <LandingPage onSuccess={handleLoginSuccess} />;

  return (
    <DashboardLayout user={currentUser} onLogout={handleLogout}>
      {currentUser.role === 'admin' && <AdminDashboard />}
      {currentUser.role === 'receptionist' && <ReceptionistDashboard currentUser={currentUser} />}
      {currentUser.role === 'nurse' && <NurseDashboard />}
      {currentUser.role === 'doctor' && <DoctorDashboard />}
      {currentUser.role === 'lab_tech' && <LabDashboard />}
      {currentUser.role === 'pharmacist' && <PharmacistDashboard />}
      {currentUser.role === 'patient' && <PatientNotice />}
    </DashboardLayout>
  );
}

function PatientNotice() {
  return (
    <div className="max-w-xl mx-auto mt-20 bg-white p-10 rounded-2xl border border-slate-200 shadow-sm text-center">
      <ActivitySquare className="h-14 w-14 text-blue-600 mx-auto mb-4" />
      <h2 className="text-xl font-bold text-slate-900 mb-2">Portal Account Active</h2>
      <p className="text-slate-500">Your patient portal account is registered. Please visit the Health Centre reception desk with your university ID to have your clinical record created and begin using FUD HIMS services.</p>
    </div>
  );
}

// ============================================================================
// LANDING / AUTH
// ============================================================================
function LandingPage({ onSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
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
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row font-sans">
      {/* Left Side - Hero & Branding */}
      <div className="md:w-[55%] bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white p-8 md:p-16 flex flex-col justify-between relative overflow-hidden">
        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white via-transparent to-transparent bg-[length:20px_20px]"></div>

        <div className="relative z-10">
          <div className="flex items-center space-x-3 mb-12">
            <div className="h-12 w-12 bg-white rounded-xl flex items-center justify-center shadow-lg">
              <ActivitySquare className="h-8 w-8 text-blue-600" />
            </div>
            <span className="text-2xl font-bold tracking-wider">FUD HIMS</span>
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold leading-tight mb-6">
            Next-Generation <br/><span className="text-blue-400">Healthcare Management</span>
          </h1>
          <p className="text-lg md:text-xl text-blue-100/80 mb-12 max-w-xl leading-relaxed">
            A comprehensive, robust, and secure Health Information Management System designed for the Federal University Dutse. Streamlining clinical workflows from triage to pharmacy.
          </p>

          <div className="grid grid-cols-2 gap-6 max-w-lg mb-12">
            {[
              { icon: Activity, label: "Real-time EMR" },
              { icon: Shield, label: "Audit & Security" },
              { icon: Users, label: "Queue Analytics" },
              { icon: Pill, label: "E-Dispensary" }
            ].map((feature, idx) => (
              <div key={idx} className="flex items-center space-x-3 text-blue-100">
                <div className="p-2 bg-white/10 rounded-lg"><feature.icon className="h-5 w-5"/></div>
                <span className="font-medium">{feature.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-2xl max-w-lg shadow-2xl">
          <div className="flex items-center space-x-2 mb-2">
            <AlertCircle className="h-5 w-5 text-amber-400" />
            <h3 className="font-bold text-lg text-white">MSc Evaluation Access</h3>
          </div>
          <p className="text-sm text-blue-100 mb-4">Click below to auto-fill the System Administrator credentials to evaluate the robust backend architecture and RBAC features.</p>
          <button onClick={autofillAdmin} type="button" className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/40 border border-blue-400/50 rounded-lg text-sm font-bold transition-all flex items-center">
            <CheckCircle2 className="h-4 w-4 mr-2"/> Auto-Fill Admin Credentials
          </button>
        </div>
      </div>

      {/* Right Side - Auth Forms */}
      <div className="md:w-[45%] flex items-center justify-center p-8 md:p-12 bg-white relative">
        <div className="w-full max-w-md animate-in fade-in slide-in-from-right-8 duration-700">

          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold text-slate-900 mb-2">Welcome Back</h2>
            <p className="text-slate-500">Access your secure portal</p>
          </div>

          <div className="flex p-1 bg-slate-100 rounded-xl mb-8">
            <button onClick={() => { setIsLogin(true); setError(''); setSuccessMsg(''); }} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${isLogin ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Sign In</button>
            <button onClick={() => { setIsLogin(false); setError(''); setSuccessMsg(''); }} className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all ${!isLogin ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>Create Patient Account</button>
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
              className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl shadow-lg shadow-blue-600/20 text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all disabled:opacity-70 mt-4">
              {loading ? (
                <ActivitySquare className="animate-spin h-5 w-5 mr-2" />
              ) : (
                isLogin ? 'Access Secure Portal' : 'Register Account'
              )}
            </button>
          </form>

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
function DashboardLayout({ children, user, onLogout }) {
  const getNavItems = () => {
    const role = user?.role;
    const items = [{ icon: Activity, label: 'Dashboard' }];
    if (role === 'admin') items.push({ icon: Users, label: 'Staff Management' }, { icon: FileArchive, label: 'Audit Logs' });
    if (role === 'receptionist') items.push({ icon: UserPlus, label: 'Patient Registration' }, { icon: Clock, label: 'Check-In' }, { icon: CreditCard, label: 'Billing & Invoices' });
    if (role === 'nurse') items.push({ icon: Clock, label: 'Triage Queue' }, { icon: Shield, label: 'Immunizations' });
    if (role === 'doctor') items.push({ icon: Stethoscope, label: 'EMR Workspace' }, { icon: FileText, label: 'Certificates' });
    if (role === 'lab_tech') items.push({ icon: TestTube, label: 'Lab Requests' });
    if (role === 'pharmacist') items.push({ icon: Pill, label: 'Dispensary' }, { icon: BarChart3, label: 'Inventory' });

    return items;
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <aside className="w-72 bg-slate-900 text-slate-300 flex flex-col shadow-2xl z-20">
        <div className="h-20 flex items-center px-6 border-b border-slate-800 bg-slate-950/50">
          <ActivitySquare className="h-8 w-8 text-blue-500 mr-3" />
          <span className="text-xl font-bold text-white tracking-wide">FUD HIMS</span>
        </div>

        <div className="p-6 flex items-center space-x-4 border-b border-slate-800">
          <div className="h-12 w-12 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-xl shadow-lg ring-2 ring-slate-800">
            {user?.name?.charAt(0)}
          </div>
          <div className="overflow-hidden">
            <div className="text-white font-medium truncate">{user?.name}</div>
            <div className="text-xs text-blue-400 font-semibold tracking-wider uppercase mt-0.5">{user?.role?.replace('_', ' ')}</div>
          </div>
        </div>

        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {getNavItems().map((item, idx) => (
            <button key={idx} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all duration-200 ${idx === 0 ? 'bg-blue-600 text-white shadow-md shadow-blue-900/20' : 'hover:bg-slate-800 hover:text-white'}`}>
              <item.icon className={`h-5 w-5 ${idx === 0 ? 'text-white' : 'text-slate-400'}`} />
              <span className="font-medium">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <button onClick={onLogout} className="w-full flex items-center justify-center space-x-2 px-4 py-3 rounded-xl hover:bg-red-500/10 hover:text-red-400 transition-colors text-slate-400 font-medium">
            <LogOut className="h-5 w-5" /> <span>Secure Logout</span>
          </button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 z-10 shadow-sm">
          <div className="flex items-center text-slate-500">
            <Menu className="h-6 w-6 cursor-pointer hover:text-slate-800 transition" />
            <span className="ml-4 text-sm font-medium">Federal University Dutse Health Centre</span>
          </div>
          <div className="flex items-center space-x-6">
            <div className="relative">
              <Search className="h-5 w-5 text-slate-400 absolute left-3 top-1/2 transform -translate-y-1/2" />
              <input type="text" placeholder="Search records..." className="pl-10 pr-4 py-2 bg-slate-100 border-transparent rounded-full text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all w-64" />
            </div>
            <button className="relative p-2 text-slate-400 hover:text-blue-600 transition">
              <Bell className="h-6 w-6" />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

// ============================================================================
// ADMIN DASHBOARD
// ============================================================================
function AdminDashboard() {
  const [stats, setStats] = useState({ totalPatients: 0, consultationsToday: 0, pendingLabs: 0, lowStock: 0, revenue: 0, lowStockItems: [] });
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', role: 'doctor' });
  const [tab, setTab] = useState('overview');

  useEffect(() => { loadData(); }, []);

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
        <div className="flex bg-slate-200 p-1 rounded-xl">
          <button onClick={() => setTab('overview')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'overview' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Overview</button>
          <button onClick={() => setTab('staff')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'staff' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Staff Directory</button>
          <button onClick={() => setTab('audit')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${tab === 'audit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Audit Logs</button>
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {[
          { label: 'Total Patients', value: stats.totalPatients, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
          { label: 'Consultations Today', value: stats.consultationsToday, icon: Stethoscope, color: 'text-indigo-600', bg: 'bg-indigo-100' },
          { label: 'Pending Lab Tests', value: stats.pendingLabs, icon: TestTube, color: 'text-amber-600', bg: 'bg-amber-100' },
          { label: 'Low Stock Alerts', value: stats.lowStock, icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-100' },
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
                  <option value="nurse">Nurse</option>
                  <option value="pharmacist">Pharmacist</option>
                  <option value="lab_tech">Lab Technician</option>
                  <option value="receptionist">Receptionist</option>
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
// RECEPTIONIST DASHBOARD
// ============================================================================
function ReceptionistDashboard() {
  const [activeTab, setActiveTab] = useState('register');
  const emptyPatientForm = { university_id: '', patient_type: 'student', full_name: '', dob: '', gender: 'Male', blood_group: '', genotype: '', allergies: '', phone: '', address: '' };
  const [patientForm, setPatientForm] = useState(emptyPatientForm);
  const [lastRegistered, setLastRegistered] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedPatient, setSelectedPatient] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [checkinForm, setCheckinForm] = useState({ assigned_doctor_id: '', priority: 'normal' });
  const [activeQueue, setActiveQueue] = useState([]);

  const [billingForm, setBillingForm] = useState({ patient_id: '', total_amount: '', purpose: '' });
  const [patients, setPatients] = useState([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);
  const [recentInvoices, setRecentInvoices] = useState([]);

  useEffect(() => {
    if (activeTab === 'checkin') {
      apiFetch('/api/staff/doctors').then(setDoctors).catch(console.error);
      loadQueue();
    }
    if (activeTab === 'billing') {
      apiFetch('/api/patients').then(setPatients).catch(console.error);
      loadInvoices();
    }
  }, [activeTab]);

  const loadQueue = () => apiFetch('/api/queue/active').then(setActiveQueue).catch(console.error);
  const loadInvoices = () => {
    apiFetch('/api/billing/unpaid').then(setUnpaidInvoices).catch(console.error);
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

  const generateInvoice = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/billing', { method: 'POST', body: JSON.stringify(billingForm) });
      alert('Invoice generated successfully!');
      setBillingForm({ patient_id: '', total_amount: '', purpose: '' });
      loadInvoices();
    } catch (e) { alert(e.message); }
  };

  const processPayment = async (id) => {
    if (!window.confirm("Confirm payment received?")) return;
    try {
      await apiFetch(`/api/billing/${id}/pay`, { method: 'PUT' });
      alert('Payment verified and receipt generated.');
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
        <div className="flex bg-slate-200 p-1 rounded-xl">
          <button onClick={() => setActiveTab('register')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'register' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Registration</button>
          <button onClick={() => setActiveTab('checkin')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'checkin' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Check-In</button>
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
                  <button onClick={() => processPayment(inv.id)} className="px-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition">Clear Payment</button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================================
// NURSE DASHBOARD
// ============================================================================
function NurseDashboard() {
  const [activeTab, setActiveTab] = useState('triage');
  const [queue, setQueue] = useState([]);
  const [activePatient, setActivePatient] = useState(null);
  const [vitals, setVitals] = useState({ blood_pressure: '', temperature: '', weight: '', heart_rate: '' });

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [immPatient, setImmPatient] = useState(null);
  const [immHistory, setImmHistory] = useState([]);
  const [immForm, setImmForm] = useState({ vaccine_name: '', dose_number: '', next_due_date: '' });

  useEffect(() => {
    if (activeTab === 'triage') loadQueue();
  }, [activeTab]);

  const loadQueue = async () => {
    try {
      const data = await apiFetch('/api/queue/active');
      setQueue(data.filter(q => q.status === 'waiting_triage'));
    } catch (e) { console.error(e); }
  };

  const submitVitals = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/vitals', {
        method: 'POST',
        body: JSON.stringify({ patient_id: activePatient.patient_id, ...vitals })
      });
      alert("Vitals logged securely! Patient has been moved to the Doctor's queue.");
      setActivePatient(null);
      setVitals({ blood_pressure: '', temperature: '', weight: '', heart_rate: '' });
      loadQueue();
    } catch (e) { alert(e.message); }
  };

  const runImmSearch = async (term) => {
    setSearchTerm(term);
    setImmPatient(null);
    setImmHistory([]);
    if (term.trim().length < 2) { setSearchResults([]); return; }
    try {
      const data = await apiFetch(`/api/patients?search=${encodeURIComponent(term)}`);
      setSearchResults(data);
    } catch (e) { console.error(e); }
  };

  const selectImmPatient = async (p) => {
    setImmPatient(p);
    setSearchResults([]);
    setSearchTerm(p.full_name);
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

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900">Nursing Station</h1>
        <div className="flex bg-slate-200 p-1 rounded-xl">
          <button onClick={() => setActiveTab('triage')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'triage' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Triage Queue</button>
          <button onClick={() => setActiveTab('immunization')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'immunization' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Immunizations</button>
        </div>
      </div>

      {activeTab === 'triage' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center"><Clock className="h-5 w-5 mr-2 text-blue-600"/> Waiting Triage</h3>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">{queue.length}</span>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-2">
              {queue.map(p => (
                <div key={p.id} onClick={() => setActivePatient(p)} className={`p-4 rounded-xl cursor-pointer border transition-all duration-200 ${activePatient?.id === p.id ? 'bg-blue-50 border-blue-200 shadow-sm' : 'hover:bg-slate-50 border-transparent hover:border-slate-200'}`}>
                  <div className="font-bold text-slate-900">{p.patient_name}</div>
                  <div className="text-xs text-slate-400 mt-2 flex justify-between">
                    <span className="capitalize text-blue-600 font-medium">{p.patient_type}</span>
                    <span>{new Date(p.check_in_time).toLocaleTimeString()}</span>
                  </div>
                  {p.priority === 'urgent' && <span className="inline-block mt-2 px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded-full">URGENT</span>}
                </div>
              ))}
              {queue.length === 0 && <p className="p-6 text-sm text-slate-400 text-center">No patients waiting for triage.</p>}
            </div>
          </div>

          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-8 h-[600px] flex flex-col">
            {!activePatient ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Activity className="h-16 w-16 mb-4 text-slate-200" />
                <p className="font-medium text-lg text-slate-500">Select a patient from the queue to record vitals</p>
              </div>
            ) : (
              <form onSubmit={submitVitals} className="space-y-6 flex-1 flex flex-col">
                <div className="mb-2 pb-4 border-b border-slate-100 flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-slate-800">{activePatient.patient_name}</h3>
                    <div className="text-xs text-slate-400 mt-1 flex items-center gap-3">
                      {activePatient.blood_group && <span className="flex items-center"><Droplet className="h-3 w-3 mr-1"/> {activePatient.blood_group}</span>}
                      {activePatient.gender && <span>{activePatient.gender}</span>}
                    </div>
                  </div>
                  <span className="bg-blue-100 text-blue-700 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">{activePatient.patient_type}</span>
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
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center border-b pb-4"><Search className="mr-3 h-5 w-5 text-emerald-600"/> Find Patient</h2>
            <input type="text" placeholder="Search by name or university ID..." value={searchTerm} onChange={e => runImmSearch(e.target.value)} className="w-full px-4 py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500 mb-3" />
            <div className="space-y-2 max-h-48 overflow-y-auto mb-4">
              {searchResults.map(p => (
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
    </div>
  );
}

// ============================================================================
// DOCTOR DASHBOARD — the core EMR workspace
// ============================================================================
function DoctorDashboard() {
  const [queue, setQueue] = useState([]);
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
  }, []);

  const loadQueue = async () => {
    try {
      const data = await apiFetch('/api/queue/active');
      setQueue(data.filter(q => q.status === 'waiting_doctor'));
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
function PharmacistDashboard() {
  const [activeTab, setActiveTab] = useState('queue');
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
