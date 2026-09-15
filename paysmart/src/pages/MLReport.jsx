// src/pages/MLReport.jsx
// Shows ML model accuracy, algorithm comparison, and live prediction demo

import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTransactions, CAT_META } from '../context/TransactionContext';
import styles from './MLReport.module.css';

const FEATURE_DESCRIPTIONS = {
  merchant_enc: 'Merchant name encoded', amount: 'Payment amount',
  amount_log: 'Log of amount', amount_bin: 'Amount range bucket',
  hour: 'Hour of payment', day_of_week: 'Day of week', month: 'Month number',
};

export default function MLReport() {
  const { apiFetch } = useAuth();
  const { mlPredict } = useTransactions();
  const [demoMerchant, setDemoMerchant] = useState('');
  const [demoAmount,   setDemoAmount]   = useState('');
  const [demoResult,   setDemoResult]   = useState(null);
  const [loading,      setLoading]      = useState(false);
  const [report,       setReport]       = useState(null);
  const [reportError,  setReportError]  = useState('');

  useEffect(() => {
    let active = true;
    apiFetch('/ml/report').then(async res => {
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not load model report');
      if (active) setReport(data);
    }).catch(error => {
      if (active) setReportError(error.message);
    });
    return () => { active = false; };
  }, []);

  async function runDemo() {
    if (!demoMerchant || !demoAmount) return;
    setLoading(true);
    const result = await mlPredict(demoMerchant, parseFloat(demoAmount));
    setDemoResult(result);
    setLoading(false);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>ML Model Report 🤖</h1>
        <p>{report ? `${report.model} classifier - evaluated from the current trained model` : 'Loading model evaluation...'}</p>
      </div>

      {reportError && <div className={styles.card}>{reportError}</div>}
      {!report && !reportError && <div className={styles.card}>Loading model evaluation...</div>}

      {report && <>

      {/* Overall Accuracy Banner */}
      <div className={styles.accuracyBanner}>
        <div className={styles.bannerGrid}></div>
        <div className={styles.bannerLeft}>
          <div className={styles.bannerLabel}>MODEL ACCURACY</div>
          <div className={styles.bannerValue}>{(report.accuracy * 100).toFixed(2)}%</div>
          <div className={styles.bannerSub}>{report.model} - {report.estimators} estimators</div>
        </div>
        <div className={styles.bannerStats}>
          <div className={styles.bStat}>
              <div className={styles.bStatVal}>{report.sample_count}</div>
            <div className={styles.bStatLabel}>Training samples</div>
          </div>
          <div className={styles.bStat}>
              <div className={styles.bStatVal}>{report.category_count}</div>
            <div className={styles.bStatLabel}>Categories</div>
          </div>
          <div className={styles.bStat}>
              <div className={styles.bStatVal}>{report.feature_count}</div>
            <div className={styles.bStatLabel}>Features used</div>
          </div>
          <div className={styles.bStat}>
            <div className={styles.bStatVal}>80/20</div>
            <div className={styles.bStatLabel}>Train/Test split</div>
          </div>
        </div>
      </div>

      <div className={styles.grid2}>

        {/* Algorithm Comparison */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>📊 Algorithm Comparison</div>
          <div className={styles.algoList}>
            {report.algorithm_comparison.map(a => (
              <div key={a.name} className={`${styles.algoItem} ${styles['algo_'+a.status]}`}>
                <div className={styles.algoTop}>
                  <span className={styles.algoName}>{a.name}</span>
                  <span className={styles.algoAcc}>{(a.accuracy * 100).toFixed(2)}%</span>
                </div>
                <div className={styles.algoBarBg}>
                  <div className={styles.algoBarFill}
                    style={{ width: (a.accuracy * 100)+'%', background: a.status==='best' ? '#32d583' : '#fbb040' }}/>
                </div>
                <div className={styles.algoNote}>Held-out test-set accuracy</div>
              </div>
            ))}
          </div>
        </div>

        {/* Feature Importance */}
        <div className={styles.card}>
          <div className={styles.cardTitle}>🔍 Feature Importance</div>
          <div className={styles.featureList}>
            {report.feature_importance.map(f => (
              <div key={f.name} className={styles.featureItem}>
                <div className={styles.featureTop}>
                  <span className={styles.featureName}>{f.name}</span>
                  <span className={styles.featurePct}>{(f.importance * 100).toFixed(2)}%</span>
                </div>
                <div className={styles.featureBarBg}>
                  <div className={styles.featureBarFill} style={{ width: (f.importance*100)+'%' }}/>
                </div>
                <div className={styles.featureDesc}>{FEATURE_DESCRIPTIONS[f.name] || 'Model input feature'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Classification Report */}
      <div className={styles.card} style={{ marginBottom: 24 }}>
        <div className={styles.cardTitle}>📋 Classification Report (Random Forest)</div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Category</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1-Score</th>
                <th>Support</th>
              </tr>
            </thead>
            <tbody>
              {report.classification_report.map(r => {
                const meta = CAT_META[r.cat] || CAT_META.Other;
                return (
                  <tr key={r.cat}>
                    <td>
                      <span className={styles.catBadge} style={{ background: meta.bg, color: meta.color }}>
                        {meta.icon} {r.cat}
                      </span>
                    </td>
                    <td><ScoreBar val={r.precision}/></td>
                    <td><ScoreBar val={r.recall}/></td>
                    <td><ScoreBar val={r.f1}/></td>
                    <td className={styles.support}>{r.support}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Live Prediction Demo */}
      <div className={styles.card}>
        <div className={styles.cardTitle}>⚡ Live Prediction Demo</div>
        <p className={styles.demoDesc}>Test the ML model right here — enter any merchant name and amount</p>
        <div className={styles.demoRow}>
          <input className={styles.demoInput} placeholder="Merchant (e.g. Zomato, DMart, Ola)"
            value={demoMerchant} onChange={e => setDemoMerchant(e.target.value)}/>
          <input className={styles.demoInput} placeholder="Amount (e.g. 250)" type="number"
            value={demoAmount} onChange={e => setDemoAmount(e.target.value)}/>
          <button className={styles.demoBtn} onClick={runDemo} disabled={loading}>
            {loading ? 'Predicting...' : 'Predict →'}
          </button>
        </div>

        {demoResult && (
          <div className={styles.demoResult}>
            <div className={styles.demoResultIcon}>
              {CAT_META[demoResult.category]?.icon || '📦'}
            </div>
            <div className={styles.demoResultText}>
              <div className={styles.demoResultLabel}>ML Prediction</div>
              <div className={styles.demoResultCat}>{demoResult.category}</div>
              <div className={styles.demoResultConf}>{demoResult.confidence}% confidence</div>
            </div>
            <div className={styles.demoConfBar}>
              <div className={styles.demoConfFill}
                style={{ width: demoResult.confidence+'%',
                  background: demoResult.confidence >= 85 ? '#32d583' : demoResult.confidence >= 70 ? '#fbb040' : '#f95f7a' }}/>
              <span className={styles.demoConfPct}>{demoResult.confidence}%</span>
            </div>
          </div>
        )}
      </div>
      </>}
    </div>
  );
}

function ScoreBar({ val }) {
  const pct  = Math.round(val * 100);
  const color = pct >= 90 ? '#32d583' : pct >= 75 ? '#fbb040' : '#f95f7a';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ flex:1, height:6, background:'var(--surface2)', borderRadius:4, overflow:'hidden' }}>
        <div style={{ width:pct+'%', height:'100%', background:color, borderRadius:4, transition:'width 1s ease' }}/>
      </div>
      <span style={{ fontSize:13, fontWeight:600, color, minWidth:36 }}>{pct}%</span>
    </div>
  );
}
