// src/pages/Home.jsx
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTransactions, CAT_META } from '../context/TransactionContext';
import styles from './Home.module.css';

const DEMO_PIN   = '1234';
const MONTH_NAME = new Date().toLocaleString('en-IN', { month:'long', year:'numeric' });

export default function Home({ onNavigate }) {
  const { currentUser }                                     = useAuth();
  const { transactions, balance,
          exceededCategories, warningCategories, catSpend } = useTransactions();

  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [balancePin,       setBalancePin]       = useState('');
  const [balancePinError,  setBalancePinError]  = useState('');
  const [balanceRevealed,  setBalanceRevealed]  = useState(false);
  // dismiss individual alerts
  const [dismissed, setDismissed] = useState(new Set());

  const displayBalance = balance || currentUser?.balance || 0;
  const hour     = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const today    = new Date().toLocaleDateString('en-IN', { weekday:'long', day:'numeric', month:'long' });

  const thisMonth  = new Date().getMonth();
  const thisYear   = new Date().getFullYear();
  const monthSpend = transactions
    .filter(t => { const d = new Date(t.date || t.time); return d.getMonth()===thisMonth && d.getFullYear()===thisYear; })
    .reduce((s,t) => s + t.amount, 0);

  const totalTxns = transactions.length;
  const topCat    = (() => {
    const cats = {};
    transactions.forEach(t => { cats[t.category] = (cats[t.category]||0)+t.amount; });
    return Object.entries(cats).sort((a,b)=>b[1]-a[1])[0]?.[0] || '—';
  })();

  // Visible alerts (not dismissed)
  const visibleExceeded = exceededCategories.filter(e => !dismissed.has('exc_'+e.cat));
  const visibleWarnings = warningCategories.filter(w => !dismissed.has('war_'+w.cat));
  const hasAlerts       = visibleExceeded.length > 0 || visibleWarnings.length > 0;

  function dismiss(key) { setDismissed(prev => new Set([...prev, key])); }

  function checkBalancePin() {
    if (verifyPin(balancePin)) { setBalancePinError(''); setBalanceRevealed(true); }
    else { setBalancePinError('❌ Incorrect UPI PIN. Please try again.'); setBalancePin(''); }
  }
  function closeBalance() { setShowBalanceModal(false); setBalancePin(''); setBalancePinError(''); setBalanceRevealed(false); }
  function openBalance()  { setBalanceRevealed(false); setBalancePin(''); setBalancePinError(''); setShowBalanceModal(true); }

  return (
    <div className={styles.page}>

      {/* ── CATEGORY LIMIT ALERTS (visible on home page) ── */}
      {visibleExceeded.map(e => {
        const meta = CAT_META[e.cat] || CAT_META['Other'];
        return (
          <div key={e.cat} className={styles.alertDanger}>
            <span className={styles.alertEmoji}>{meta.icon}</span>
            <div className={styles.alertBody}>
              <strong>🚨 {e.cat} limit exceeded!</strong>
              <p>You spent ₹{e.spent.toLocaleString('en-IN')} — ₹{e.over.toLocaleString('en-IN')} over your ₹{e.limit.toLocaleString('en-IN')} limit this month.</p>
              <span className={styles.alertAction} onClick={() => onNavigate('limits')}>View Limits →</span>
            </div>
            <button className={styles.alertClose} onClick={() => dismiss('exc_'+e.cat)}>✕</button>
          </div>
        );
      })}
      {visibleWarnings.map(w => {
        const meta = CAT_META[w.cat] || CAT_META['Other'];
        return (
          <div key={w.cat} className={styles.alertWarn}>
            <span className={styles.alertEmoji}>{meta.icon}</span>
            <div className={styles.alertBody}>
              <strong>⚠️ {w.cat} — {w.pct}% used</strong>
              <p>Spent ₹{w.spent.toLocaleString('en-IN')} of ₹{w.limit.toLocaleString('en-IN')} limit. You're getting close!</p>
              <span className={styles.alertAction} onClick={() => onNavigate('limits')}>View Limits →</span>
            </div>
            <button className={styles.alertClose} onClick={() => dismiss('war_'+w.cat)}>✕</button>
          </div>
        );
      })}

      {/* ── HEADER ── */}
      <div className={styles.header}>
        <div>
          <h1>{greeting}, {currentUser?.firstname} 👋</h1>
          <p>{today}</p>
        </div>
        <div className={styles.upiChip}><span>🏦</span><span>{currentUser?.upi || 'user@paysmart'}</span></div>
      </div>

      {/* ── HERO CARD ── */}
      <div className={styles.heroCard}>
        <div className={styles.heroOrb}/>
        <div className={styles.heroGrid}/>
        <div className={styles.heroBody}>
          <div className={styles.heroTag}>PAYSMART · AI-POWERED PAYMENTS</div>
          <h2 className={styles.heroTitle}>Your money,<br/>tracked intelligently.</h2>
          <p className={styles.heroSub}>Every payment is instantly categorized by ML — so you always know where your money goes.</p>

          <div className={styles.statRow}>
            <div className={styles.statPill}>
              <span className={styles.statIcon}>📅</span>
              <div>
                <div className={styles.statVal}>₹{monthSpend.toLocaleString('en-IN')}</div>
                <div className={styles.statLbl}>Spent in {new Date().toLocaleString('en-IN',{month:'short'})}</div>
              </div>
            </div>
            <div className={styles.statPill}>
              <span className={styles.statIcon}>🔢</span>
              <div>
                <div className={styles.statVal}>{totalTxns}</div>
                <div className={styles.statLbl}>Total payments</div>
              </div>
            </div>
            <div className={styles.statPill}>
              <span className={styles.statIcon}>🏆</span>
              <div>
                <div className={styles.statVal}>{topCat}</div>
                <div className={styles.statLbl}>Top category</div>
              </div>
            </div>
          </div>

          {/* Mini limit status strip — shows exceeded categories */}
          {hasAlerts && (
            <div className={styles.limitStrip}>
              <span className={styles.limitStripIcon}>🔔</span>
              <span className={styles.limitStripText}>
                {visibleExceeded.length > 0
                  ? `${visibleExceeded.length} category limit${visibleExceeded.length>1?'s':''} exceeded this month`
                  : `${visibleWarnings.length} category${visibleWarnings.length>1?'s are':' is'} near their limit`}
              </span>
              <span className={styles.limitStripLink} onClick={() => onNavigate('limits')}>Review →</span>
            </div>
          )}
        </div>

        <div className={styles.heroActions}>
          <button className={styles.heroBtn} onClick={() => onNavigate('send')}>💸 Send Money</button>
          <button className={styles.heroBtn} onClick={() => onNavigate('qr')}>📷 QR Pay</button>
          <button className={styles.heroBtn} onClick={openBalance}>👁 Check Balance</button>
          <button className={styles.heroBtn} onClick={() => onNavigate('limits')}>
            🎯 Set Limits{hasAlerts ? ' 🔴' : ''}
          </button>
        </div>
      </div>

      {/* ── QUICK ACTIONS ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Quick Actions</div>
        <div className={styles.quickGrid}>
          {[
            { icon:'📱', label:'Mobile Recharge', action:'send'      },
            { icon:'⚡', label:'Electricity',     action:'send'      },
            { icon:'📊', label:'Dashboard',       action:'dashboard' },
            { icon:'🎯', label:'Set Limits',      action:'limits'    },
          ].map((q,i) => (
            <div key={i} className={styles.quickItem} onClick={() => onNavigate(q.action)}>
              <span className={styles.quickIcon}>{q.icon}</span>
              <span className={styles.quickLabel}>{q.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── HOW IT WORKS ── */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>How PaySmart works</div>
        <div className={styles.howGrid}>
          {[
            { step:'1', icon:'💸', title:'Make a Payment',    desc:'Send money via UPI ID or mobile number to anyone, instantly.' },
            { step:'2', icon:'🤖', title:'ML Categorizes It', desc:'Our Random Forest model detects the category — Restaurant, Market, Transport and more.' },
            { step:'3', icon:'📊', title:'Track Spending',    desc:'View category-wise breakdown and monthly trends on your Dashboard.' },
            { step:'4', icon:'🎯', title:'Stay in Budget',    desc:'Set limits per category and get notified before you overspend.' },
          ].map(h => (
            <div key={h.step} className={styles.howCard}>
              <div className={styles.howStep}>{h.step}</div>
              <div className={styles.howIcon}>{h.icon}</div>
              <div className={styles.howTitle}>{h.title}</div>
              <div className={styles.howDesc}>{h.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── CHECK BALANCE MODAL ── */}
      {showBalanceModal && (
        <div className={styles.overlay} onClick={closeBalance}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <span className={styles.modalEmoji}>👁</span>
            {!balanceRevealed ? (
              <>
                <h3>Check Balance</h3>
                <p>Enter your UPI PIN to view your balance</p>
                <div className={styles.pinDots}>
                  {[0,1,2,3].map(i => (
                    <div key={i} className={`${styles.pinDot} ${balancePin.length>i ? styles.pinFilled : ''}`}/>
                  ))}
                </div>
                <input className={styles.pinInput} type="password" maxLength={4}
                  placeholder="Enter 4-digit PIN" inputMode="numeric" autoFocus
                  value={balancePin}
                  onChange={e => { setBalancePin(e.target.value.replace(/\D/,'')); setBalancePinError(''); }}
                  onKeyDown={e => e.key==='Enter' && checkBalancePin()}/>
                {balancePinError && <div className={styles.pinError}>{balancePinError}</div>}
                <div className={styles.modalBtns}>
                  <button className={styles.btnOutline} onClick={closeBalance}>Cancel</button>
                  <button className={styles.btnPrimary} onClick={checkBalancePin}>View Balance →</button>
                </div>
              </>
            ) : (
              <>
                <h3>Your Balance</h3>
                <div className={styles.balReveal}>
                  <span className={styles.balRupee}>₹</span>
                  <span className={styles.balAmt}>{displayBalance.toLocaleString('en-IN')}</span>
                </div>
                <div className={styles.balTable}>
                  <div className={styles.balRow}><span>UPI ID</span><span>{currentUser?.upi}</span></div>
                  <div className={styles.balRow}><span>Account</span><span>****4291</span></div>
                  <div className={styles.balRow}><span>Spent this month</span><span>₹{monthSpend.toLocaleString('en-IN')}</span></div>
                </div>
                <button className={styles.btnPrimary} style={{width:'100%'}} onClick={closeBalance}>Done</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
