import React, { useState, useEffect } from 'react';
import { 
  Activity, Users, Calendar, CreditCard, Pill, 
  LogOut, Check, X, Plus, ActivitySquare, Shield, 
  Stethoscope, Clock, FileText, ChevronRight
} from 'lucide-react';

// Centralized API Fetch Utility handling JWT Authentication
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
  const [view, setView] = useState('landing'); // landing, login, dashboard, register
  const [isInitializing, setIsInitializing] = useState(true);

  // Check for existing session
  useEffect(() => {
    const token = localStorage.getItem('token');
    const user = localStorage.getItem('user');
    if (token && user) {
      setCurrentUser(JSON.parse(user));
      setView('dashboard');
    }
    setIsInitializing(false);
  }, []);

  const handleLoginSuccess = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    setCurrentUser(data.user);
    setView('dashboard');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setCurrentUser(null);
    setView('landing');
  };

  if (isInitializing) return <div className="flex h-screen items-center justify-center">Loading...</div>;

  if (view === 'landing') return <LandingPage setView={setView} />;
  if (view === 'login') return <AuthPage setView={setView} onSuccess={handleLoginSuccess} mode="login" />;
  if (view === 'register') return <AuthPage setView={setView} onSuccess={handleLoginSuccess} mode="register" />;
  
  return (
    <DashboardLayout user={currentUser} onLogout={handleLogout}>
      {currentUser?.role === 'admin' && <AdminDashboard />}
      {currentUser?.role === 'patient' && <PatientDashboard user={currentUser} />}
      {currentUser?.role === 'doctor' && <DoctorDashboard user={currentUser} />}
      {currentUser?.role === 'pharmacist' && <PharmacistDashboard />}
    </DashboardLayout>
  );
}

function LandingPage({ setView }) {
  return (
    <div className="min-h-screen bg-slate-50 font-sans flex flex-col">
      <header className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <div className="flex items-center space-x-2">
            <ActivitySquare className="h-8 w-8 text-blue-600" />
            <span className="text-2xl font-bold text-slate-800">FUD Health</span>
          </div>
          <div className="space-x-4">
            <button onClick={() => setView('login')} className="text-blue-600 font-medium hover:text-blue-800 transition">Login</button>
            <button onClick={() => setView('register')} className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-medium transition-colors">Sign Up</button>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <section className="max-w-7xl mx-auto px-4 py-20 flex flex-col md:flex-row items-center">
          <div className="md:w-1/2 pr-8">
            <h1 className="text-4xl md:text-5xl font-extrabold text-slate-900 leading-tight mb-6">
              Modern Healthcare Delivery for the FUD Community
            </h1>
            <p className="text-lg text-slate-600 mb-8">
              Experience seamless healthcare with our Online Hospital Management System. Book appointments, manage records, and receive care seamlessly.
            </p>
            <button onClick={() => setView('register')} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold text-lg shadow-lg flex items-center">
              Access Portal <ChevronRight className="ml-2 h-5 w-5" />
            </button>
          </div>
          <div className="md:w-1/2 mt-12 md:mt-0 relative">
            <img src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&w=800&q=80" alt="Hospital" className="rounded-2xl shadow-2xl object-cover h-[400px] w-full" />
          </div>
        </section>
      </main>
    </div>
  );
}

