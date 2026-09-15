// src/pages/Auth.jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './Auth.module.css';

export default function Auth() {
  const { login, register } = useAuth();
  const [tab, setTab]       = useState('login');
  const [error, setError]   = useState('');
  const [success, setSuccess] = useState('');
  const [strength, setStrength] = useState(0);

  const [loginData, setLoginData] = useState({ email:'', password:'' });
  const [regData, setRegData] = useState({
    firstname:'', lastname:'', email:'', phone:'', upi:'', password:'', confirm:''
  });

  function checkStrength(val) {
    let score = 0;
    if (val.length >= 6) score++;
    if (val.length >= 10) score++;
    if (/[A-Z]/.test(val) && /[0-9]/.test(val)) score++;
    if (/[^A-Za-z0-9]/.test(val)) score++;
    setStrength(score);
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!loginData.email || !loginData.password) { setError('❌ Please enter your email and password.'); return; }
    try {
      await login(loginData.email, loginData.password);
    } catch (err) {
      if (err.message?.toLowerCase().includes('invalid') || err.message?.toLowerCase().includes('not found')) {
        setError('❌ No account found with this email. Please register first.');
      } else {
        setError('❌ ' + (err.message || 'Login failed. Please try again.'));
      }
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setError(''); setSuccess('');
    if (!regData.firstname || !regData.email || !regData.password) {
      setError('❌ Please fill in all required fields.'); return;
    }
    if (regData.password !== regData.confirm) {
      setError('❌ Passwords do not match.'); return;
    }
    if (regData.password.length < 6) {
      setError('❌ Password must be at least 6 characters.'); return;
    }
    try {
      await register(regData);
    } catch (err) {
      setError('❌ ' + (err.message || 'Registration failed.'));
    }
  }

  const strengthColors = ['#f95f7a','#fbb040','#7c6dfa','#32d583'];
  const strengthLabels = ['Weak','Fair','Good','Strong'];

  return (
    <div className={styles.wrapper}>
      {/* Left Panel */}
      <div className={styles.left}>
        <div className={styles.grid}/>
        <div className={styles.brand}>Pay<span>Smart</span></div>
        <p className={styles.tagline}>The smarter way to pay and track your expenses with AI</p>
        <div className={styles.features}>
          {[
            { icon:'🤖', text:'ML auto-categorizes every payment instantly' },
            { icon:'📊', text:'Monthly expense dashboard with live charts' },
            { icon:'⚡', text:'UPI payments as fast as GPay & PhonePe' },
            { icon:'🔔', text:'Smart budget alerts when you overspend' },
          ].map((f,i) => (
            <div key={i} className={styles.feature}>
              <span className={styles.featureIcon}>{f.icon}</span>
              <span className={styles.featureText}>{f.text}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel */}
      <div className={styles.right}>
        <div className={styles.tabs}>
          <button className={`${styles.tab} ${tab==='login'?styles.activeTab:''}`}
            onClick={() => { setTab('login'); setError(''); setSuccess(''); }}>Login</button>
          <button className={`${styles.tab} ${tab==='register'?styles.activeTab:''}`}
            onClick={() => { setTab('register'); setError(''); setSuccess(''); }}>Register</button>
        </div>

        {error   && (
          <div className={styles.error}>{error}
            {error.includes('register') &&
              <span className={styles.errorLink} onClick={() => { setTab('register'); setError(''); }}>
                → Create account now
              </span>}
          </div>
        )}
        {success && <div className={styles.successMsg}>{success}</div>}

        {/* LOGIN */}
        {tab === 'login' && (
          <form className={styles.form} onSubmit={handleLogin}>
            <h2>Welcome back 👋</h2>
            <p className={styles.sub}>Login to your PaySmart account</p>

            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>📧</span>
              <input className={styles.input} type="email" placeholder="Email address" required
                value={loginData.email} onChange={e => setLoginData({...loginData, email:e.target.value})}/>
            </div>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>🔒</span>
              <input className={styles.input} type="password" placeholder="Password" required
                value={loginData.password} onChange={e => setLoginData({...loginData, password:e.target.value})}/>
            </div>

            <div className={styles.newUserHint}>
              New to PaySmart?{' '}
              <span onClick={() => { setTab('register'); setError(''); }}>Create an account first →</span>
            </div>

            <button type="submit" className={styles.btn}>Login to PaySmart →</button>

            <p className={styles.switchText}>
              Don't have an account? <span onClick={() => { setTab('register'); setError(''); }}>Register here</span>
            </p>
          </form>
        )}

        {/* REGISTER — no UPI ID field, no demo */}
        {tab === 'register' && (
          <form className={styles.form} onSubmit={handleRegister}>
            <h2>Create account ✨</h2>
            <p className={styles.sub}>Join PaySmart — it's free</p>

            <div className={styles.row2}>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>👤</span>
                <input className={styles.input} placeholder="First name" required
                  value={regData.firstname} onChange={e => setRegData({...regData, firstname:e.target.value})}/>
              </div>
              <div className={styles.inputWrap}>
                <span className={styles.inputIcon}>👤</span>
                <input className={styles.input} placeholder="Last name"
                  value={regData.lastname} onChange={e => setRegData({...regData, lastname:e.target.value})}/>
              </div>
            </div>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>📧</span>
              <input className={styles.input} type="email" placeholder="Email address" required
                value={regData.email} onChange={e => setRegData({...regData, email:e.target.value})}/>
            </div>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>📱</span>
              <input className={styles.input} placeholder="Mobile number (10 digits)"
                value={regData.phone} onChange={e => setRegData({...regData, phone:e.target.value})}/>
            </div>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>💸</span>
              <input className={styles.input} placeholder="UPI ID (e.g. name@bank)" required
                value={regData.upi} onChange={e => setRegData({...regData, upi:e.target.value.toLowerCase()})}/>
            </div>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>🔒</span>
              <input className={styles.input} type="password" placeholder="Create password" required
                value={regData.password} onChange={e => { setRegData({...regData, password:e.target.value}); checkStrength(e.target.value); }}/>
            </div>
            <div className={styles.strengthBar}>
              {[0,1,2,3].map(i => (
                <div key={i} className={styles.strengthSeg}
                  style={{ background: i < strength ? strengthColors[strength-1] : 'var(--surface3)' }}/>
              ))}
            </div>
            <p className={styles.strengthLabel} style={{ color: strength ? strengthColors[strength-1] : 'var(--muted)' }}>
              {regData.password ? `Password strength: ${strengthLabels[strength-1]||'Weak'}` : 'Enter a password'}
            </p>
            <div className={styles.inputWrap}>
              <span className={styles.inputIcon}>🔒</span>
              <input className={styles.input} type="password" placeholder="Confirm password" required
                value={regData.confirm} onChange={e => setRegData({...regData, confirm:e.target.value})}/>
            </div>

            <button type="submit" className={styles.btn}>Create My Account →</button>
            <p className={styles.terms}>By registering you agree to our <a href="#">Terms</a> and <a href="#">Privacy Policy</a></p>
            <p className={styles.switchText}>
              Already have an account? <span onClick={() => { setTab('login'); setError(''); }}>Login here</span>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
