// src/pages/Limits.jsx
// Category-wise monthly limits — reads/writes from shared TransactionContext
import { useState } from 'react';
import { useTransactions, CAT_META } from '../context/TransactionContext';
import styles from './Limits.module.css';

const ALL_CATEGORIES = [
  { name:'Restaurant',       icon:'🍽', suggested:3000  },
  { name:'Market',           icon:'🛒', suggested:5000  },
  { name:'Food',             icon:'🍔', suggested:2000  },
  { name:'Transport',        icon:'🚗', suggested:2500  },
  { name:'Business',         icon:'💼', suggested:8000  },
  { name:'Mobile Recharge',  icon:'📱', suggested:500   },
  { name:'Electricity',      icon:'⚡', suggested:1500  },
  { name:'Medicines',        icon:'💊', suggested:1000  },
  { name:'Hospital',         icon:'🏥', suggested:5000  },
  { name:'Stationary',       icon:'✏️', suggested:800   },
  { name:'Entertainment',    icon:'🎬', suggested:2000  },
  { name:'Education',        icon:'📚', suggested:3000  },
  { name:'Other',            icon:'📦', suggested:1000  },
];

const MONTH_NAME = new Date().toLocaleString('en-IN', { month:'long', year:'numeric' });

const STATUS_COLOR = { exceeded:'#f95f7a', warning:'#fbb040', safe:'#32d583', none:'var(--accent)' };

