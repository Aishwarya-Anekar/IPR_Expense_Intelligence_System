// src/pages/History.jsx
// Shows transactions grouped by category with totals
import { useState } from 'react';
import { useTransactions, CAT_META } from '../context/TransactionContext';
import TransactionItem from '../components/TransactionItem';
import styles from './History.module.css';

const ALL_CATS = ['All', 'Restaurant', 'Market', 'Food', 'Transport', 'Business',
                  'Mobile Recharge', 'Electricity', 'Medicines', 'Hospital',
                  'Stationary', 'Entertainment', 'Education', 'Other'];

const VIEW_MODES = [
  { id: 'category', label: '📂 Category View' },
  { id: 'list',     label: '📋 List View' },
];

export default function History() {
  const { transactions } = useTransactions();
  const [activeFilter, setActiveFilter] = useState('All');
  const [viewMode,     setViewMode]     = useState('category');
  const [expandedCat,  setExpandedCat]  = useState(null);

  // Filter by category
  const filtered = activeFilter === 'All'
    ? transactions
    : transactions.filter(t => t.category === activeFilter);

  // Group transactions by category
  const grouped = {};
  filtered.forEach(t => {
    if (!grouped[t.category]) grouped[t.category] = { txns: [], total: 0 };
    grouped[t.category].txns.push(t);
    grouped[t.category].total += t.amount;
  });
  const sortedCats = Object.entries(grouped).sort((a, b) => b[1].total - a[1].total);

  const totalSpend = filtered.reduce((s, t) => s + t.amount, 0);

  // Only show filter chips for categories that actually exist in transactions
  const usedCats = ['All', ...new Set(transactions.map(t => t.category))];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1>Transaction History</h1>
          <p>{transactions.length} payments · ₹{totalSpend.toLocaleString('en-IN')} total</p>
        </div>

        {/* View mode toggle */}
        <div className={styles.viewToggle}>
          {VIEW_MODES.map(v => (
            <button key={v.id}
              className={`${styles.viewBtn} ${viewMode === v.id ? styles.viewActive : ''}`}
              onClick={() => setViewMode(v.id)}>
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {/* Category filter chips */}
      <div className={styles.filters}>
        {usedCats.map(f => {
          const meta = CAT_META[f];
          return (
            <button key={f}
              className={`${styles.chip} ${activeFilter === f ? styles.activeChip : ''}`}
              style={activeFilter === f && meta ? { background: meta.color, borderColor: meta.color } : {}}
              onClick={() => setActiveFilter(f)}>
              {meta ? meta.icon + ' ' : ''}{f}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>📋</div>
          <div className={styles.emptyText}>No transactions found</div>
          <div className={styles.emptySub}>Try a different category filter</div>
        </div>
      ) : viewMode === 'category' ? (
        /* ── CATEGORY VIEW ── */
        <div className={styles.categoryView}>
          {/* Summary cards */}
          <div className={styles.summaryGrid}>
            {sortedCats.map(([cat, data]) => {
              const meta = CAT_META[cat] || CAT_META['Other'];
              const pct  = Math.round((data.total / totalSpend) * 100);
              return (
                <div key={cat} className={styles.summaryCard}
                  style={{ borderColor: expandedCat === cat ? meta.color : 'var(--border)' }}
                  onClick={() => setExpandedCat(expandedCat === cat ? null : cat)}>
                  <div className={styles.summaryLeft}>
                    <div className={styles.summaryIconBox} style={{ background: meta.bg }}>
                      <span className={styles.summaryIcon}>{meta.icon}</span>
                    </div>
                    <div>
                      <div className={styles.summaryCat}>{cat}</div>
                      <div className={styles.summaryCount}>{data.txns.length} transaction{data.txns.length !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                  <div className={styles.summaryRight}>
                    <div className={styles.summaryAmt} style={{ color: meta.color }}>
                      ₹{data.total.toLocaleString('en-IN')}
                    </div>
                    <div className={styles.summaryPct}>{pct}% of total</div>
                    <span className={styles.summaryChevron}>{expandedCat === cat ? '▲' : '▼'}</span>
                  </div>
                  {/* Spend bar */}
                  <div className={styles.summaryBar}>
                    <div className={styles.summaryBarFill} style={{ width: pct + '%', background: meta.color }}/>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Expanded transactions for selected category */}
          {expandedCat && grouped[expandedCat] && (
            <div className={styles.expandedCard}>
              <div className={styles.expandedHeader}>
                <span>{CAT_META[expandedCat]?.icon} {expandedCat} transactions</span>
                <span className={styles.expandedClose} onClick={() => setExpandedCat(null)}>✕ Close</span>
              </div>
              {grouped[expandedCat].txns.map(t => (
                <TransactionItem key={t.id} txn={t}/>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* ── LIST VIEW ── */
        <div className={styles.listCard}>
          {filtered.map(t => <TransactionItem key={t.id} txn={t}/>)}
        </div>
      )}
    </div>
  );
}
