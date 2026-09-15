// src/context/TransactionContext.jsx
import { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';

const TransactionContext = createContext();
const API = 'http://localhost:5000';

export const CAT_META = {
  Restaurant:      { icon:'🍽', color:'#f95f7a', bg:'rgba(249,95,122,0.15)',  budget:3000 },
  Market:          { icon:'🛒', color:'#32d583', bg:'rgba(50,213,131,0.15)',   budget:5000 },
  Food:            { icon:'🍔', color:'#fbb040', bg:'rgba(251,176,64,0.15)',   budget:2000 },
  Coffee:          { icon:'☕', color:'#c084fc', bg:'rgba(192,132,252,0.15)', budget:2000 },
  Transport:       { icon:'🚗', color:'#7c6dfa', bg:'rgba(124,109,250,0.15)',  budget:2500 },
  Business:        { icon:'💼', color:'#38bdf8', bg:'rgba(56,189,248,0.15)',   budget:8000 },
  'Mobile Recharge':{ icon:'📱', color:'#a78bfa', bg:'rgba(167,139,250,0.15)', budget:500  },
  Electricity:     { icon:'⚡', color:'#fde047', bg:'rgba(253,224,71,0.15)',   budget:1500 },
  Medicines:       { icon:'💊', color:'#34d399', bg:'rgba(52,211,153,0.15)',   budget:1000 },
  Hospital:        { icon:'🏥', color:'#f87171', bg:'rgba(248,113,113,0.15)',  budget:5000 },
  Stationary:      { icon:'✏️', color:'#60a5fa', bg:'rgba(96,165,250,0.15)',   budget:800  },
  Entertainment:   { icon:'🎬', color:'#c084fc', bg:'rgba(192,132,252,0.15)',  budget:2000 },
  Education:       { icon:'📚', color:'#4ade80', bg:'rgba(74,222,128,0.15)',   budget:3000 },
  Other:           { icon:'📦', color:'#a0a0c0', bg:'rgba(160,160,192,0.15)',  budget:1000 },
};

// ── localStorage key for current month's limits e.g. "paysmart_limits_2025_02"
function monthKey() {
  const d = new Date();
  return `paysmart_limits_${d.getFullYear()}_${String(d.getMonth()+1).padStart(2,'0')}`;
}
function loadLimits() {
  try { return JSON.parse(localStorage.getItem(monthKey()) || '{}'); }
  catch { return {}; }
}
function saveLimits(limits) {
  try { localStorage.setItem(monthKey(), JSON.stringify(limits)); }
  catch {}
}

export function TransactionProvider({ children, userId }) {
  const { apiFetch } = useAuth();
  const [transactions,   setTransactions]   = useState([]);
  const [balance,        setBalance]        = useState(null);
  const [loading,        setLoading]        = useState(false);
  // ── Limits persisted to localStorage per month — survive page refresh
  const [categoryLimits, setCategoryLimits] = useState(() => loadLimits());

  function setLimit(cat, value) {
    setCategoryLimits(prev => {
      const updated = { ...prev, [cat]: parseFloat(value) };
      saveLimits(updated);
      return updated;
    });
  }
  function removeLimit(cat) {
    setCategoryLimits(prev => {
      const n = { ...prev };
      delete n[cat];
      saveLimits(n);
      return n;
    });
  }

  // ── This month's spend per category — computed once, shared everywhere
  const thisMonth = new Date().getMonth();
  const thisYear  = new Date().getFullYear();
  const catSpend  = {};
  transactions.forEach(t => {
    const d = new Date(t.date || t.time);
    if (d.getMonth() === thisMonth && d.getFullYear() === thisYear) {
      catSpend[t.category] = (catSpend[t.category] || 0) + t.amount;
    }
  });

  // ── Categories that EXCEEDED their limit (for Home alerts)
  const exceededCategories = Object.entries(categoryLimits)
    .filter(([cat, lim]) => (catSpend[cat] || 0) > lim)
    .map(([cat, lim]) => ({
      cat,
      spent: catSpend[cat] || 0,
      limit: lim,
      over:  (catSpend[cat] || 0) - lim,
    }));

  // ── Categories at 80-99% of limit (warning)
  const warningCategories = Object.entries(categoryLimits)
    .filter(([cat, lim]) => {
      const pct = ((catSpend[cat] || 0) / lim) * 100;
      return pct >= 80 && pct < 100;
    })
    .map(([cat, lim]) => ({
      cat,
      spent: catSpend[cat] || 0,
      limit: lim,
      pct:   Math.round(((catSpend[cat] || 0) / lim) * 100),
    }));

  useEffect(() => {
    if (!userId) { setTransactions([]); setBalance(null); return; }
    fetchTransactions();
  }, [userId]);

  async function fetchTransactions() {
    setLoading(true);
    try {
      const res  = await apiFetch(`/transactions/${userId}`);
      const data = await res.json();
      if (!res.ok) {
        const error = new Error(data.error || 'Could not load transactions');
        error.status = res.status;
        throw error;
      }
      const formatted = (data.transactions || []).map(t => ({
        ...t,
        time: new Date(t.date).toLocaleString('en-IN', {
          day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'
        }),
        conf: t.confidence,
      }));
      setTransactions(formatted);
      if (typeof data.balance === 'number') setBalance(data.balance);
    } catch (e) {
      // Demo mode fallback — seed multi-month transactions so Monthly Trend chart shows real data
      const now = new Date();
      const mo  = (offsetMonths) => {
        const d = new Date(now.getFullYear(), now.getMonth() + offsetMonths, 15);
        return d;
      };
      setTransactions([
        { id:1,  merchant:'Zomato',      amount:350,  category:'Restaurant',      conf:94, date: mo(0)  },
        { id:2,  merchant:'DMart',       amount:1200, category:'Market',          conf:91, date: mo(0)  },
        { id:3,  merchant:'OlaCabs',     amount:180,  category:'Transport',       conf:89, date: mo(0)  },
        { id:4,  merchant:'Airtel',      amount:299,  category:'Mobile Recharge', conf:96, date: mo(0)  },
        { id:5,  merchant:'Apollo',      amount:450,  category:'Medicines',       conf:88, date: mo(0)  },
        { id:6,  merchant:'Zomato',      amount:520,  category:'Restaurant',      conf:93, date: mo(-1) },
        { id:7,  merchant:'BigBazaar',   amount:2100, category:'Market',          conf:90, date: mo(-1) },
        { id:8,  merchant:'Uber',        amount:320,  category:'Transport',       conf:92, date: mo(-1) },
        { id:9,  merchant:'Netflix',     amount:649,  category:'Entertainment',   conf:95, date: mo(-1) },
        { id:10, merchant:'Starbucks',   amount:480,  category:'Food',            conf:87, date: mo(-2) },
        { id:11, merchant:'DMart',       amount:1800, category:'Market',          conf:91, date: mo(-2) },
        { id:12, merchant:'Rapido',      amount:95,   category:'Transport',       conf:89, date: mo(-2) },
        { id:13, merchant:'BESCOM',      amount:1200, category:'Electricity',     conf:97, date: mo(-2) },
        { id:14, merchant:'Swiggy',      amount:390,  category:'Restaurant',      conf:92, date: mo(-3) },
        { id:15, merchant:'Reliance',    amount:1650, category:'Market',          conf:90, date: mo(-3) },
        { id:16, merchant:'IRCTC',       amount:850,  category:'Transport',       conf:94, date: mo(-3) },
        { id:17, merchant:'Byju\'s',     amount:1200, category:'Education',       conf:88, date: mo(-4) },
        { id:18, merchant:'Zomato',      amount:610,  category:'Restaurant',      conf:93, date: mo(-4) },
        { id:19, merchant:'Meesho',      amount:780,  category:'Market',          conf:86, date: mo(-4) },
        { id:20, merchant:'OlaCabs',     amount:260,  category:'Transport',       conf:91, date: mo(-5) },
        { id:21, merchant:'Pharmacy',    amount:320,  category:'Medicines',       conf:87, date: mo(-5) },
        { id:22, merchant:'Zomato',      amount:440,  category:'Restaurant',      conf:94, date: mo(-5) },
      ].map(t => ({
        ...t,
        time: t.date.toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' }),
        conf: t.conf,
      })));
      setBalance(24580);
    }
    setLoading(false);
  }

  async function mlPredict(merchant, amount = 100) {
    try {
      const res  = await apiFetch('/predict', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ merchant, amount })
      });
      const data = await res.json();
      return { category: data.category, confidence: data.confidence };
    } catch (e) {
      return fallbackPredict(merchant);
    }
  }

  function fallbackPredict(merchant) {
    const ML_MAP = {
      zomato:'Restaurant', swiggy:'Restaurant', kfc:'Restaurant', mcdonalds:'Restaurant',
      dmart:'Market', bigbazaar:'Market', reliance:'Market', zepto:'Market',
      starbucks:'Food', cafecoffeeday:'Food', barista:'Food',
      ola:'Transport', uber:'Transport', rapido:'Transport', irctc:'Transport',
      razorpay:'Business', zoho:'Business', meesho:'Business',
      apollo:'Medicines', medplus:'Medicines', pharmacy:'Medicines',
      hospital:'Hospital', clinic:'Hospital', doctor:'Hospital',
      airtel:'Mobile Recharge', jio:'Mobile Recharge', vi:'Mobile Recharge',
      bescom:'Electricity', tneb:'Electricity', mseb:'Electricity',
    };
    const key = merchant.toLowerCase().replace(/\s/g, '');
    for (const [k, cat] of Object.entries(ML_MAP)) {
      if (key.includes(k)) return { category: cat, confidence: 85 + Math.floor(Math.random() * 12) };
    }
    return { category: 'Other', confidence: 62 };
  }

  async function addTransaction(merchant, amount, category, conf, recipientUpi = null, allowOfflineFallback = true) {
    try {
      const res  = await apiFetch('/transactions', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ user_id: userId, merchant, amount, category, confidence: conf, recipient_upi: recipientUpi })
      });
      const data = await res.json();
      if (!res.ok) {
        const error = new Error(data.error || 'Payment failed');
        error.status = res.status;
        throw error;
      }
      if (data.success) {
        setBalance(data.balance ?? data.payer_balance);
        const newTxn = {
          id: Date.now(), merchant, amount, category, conf, date: new Date(),
          time: new Date().toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
        };
        setTransactions(prev => [newTxn, ...prev]);
        return newTxn;
      }
      throw new Error('Payment was not completed');
    } catch (e) {
      if (e.status || !allowOfflineFallback) throw e;

      // Preserve offline demo behavior only when the API cannot be reached.
      const newTxn = {
        id: Date.now(), merchant, amount, category, conf, date: new Date(),
        time: new Date().toLocaleString('en-IN', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
      };
      setTransactions(prev => [newTxn, ...prev]);
      setBalance(prev => prev - amount);
      return newTxn;
    }
  }

  function getStats() {
    const total = transactions.reduce((s,t) => s + t.amount, 0);
    const count = transactions.length;
    const avg   = count ? Math.round(total / count) : 0;
    const catTotals = {};
    transactions.forEach(t => { catTotals[t.category] = (catTotals[t.category] || 0) + t.amount; });
    const topCat = Object.entries(catTotals).sort((a,b) => b[1]-a[1])[0];

    // Group by MONTH name (Jan 2025, Feb 2025...) — NOT by day
    const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const rawMonthMap = {};
    transactions.forEach(t => {
      const d = new Date(t.date || t.time);
      if (isNaN(d)) return;
      const key = MONTHS[d.getMonth()] + ' ' + d.getFullYear();
      rawMonthMap[key] = (rawMonthMap[key] || 0) + t.amount;
    });
    // Sort chronologically
    const monthMap = Object.fromEntries(
      Object.entries(rawMonthMap).sort((a, b) => {
        const toMs = s => { const [m,y] = s.split(' '); return new Date(m+' 1 '+y).getTime(); };
        return toMs(a[0]) - toMs(b[0]);
      })
    );
    return { total, count, avg, catTotals, topCat, monthMap };
  }

  return (
    <TransactionContext.Provider value={{
      transactions, balance, setBalance, loading,
      categoryLimits, catSpend,
      exceededCategories, warningCategories,
      setLimit, removeLimit,
      mlPredict, addTransaction, getStats, fetchTransactions,
    }}>
      {children}
    </TransactionContext.Provider>
  );
}

export function useTransactions() {
  return useContext(TransactionContext);
}
