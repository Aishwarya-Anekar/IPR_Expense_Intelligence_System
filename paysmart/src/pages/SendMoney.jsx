// src/pages/SendMoney.jsx
import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTransactions, CAT_META } from '../context/TransactionContext';
import styles from './SendMoney.module.css';

const CONTACTS = [
  { name:'Rahul',     upi:'rahul@upi',     mobile:'9876543210', color:'rgba(249,95,122,0.2)', text:'#f95f7a' },
  { name:'Priya',     upi:'priya@upi',     mobile:'9123456780', color:'rgba(50,213,131,0.2)',  text:'#32d583' },
  { name:'Amit',      upi:'amit@upi',      mobile:'9988776655', color:'rgba(56,189,248,0.2)',  text:'#38bdf8' },
  { name:'Sneha',     upi:'sneha@upi',     mobile:'9871234560', color:'rgba(251,176,64,0.2)',  text:'#fbb040' },
  { name:'Zomato',    upi:'zomato@upi',    mobile:'',           color:'rgba(249,95,122,0.2)',  text:'#f95f7a' },
  { name:'DMart',     upi:'dmart@upi',     mobile:'',           color:'rgba(50,213,131,0.2)',  text:'#32d583' },
  { name:'OlaCabs',   upi:'ola@upi',       mobile:'',           color:'rgba(124,109,250,0.2)', text:'#7c6dfa' },
  { name:'Starbucks', upi:'starbucks@upi', mobile:'',           color:'rgba(251,176,64,0.2)',  text:'#fbb040' },
];

const CATEGORIES = [
  { name:'Restaurant',      icon:'🍽' },
  { name:'Market',          icon:'🛒' },
  { name:'Food',            icon:'🍔' },
  { name:'Transport',       icon:'🚗' },
  { name:'Business',        icon:'💼' },
  { name:'Mobile Recharge', icon:'📱' },
  { name:'Electricity',     icon:'⚡' },
  { name:'Medicines',       icon:'💊' },
  { name:'Hospital',        icon:'🏥' },
  { name:'Stationary',      icon:'✏️' },
  { name:'Entertainment',   icon:'🎬' },
  { name:'Education',       icon:'📚' },
  { name:'Custom',          icon:'➕' },
];

