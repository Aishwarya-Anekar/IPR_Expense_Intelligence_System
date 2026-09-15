// src/components/TransactionItem.jsx
import { CAT_META } from '../context/TransactionContext';
import styles from './TransactionItem.module.css';

export default function TransactionItem({ txn }) {
  const meta = CAT_META[txn.category] || CAT_META['Other'];
  return (
    <div className={styles.item}>
      <div className={styles.icon} style={{ background: meta.bg }}>
        {meta.icon}
      </div>
      <div className={styles.info}>
        <div className={styles.merchant}>
          {txn.merchant}
          <span className={styles.badge} style={{ background: meta.bg, color: meta.color }}>
            {txn.category}
          </span>
        </div>
        <div className={styles.meta}>{txn.time} · ML {txn.conf}% confident</div>
      </div>
      <div className={styles.amount}>-₹{txn.amount.toLocaleString('en-IN')}</div>
    </div>
  );
}
