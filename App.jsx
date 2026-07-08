import React, { useState, useEffect } from 'react';
import { 
  Activity, Users, Calendar, CreditCard, Pill, 
  LogOut, Check, X, Plus, ActivitySquare, Shield, 
  Stethoscope, Clock, FileText, ChevronRight,
  Search, Bell, Menu, BarChart3, TestTube, UserPlus, FileArchive,
  ClipboardList, Syringe, Save, CheckCircle2, History, AlertCircle
} from 'lucide-react';

const apiFetch = async (url, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = { 
    'Content-Type': 'application/json',
    ...options.headers
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error || 'An error occurred with the API request');
  }
  return data;
};

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      setCurrentUser(JSON.parse(user));
    }
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

  if (!currentUser) return <AuthPage onSuccess={handleLoginSuccess} />;
  
  return (
    <DashboardLayout user={currentUser} onLogout={handleLogout}>
      {currentUser.role === 'admin' && <AdminDashboard />}
      {currentUser.role === 'receptionist' && <ReceptionistDashboard />}
      {currentUser.role === 'nurse' && <NurseDashboard />}
      {currentUser.role === 'doctor' && <DoctorDashboard />}
      {currentUser.role === 'lab_tech' && <LabDashboard />}
      {currentUser.role === 'pharmacist' && <PharmacistDashboard />}
    </DashboardLayout>
  );
}