export default function Limits() {
  // ── All data comes from shared context
  const { categoryLimits, catSpend, setLimit, removeLimit,
          exceededCategories, warningCategories } = useTransactions();

  const [editingCat, setEditingCat] = useState(null);
  const [editValue,  setEditValue]  = useState('');

  const totalLimit = Object.values(categoryLimits).reduce((s,v) => s + v, 0);
  const totalSpend = Object.values(catSpend).reduce((s,v) => s + v, 0);

  // Categories that have a limit set or spending this month
  const activeCats   = ALL_CATEGORIES.filter(c => categoryLimits[c.name] || catSpend[c.name]);
  const inactiveCats = ALL_CATEGORIES.filter(c => !categoryLimits[c.name] && !catSpend[c.name]);

  function openEdit(cat, currentVal) {
    setEditingCat(cat);
    setEditValue(currentVal ? String(currentVal) : '');
  }

  function save(cat) {
    if (editValue && parseFloat(editValue) > 0) setLimit(cat, editValue);
    setEditingCat(null); setEditValue('');
  }

  function remove(cat) { removeLimit(cat); setEditingCat(null); }

  function getStatus(spent, limit) {
    if (!limit) return 'none';
    const pct = (spent / limit) * 100;
    if (pct >= 100) return 'exceeded';
    if (pct >= 80)  return 'warning';
    return 'safe';
  }

  const limitsSetCount = Object.keys(categoryLimits).length;

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Category Limits 🎯</h1>
          <p>Monthly budgets for <strong>{MONTH_NAME}</strong></p>
        </div>
        {limitsSetCount > 0 && (
          <div className={styles.headerBadge}>{limitsSetCount} limit{limitsSetCount > 1 ? 's' : ''} set</div>
        )}
      </div>

      {/* Monthly persistence info */}
      <div className={styles.monthInfo}>
        <span className={styles.monthInfoIcon}>📅</span>
        <div>
          <strong>Limits are saved per month</strong>
          <p>Your <strong>{MONTH_NAME}</strong> limits are saved automatically — they survive page refresh. Next month you'll set fresh limits for that month.</p>
        </div>
      </div>

      {/* Summary card */}
      {totalLimit > 0 && (
        <div className={styles.summaryCard}>
          <div className={styles.summaryRow}>
            <div className={styles.summaryItem}>
              <div className={styles.summaryVal}>₹{totalSpend.toLocaleString('en-IN')}</div>
              <div className={styles.summaryLbl}>Total spent</div>
            </div>
            <div className={styles.summaryDiv}/>
            <div className={styles.summaryItem}>
              <div className={styles.summaryVal}>₹{totalLimit.toLocaleString('en-IN')}</div>
              <div className={styles.summaryLbl}>Total limits</div>
            </div>
            <div className={styles.summaryDiv}/>
            <div className={styles.summaryItem}>
              <div className={styles.summaryVal} style={{color: totalSpend > totalLimit ? '#f95f7a' : '#32d583'}}>
                ₹{Math.max(0, totalLimit-totalSpend).toLocaleString('en-IN')}
              </div>
              <div className={styles.summaryLbl}>Remaining</div>
            </div>
          </div>
        </div>
      )}

      {/* Exceeded notifications */}
      {exceededCategories.map(e => {
        const meta = CAT_META[e.cat] || CAT_META['Other'];
        return (
          <div key={e.cat} className={styles.alertDanger}>
            <span>{meta.icon}</span>
            <div>
              <strong>🚨 {e.cat} limit exceeded!</strong>
              <p>Spent ₹{e.spent.toLocaleString('en-IN')} — ₹{e.over.toLocaleString('en-IN')} over your ₹{e.limit.toLocaleString('en-IN')} limit</p>
            </div>
          </div>
        );
      })}

      {/* Warning notifications */}
      {warningCategories.map(w => {
        const meta = CAT_META[w.cat] || CAT_META['Other'];
        return (
          <div key={w.cat} className={styles.alertWarn}>
            <span>{meta.icon}</span>
            <div>
              <strong>⚠️ {w.cat} — {w.pct}% of limit used</strong>
              <p>Spent ₹{w.spent.toLocaleString('en-IN')} of ₹{w.limit.toLocaleString('en-IN')}</p>
            </div>
          </div>
        );
      })}

      {/* Active categories */}
      {activeCats.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Active This Month</div>
          <div className={styles.catList}>
            {activeCats.map(c => {
              const spent  = catSpend[c.name] || 0;
              const limit  = categoryLimits[c.name];
              const pct    = limit ? Math.min(Math.round((spent/limit)*100), 100) : 0;
              const status = getStatus(spent, limit);
              const meta   = CAT_META[c.name] || { bg:'rgba(160,160,192,0.15)' };

              return (
                <div key={c.name} className={styles.catCard}
                  style={{ borderColor: status === 'exceeded' ? 'rgba(249,95,122,.3)' : status === 'warning' ? 'rgba(251,176,64,.3)' : 'var(--border)' }}>
                  <div className={styles.catTop}>
                    <div className={styles.catLeft}>
                      <div className={styles.catIconBox} style={{background:meta.bg}}>{c.icon}</div>
                      <div>
                        <div className={styles.catName}>{c.name}</div>
                        <div className={styles.catSpent}>
                          Spent <strong>₹{spent.toLocaleString('en-IN')}</strong>
                          {limit && <span className={styles.catOf}> of ₹{limit.toLocaleString('en-IN')}</span>}
                        </div>
                      </div>
                    </div>
                    <div className={styles.catRight}>
                      {limit
                        ? <><span className={styles.catPct} style={{color:STATUS_COLOR[status]}}>{pct}%</span>
                            <button className={styles.editBtn} onClick={() => openEdit(c.name, limit)}>Edit</button></>
                        : <button className={styles.setBtn} onClick={() => openEdit(c.name, null)}>+ Set Limit</button>
                      }
                    </div>
                  </div>

                  {limit && (
                    <div className={styles.progressBg}>
                      <div className={styles.progressFill} style={{width:pct+'%', background:STATUS_COLOR[status]}}/>
                    </div>
                  )}

                  {editingCat === c.name && (
                    <div className={styles.editRow}>
                      <span className={styles.editRupee}>₹</span>
                      <input className={styles.editInput} type="number" autoFocus
                        placeholder={`Suggested: ₹${c.suggested.toLocaleString('en-IN')}`}
                        value={editValue}
                        onChange={e => setEditValue(e.target.value)}
                        onKeyDown={e => e.key==='Enter' && save(c.name)}/>
                      <button className={styles.saveBtn} onClick={() => save(c.name)}>Save</button>
                      {limit && <button className={styles.removeBtn} onClick={() => remove(c.name)}>Remove</button>}
                      <button className={styles.cancelBtn} onClick={() => setEditingCat(null)}>✕</button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Inactive categories — set limits */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>
          {activeCats.length > 0 ? 'Add Limits for Other Categories' : 'Set Category Limits'}
        </div>
        {inactiveCats.length === 0
          ? <div className={styles.allSet}>✅ All categories have limits set!</div>
          : <div className={styles.inactiveGrid}>
              {inactiveCats.map(c => (
                <div key={c.name} className={styles.inactiveCard}
                  onClick={() => openEdit(c.name, null)}>
                  <span className={styles.inactiveIcon}>{c.icon}</span>
                  <div className={styles.inactiveName}>{c.name}</div>
                  <div className={styles.inactiveSug}>Suggested ₹{c.suggested.toLocaleString('en-IN')}</div>
                  {editingCat === c.name
                    ? <div className={styles.editRowInline} onClick={e=>e.stopPropagation()}>
                        <input className={styles.editInputSm} type="number" autoFocus
                          placeholder={String(c.suggested)}
                          value={editValue}
                          onChange={e=>setEditValue(e.target.value)}
                          onKeyDown={e=>e.key==='Enter'&&save(c.name)}/>
                        <button className={styles.saveBtn} onClick={()=>save(c.name)}>✓</button>
                        <button className={styles.cancelBtn} onClick={()=>setEditingCat(null)}>✕</button>
                      </div>
                    : <div className={styles.inactiveAdd}>+ Set Limit</div>
                  }
                </div>
              ))}
            </div>
        }
      </div>
    </div>
  );
}
