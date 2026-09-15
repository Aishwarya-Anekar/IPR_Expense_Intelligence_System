// src/pages/QR.jsx
import { useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { useTransactions } from '../context/TransactionContext';
import styles from './QR.module.css';

export default function QR() {
  const { currentUser } = useAuth();
  const { mlPredict, addTransaction } = useTransactions();
  const [upiInput, setUpiInput] = useState('');
  const [amtInput, setAmtInput] = useState('');
  const [success, setSuccess] = useState(false);
  const qrRef = useRef(null);

  const upiId = currentUser?.upi || 'user@paysmart';

  const qrValue = useMemo(() => {
    const amount = Number(amtInput) > 0 ? Number(amtInput).toFixed(2) : '0.00';
    const payee = upiId || 'user@paysmart';
    return `upi://pay?pa=${encodeURIComponent(payee)}&pn=${encodeURIComponent(currentUser ? `${currentUser.firstname} ${currentUser.lastname || ''}`.trim() : 'PaySmart User')}&am=${amount}&cu=INR&tn=${encodeURIComponent('PaySmart payment')}`;
  }, [amtInput, currentUser, upiId]);

  function simulateScan() {
    const samples = [
      { upi: 'zomato@upi', amt: '250' },
      { upi: 'dmart@upi', amt: '820' },
      { upi: 'ola@upi', amt: '130' },
    ];
    const sample = samples[Math.floor(Math.random() * samples.length)];
    setUpiInput(sample.upi);
    setAmtInput(sample.amt);
    setSuccess(false);
  }

  function downloadQr() {
    const canvas = qrRef.current?.querySelector('canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = 'paysmart-qr.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  }

  async function pay() {
    if (!upiInput || !amtInput) return alert('Enter UPI ID and amount');
    const merchant = upiInput.split('@')[0];
    const pred = await mlPredict(merchant, Number(amtInput) || 0);
    await addTransaction(merchant, parseFloat(amtInput), pred.category, pred.confidence);
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setUpiInput('');
      setAmtInput('');
    }, 2500);
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>QR Payment</h1>
        <p>Scan to pay or show your QR code</p>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <div className={styles.cardTitle}>Your QR Code</div>
          <div className={styles.qrBox} ref={qrRef}>
            <QRCodeSVG
              value={qrValue}
              size={180}
              bgColor="#ffffff"
              fgColor="#111111"
              includeMargin={true}
            />
          </div>
          <p className={styles.upiId}>{upiId} · PaySmart</p>
          <button className={styles.btn} onClick={downloadQr}>⬇ Download QR</button>
        </div>

        <div className={styles.card}>
          <div className={styles.cardTitle}>Scan & Pay</div>
          {success && <div className={styles.successBanner}>✅ Payment Successful! Auto-categorized by ML</div>}
          <div className={styles.scanArea} onClick={simulateScan}>
            <span className={styles.scanIcon}>📷</span>
            <p className={styles.scanText}>Click to simulate QR scan</p>
            <p className={styles.scanSub}>This fills a sample UPI ID and amount</p>
          </div>
          <div className={styles.divider}></div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Or enter UPI ID manually</label>
            <input className={styles.input} placeholder="merchant@upi" value={upiInput} onChange={e => setUpiInput(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>Amount (₹)</label>
            <input className={styles.input} type="number" placeholder="0.00" value={amtInput} onChange={e => setAmtInput(e.target.value)} />
          </div>
          <button className={styles.btn} onClick={pay}>Pay via UPI →</button>
        </div>
      </div>
    </div>
  );
}
