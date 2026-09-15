// src/pages/Dashboard.jsx
import { useEffect, useRef } from 'react';
import { Chart, ArcElement, DoughnutController, BarElement, BarController, CategoryScale, LinearScale, Tooltip, Legend } from 'chart.js';
import { useTransactions, CAT_META } from '../context/TransactionContext';
import styles from './Dashboard.module.css';

Chart.register(ArcElement, DoughnutController, BarElement, BarController, CategoryScale, LinearScale, Tooltip, Legend);

// Only show alerts based on USER-SET limits — no default budgets
function getSmartAlerts(transactions, categoryLimits, catSpend) {
  if (!transactions.length) return [];
  const alerts = [];

  const now       = new Date();
  const thisMonth = now.getMonth();
  const thisYear  = now.getFullYear();
  const lastMonth = thisMonth === 0 ? 11 : thisMonth - 1;
  const lastYear  = thisMonth === 0 ? thisYear - 1 : thisYear;

  const thisMonthTotals = {};
  const lastMonthTotals = {};
  transactions.forEach(t => {
    const d = new Date(t.date || t.time);
    if (isNaN(d)) return;
    if (d.getFullYear() === thisYear && d.getMonth() === thisMonth)
      thisMonthTotals[t.category] = (thisMonthTotals[t.category] || 0) + t.amount;
    if (d.getFullYear() === lastYear && d.getMonth() === lastMonth)
      lastMonthTotals[t.category] = (lastMonthTotals[t.category] || 0) + t.amount;
  });

  // User-set limit alerts only
  if (categoryLimits && catSpend) {
    Object.entries(categoryLimits).forEach(([cat, limit]) => {
      const spent = catSpend[cat] || 0;
      if (!limit) return;
      const pct = Math.round((spent / limit) * 100);
      if (pct >= 100) {
        alerts.push({
          icon: '🚨',
          msg: `${CAT_META[cat]?.icon || ''} ${cat} limit exceeded — spent ₹${spent.toLocaleString('en-IN')} of your ₹${limit.toLocaleString('en-IN')} limit`,
          color: 'rgba(249,95,122,0.12)', border: 'rgba(249,95,122,0.3)', textColor: '#f95f7a',
        });
      } else if (pct >= 80) {
        alerts.push({
          icon: '⚠️',
          msg: `${CAT_META[cat]?.icon || ''} ${cat} at ${pct}% — ₹${(limit - spent).toLocaleString('en-IN')} remaining`,
          color: 'rgba(251,176,64,0.1)', border: 'rgba(251,176,64,0.3)', textColor: '#fbb040',
        });
      }
    });
  }

  // Month-over-month increase alerts
  Object.entries(thisMonthTotals).forEach(([cat, thisAmt]) => {
    const lastAmt = lastMonthTotals[cat];
    if (lastAmt && thisAmt > lastAmt) {
      const pct = Math.round(((thisAmt - lastAmt) / lastAmt) * 100);
      if (pct >= 20) {
        alerts.push({
          icon: '⚠️',
          msg: `${CAT_META[cat]?.icon || ''} ${cat} spending up ${pct}% vs last month`,
          color: 'rgba(251,176,64,0.1)', border: 'rgba(251,176,64,0.3)', textColor: '#fbb040',
        });
      }
    }
  });

  return alerts;
}