function AuthPage({ setView, onSuccess, mode }) {
  const [formData, setFormData] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    
    try {
      if (mode === 'register') {
        await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify(formData) });
        const loginData = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: formData.email, password: formData.password }) });
        onSuccess(loginData);
      } else {
        const loginData = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: formData.email, password: formData.password }) });
        onSuccess(loginData);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <ActivitySquare className="mx-auto h-12 w-12 text-blue-600" />
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {mode === 'login' ? 'Sign in to your account' : 'Create Patient Account'}
        </h2>
      </div>
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
        <form className="space-y-6" onSubmit={handleSubmit}>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}
          
          {mode === 'register' && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Full Name</label>
              <input type="text" required onChange={e => setFormData({...formData, name: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Email address</label>
            <input type="email" required onChange={e => setFormData({...formData, email: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Password</label>
            <input type="password" required onChange={e => setFormData({...formData, password: e.target.value})} className="mt-1 block w-full border border-gray-300 rounded-md py-2 px-3" />
          </div>
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition disabled:opacity-50">
            {loading ? 'Processing...' : (mode === 'login' ? 'Sign in' : 'Register')}
          </button>
        </form>
        <div className="mt-4 text-center">
          <button onClick={() => setView(mode === 'login' ? 'register' : 'login')} className="text-sm text-blue-600">
            {mode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DashboardLayout({ children, user, onLogout }) {
  return (
    <div className="flex h-screen bg-slate-100">
      <aside className="w-64 bg-slate-900 text-white flex flex-col">
        <div className="p-6 flex items-center space-x-3 border-b border-slate-800">
          <ActivitySquare className="h-8 w-8 text-blue-400" />
          <span className="text-xl font-bold">FUD Health</span>
        </div>
        <div className="p-4 flex-1">
          <div className="flex items-center space-x-3 mb-8">
            <div className="h-10 w-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-lg">
              {user?.name?.charAt(0)}
            </div>
            <div>
              <div className="font-medium text-sm truncate w-40">{user?.name}</div>
              <div className="text-xs text-blue-400 capitalize">{user?.role}</div>
            </div>
          </div>
          <nav className="space-y-2">
            <div className="bg-blue-600 text-white px-4 py-3 rounded-lg flex items-center space-x-3">
              <Activity className="h-5 w-5" />
              <span>Dashboard</span>
            </div>
          </nav>
        </div>
        <div className="p-4 border-t border-slate-800">
          <button onClick={onLogout} className="flex items-center space-x-3 text-slate-400 hover:text-white transition w-full py-2">
            <LogOut className="h-5 w-5" /> <span>Sign Out</span>
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-8">
        {children}
      </main>
    </div>
  );
}

function AdminDashboard() {
  const [payments, setPayments] = useState([]);
  const [staffForm, setStaffForm] = useState({ name: '', email: '', password: '', role: 'doctor' });

  useEffect(() => { loadPayments(); }, []);

  const loadPayments = async () => {
    try {
      const data = await apiFetch('/api/admin/payments');
      setPayments(data);
    } catch (e) { console.error(e); }
  };

  const handleVerify = async (id) => {
    try {
      await apiFetch(`/api/admin/payments/${id}/verify`, { method: 'PUT' });
      loadPayments();
    } catch (e) { alert(e.message); }
  };

  const handleAddStaff = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/admin/staff', { method: 'POST', body: JSON.stringify(staffForm) });
      alert('Staff added successfully!');
      setStaffForm({ name: '', email: '', password: '', role: 'doctor' });
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Administrator Dashboard</h1>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Payment Verification Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold flex items-center mb-4"><CreditCard className="mr-2 h-5 w-5 text-blue-600"/> Payment Verifications</h2>
          <div className="space-y-4">
            {payments.map(payment => (
              <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div>
                  <div className="font-semibold">{payment.patient_name}</div>
                  <div className="text-sm text-gray-500">₦{payment.amount} - {payment.purpose}</div>
                  {payment.receipt_no && <div className="text-xs text-green-600 mt-1">Receipt: {payment.receipt_no}</div>}
                </div>
                {payment.status === 'pending' ? (
                  <button onClick={() => handleVerify(payment.id)} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-md flex items-center text-sm">
                    <Check className="w-4 h-4 mr-1"/> Verify
                  </button>
                ) : (
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-md text-sm">Verified</span>
                )}
              </div>
            ))}
            {payments.length === 0 && <p className="text-gray-500 text-sm">No payments found.</p>}
          </div>
        </div>

        {/* Add Staff Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold flex items-center mb-4"><Users className="mr-2 h-5 w-5 text-blue-600"/> Add New Staff</h2>
          <form onSubmit={handleAddStaff} className="space-y-4">
            <input required type="text" placeholder="Full Name" value={staffForm.name} onChange={e => setStaffForm({...staffForm, name: e.target.value})} className="w-full border p-2 rounded" />
            <input required type="email" placeholder="Email Address" value={staffForm.email} onChange={e => setStaffForm({...staffForm, email: e.target.value})} className="w-full border p-2 rounded" />
            <input required type="password" placeholder="Temporary Password" value={staffForm.password} onChange={e => setStaffForm({...staffForm, password: e.target.value})} className="w-full border p-2 rounded" />
            <select value={staffForm.role} onChange={e => setStaffForm({...staffForm, role: e.target.value})} className="w-full border p-2 rounded">
              <option value="doctor">Doctor</option>
              <option value="pharmacist">Pharmacist</option>
            </select>
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">Create Staff Account</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function PatientDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [paymentForm, setPaymentForm] = useState({ amount: '', purpose: 'Consultation Fee' });
  const [apptForm, setApptForm] = useState({ doctor_id: '', appointment_date: '' });

  useEffect(() => {
    loadAppointments();
    loadDoctors();
  }, []);

  const loadAppointments = async () => {
    try { const data = await apiFetch('/api/patient/appointments'); setAppointments(data); } catch (e) { console.error(e); }
  };
  
  const loadDoctors = async () => {
    try { const data = await apiFetch('/api/doctors'); setDoctors(data); } catch (e) { console.error(e); }
  };

  const handleBookAppt = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/appointments', { method: 'POST', body: JSON.stringify(apptForm) });
      alert('Appointment requested!');
      loadAppointments();
    } catch (e) { alert(e.message); }
  };

  const handlePayment = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/payments', { method: 'POST', body: JSON.stringify(paymentForm) });
      alert('Payment submitted for verification!');
      setPaymentForm({ amount: '', purpose: 'Consultation Fee' });
    } catch (e) { alert(e.message); }
  };

  const cancelAppointment = async (id) => {
    try {
      await apiFetch(`/api/appointments/${id}/status`, { method: 'PUT', body: JSON.stringify({ status: 'cancelled' }) });
      loadAppointments();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Patient Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Appointments List */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 col-span-1 md:col-span-2">
          <h2 className="text-lg font-bold flex items-center mb-4"><Calendar className="mr-2 h-5 w-5 text-blue-600"/> My Appointments</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {appointments.map(apt => (
              <div key={apt.id} className="p-4 border rounded-lg flex justify-between items-center">
                <div>
                  <div className="font-semibold">{apt.doctor_name}</div>
                  <div className="text-sm text-gray-500">{new Date(apt.appointment_date).toLocaleString()}</div>
                  <span className={`text-xs px-2 py-1 rounded-full mt-2 inline-block ${apt.status === 'approved' ? 'bg-green-100 text-green-800' : apt.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {apt.status.toUpperCase()}
                  </span>
                </div>
                {apt.status === 'pending' && (
                  <button onClick={() => cancelAppointment(apt.id)} className="text-red-500 hover:text-red-700"><X className="w-5 h-5"/></button>
                )}
              </div>
            ))}
            {appointments.length === 0 && <p className="text-gray-500 text-sm">No appointments found.</p>}
          </div>
        </div>

        {/* Book Appointment Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold mb-4">Book New Appointment</h2>
          <form onSubmit={handleBookAppt} className="space-y-4">
            <select required value={apptForm.doctor_id} onChange={e => setApptForm({...apptForm, doctor_id: e.target.value})} className="w-full border p-2 rounded">
              <option value="">Select Doctor</option>
              {doctors.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
            <input required type="datetime-local" value={apptForm.appointment_date} onChange={e => setApptForm({...apptForm, appointment_date: e.target.value})} className="w-full border p-2 rounded" />
            <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">Book Appointment</button>
          </form>
        </div>

        {/* Make Payment Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold mb-4">Make Payment</h2>
          <form onSubmit={handlePayment} className="space-y-4">
            <input required type="number" placeholder="Amount (₦)" value={paymentForm.amount} onChange={e => setPaymentForm({...paymentForm, amount: e.target.value})} className="w-full border p-2 rounded" />
            <input required type="text" placeholder="Purpose (e.g. Consultation)" value={paymentForm.purpose} onChange={e => setPaymentForm({...paymentForm, purpose: e.target.value})} className="w-full border p-2 rounded" />
            <button type="submit" className="w-full bg-green-600 text-white py-2 rounded hover:bg-green-700">Submit Payment</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function DoctorDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [rxForm, setRxForm] = useState({ patient_id: '', medicine: '', dosage: '' });

  useEffect(() => { loadAppointments(); }, []);

  const loadAppointments = async () => {
    try { const data = await apiFetch('/api/doctor/appointments'); setAppointments(data); } catch (e) { console.error(e); }
  };

  const updateStatus = async (id, status) => {
    try {
      await apiFetch(`/api/appointments/${id}/status`, { method: 'PUT', body: JSON.stringify({ status }) });
      loadAppointments();
    } catch (e) { alert(e.message); }
  };

  const handlePrescription = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/prescriptions', { method: 'POST', body: JSON.stringify(rxForm) });
      alert('Prescription sent to pharmacy!');
      setRxForm({ patient_id: '', medicine: '', dosage: '' });
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Doctor Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Appointments Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold flex items-center mb-4"><Stethoscope className="mr-2 h-5 w-5 text-blue-600"/> Patient Appointments</h2>
          <div className="space-y-4">
            {appointments.map(apt => (
              <div key={apt.id} className="p-4 border rounded-lg">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <div className="font-bold">{apt.patient_name}</div>
                    <div className="text-sm text-gray-500">{new Date(apt.appointment_date).toLocaleString()}</div>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${apt.status === 'approved' ? 'bg-green-100 text-green-800' : apt.status === 'cancelled' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}`}>
                    {apt.status}
                  </span>
                </div>
                {apt.status === 'pending' && (
                  <div className="flex space-x-2 mt-3">
                    <button onClick={() => updateStatus(apt.id, 'approved')} className="flex-1 bg-green-50 text-green-700 py-1 rounded border border-green-200 text-sm hover:bg-green-100">Approve</button>
                    <button onClick={() => updateStatus(apt.id, 'cancelled')} className="flex-1 bg-red-50 text-red-700 py-1 rounded border border-red-200 text-sm hover:bg-red-100">Cancel</button>
                  </div>
                )}
                {apt.status === 'approved' && (
                  <button onClick={() => setRxForm({...rxForm, patient_id: apt.patient_id})} className="mt-3 w-full bg-blue-50 text-blue-700 py-1 rounded border border-blue-200 text-sm">Write Prescription</button>
                )}
              </div>
            ))}
            {appointments.length === 0 && <p className="text-gray-500 text-sm">No appointments scheduled.</p>}
          </div>
        </div>

        {/* Generate Prescription Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold flex items-center mb-4"><FileText className="mr-2 h-5 w-5 text-blue-600"/> Send Prescription</h2>
          <form onSubmit={handlePrescription} className="space-y-4">
            <div>
               <label className="text-sm text-gray-600">Patient ID (Select from approved appointments)</label>
               <input required type="text" value={rxForm.patient_id} readOnly className="w-full border p-2 rounded bg-gray-50" />
            </div>
            <input required type="text" placeholder="Medicine Name" value={rxForm.medicine} onChange={e => setRxForm({...rxForm, medicine: e.target.value})} className="w-full border p-2 rounded" />
            <input required type="text" placeholder="Dosage (e.g., 2 tabs twice daily)" value={rxForm.dosage} onChange={e => setRxForm({...rxForm, dosage: e.target.value})} className="w-full border p-2 rounded" />
            <button type="submit" disabled={!rxForm.patient_id} className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-50">Send to Pharmacy</button>
          </form>
        </div>
      </div>
    </div>
  );
}

function PharmacistDashboard() {
  const [inventory, setInventory] = useState([]);
  const [prescriptions, setPrescriptions] = useState([]);
  const [stockForm, setStockForm] = useState({ medicine_name: '', quantity: '' });

  useEffect(() => {
    loadInventory();
    loadPrescriptions();
  }, []);

  const loadInventory = async () => {
    try { const data = await apiFetch('/api/inventory'); setInventory(data); } catch (e) { console.error(e); }
  };
  const loadPrescriptions = async () => {
    try { const data = await apiFetch('/api/prescriptions'); setPrescriptions(data); } catch (e) { console.error(e); }
  };

  const handleUpdateStock = async (e) => {
    e.preventDefault();
    try {
      await apiFetch('/api/inventory', { method: 'POST', body: JSON.stringify(stockForm) });
      setStockForm({ medicine_name: '', quantity: '' });
      loadInventory();
    } catch (e) { alert(e.message); }
  };

  const dispenseMedicine = async (id) => {
    try {
      await apiFetch(`/api/prescriptions/${id}/dispense`, { method: 'PUT' });
      loadPrescriptions();
    } catch (e) { alert(e.message); }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Pharmacy Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Prescriptions to Dispense Card */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold flex items-center mb-4"><Pill className="mr-2 h-5 w-5 text-blue-600"/> Pending Prescriptions</h2>
          <div className="space-y-4">
            {prescriptions.map(rx => (
              <div key={rx.id} className="p-4 border rounded-lg border-l-4 border-l-blue-500">
                <div className="font-bold text-lg text-blue-900">{rx.medicine}</div>
                <div className="text-sm text-gray-600 mb-2">Dosage: {rx.dosage}</div>
                <div className="text-xs text-gray-500 mb-3">Patient: {rx.patient_name} | Dr. {rx.doctor_name}</div>
                <button onClick={() => dispenseMedicine(rx.id)} className="w-full bg-blue-100 text-blue-700 py-1.5 rounded-md font-medium text-sm hover:bg-blue-200 transition">
                  Mark as Dispensed
                </button>
              </div>
            ))}
            {prescriptions.length === 0 && <p className="text-gray-500 text-sm">No pending prescriptions.</p>}
          </div>
        </div>

        {/* Inventory Management Card */}
        <div className="space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold mb-4">Add / Update Stock</h2>
            <form onSubmit={handleUpdateStock} className="flex space-x-2">
              <input required type="text" placeholder="Medicine" value={stockForm.medicine_name} onChange={e => setStockForm({...stockForm, medicine_name: e.target.value})} className="flex-1 border p-2 rounded text-sm" />
              <input required type="number" placeholder="Qty" value={stockForm.quantity} onChange={e => setStockForm({...stockForm, quantity: e.target.value})} className="w-24 border p-2 rounded text-sm" />
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"><Plus className="w-5 h-5"/></button>
            </form>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-lg font-bold mb-4">Current Inventory</h2>
            <div className="max-h-64 overflow-y-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b bg-gray-50"><th className="p-2">Medicine</th><th className="p-2">Quantity</th></tr>
                </thead>
                <tbody>
                  {inventory.map(item => (
                    <tr key={item.id} className="border-b"><td className="p-2">{item.medicine_name}</td><td className="p-2">{item.quantity}</td></tr>
                  ))}
                  {inventory.length === 0 && <tr><td colSpan="2" className="p-2 text-gray-500">Inventory empty.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