export default function SendMoney({ onNavigate }) {
  const { verifyPin } = useAuth();
  const { transactions, mlPredict, addTransaction, categoryLimits, catSpend } = useTransactions();

  const [sendMode,   setSendMode]   = useState('upi');
  const [recipient,  setRecipient]  = useState('');
  const [note,       setNote]       = useState('');
  const [amount,     setAmount]     = useState('');

  // Category state
  const [prediction,      setPrediction]      = useState(null);  // ML / auto-suggest
  const [manualCat,       setManualCat]       = useState(null);  // manually chosen by user
  const [catRequired,     setCatRequired]     = useState(false); // true when reason differs from past
  const [showCatPicker,   setShowCatPicker]   = useState(false);
  const [customCatMode,   setCustomCatMode]   = useState(false);
  const [customCatName,   setCustomCatName]   = useState('');

  // Contacts
  const [showContacts, setShowContacts] = useState(false);

  // PIN
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin,          setPin]          = useState('');
  const [pinError,     setPinError]     = useState('');

  // Success
  const [showSuccess, setShowSuccess] = useState(false);
  const [lastTxn,     setLastTxn]     = useState(null);

  // The final chosen category (manual overrides ML)
  const chosenCat  = manualCat || prediction;

  // ── Inline limit status — computed live as category + amount changes
  const limitStatus = (() => {
    const cat    = chosenCat?.category;
    if (!cat) return null;
    const limit  = categoryLimits[cat];
    if (!limit) return null;
    const spent  = catSpend[cat] || 0;
    const payAmt = parseFloat(amount) || 0;
    const pct    = Math.round((spent / limit) * 100);
    if (spent >= limit) {
      return {
        type: 'exceeded',
        cat, limit, spent,
        over: spent - limit,
        meta: CAT_META[cat] || CAT_META['Other'],
      };
    }
    if (payAmt > 0 && spent + payAmt > limit) {
      return {
        type: 'will_exceed',
        cat, limit, spent, payAmt,
        exceedBy: spent + payAmt - limit,
        meta: CAT_META[cat] || CAT_META['Other'],
      };
    }
    if (pct >= 80) {
      return {
        type: 'warning',
        cat, limit, spent,
        remaining: limit - spent,
        pct,
        meta: CAT_META[cat] || CAT_META['Other'],
      };
    }
    return null;
  })();

  // ── Look up past payments to the same recipient
  const pastPayments = useMemo(() => {
    if (!recipient || recipient.length < 5) return [];
    return transactions.filter(t => {
      // match by UPI or mobile stored in merchant field (approximation)
      return t.merchant?.toLowerCase().includes(recipient.toLowerCase().split('@')[0]);
    });
  }, [recipient, transactions]);

  // Most recent category used for this recipient
  const lastCategory = pastPayments[0]?.category || null;

  // ── When recipient changes: auto-suggest category from past payments
  async function handleRecipientChange(val) {
    setRecipient(val);
    setManualCat(null);
    setCatRequired(false);
    setPrediction(null);

    if (val.length < 5) return;

    // Find past transactions for this recipient
    const key  = val.toLowerCase().split('@')[0];
    const past  = transactions.filter(t => t.merchant?.toLowerCase().includes(key));

    if (past.length > 0) {
      // Auto-suggest most recent category
      setPrediction({ category: past[0].category, confidence: 100, source: 'history' });
    } else {
      // New recipient — ML predict from UPI/name
      const pred = await mlPredict(key, 100);
      setPrediction({ ...pred, source: 'ml' });
    }
  }

  // ── When note changes: check if reason differs from past payments
  function handleNoteChange(val) {
    setNote(val);
    if (!val || !lastCategory) return;

    // Simple heuristic: if note contains keywords that suggest a different category
    const noteL = val.toLowerCase();
    const catKeywords = {
      Restaurant: ['food','lunch','dinner','breakfast','eat','meal','zomato','swiggy'],
      Transport:  ['cab','taxi','ola','uber','travel','ride','bus','train'],
      Market:     ['grocery','vegetables','milk','shopping','dmart','big'],
      Medicines:  ['medicine','tablet','pharmacy','drug'],
      Hospital:   ['hospital','doctor','clinic','checkup'],
      Education:  ['fees','school','college','course','tuition'],
    };

    let detectedCat = null;
    for (const [cat, keywords] of Object.entries(catKeywords)) {
      if (keywords.some(k => noteL.includes(k))) { detectedCat = cat; break; }
    }

    // If detected category differs from last category, require user to confirm
    if (detectedCat && lastCategory && detectedCat !== lastCategory) {
      setCatRequired(true);
      setManualCat(null);
      setPrediction({ category: detectedCat, confidence: 85, source: 'note' });
    } else {
      setCatRequired(false);
    }
  }

  function selectContact(c) {
    const recVal = sendMode === 'upi' ? c.upi : c.mobile;
    setRecipient(recVal);
    handleRecipientChange(recVal);
    setShowContacts(false);
  }

  function numPress(k) {
    if (k === '⌫') { setAmount(prev => prev.slice(0,-1)); return; }
    if (k === '.' && amount.includes('.')) return;
    if (amount.length >= 8) return;
    setAmount(prev => prev + k);
  }

  function handlePayNow() {
    if (!recipient) return alert('Please enter a UPI ID or mobile number');
    if (!amount || parseFloat(amount) <= 0) return alert('Please enter an amount');
    if (catRequired && !manualCat) {
      alert('⚠️ This payment reason differs from past payments. Please select the correct category first.');
      setShowCatPicker(true);
      return;
    }
    // 'exceeded' case is blocked at button level — only 'will_exceed' or no-limit reaches here
    setPin(''); setPinError('');
    setShowPinModal(true);
  }


  async function confirmPayment() {
    if (pin.length !== 4) { setPinError('Please enter your 4-digit UPI PIN'); return; }
    if (!verifyPin(pin))   { setPinError('❌ Incorrect UPI PIN. Please try again.'); setPin(''); return; }

    setPinError('');
    const cat   = chosenCat?.category || 'Other';
    const conf  = chosenCat?.confidence || 62;
    const label = recipient.split('@')[0] || recipient;

    const txn = await addTransaction(label, parseFloat(amount), cat, conf);
    setLastTxn(txn);
    setShowPinModal(false);
    setShowSuccess(true);
    setRecipient(''); setNote(''); setAmount(''); setPrediction(null); setManualCat(null); setCatRequired(false); setPin('');
  }

  const catMeta = chosenCat ? (CAT_META[chosenCat.category] || CAT_META['Other']) : null;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Send Money</h1>
        <p>ML auto-categorizes your payment</p>
      </div>

      {/* Contacts row */}
      <div className={styles.contactsHeader}>
        <span className={styles.contactsTitle}>Recent Contacts</span>
        <span className={styles.seeAllContacts} onClick={() => setShowContacts(true)}>See all →</span>
      </div>
      <div className={styles.contactsRow}>
        {CONTACTS.slice(0,5).map(c => (
          <div key={c.name} className={styles.contact} onClick={() => selectContact(c)}>
            <div className={styles.avatar} style={{background:c.color, color:c.text}}>{c.name[0]}</div>
            <span className={styles.contactName}>{c.name}</span>
          </div>
        ))}
        <div className={styles.contact} onClick={() => setShowContacts(true)}>
          <div className={styles.avatar} style={{background:'var(--surface2)',color:'var(--muted)'}}>+</div>
          <span className={styles.contactName}>More</span>
        </div>
      </div>

      <div className={styles.grid}>
        {/* LEFT */}
        <div>
          {/* UPI / Mobile toggle */}
          <div className={styles.modeTabs}>
            <button className={`${styles.modeTab} ${sendMode==='upi'?styles.modeActive:''}`} onClick={() => setSendMode('upi')}>🏦 UPI ID</button>
            <button className={`${styles.modeTab} ${sendMode==='mobile'?styles.modeActive:''}`} onClick={() => setSendMode('mobile')}>📱 Mobile Number</button>
          </div>

          {/* Recipient input */}
          <div className={styles.formGroup}>
            <label className={styles.label}>{sendMode === 'upi' ? 'UPI ID' : 'Mobile Number'}</label>
            <input className={styles.input}
              placeholder={sendMode === 'upi' ? 'e.g. name@upi or name@paytm' : '10-digit mobile number'}
              type={sendMode === 'mobile' ? 'tel' : 'text'}
              maxLength={sendMode === 'mobile' ? 10 : 50}
              value={recipient}
              onChange={e => handleRecipientChange(e.target.value)}/>
          </div>

          {/* Past payments hint */}
          {pastPayments.length > 0 && (
            <div className={styles.historyHint}>
              <span>🕐</span>
              <span>You've paid this contact <strong>{pastPayments.length} time{pastPayments.length>1?'s':''}</strong> before — last as <strong>{lastCategory}</strong></span>
            </div>
          )}

          {/* Note / reason */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Reason / Note</label>
            <input className={styles.input}
              placeholder="What is this payment for? (e.g. food, medicine, rent)"
              value={note}
              onChange={e => handleNoteChange(e.target.value)}/>
          </div>

          {/* Category differs warning */}
          {catRequired && (
            <div className={styles.catWarning}>
              <span>⚠️</span>
              <div>
                <strong>Different reason detected!</strong>
                <p>You usually pay this contact for <strong>{lastCategory}</strong>, but your note suggests <strong>{prediction?.category}</strong>. Please confirm the category below.</p>
              </div>
            </div>
          )}

          {/* Auto-suggest or ML badge */}
          {chosenCat && (
            <div className={styles.mlBadge} style={{borderColor: catRequired && !manualCat ? '#f95f7a44' : ''}}>
              <span className={styles.mlIcon}>{catMeta?.icon}</span>
              <div className={styles.mlText}>
                <div className={styles.mlLabel}>
                  {chosenCat.source === 'history' ? '🕐 Based on past payments'
                    : chosenCat.source === 'note' ? '📝 Based on your note'
                    : '⚡ ML Auto-detected'}
                </div>
                <div className={styles.mlCategory}>{chosenCat.category}</div>
                <div className={styles.mlConf}>
                  {chosenCat.source === 'history' ? 'Same as previous payments' : `${chosenCat.confidence}% confidence`}
                </div>
              </div>
              <button className={styles.mlChange} onClick={() => setShowCatPicker(true)}>
                {catRequired && !manualCat ? '⚠️ Confirm' : 'Change'}
              </button>
            </div>
          )}

          {/* Category required but not yet chosen */}
          {!chosenCat && (
            <button className={styles.selectCatBtn} onClick={() => setShowCatPicker(true)}>
              + Select Category
            </button>
          )}

          {/* Amount */}
          <div className={styles.amountBox}>
            <span className={styles.rupeeSign}>₹</span>
            <span className={styles.bigAmount}>{amount || '0'}</span>
            <p className={styles.amountHint}>Use keypad →</p>
          </div>

          {/* ── INLINE LIMIT WARNING — shown as soon as category+amount triggers a limit issue ── */}
          {limitStatus?.type === 'exceeded' && (
            <div className={styles.limitExceededBanner}>
              <div className={styles.lebTop}>
                <span className={styles.lebIcon}>🚨</span>
                <div className={styles.lebBody}>
                  <strong>You've exceeded your {limitStatus.cat} limit!</strong>
                  <p>
                    You've already spent <strong>₹{limitStatus.spent.toLocaleString('en-IN')}</strong> this month —
                    ₹{limitStatus.over.toLocaleString('en-IN')} over your ₹{limitStatus.limit.toLocaleString('en-IN')} limit.
                    Please update your limit before making this payment.
                  </p>
                </div>
              </div>
              <button className={styles.lebChangeBtn} onClick={() => onNavigate && onNavigate('limits')}>
                Update Limit →
              </button>
            </div>
          )}

          {limitStatus?.type === 'will_exceed' && (
            <div className={styles.limitWillExceedBanner}>
              <div className={styles.lebTop}>
                <span className={styles.lebIcon}>⚠️</span>
                <div className={styles.lebBody}>
                  <strong>This payment will exceed your {limitStatus.cat} limit!</strong>
                  <p>
                    You've spent <strong>₹{limitStatus.spent.toLocaleString('en-IN')}</strong> of your ₹{limitStatus.limit.toLocaleString('en-IN')} limit.
                    This payment of ₹{limitStatus.payAmt.toLocaleString('en-IN')} will exceed it by <strong>₹{limitStatus.exceedBy.toLocaleString('en-IN')}</strong>.
                  </p>
                </div>
              </div>
              <div className={styles.lebActions}>
                <button className={styles.lebChangeBtn} onClick={() => onNavigate && onNavigate('limits')}>Update Limit</button>
                <button className={styles.lebPayBtn} onClick={handlePayNow}>Pay Anyway →</button>
              </div>
            </div>
          )}

          {limitStatus?.type === 'warning' && (
            <div className={styles.limitWarningBanner}>
              <span>⚠️</span>
              <p>You've used {limitStatus.pct}% of your {limitStatus.cat} limit — only <strong>₹{limitStatus.remaining.toLocaleString('en-IN')}</strong> left this month.</p>
            </div>
          )}

          <button
            className={styles.payBtn}
            style={limitStatus?.type === 'exceeded' ? {opacity:0.45, cursor:'not-allowed'} : {}}
            onClick={limitStatus?.type === 'exceeded' ? undefined : handlePayNow}>
            Pay Now →
          </button>
          {limitStatus?.type === 'exceeded'
            ? <p className={styles.pinHint} style={{color:'#f95f7a'}}>⛔ Update your {limitStatus.cat} limit to proceed</p>
            : <p className={styles.pinHint}>🔐 UPI PIN required to complete payment</p>
          }
        </div>

        {/* RIGHT — Numpad */}
        <div>
          <div className={styles.numpad}>
            {['1','2','3','4','5','6','7','8','9','.','0','⌫'].map(k => (
              <button key={k} className={styles.numKey} onClick={() => numPress(k)}>{k}</button>
            ))}
          </div>
          <div className={styles.quickAmounts}>
            <div className={styles.qaLabel}>Quick amounts</div>
            <div className={styles.qaRow}>
              {['50','100','200','500','1000'].map(a => (
                <button key={a} className={styles.qaBtn} onClick={() => setAmount(a)}>₹{a}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ALL CONTACTS */}
      {showContacts && (
        <div className={styles.modalOverlay} onClick={() => setShowContacts(false)}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.handle}/>
            <h3>Select Contact</h3>
            <div className={styles.allContacts}>
              {CONTACTS.map(c => (
                <div key={c.name} className={styles.contactRow} onClick={() => selectContact(c)}>
                  <div className={styles.contactRowAvatar} style={{background:c.color, color:c.text}}>{c.name[0]}</div>
                  <div className={styles.contactRowInfo}>
                    <div className={styles.contactRowName}>{c.name}</div>
                    <div className={styles.contactRowSub}>{c.upi || c.mobile || '—'}</div>
                  </div>
                  <span className={styles.contactRowArrow}>→</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY PICKER */}
      {showCatPicker && (
        <div className={styles.modalOverlay} onClick={() => { setShowCatPicker(false); setCustomCatMode(false); }}>
          <div className={styles.sheet} onClick={e => e.stopPropagation()}>
            <div className={styles.handle}/>
            {!customCatMode ? (
              <>
                <h3>Select Category {catRequired ? '⚠️ Required' : ''}</h3>
                {catRequired && <p className={styles.catPickerHint}>Your note suggests a different purpose than usual. Choose the correct category for this payment.</p>}
                <div className={styles.catGrid}>
                  {CATEGORIES.map(c => (
                    <div key={c.name} className={`${styles.catOpt} ${chosenCat?.category === c.name ? styles.catSelected : ''}`}
                      onClick={() => {
                        if (c.name === 'Custom') { setCustomCatMode(true); return; }
                        setManualCat({ category: c.name, confidence: 100, source: 'manual' });
                        setCatRequired(false);
                        setShowCatPicker(false);
                      }}>
                      <span className={styles.catOptIcon}>{c.icon}</span>
                      <span className={styles.catOptName}>{c.name === 'Custom' ? '➕ Custom' : c.name}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className={styles.customCat}>
                <h3>Custom Category</h3>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Category Name</label>
                  <input className={styles.input} placeholder="e.g. Gym, Pet Care, Rent"
                    value={customCatName} onChange={e => setCustomCatName(e.target.value)}/>
                </div>
                <div className={styles.customBtns}>
                  <button className={styles.btnCancel} onClick={() => setCustomCatMode(false)}>← Back</button>
                  <button className={styles.btnConfirm} onClick={() => {
                    if (!customCatName) return;
                    setManualCat({ category: customCatName, confidence: 100, source: 'manual' });
                    setCatRequired(false);
                    setShowCatPicker(false); setCustomCatMode(false);
                  }}>Save</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      {/* PIN MODAL */}
      {showPinModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <span className={styles.pinIcon}>🔐</span>
            <h3>Enter UPI PIN</h3>
            <p>Paying <strong style={{color:'var(--text)'}}>₹{parseFloat(amount).toLocaleString('en-IN')}</strong> · {chosenCat?.category}</p>
            <div className={styles.pinDots}>
              {[0,1,2,3].map(i => (
                <div key={i} className={`${styles.pinDot} ${pin.length>i?styles.pinFilled:''}`}/>
              ))}
            </div>
            <input className={styles.pinInput} type="password" maxLength={4}
              placeholder="••••" inputMode="numeric" autoFocus
              value={pin}
              onChange={e => { setPin(e.target.value.replace(/\D/,'')); setPinError(''); }}
              onKeyDown={e => e.key === 'Enter' && confirmPayment()}/>
            {pinError && <div className={styles.pinError}>{pinError}</div>}
            <div className={styles.modalBtns}>
              <button className={styles.btnCancel} onClick={() => setShowPinModal(false)}>Cancel</button>
              <button className={styles.btnConfirm} onClick={confirmPayment}>Confirm →</button>
            </div>
          </div>
        </div>
      )}

      {/* SUCCESS MODAL */}
      {showSuccess && lastTxn && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <span className={styles.successIcon}>✅</span>
            <h2>Payment Successful!</h2>
            <p>Auto-categorized by ML instantly</p>
            <div className={styles.modalDetail}>
              {[
                ['To',         recipient || lastTxn.merchant],
                ['Amount',     '₹'+lastTxn.amount.toLocaleString('en-IN')],
                ['Category',   (CAT_META[lastTxn.category]?.icon||'')+ ' '+lastTxn.category],
                ['Confidence', lastTxn.conf+'%'],
                ['Note',       note || '—'],
              ].map(([k,v]) => (
                <div key={k} className={styles.modalRow}>
                  <span className={styles.modalKey}>{k}</span>
                  <span className={styles.modalVal}>{v}</span>
                </div>
              ))}
            </div>
            <button className={styles.btnConfirm} style={{width:'100%'}} onClick={() => { setShowSuccess(false); setNote(''); }}>Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
