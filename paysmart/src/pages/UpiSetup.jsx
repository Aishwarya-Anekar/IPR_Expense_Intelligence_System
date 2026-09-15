// src/pages/UpiSetup.jsx
// After registration — user must set UPI PIN (mandatory) and link bank
import { useState } from 'react';
import styles from './UpiSetup.module.css';

const BANKS = [
  { name:'SBI',   logo:'🏛', color:'#1a56db' },
  { name:'HDFC',  logo:'🏦', color:'#e63946' },
  { name:'ICICI', logo:'🏢', color:'#f4a261' },
  { name:'Axis',  logo:'🏬', color:'#9b5de5' },
  { name:'Kotak', logo:'🏪', color:'#e76f51' },
  { name:'PNB',   logo:'🏗', color:'#2a9d8f' },
];

export default function UpiSetup({ user, onComplete }) {
  const [step,       setStep]       = useState(1); // 1=bank, 2=pin, 3=done
  const [selBank,    setSelBank]    = useState(null);
  const [accountNo,  setAccountNo]  = useState('');
  const [ifsc,       setIfsc]       = useState('');
  const [upi,        setUpi]        = useState(user?.upi || '');
  const [pin,        setPin]        = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error,      setError]      = useState('');
  const [saving,     setSaving]     = useState(false);

  function handleBankNext() {
    if (!selBank) { setError('Please select your bank'); return; }
    if (!accountNo) { setError('Please enter your account number'); return; }
    if (!ifsc) { setError('Please enter your IFSC code'); return; }
    if (!upi || !upi.includes('@') || upi.includes(' ')) { setError('Please enter a valid UPI ID'); return; }
    setError(''); setStep(2);
  }

  function handlePinNext() {
    if (pin.length !== 4) { setError('PIN must be exactly 4 digits'); return; }
    if (pin !== confirmPin) { setError('PINs do not match. Please re-enter.'); return; }
    setError(''); setStep(3);
  }

  async function handleComplete() {
    setSaving(true);
    setError('');
    try {
      await onComplete({ pin, bank_name: selBank.name, account_number: accountNo, ifsc_code: ifsc, upi });
    } catch (setupError) {
      setError(setupError.message || 'Could not complete UPI setup');
      setStep(2);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.card}>
        <div className={styles.brand}>💳 PaySmart</div>

        {/* Step bar */}
        <div className={styles.stepBar}>
          {['Link Bank','Set PIN','Done'].map((s,i) => (
            <div key={s} className={styles.stepItem}>
              <div className={`${styles.stepDot} ${step > i+1 ? styles.stepDone : step === i+1 ? styles.stepActive : ''}`}>
                {step > i+1 ? '✓' : i+1}
              </div>
              <span className={styles.stepLabel}>{s}</span>
              {i < 2 && <div className={`${styles.stepLine} ${step > i+1 ? styles.stepLineDone : ''}`}/>}
            </div>
          ))}
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {/* ── STEP 1: Bank */}
        {step === 1 && (
          <div className={styles.section}>
            <h2>Link your bank account 🏦</h2>
            <p className={styles.sub}>Select your bank to connect with PaySmart UPI</p>
            <div className={styles.bankGrid}>
              {BANKS.map(b => (
                <div key={b.name}
                  className={`${styles.bankCard} ${selBank?.name === b.name ? styles.bankSelected : ''}`}
                  style={selBank?.name === b.name ? { borderColor: b.color } : {}}
                  onClick={() => { setSelBank(b); setError(''); }}>
                  <span className={styles.bankLogo}>{b.logo}</span>
                  <span className={styles.bankName}>{b.name}</span>
                  {selBank?.name === b.name && <span className={styles.bankCheck} style={{color:b.color}}>✓</span>}
                </div>
              ))}
            </div>
            <div className={styles.inputWrap}>
              <label className={styles.label}>Account Number <span className={styles.req}>*</span></label>
              <input className={styles.input} placeholder="Enter your account number" type="number"
                value={accountNo} onChange={e => setAccountNo(e.target.value)}/>
            </div>
            <div className={styles.inputWrap}>
              <label className={styles.label}>IFSC Code <span className={styles.req}>*</span></label>
              <input className={styles.input} placeholder="e.g. SBIN0001234"
                style={{textTransform:'uppercase'}}
                value={ifsc} onChange={e => setIfsc(e.target.value.toUpperCase())}/>
            </div>
            <div className={styles.inputWrap}>
              <label className={styles.label}>UPI ID <span className={styles.req}>*</span></label>
              <input className={styles.input} placeholder="name@bank" value={upi}
                onChange={e => setUpi(e.target.value.toLowerCase())}/>
            </div>
            <button className={styles.btn} onClick={handleBankNext}>Next — Set UPI PIN →</button>
          </div>
        )}

        {/* ── STEP 2: PIN — mandatory, no skip */}
        {step === 2 && (
          <div className={styles.section}>
            <h2>Set your UPI PIN 🔐</h2>
            <p className={styles.sub}>This 4-digit PIN secures every payment you make</p>

            <div className={styles.mandatoryNote}>
              🔒 UPI PIN is required to complete any payment. Please set it now.
            </div>

            <div className={styles.pinSection}>
              <label className={styles.label}>Create PIN <span className={styles.req}>*</span></label>
              <div className={styles.pinDots}>
                {[0,1,2,3].map(i => (
                  <div key={i} className={`${styles.pinDot} ${pin.length > i ? styles.pinFilled : ''}`}/>
                ))}
              </div>
              <input className={styles.pinHidden} type="password" maxLength={4} autoFocus
                value={pin} onChange={e => { setPin(e.target.value.replace(/\D/,'')); setError(''); }}
                placeholder="Enter 4-digit PIN" inputMode="numeric"/>
            </div>

            <div className={styles.pinSection} style={{marginTop:24}}>
              <label className={styles.label}>Confirm PIN <span className={styles.req}>*</span></label>
              <div className={styles.pinDots}>
                {[0,1,2,3].map(i => (
                  <div key={i} className={`${styles.pinDot} ${confirmPin.length > i ? styles.pinFilled : ''}`}/>
                ))}
              </div>
              <input className={styles.pinHidden} type="password" maxLength={4}
                value={confirmPin} onChange={e => { setConfirmPin(e.target.value.replace(/\D/,'')); setError(''); }}
                placeholder="Confirm 4-digit PIN" inputMode="numeric"/>
            </div>

            <div className={styles.pinTip}>
              <span>💡</span> Never share your UPI PIN with anyone — not even bank employees
            </div>

            <div className={styles.btnRow}>
              <button className={styles.btnOutline} onClick={() => setStep(1)}>← Back</button>
              <button className={styles.btn} style={{flex:1}} onClick={handlePinNext}>Set PIN & Continue →</button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Done */}
        {step === 3 && (
          <div className={styles.section} style={{textAlign:'center'}}>
            <div className={styles.successAnim}>🎉</div>
            <h2>You're all set, {user?.firstname}!</h2>
            <p className={styles.sub}>Your PaySmart account is ready. Start paying and tracking with ML.</p>

            <div className={styles.setupSummary}>
              {[
                ['👤 Name',   `${user?.firstname} ${user?.lastname}`],
                ['📧 Email',  user?.email],
                ['🏦 Bank',   selBank?.name || '—'],
                ['🏧 UPI ID', upi],
                ['🔐 UPI PIN','✓ Set securely'],
                ['💰 Balance','₹24,580.00'],
              ].map(([k,v]) => (
                <div key={k} className={styles.summaryRow}>
                  <span>{k}</span><span>{v}</span>
                </div>
              ))}
            </div>

            <button className={styles.btn} onClick={handleComplete} disabled={saving}>
              {saving ? 'Saving setup...' : 'Go to PaySmart →'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