function AuthPage({ onSuccess }) {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const data = await apiFetch('/api/auth/login', { 
        method: 'POST', 
        body: JSON.stringify(formData) 
      });
      onSuccess(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        <div className="mx-auto h-20 w-20 bg-white rounded-2xl flex items-center justify-center shadow-xl mb-4">
          <ActivitySquare className="h-12 w-12 text-blue-600" />
        </div>
        <h2 className="text-3xl font-extrabold text-white tracking-tight">FUD HIMS Portal</h2>
        <p className="mt-2 text-blue-200">Health Information Management System</p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-2xl sm:rounded-2xl sm:px-10 border border-slate-100">
          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md flex items-center">
                <X className="h-5 w-5 text-red-500 mr-2"/>
                <span className="text-sm text-red-700">{error}</span>
              </div>
            )}
            
            <div>
              <label className="block text-sm font-medium text-slate-700">Email Address</label>
              <div className="mt-1">
                <input required type="email" onChange={e => setFormData({...formData, email: e.target.value})} 
                  className="appearance-none block w-full px-3 py-3 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Password</label>
              <div className="mt-1">
                <input required type="password" onChange={e => setFormData({...formData, password: e.target.value})} 
                  className="appearance-none block w-full px-3 py-3 border border-slate-300 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition" />
              </div>
            </div>

            <button type="submit" disabled={loading} 
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition disabled:opacity-50">
              {loading ? 'Authenticating...' : 'Secure Login'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function DashboardLayout({ children, user, onLogout }) {
  // Navigation mapping based on user roles
  const getNavItems = () => {
    const role = user?.role;
    const items = [{ icon: Activity, label: 'Dashboard' }];
    
    if (role === 'admin') items.push({ icon: Users, label: 'Staff Management' }, { icon: FileArchive, label: 'Audit Logs' });
    if (role === 'receptionist') items.push({ icon: UserPlus, label: 'Patient Registration' }, { icon: CreditCard, label: 'Billing & Invoices' });
    if (role === 'nurse') items.push({ icon: Clock, label: 'Triage Queue' }, { icon: Shield, label: 'Immunizations' });
    if (role === 'doctor') items.push({ icon: Stethoscope, label: 'Consultations' }, { icon: FileText, label: 'Certificates' });
    if (role === 'lab_tech') items.push({ icon: TestTube, label: 'Lab Requests' });
    if (role === 'pharmacist') items.push({ icon: Pill, label: 'Dispensary' }, { icon: BarChart3, label: 'Inventory' });

    return items;
  };

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      {/* Sidebar */}
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

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
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
              <span className="absolute top-1 right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>
        
        {/* Scrollable Workspace */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState({ totalPatients: 0, consultationsToday: 0, pendingLabs: 0, lowStock: 0 });
  const [logs, setLogs] = useState([]);
  const [users, setUsers] = useState([]);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', role: 'doctor' });

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
      alert('Staff created successfully.');
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold text-slate-900">System Overview</h1>
      
      {/* Analytics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
          { label: 'Total Patients', value: stats.totalPatients, icon: Users, color: 'text-blue-600', bg: 'bg-blue-100' },
          { label: 'Consultations Today', value: stats.consultationsToday, icon: Stethoscope, color: 'text-indigo-600', bg: 'bg-indigo-100' },
          { label: 'Pending Lab Tests', value: stats.pendingLabs, icon: TestTube, color: 'text-amber-600', bg: 'bg-amber-100' },
          { label: 'Low Stock Alerts', value: stats.lowStock, icon: BarChart3, color: 'text-red-600', bg: 'bg-red-100' },
        ].map((card, i) => (
          <div key={i} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center space-x-4">
            <div className={`p-4 rounded-xl ${card.bg}`}>
              <card.icon className={`h-8 w-8 ${card.color}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-slate-500">{card.label}</p>
              <h3 className="text-2xl font-bold text-slate-900">{card.value}</h3>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Create Staff Form */}
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

        {/* Immutable Audit Logs */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-6 overflow-hidden flex flex-col">
          <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center"><FileArchive className="mr-2 h-5 w-5 text-indigo-600"/> Security Audit Logs</h2>
          <div className="overflow-x-auto flex-1">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Target Table</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-slate-200">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition">
                    <td className="px-4 py-3 text-sm text-slate-500 whitespace-nowrap">{new Date(log.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3 text-sm font-medium text-slate-900">{log.acting_user || 'System'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                        log.action === 'INSERT' ? 'bg-green-100 text-green-700' :
                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'
                      }`}>{log.action}</span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-500">{log.table_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReceptionistDashboard() {
  const [activeTab, setActiveTab] = useState('register');
  const [patientForm, setPatientForm] = useState({ university_id: '', patient_type: 'student', full_name: '', dob: '', gender: 'Male', phone: '' });
  const [billingForm, setBillingForm] = useState({ patient_id: '', total_amount: '', purpose: '' });
  const [patients, setPatients] = useState([]);
  const [unpaidInvoices, setUnpaidInvoices] = useState([]);

  useEffect(() => {
    if (activeTab === 'billing') {
      apiFetch('/api/patients').then(setPatients).catch(e => console.error(e));
      loadInvoices();
    }
  }, [activeTab]);

  const loadInvoices = () => {
    apiFetch('/api/billing/unpaid').then(setUnpaidInvoices).catch(e => console.error(e));
  };

  const registerPatient = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/patients', { method: 'POST', body: JSON.stringify(patientForm) });
      alert('Patient successfully registered into the HIMS!');
      setPatientForm({ university_id: '', patient_type: 'student', full_name: '', dob: '', gender: 'Male', phone: '' });
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
    if(!window.confirm("Confirm payment received?")) return;
    try {
      await apiFetch(`/api/billing/${id}/pay`, { method: 'PUT' });
      alert('Payment verified and receipt generated.');
      loadInvoices();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900">Front Desk Operations</h1>
        <div className="flex bg-slate-200 p-1 rounded-xl">
          <button onClick={() => setActiveTab('register')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'register' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Registration</button>
          <button onClick={() => setActiveTab('billing')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'billing' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Billing & Payments</button>
        </div>
      </div>
      
      {activeTab === 'register' ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-3xl">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center border-b pb-4"><UserPlus className="mr-3 h-6 w-6 text-blue-600"/> New Patient Registration</h2>
          <form onSubmit={registerPatient} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="md:col-span-2 pt-4">
              <button type="submit" className="w-full md:w-auto px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200">Complete Registration</button>
            </div>
          </form>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center"><CreditCard className="mr-2 h-5 w-5 text-blue-600"/> Generate Invoice</h2>
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
                <input required type="text" placeholder="e.g. Lab Tests, Consultation" value={billingForm.purpose} onChange={e => setBillingForm({...billingForm, purpose: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Total Amount (₦)</label>
                <input required type="number" min="0" value={billingForm.total_amount} onChange={e => setBillingForm({...billingForm, total_amount: e.target.value})} className="w-full px-4 py-2 border border-slate-300 rounded-xl focus:ring-blue-500" />
              </div>
              <button type="submit" className="w-full py-3 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-900 transition shadow-lg">Create Invoice</button>
            </form>
          </div>
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Unpaid Invoices</h2>
            <div className="overflow-y-auto flex-1 space-y-3">
              {unpaidInvoices.length === 0 ? <p className="text-slate-400 text-sm">No pending payments.</p> : unpaidInvoices.map(inv => (
                <div key={inv.id} className="p-4 border border-slate-100 bg-slate-50 rounded-xl flex justify-between items-center">
                  <div>
                    <div className="font-bold text-slate-900">{inv.patient_name}</div>
                    <div className="text-xs text-slate-500">{inv.purpose}</div>
                    <div className="text-sm font-bold text-red-600 mt-1">₦{Number(inv.total_amount).toLocaleString()}</div>
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

function NurseDashboard() {
  const [activeTab, setActiveTab] = useState('triage');
  const [queue, setQueue] = useState([]);
  const [patients, setPatients] = useState([]);
  const [activePatient, setActivePatient] = useState(null);
  const [vitals, setVitals] = useState({ blood_pressure: '', temperature: '', weight: '', heart_rate: '' });
  const [immForm, setImmForm] = useState({ patient_id: '', vaccine_name: '', dose_number: '', next_due_date: '' });

  useEffect(() => { 
    if (activeTab === 'triage') loadQueue();
    if (activeTab === 'immunization') apiFetch('/api/patients').then(setPatients).catch(console.error);
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
      alert('Vitals logged securely! Patient has been moved to the Doctor\'s queue.');
      setActivePatient(null);
      setVitals({ blood_pressure: '', temperature: '', weight: '', heart_rate: '' });
      loadQueue();
    } catch (e) { alert(e.message); }
  };

  const submitImmunization = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/immunizations', { method: 'POST', body: JSON.stringify(immForm) });
      alert('Immunization record saved securely!');
      setImmForm({ patient_id: '', vaccine_name: '', dose_number: '', next_due_date: '' });
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900">Clinical Triage & Vitals</h1>
        <div className="flex bg-slate-200 p-1 rounded-xl">
          <button onClick={() => setActiveTab('triage')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'triage' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Triage Queue</button>
          <button onClick={() => setActiveTab('immunization')} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'immunization' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}>Immunizations</button>
        </div>
      </div>
      
      {activeTab === 'triage' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Waiting List */}
          <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[600px]">
            <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-slate-800 flex items-center"><Clock className="h-5 w-5 mr-2 text-blue-600"/> Triage Queue</h3>
              <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">{queue.length}</span>
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-2">
              {queue.length === 0 ? <p className="p-4 text-sm text-slate-500 text-center">Queue is empty.</p> : queue.map(p => (
                <div key={p.id} onClick={() => setActivePatient(p)} className={`p-4 rounded-xl cursor-pointer border transition-all duration-200 ${activePatient?.id === p.id ? 'bg-blue-50 border-blue-200 shadow-sm' : 'hover:bg-slate-50 border-transparent hover:border-slate-200'}`}>
                  <div className="font-bold text-slate-900">{p.patient_name}</div>
                  <div className="text-xs text-slate-400 mt-2 flex justify-between">
                    <span className="capitalize text-blue-600 font-medium">{p.patient_type}</span>
                    <span>{new Date(p.check_in_time).toLocaleTimeString()}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Vitals Form */}
          <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-8 h-[600px] flex flex-col">
            {!activePatient ? (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
                <Activity className="h-16 w-16 mb-4 text-slate-200" />
                <p className="font-medium text-lg text-slate-500">Select a patient from the queue to record vitals</p>
              </div>
            ) : (
              <form onSubmit={submitVitals} className="space-y-6 flex-1 flex flex-col">
                <div className="mb-2 pb-4 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="text-xl font-bold text-slate-800">{activePatient.patient_name}</h3>
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
        <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm max-w-2xl">
          <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center border-b pb-4"><Shield className="mr-3 h-6 w-6 text-emerald-600"/> Record Immunization</h2>
          <form onSubmit={submitImmunization} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Patient</label>
              <select required value={immForm.patient_id} onChange={e => setImmForm({...immForm, patient_id: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition">
                <option value="">Choose...</option>
                {patients.map(p => <option key={p.id} value={p.id}>{p.full_name} ({p.university_id})</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Vaccine Name</label>
                <input required type="text" placeholder="e.g. Hepatitis B, Covid-19" value={immForm.vaccine_name} onChange={e => setImmForm({...immForm, vaccine_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Dose Number</label>
                <input required type="text" placeholder="e.g. Dose 1, Booster" value={immForm.dose_number} onChange={e => setImmForm({...immForm, dose_number: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Next Due Date (Optional)</label>
              <input type="date" value={immForm.next_due_date} onChange={e => setImmForm({...immForm, next_due_date: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 transition" />
            </div>
            <button type="submit" className="w-full py-4 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition shadow-lg shadow-emerald-200">Save Vaccination Record</button>
          </form>
        </div>
      )}
    </div>
  );
}

function DoctorDashboard() {
  const [queue, setQueue] = useState([]);
  const [activePatient, setActivePatient] = useState(null);
  const [activeTab, setActiveTab] = useState('history'); // history, consult, lab, rx, cert
  const [history, setHistory] = useState({ consultations: [], vitals: [] });
  const [inventory, setInventory] = useState([]);
  
  const [consultForm, setConsultForm] = useState({ chief_complaint: '', diagnosis: '', treatment_plan: '', notes: '' });
  const [labForm, setLabForm] = useState({ test_name: '' });
  const [rxForm, setRxForm] = useState({ inventory_id: '', dosage: '', quantity_prescribed: 1 });
  const [certForm, setCertForm] = useState({ certificate_type: 'sick_leave', start_date: '', end_date: '', remarks: '' });

  useEffect(() => { 
    loadQueue();
    loadInventory();
  }, []);

  const loadQueue = async () => {
    try {
      const data = await apiFetch('/api/queue/active');
      setQueue(data.filter(q => q.status === 'waiting_doctor'));
    } catch (e) { console.error(e); }
  };

  const loadInventory = async () => {
    try {
      const data = await apiFetch('/api/inventory');
      setInventory(data);
    } catch (e) { console.error(e); }
  };

  const selectPatient = async (p) => {
    setActivePatient(p);
    setActiveTab('history');
    try {
      const data = await apiFetch(`/api/emr/history/${p.patient_id}`);
      setHistory(data);
    } catch (e) { console.error(e); }
  };

  const submitConsultation = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/consultations', { method: 'POST', body: JSON.stringify({ patient_id: activePatient.patient_id, ...consultForm }) });
      alert('Consultation Notes Saved!');
      setConsultForm({ chief_complaint: '', diagnosis: '', treatment_plan: '', notes: '' });
      selectPatient(activePatient); // Reload history
    } catch (e) { alert(e.message); }
  };

  const submitLabRequest = async (e) => {
    e.preventDefault();
    try {
      // Fetch latest consultation ID (simplification: ideally selected from list)
      const consId = history.consultations.length > 0 ? history.consultations[0].id : null;
      if (!consId) return alert('Save a consultation first before requesting labs.');
      await apiFetch('/api/lab/request', { method: 'POST', body: JSON.stringify({ patient_id: activePatient.patient_id, consultation_id: consId, test_name: labForm.test_name }) });
      alert('Lab Test Requested!');
      setLabForm({ test_name: '' });
    } catch (e) { alert(e.message); }
  };

  const submitPrescription = async (e) => {
    e.preventDefault();
    try {
      const consId = history.consultations.length > 0 ? history.consultations[0].id : null;
      if (!consId) return alert('Save a consultation first.');
      await apiFetch('/api/prescriptions', { method: 'POST', body: JSON.stringify({ patient_id: activePatient.patient_id, consultation_id: consId, items: [rxForm] }) });
      alert('E-Prescription Generated & Sent to Pharmacy!');
      setRxForm({ inventory_id: '', dosage: '', quantity_prescribed: 1 });
    } catch (e) { alert(e.message); }
  };

  const submitCertificate = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/certificates', { method: 'POST', body: JSON.stringify({ patient_id: activePatient.patient_id, ...certForm }) });
      alert('Medical Certificate officially generated!');
      setCertForm({ certificate_type: 'sick_leave', start_date: '', end_date: '', remarks: '' });
    } catch (e) { alert(e.message); }
  };

  const updateQueueStatus = async (status) => {
    try {
      await apiFetch(`/api/queue/${activePatient.id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      alert(`Patient routed to: ${status.replace('_', ' ')}`);
      setActivePatient(null);
      loadQueue();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-slate-900">Doctor's EMR Workspace</h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Waiting List */}
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[700px]">
          <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-slate-800 flex items-center"><Clock className="h-5 w-5 mr-2 text-indigo-600"/> Waiting Room</h3>
            <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2.5 py-1 rounded-full">{queue.length}</span>
          </div>
          <div className="overflow-y-auto flex-1 p-2 space-y-2">
            {queue.map(p => (
              <div key={p.id} onClick={() => selectPatient(p)} className={`p-4 rounded-xl cursor-pointer border transition-all duration-200 ${activePatient?.id === p.id ? 'bg-indigo-50 border-indigo-200 shadow-sm' : 'hover:bg-slate-50 border-transparent hover:border-slate-200'}`}>
                <div className="font-bold text-slate-900">{p.patient_name}</div>
                <div className="text-xs text-slate-400 mt-2">Arrived: {new Date(p.check_in_time).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </div>

        {/* EMR Main Area */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col h-[700px]">
          {!activePatient ? (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
              <Stethoscope className="h-16 w-16 mb-4 text-slate-200" />
              <p className="font-medium text-lg text-slate-500">Select a patient to open their Electronic Medical Record</p>
            </div>
          ) : (
            <div className="flex flex-col h-full animate-in fade-in">
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h2 className="text-2xl font-bold text-slate-900">{activePatient.patient_name}</h2>
                  <div className="flex space-x-4 text-sm text-slate-500 mt-1">
                    <span className="capitalize px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md font-medium">{activePatient.patient_type}</span>
                    <span>Patient ID: {activePatient.patient_id}</span>
                  </div>
                </div>
                
                {/* Routing Buttons */}
                <div className="flex space-x-2">
                  <button onClick={() => updateQueueStatus('waiting_lab')} className="px-4 py-2 bg-amber-100 text-amber-700 font-bold rounded-lg hover:bg-amber-200 transition text-sm flex items-center"><TestTube className="h-4 w-4 mr-2"/> Send to Lab</button>
                  <button onClick={() => updateQueueStatus('waiting_pharmacy')} className="px-4 py-2 bg-emerald-100 text-emerald-700 font-bold rounded-lg hover:bg-emerald-200 transition text-sm flex items-center"><Pill className="h-4 w-4 mr-2"/> Send to Pharmacy</button>
                  <button onClick={() => updateQueueStatus('completed')} className="px-4 py-2 bg-slate-800 text-white font-bold rounded-lg hover:bg-slate-900 transition text-sm flex items-center"><CheckCircle2 className="h-4 w-4 mr-2"/> Discharge</button>
                </div>
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

          {/* Tab Content Areas */}
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

                    <h4 className="font-bold text-slate-800 flex items-center mt-8"><FileText className="h-4 w-4 mr-2"/> Past Consultations</h4>
                    <div className="space-y-4">
                      {history.consultations.map(c => (
                        <div key={c.id} className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                          <div className="text-xs font-bold text-slate-400 mb-2 uppercase">{new Date(c.created_at).toLocaleDateString()} - Dr. {c.doctor_name}</div>
                          <div className="mb-3">
                            <span className="text-xs font-bold text-indigo-500 uppercase tracking-wider block mb-1">Chief Complaint</span>
                            <p className="text-slate-700 text-sm">{c.chief_complaint}</p>
                          </div>
                          <div>
                            <span className="text-xs font-bold text-green-500 uppercase tracking-wider block mb-1">Diagnosis</span>
                            <p className="text-slate-900 font-medium text-sm">{c.diagnosis}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {activeTab === 'consult' && (
                  <form onSubmit={submitConsultation} className="space-y-4 max-w-2xl">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Chief Complaint</label>
                      <textarea required rows="3" value={consultForm.chief_complaint} onChange={e => setConsultForm({...consultForm, chief_complaint: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"></textarea>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Clinical Diagnosis</label>
                      <input required type="text" value={consultForm.diagnosis} onChange={e => setConsultForm({...consultForm, diagnosis: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Treatment Plan</label>
                      <textarea required rows="3" value={consultForm.treatment_plan} onChange={e => setConsultForm({...consultForm, treatment_plan: e.target.value})} className="w-full px-4 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500"></textarea>
                    </div>
                    <button type="submit" className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-xl shadow-lg hover:bg-indigo-700 transition">Save Consultation Note</button>
                  </form>
                )}

                {activeTab === 'lab' && (
                  <form onSubmit={submitLabRequest} className="space-y-4 max-w-lg bg-white p-6 rounded-xl border border-slate-200">
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-1">Required Test</label>
                      <input required type="text" placeholder="e.g., Full Blood Count (FBC)" value={labForm.test_name} onChange={e => setLabForm({...labForm, test_name: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500" />
                    </div>
                    <button type="submit" className="w-full px-6 py-3 bg-amber-500 text-white font-bold rounded-xl shadow-lg hover:bg-amber-600 transition">Send Request to Lab</button>
                  </form>
                )}

                {activeTab === 'rx' && (
              <form onSubmit={submitPrescription} className="space-y-4 max-w-2xl bg-white p-6 rounded-xl border border-slate-200">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Select Medication</label>
                    <select required value={rxForm.inventory_id} onChange={e => setRxForm({...rxForm, inventory_id: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500">
                      <option value="">Select from Inventory...</option>
                      {inventory.map(i => <option key={i.id} value={i.id}>{i.item_name} ({i.quantity} in stock)</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-700 mb-1">Quantity</label>
                    <input required type="number" min="1" value={rxForm.quantity_prescribed} onChange={e => setRxForm({...rxForm, quantity_prescribed: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-sm font-bold text-slate-700 mb-1">Dosage Instructions</label>
                    <input required type="text" placeholder="e.g., 2 tablets daily for 5 days" value={rxForm.dosage} onChange={e => setRxForm({...rxForm, dosage: e.target.value})} className="w-full px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
                <button type="submit" className="w-full px-6 py-3 bg-emerald-600 text-white font-bold rounded-xl shadow-lg hover:bg-emerald-700 transition flex justify-center items-center"><Save className="mr-2 h-5 w-5"/> Sign & Send E-Prescription</button>
              </form>
            )}

            {activeTab === 'cert' && (
              <form onSubmit={submitCertificate} className="space-y-4 max-w-2xl bg-white p-6 rounded-xl border border-slate-200">
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
            )}
          </div>
        </div>
      )}
    </div>
  </div>
</div>
  );
}

function LabDashboard() {
  const [requests, setRequests] = useState([]);
  const [activeRequest, setActiveRequest] = useState(null);
  const [resultText, setResultText] = useState('');

  useEffect(() => { loadRequests(); }, []);
  const loadRequests = async () => {
    try {
      const data = await apiFetch('/api/lab/pending');
      setRequests(data);
    } catch (e) { console.error(e); }
  };

  const submitResults = async (e) => {
    e.preventDefault();
    try {
      // Wrap simple text input into structured JSON for the schema
      await apiFetch(`/api/lab/results/${activeRequest.id}`, {
        method: 'PUT',
        body: JSON.stringify({ result_data: { findings: resultText, date_processed: new Date().toISOString() } })
      });
      alert('Lab Results successfully securely attached to Patient EMR!');
      setActiveRequest(null);
      setResultText('');
      loadRequests();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <h1 className="text-3xl font-bold text-slate-900">Laboratory Operations</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[600px] flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-amber-50">
            <h3 className="font-bold text-amber-900 flex items-center"><AlertCircle className="h-5 w-5 mr-2 text-amber-600"/> Pending Tests</h3>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-2">
            {requests.map(r => (
              <div key={r.id} onClick={() => setActiveRequest(r)} className={`p-4 rounded-xl cursor-pointer border ${activeRequest?.id === r.id ? 'bg-amber-50 border-amber-200' : 'hover:bg-slate-50 border-transparent'}`}>
                <div className="font-bold text-slate-900">{r.test_name}</div>
                <div className="text-sm text-slate-600 mt-1">Patient: {r.patient_name}</div>
                <div className="text-xs text-slate-400 mt-2 text-right">Req. by Dr. {r.doctor_name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 shadow-sm p-8 h-[600px]">
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
              <form onSubmit={submitResults} className="flex-1 flex flex-col">
                <label className="block text-sm font-bold text-slate-700 mb-2">Detailed Results / Findings</label>
                <textarea required value={resultText} onChange={e => setResultText(e.target.value)} placeholder="Input parameters and findings here..." className="flex-1 w-full p-4 border border-slate-300 rounded-xl focus:ring-2 focus:ring-amber-500 resize-none mb-6"></textarea>
                <button type="submit" className="w-full py-4 bg-amber-500 text-white font-bold rounded-xl hover:bg-amber-600 shadow-lg transition text-lg">Finalize & Submit Results</button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PharmacistDashboard() {
  const [activeTab, setActiveTab] = useState('queue');
  const [queue, setQueue] = useState([]);
  const [inventory, setInventory] = useState([]);
  const [invForm, setInvForm] = useState({ item_name: '', category: 'Drug', quantity: 0, unit_price: 0 });
  
  useEffect(() => { 
    if(activeTab === 'queue') loadQueue(); 
    if(activeTab === 'inventory') loadInventory();
  }, [activeTab]);

  const loadQueue = async () => {
    try {
      const data = await apiFetch('/api/pharmacy/queue');
      setQueue(data);
    } catch (e) { console.error(e); }
  };

  const dispenseRx = async (id) => {
    if(!window.confirm("Are you sure you want to mark this as dispensed? This will deduct the inventory items automatically.")) return;
    try {
      await apiFetch(`/api/pharmacy/dispense/${id}`, { method: 'PUT' });
      alert('Medications successfully dispensed. Inventory has been updated automatically.');
      loadQueue();
    } catch (e) { alert(e.message); }
  };

  const loadInventory = async () => {
    try {
      const data = await apiFetch('/api/inventory');
      setInventory(data);
    } catch (e) { console.error(e); }
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
              {queue.map(rx => (
                <div key={rx.id} className="p-6 hover:bg-slate-50 transition flex flex-col md:flex-row md:items-center justify-between gap-6">
                  <div>
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-bold text-lg text-slate-900">{rx.patient_name}</h3>
                      <span className="px-2.5 py-0.5 bg-rose-100 text-rose-700 text-xs font-bold rounded-full uppercase tracking-wide">Pending Rx</span>
                    </div>
                    <div className="text-sm text-slate-500 mb-4">Prescribed by Dr. {rx.doctor_name} on {new Date(rx.created_at).toLocaleString()}</div>
                    
                    {/* Prescription Items */}
                    <div className="bg-slate-100 rounded-lg p-4 grid gap-3">
                      {rx.items.map(item => (
                        <div key={item.id} className="flex items-center space-x-4 bg-white p-3 rounded shadow-sm border border-slate-200">
                          <Pill className="h-5 w-5 text-emerald-500 flex-shrink-0"/>
                          <div className="flex-1">
                            <div className="font-bold text-slate-800">{item.item_name}</div>
                            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">{item.dosage}</div>
                          </div>
                          <div className="font-bold text-lg text-emerald-600 bg-emerald-50 px-3 py-1 rounded">x{item.quantity_prescribed}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  <button onClick={() => dispenseRx(rx.id)} className="w-full md:w-auto px-8 py-4 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 shadow-lg shadow-emerald-200 transition flex items-center justify-center">
                    <Check className="mr-2 h-5 w-5"/> Mark as Dispensed
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
            <h2 className="text-lg font-bold text-slate-900 mb-6 flex items-center"><Plus className="mr-2 h-5 w-5 text-emerald-600"/> Add / Restock Item</h2>
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
                        <span className={`px-2 py-1 rounded text-xs font-bold ${item.quantity < 10 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                          {item.quantity} units
                        </span>
                      </td>
                      <td className="py-3 text-sm text-slate-500 text-right">₦{item.unit_price}</td>
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
