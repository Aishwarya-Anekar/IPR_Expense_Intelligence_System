// src/pages/QR.jsx
import { useMemo, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../context/AuthContext';
import { useTransactions } from '../context/TransactionContext';
import styles from './QR.module.css';

export default function QR() {
  const { currentUser, verifyPin } = useAuth();
  const { mlPredict, addTransaction } = useTransactions();
  const [upiInput, setUpiInput] = useState('');
  const [amtInput, setAmtInput] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(false);
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
    setError('');
  }

  function downloadQr() {
    const svg = qrRef.current?.querySelector('svg');
    if (!svg) return;
    const source = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = 'paysmart-qr.svg';
    link.href = url;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  async function pay() {
    const amount = Number(amtInput);
    const recipientUpi = upiInput.trim().toLowerCase();
    if (!recipientUpi || !recipientUpi.includes('@') || recipientUpi.includes(' ')) {
      setError('Enter a valid recipient UPI ID.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Enter an amount greater than zero.');
      return;
    }
    if (!/^\d{4}$/.test(pinInput)) {
      setError('Enter your 4-digit UPI PIN.');
      return;
    }
    if (recipientUpi === currentUser?.upi?.toLowerCase()) {
      setError('You cannot pay your own UPI ID.');
      return;
    }

    setProcessing(true);
    setError('');
    setSuccess(false);
    try {
      if (!(await verifyPin(pinInput))) {
        throw new Error('Incorrect UPI PIN.');
      }
      const merchant = recipientUpi.split('@')[0];
      const pred = await mlPredict(merchant, amount);
      await addTransaction(merchant, amount, pred.category, pred.confidence, recipientUpi, false);
      setSuccess(true);
      setUpiInput('');
      setAmtInput('');
      setPinInput('');
    } catch (paymentError) {
      setError(paymentError.message || 'Payment failed. Please try again.');
    } finally {
      setProcessing(false);
    }
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
          {success && <div className={styles.successBanner}>✅ Payment successful and recorded</div>}
          {error && <div className={styles.errorBanner}>{error}</div>}
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
            <input className={styles.input} type="number" min="0.01" step="0.01" placeholder="0.00" value={amtInput} onChange={e => { setAmtInput(e.target.value); setError(''); }} />
          </div>
          <div className={styles.formGroup}>
            <label className={styles.label}>UPI PIN</label>
            <input className={styles.input} type="password" inputMode="numeric" maxLength={4} placeholder="4-digit PIN" value={pinInput} onChange={e => { setPinInput(e.target.value.replace(/\D/g, '')); setError(''); }} />
          </div>
          <button className={styles.btn} onClick={pay} disabled={processing}>{processing ? 'Processing...' : 'Pay via UPI →'}</button>
        </div>
      </div>
    </div>
  );
}
