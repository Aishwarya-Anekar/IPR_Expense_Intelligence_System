// src/components/Sidebar.jsx
import { useAuth } from '../context/AuthContext';
import styles from './Sidebar.module.css';

const NAV = [
  { id:'home',      icon:'🏠', label:'Home' },
  { id:'limits',    icon:'🎯', label:'Set Limits' },
  { id:'send',      icon:'💸', label:'Send Money' },
  { id:'qr',        icon:'📷', label:'QR Pay' },
  { id:'history',   icon:'📋', label:'History' },
  { id:'dashboard', icon:'📊', label:'Dashboard' },
  { id:'ml',        icon:'🤖', label:'ML Report' },
];

export default function Sidebar({ active, onNavigate }) {
  const { currentUser, logout } = useAuth();

  return (
    <nav className={styles.sidebar}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>💳</div>
      </div>

      {NAV.map(item => (
        <button
          key={item.id}
          className={`${styles.navBtn} ${active === item.id ? styles.active : ''}`}
          onClick={() => onNavigate(item.id)}
        >
          <span>{item.icon}</span>
          <span className={styles.tooltip}>{item.label}</span>
        </button>
      ))}

      <div className={styles.avatar} onClick={logout} title="Logout">
        <span>{currentUser?.firstname?.[0]?.toUpperCase() || 'U'}</span>
        <span className={styles.logoutTip}>Logout</span>
      </div>
    </nav>
  );
}