export default function Dashboard() {
  const { getStats, transactions, categoryLimits, catSpend } = useTransactions();
  const { total, count, avg, catTotals, topCat, monthMap } = getStats();

  const pieRef   = useRef(null);
  const barRef   = useRef(null);
  const pieChart = useRef(null);
  const barChart = useRef(null);

  const alerts           = getSmartAlerts(transactions, categoryLimits, catSpend);
  const limitsSetCount   = Object.keys(categoryLimits || {}).length;
  const topCatPct        = topCat ? Math.round((topCat[1] / total) * 100) : 0;

  useEffect(() => {
    if (pieChart.current) pieChart.current.destroy();
    const labels = Object.keys(catTotals);
    const data   = Object.values(catTotals);
    const colors = labels.map(l => CAT_META[l]?.color || '#a0a0c0');

    if (labels.length > 0) {
      pieChart.current = new Chart(pieRef.current, {
        type: 'doughnut',
        data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 0, hoverOffset: 8 }] },
        options: {
          responsive: true, cutout: '65%',
          plugins: {
            legend: { position:'bottom', labels:{ color:'#7070a0', font:{size:12}, padding:12 } },
            tooltip: { callbacks: { label: ctx => ` ₹${ctx.parsed.toLocaleString('en-IN')}` } }
          }
        }
      });
    }

    if (barChart.current) barChart.current.destroy();
    const months = Object.keys(monthMap);
    const vals   = Object.values(monthMap);
    if (months.length > 0) {
      barChart.current = new Chart(barRef.current, {
        type: 'bar',
        data: {
          labels: months,
          datasets: [{
            label: 'Spending (₹)', data: vals,
            backgroundColor: months.map((_,i) => i === months.length-1 ? '#7c6dfa' : 'rgba(124,109,250,0.25)'),
            borderRadius: 8, borderSkipped: false,
          }]
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: '#7070a0' } },
            y: { grid: { color: 'rgba(255,255,255,0.04)' }, ticks: { color: '#7070a0', callback: v => '₹'+v/1000+'k' } }
          }
        }
      });
    }

    return () => { pieChart.current?.destroy(); barChart.current?.destroy(); };
  }, [catTotals, monthMap]);

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Expense Intelligence</h1>
        <p>ML-powered insights into your spending</p>
      </div>

      {/* Alerts — only user-set limit breaches + MoM increases */}
      {alerts.map((a, i) => (
        <div key={i} className={styles.alert} style={{ background: a.color, borderColor: a.border }}>
          <span className={styles.alertIcon}>{a.icon}</span>
          <span style={{ color: a.textColor }}>{a.msg}</span>
        </div>
      ))}

      {/* Nudge to set limits if none set yet */}
      {limitsSetCount === 0 && transactions.length > 0 && (
        <div className={styles.noLimitsNudge}>
          <span className={styles.nudgeIcon}>🎯</span>
          <div>
            <strong>You haven't set any category limits yet</strong>
            <p>Go to <strong>Set Limits</strong> in the sidebar to set monthly budgets per category. Alerts on this page and on payments will be based entirely on what you set.</p>
          </div>
        </div>
      )}

      {/* Category limits tracker — only shown when user HAS set limits */}
      {limitsSetCount > 0 && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Your Category Limits — {new Date().toLocaleString('en-IN',{month:'long',year:'numeric'})}</div>
          <div className={styles.limitList}>
            {Object.entries(categoryLimits).map(([cat, limit]) => {
              const spent  = catSpend[cat] || 0;
              const pct    = Math.min(Math.round((spent / limit) * 100), 100);
              const meta   = CAT_META[cat] || CAT_META['Other'];
              const status = pct >= 100 ? 'exceeded' : pct >= 80 ? 'warning' : 'safe';
              const barColor = status === 'exceeded' ? '#f95f7a' : status === 'warning' ? '#fbb040' : '#32d583';
              return (
                <div key={cat} className={styles.limitItem}>
                  <div className={styles.limitHeader}>
                    <span className={styles.limitCat}>{meta.icon} {cat}</span>
                    <span className={styles.limitAmts} style={{ color: status === 'exceeded' ? '#f95f7a' : 'var(--muted)' }}>
                      ₹{spent.toLocaleString('en-IN')} / ₹{limit.toLocaleString('en-IN')}
                    </span>
                  </div>
                  <div className={styles.limitBar}>
                    <div className={styles.limitFill} style={{ width: pct+'%', background: barColor }}/>
                  </div>
                  <div className={styles.limitFooter}>
                    <span style={{ color: barColor, fontSize:11, fontWeight:600 }}>{pct}% used</span>
                    {status !== 'exceeded' && (
                      <span style={{ fontSize:11, color:'var(--muted)' }}>₹{(limit-spent).toLocaleString('en-IN')} remaining</span>
                    )}
                    {status === 'exceeded' && (
                      <span style={{ fontSize:11, color:'#f95f7a', fontWeight:700 }}>₹{(spent-limit).toLocaleString('en-IN')} over limit</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats */}
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>💰</div>
          <div className={styles.statValue}>₹{total.toLocaleString('en-IN')}</div>
          <div className={styles.statLabel}>Total Spent This Month</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>🏆</div>
          <div className={styles.statValue}>{topCat ? (CAT_META[topCat[0]]?.icon + ' ' + topCat[0]) : '—'}</div>
          <div className={styles.statLabel}>Top Spending Category</div>
          <div className={styles.statChange} style={{color:'var(--muted)'}}>{topCatPct}% of total</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statIcon}>📊</div>
          <div className={styles.statValue}>{count}</div>
          <div className={styles.statLabel}>Total Transactions</div>
          <div className={styles.statChange} style={{color:'var(--muted)'}}>Avg ₹{avg.toLocaleString('en-IN')} per txn</div>
        </div>
      </div>

      {/* Charts */}
      <div className={styles.chartsGrid}>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Category-wise Spending</div>
          <canvas ref={pieRef}></canvas>
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartTitle}>Monthly Trend</div>
          <canvas ref={barRef}></canvas>
        </div>
      </div>
    </div>
  );
}
