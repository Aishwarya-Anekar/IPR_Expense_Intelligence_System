import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { TransactionProvider } from './context/TransactionContext';
import Sidebar from './components/Sidebar';
import Auth from './pages/Auth';
import UpiSetup from './pages/UpiSetup';
import Home from './pages/Home';
import SendMoney from './pages/SendMoney';
import QR from './pages/QR';
import History from './pages/History';
import Dashboard from './pages/Dashboard';
import MLReport from './pages/MLReport';
import Limits from './pages/Limits';
import styles from './App.module.css';

const screenPath = id => `/${id}`;

function AuthRoutes() {
  return (
    <Routes>
      <Route path="/auth" element={<Auth />} />
      <Route path="*" element={<Navigate to="/auth" replace />} />
    </Routes>
  );
}

function SetupRoutes() {
  const { currentUser, completeSetup } = useAuth();
  return (
    <Routes>
      <Route path="*" element={<UpiSetup user={currentUser} onComplete={completeSetup} />} />
    </Routes>
  );
}

function ProtectedRoutes() {
  const { currentUser } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const active = location.pathname.split('/')[1] || 'home';
  const onNavigate = id => navigate(screenPath(id));

  return (
    <TransactionProvider userId={currentUser.id}>
      <div className={styles.app}>
        <Sidebar active={active} onNavigate={onNavigate} />
        <main className={styles.main}>
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<Home onNavigate={onNavigate} />} />
            <Route path="/send" element={<SendMoney onNavigate={onNavigate} />} />
            <Route path="/qr" element={<QR />} />
            <Route path="/history" element={<History />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/ml" element={<MLReport />} />
            <Route path="/limits" element={<Limits />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </main>
      </div>
    </TransactionProvider>
  );
}

function AppContent() {
  const { currentUser, needsSetup, loading } = useAuth();
  if (loading) return null;
  if (!currentUser) return <AuthRoutes />;
  if (needsSetup) return <SetupRoutes />;
  return <ProtectedRoutes />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}