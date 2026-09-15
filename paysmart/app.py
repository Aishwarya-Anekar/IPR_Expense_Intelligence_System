# ============================================================
#   PaySmart — Flask + SQLite Backend
#   Run: python app.py
#   API runs at: http://localhost:5000
# ============================================================

from flask import Flask, request, jsonify, make_response
from flask_cors import CORS
import sqlite3
import pickle
import numpy as np
import pandas as pd
from datetime import datetime
import os
import hashlib
import secrets
from datetime import timedelta
from functools import wraps
import jwt
from werkzeug.security import generate_password_hash, check_password_hash
import warnings
warnings.filterwarnings('ignore')

app = Flask(__name__)
CORS(app, supports_credentials=True)

DB = os.environ.get('PAYSMART_DB_PATH', 'paysmart.db')
JWT_SECRET = os.environ.get('PAYSMART_JWT_SECRET', 'development-only-change-this-secret')
ACCESS_TOKEN_MINUTES = 15
REFRESH_TOKEN_DAYS = 7
REFRESH_COOKIE = 'paysmart_refresh'

# ─────────────────────────────────────────
# Load ML Model
# ─────────────────────────────────────────
MODEL_DATA = None


def load_model():
    global MODEL_DATA
    if os.path.exists('model.pkl'):
        with open('model.pkl', 'rb') as f:
            MODEL_DATA = pickle.load(f)
        print("✅ ML Model loaded")
        return

    try:
        import train_model
        print("⚠️  model.pkl not found — generating it automatically...")
        train_model.ensure_model_ready()
        with open('model.pkl', 'rb') as f:
            MODEL_DATA = pickle.load(f)
        print("✅ ML Model created automatically")
    except Exception as exc:
        print(f"⚠️  Auto-training failed: {exc}")


load_model()

# ─────────────────────────────────────────
# Database Setup
# ─────────────────────────────────────────
def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row  # return dict-like rows
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()

    # Users table
    c.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            firstname TEXT NOT NULL,
            lastname  TEXT NOT NULL,
            email     TEXT UNIQUE NOT NULL,
            phone     TEXT NOT NULL,
            upi       TEXT NOT NULL,
            password  TEXT NOT NULL,
            balance   REAL DEFAULT 24580.0,
            account_number TEXT UNIQUE,
            created   TEXT DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    columns = [row[1] for row in c.execute('PRAGMA table_info(users)').fetchall()]
    if 'account_number' not in columns:
        # SQLite does not allow adding a UNIQUE column to an existing table.
        # Use a non-unique column first, backfill generated values, and then
        # enforce uniqueness with a partial unique index that ignores NULLs.
        c.execute('ALTER TABLE users ADD COLUMN account_number TEXT')

    # Backfill missing or duplicate account numbers before creating the unique index.
    users = c.execute('SELECT id, account_number FROM users ORDER BY id').fetchall()
    seen = set()
    for user in users:
        raw = (user['account_number'] or '').strip()
        if not raw:
            raw = f"PAYS{user['id']:06d}"
        if raw in seen:
            raw = f"PAYS{user['id']:06d}"
            while raw in seen:
                raw = f"PAYS{user['id']:06d}-{len(seen) + 1}"
        seen.add(raw)
        c.execute('UPDATE users SET account_number = ? WHERE id = ?', (raw, user['id']))

    # Enforce uniqueness without violating the SQLite table-alter constraint.
    c.execute(
        'CREATE UNIQUE INDEX IF NOT EXISTS idx_users_account_number '
        'ON users(account_number) WHERE account_number IS NOT NULL'
    )

    if 'upi_pin_hash' not in columns:
        c.execute('ALTER TABLE users ADD COLUMN upi_pin_hash TEXT')

    if 'bank_name' not in columns:
        c.execute('ALTER TABLE users ADD COLUMN bank_name TEXT')
    if 'ifsc_code' not in columns:
        c.execute('ALTER TABLE users ADD COLUMN ifsc_code TEXT')
    if 'upi_setup_completed' not in columns:
        c.execute('ALTER TABLE users ADD COLUMN upi_setup_completed INTEGER NOT NULL DEFAULT 0')

    c.execute('''
        CREATE TABLE IF NOT EXISTS auth_sessions (
            id           TEXT PRIMARY KEY,
            user_id      INTEGER NOT NULL,
            token_hash   TEXT UNIQUE NOT NULL,
            expires_at   TEXT NOT NULL,
            revoked_at   TEXT,
            created_at   TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    # Transactions table
    c.execute('''
        CREATE TABLE IF NOT EXISTS transactions (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id    INTEGER NOT NULL,
            merchant   TEXT NOT NULL,
            amount     REAL NOT NULL,
            category   TEXT NOT NULL,
            confidence INTEGER DEFAULT 0,
            date       TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    ''')

    c.execute('''
        CREATE TABLE IF NOT EXISTS account_ledger (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            payer_id      INTEGER NOT NULL,
            recipient_id  INTEGER NOT NULL,
            amount        REAL NOT NULL,
            note          TEXT,
            status        TEXT DEFAULT 'completed',
            created_at    TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (payer_id) REFERENCES users(id),
            FOREIGN KEY (recipient_id) REFERENCES users(id)
        )
    ''')

    # Ensure account numbers exist for demo and all users
    users = c.execute('SELECT id, account_number FROM users').fetchall()
    for user in users:
        if not user['account_number']:
            c.execute('UPDATE users SET account_number = ? WHERE id = ?', (f'PAYS{user["id"]:06d}', user['id']))

    # Insert demo user if not exists
    existing = c.execute("SELECT id FROM users WHERE email='arjun@demo.com'").fetchone()
    if not existing:
        c.execute('''
            INSERT INTO users (firstname, lastname, email, phone, upi, password, balance, account_number)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', ('Arjun', 'Sharma', 'arjun@demo.com', '9876543210',
              'arjun@paysmart', hash_password('Demo@123'), 24580.0, 'PAYS000001'))

        user_id = c.lastrowid

        # Seed transactions for demo user
        seed = [
            ('Zomato',        249,   'Restaurant', 93),
            ('DMart',         812,   'Market',     91),
            ('OlaCabs',       127,   'Transport',  88),
            ('Starbucks',     380,   'Coffee',     95),
            ('Swiggy',        340,   'Restaurant', 90),
            ('BigBazaar',     1200,  'Market',     87),
            ('Razorpay',      4999,  'Business',   89),
            ('CafeCoffeeDay', 210,   'Coffee',     92),
            ('IRCTC',         550,   'Transport',  85),
            ('KFC',           480,   'Restaurant', 91),
        ]
        for merchant, amount, category, conf in seed:
            c.execute('''
                INSERT INTO transactions (user_id, merchant, amount, category, confidence)
                VALUES (?, ?, ?, ?, ?)
            ''', (user_id, merchant, amount, category, conf))

        print("✅ Demo user + seed data inserted")

    conn.commit()
    conn.close()
    print("✅ Database ready:", DB)

def hash_password(password):
    return generate_password_hash(password)


def verify_password(stored_hash, password):
    if not stored_hash:
        return False
    try:
        if stored_hash.startswith(('scrypt:', 'pbkdf2:')):
            return check_password_hash(stored_hash, password)
    except ValueError:
        return False
    # Keep existing demo accounts usable, then upgrade them on successful login.
    return hashlib.sha256(password.encode()).hexdigest() == stored_hash


def user_payload(user):
    return {
        'id': user['id'], 'firstname': user['firstname'],
        'lastname': user['lastname'], 'email': user['email'],
        'phone': user['phone'], 'upi': user['upi'],
        'balance': user['balance'], 'has_pin': bool(user['upi_pin_hash']),
        'bank_name': user['bank_name'], 'ifsc_code': user['ifsc_code'],
        'upi_setup_completed': bool(user['upi_setup_completed'])
    }


def issue_session(user_id):
    session_id = secrets.token_urlsafe(24)
    refresh_token = secrets.token_urlsafe(48)
    expires = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_DAYS)
    conn = get_db()
    conn.execute('''
        INSERT INTO auth_sessions (id, user_id, token_hash, expires_at)
        VALUES (?, ?, ?, ?)
    ''', (session_id, user_id, hashlib.sha256(refresh_token.encode()).hexdigest(), expires.isoformat()))
    conn.commit()
    conn.close()
    access_token = jwt.encode({
        'sub': str(user_id),
        'sid': session_id,
        'exp': datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_MINUTES)
    }, JWT_SECRET, algorithm='HS256')
    return access_token, refresh_token


def set_refresh_cookie(response, refresh_token):
    response.set_cookie(
        REFRESH_COOKIE, refresh_token,
        max_age=REFRESH_TOKEN_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=os.environ.get('PAYSMART_COOKIE_SECURE', '0') == '1',
        samesite='Lax',
        path='/auth'
    )
    return response


def require_auth(handler):
    @wraps(handler)
    def wrapped(*args, **kwargs):
        header = request.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            return jsonify({'error': 'Authentication required'}), 401
        try:
            claims = jwt.decode(header[7:], JWT_SECRET, algorithms=['HS256'])
            conn = get_db()
            session = conn.execute(
                'SELECT * FROM auth_sessions WHERE id=? AND user_id=? AND revoked_at IS NULL',
                (claims['sid'], int(claims['sub']))
            ).fetchone()
            conn.close()
            if not session or datetime.fromisoformat(session['expires_at']) <= datetime.utcnow():
                return jsonify({'error': 'Session expired'}), 401
            request.auth_user_id = int(claims['sub'])
        except (jwt.InvalidTokenError, KeyError, ValueError, TypeError):
            return jsonify({'error': 'Invalid authentication token'}), 401
        return handler(*args, **kwargs)
    return wrapped


def own_user_id(route_user_id=None):
    if route_user_id is not None and int(route_user_id) != request.auth_user_id:
        return None
    return request.auth_user_id


def normalize_upi(value):
    return (value or '').strip().lower()


def get_user_by_upi(conn, upi):
    key = normalize_upi(upi)
    if not key:
        return None
    return conn.execute(
        'SELECT * FROM users WHERE lower(upi)=? COLLATE NOCASE',
        (key,)
    ).fetchone()


def get_user_by_email(conn, email):
    key = normalize_upi(email)
    if not key:
        return None
    return conn.execute(
        'SELECT * FROM users WHERE lower(email)=? COLLATE NOCASE',
        (key,)
    ).fetchone()


def has_upi_setup(user_id):
    conn = get_db()
    user = conn.execute(
        'SELECT upi, upi_pin_hash, bank_name, account_number, ifsc_code, upi_setup_completed '
        'FROM users WHERE id=?', (user_id,)
    ).fetchone()
    conn.close()
    return bool(user and user['upi_setup_completed'] and user['upi'] and
                user['upi_pin_hash'] and user['bank_name'] and
                user['account_number'] and user['ifsc_code'])


# ─────────────────────────────────────────
# ML Prediction Helper
# ─────────────────────────────────────────
ML_MAP = {
    'zomato':'Restaurant','swiggy':'Restaurant','mcdonalds':'Restaurant',
    'kfc':'Restaurant','dominos':'Restaurant','biryani':'Restaurant',
    'dmart':'Market','bigbazaar':'Market','reliance':'Market',
    'zepto':'Market','blinkit':'Market','grofers':'Market',
    'starbucks':'Coffee','cafecoffeeday':'Coffee','barista':'Coffee','cafe':'Coffee',
    'ola':'Transport','uber':'Transport','rapido':'Transport','irctc':'Transport',
    'redbus':'Transport','metro':'Transport','makemytrip':'Transport',
    'zoho':'Business','razorpay':'Business','meesho':'Business','indiamart':'Business',
}

def ml_predict(merchant, amount):
    # Try trained model first
    if MODEL_DATA:
        try:
            model       = MODEL_DATA['model']
            le_merchant = MODEL_DATA['le_merchant']
            le_category = MODEL_DATA['le_category']
            features    = MODEL_DATA['features']

            now = datetime.now()
            merch_enc = le_merchant.transform([merchant])[0] if merchant in le_merchant.classes_ else 0
            amount_log = np.log1p(amount)
            amount_bin = pd.cut([amount], bins=[0,5,15,40,100,300,99999], labels=[0,1,2,3,4,5]).astype(int)[0]

            X = pd.DataFrame([[amount, amount_log, amount_bin,
                                now.hour, now.weekday(), now.month,
                                merch_enc]], columns=features)
            pred     = model.predict(X)[0]
            proba    = model.predict_proba(X)[0]
            category = le_category.inverse_transform([pred])[0]
            conf     = int(round(float(max(proba)) * 100))
            return category, conf
        except Exception as e:
            print("Model error:", e)

    # Fallback: keyword map
    key = merchant.lower().replace(' ', '')
    for k, cat in ML_MAP.items():
        if k in key:
            return cat, 85 + int(np.random.randint(0, 12))
    return 'Other', 62

# ─────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────

# Health check
@app.route('/', methods=['GET'])
def home():
    return jsonify({ 'status': 'running', 'message': 'PaySmart API is live!' })

# ── AUTH ──────────────────────────────────

@app.route('/auth/register', methods=['POST'])
def register():
    d = request.get_json()
    firstname = d.get('firstname','').strip()
    lastname  = d.get('lastname','').strip()
    email     = d.get('email','').strip().lower()
    phone     = d.get('phone','').strip()
    upi       = d.get('upi','').strip()
    password  = d.get('password','')
    confirm   = d.get('confirm','')

    # Validation
    if not firstname or not lastname: return jsonify({'error':'Please enter your full name'}), 400
    if not email or '@' not in email: return jsonify({'error':'Please enter a valid email'}), 400
    if not phone.isdigit() or len(phone) != 10: return jsonify({'error':'Enter a valid 10-digit mobile number'}), 400
    if not upi or '@' not in upi or ' ' in upi:
        return jsonify({'error':'Please enter a valid UPI ID'}), 400
    if len(password) < 6:   return jsonify({'error':'Password must be at least 6 characters'}), 400
    if password != confirm:  return jsonify({'error':'Passwords do not match'}), 400

    conn = get_db()
    try:
        conn.execute('''
            INSERT INTO users (firstname, lastname, email, phone, upi, password)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (firstname, lastname, email, phone, upi, hash_password(password)))
        conn.commit()

        user = conn.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
        access_token, refresh_token = issue_session(user['id'])
        response = jsonify({'success': True, 'user': user_payload(user), 'access_token': access_token})
        return set_refresh_cookie(response, refresh_token)
    except sqlite3.IntegrityError:
        return jsonify({'error': 'Account already exists with this email'}), 400
    finally:
        conn.close()


@app.route('/auth/login', methods=['POST'])
def login():
    d = request.get_json()
    email    = d.get('email','').strip().lower()
    password = d.get('password','')

    conn = get_db()
    user = conn.execute('SELECT * FROM users WHERE email=?', (email,)).fetchone()
    conn.close()

    if not user or not verify_password(user['password'], password):
        return jsonify({'error': 'Invalid email or password'}), 401

    if not user['password'].startswith(('scrypt:', 'pbkdf2:')):
        conn = get_db()
        conn.execute('UPDATE users SET password=? WHERE id=?', (hash_password(password), user['id']))
        conn.commit()
        conn.close()
    access_token, refresh_token = issue_session(user['id'])
    response = jsonify({'success': True, 'user': user_payload(user), 'access_token': access_token})
    return set_refresh_cookie(response, refresh_token)


@app.route('/auth/demo', methods=['POST'])
def demo_login():
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE email='arjun@demo.com'").fetchone()
    conn.close()
    if not user:
        return jsonify({'error': 'Demo user not found'}), 404
    access_token, refresh_token = issue_session(user['id'])
    response = jsonify({'success': True, 'user': user_payload(user), 'access_token': access_token})
    return set_refresh_cookie(response, refresh_token)


@app.route('/auth/refresh', methods=['POST'])
def refresh_session():
    refresh_token = request.cookies.get(REFRESH_COOKIE, '')
    token_hash = hashlib.sha256(refresh_token.encode()).hexdigest()
    conn = get_db()
    session = conn.execute(
        'SELECT * FROM auth_sessions WHERE token_hash=? AND revoked_at IS NULL',
        (token_hash,)
    ).fetchone()
    if not session or datetime.fromisoformat(session['expires_at']) <= datetime.utcnow():
        conn.close()
        return jsonify({'error': 'Refresh session expired'}), 401
    user = conn.execute('SELECT * FROM users WHERE id=?', (session['user_id'],)).fetchone()
    conn.execute('UPDATE auth_sessions SET revoked_at=? WHERE id=?', (datetime.utcnow().isoformat(), session['id']))
    conn.commit()
    conn.close()
    access_token, new_refresh_token = issue_session(user['id'])
    response = jsonify({'success': True, 'user': user_payload(user), 'access_token': access_token})
    return set_refresh_cookie(response, new_refresh_token)


@app.route('/auth/logout', methods=['POST'])
def logout():
    refresh_token = request.cookies.get(REFRESH_COOKIE, '')
    if refresh_token:
        conn = get_db()
        conn.execute(
            'UPDATE auth_sessions SET revoked_at=? WHERE token_hash=? AND revoked_at IS NULL',
            (datetime.utcnow().isoformat(), hashlib.sha256(refresh_token.encode()).hexdigest())
        )
        conn.commit()
        conn.close()
    response = jsonify({'success': True})
    response.delete_cookie(REFRESH_COOKIE, path='/auth')
    return response


@app.route('/auth/pin', methods=['POST'])
@require_auth
def set_pin():
    data = request.get_json() or {}
    pin = str(data.get('pin', ''))
    if not pin.isdigit() or len(pin) != 4:
        return jsonify({'error': 'PIN must be exactly 4 digits'}), 400

    bank_name = str(data.get('bank_name', '')).strip()
    account_number = str(data.get('account_number', '')).strip()
    ifsc_code = str(data.get('ifsc_code', '')).strip().upper()
    upi = normalize_upi(data.get('upi'))
    if not bank_name or not account_number.isdigit() or len(account_number) < 6:
        return jsonify({'error': 'Valid bank and account details are required'}), 400
    if not ifsc_code or len(ifsc_code) < 8 or ' ' in ifsc_code:
        return jsonify({'error': 'Valid IFSC code is required'}), 400

    conn = get_db()
    user = conn.execute('SELECT upi FROM users WHERE id=?', (request.auth_user_id,)).fetchone()
    if not user:
        conn.close()
        return jsonify({'error': 'User not found'}), 404
    if upi and ('@' not in upi or ' ' in upi):
        conn.close()
        return jsonify({'error': 'Please enter a valid UPI ID'}), 400
    conn.execute('''
        UPDATE users
        SET upi=COALESCE(NULLIF(?, ''), upi), bank_name=?, account_number=?,
            ifsc_code=?, upi_pin_hash=?, upi_setup_completed=1
        WHERE id=?
    ''', (upi, bank_name, account_number, ifsc_code, generate_password_hash(pin), request.auth_user_id))
    conn.commit()
    updated_user = conn.execute('SELECT * FROM users WHERE id=?', (request.auth_user_id,)).fetchone()
    conn.close()
    return jsonify({'success': True, 'user': user_payload(updated_user)})


@app.route('/auth/pin/verify', methods=['POST'])
@require_auth
def verify_pin():
    pin = str((request.get_json() or {}).get('pin', ''))
    conn = get_db()
    user = conn.execute('SELECT upi_pin_hash FROM users WHERE id=?', (request.auth_user_id,)).fetchone()
    conn.close()
    return jsonify({'valid': bool(user and user['upi_pin_hash'] and check_password_hash(user['upi_pin_hash'], pin))})

# ── ML PREDICT ────────────────────────────

@app.route('/predict', methods=['POST'])
@require_auth
def predict():
    d        = request.get_json()
    merchant = d.get('merchant','').strip()
    amount   = float(d.get('amount', 0))

    if not merchant or amount <= 0:
        return jsonify({'error': 'merchant and amount required'}), 400

    category, confidence = ml_predict(merchant, amount)

    return jsonify({
        'merchant':   merchant,
        'amount':     amount,
        'category':   category,
        'confidence': confidence
    })


@app.route('/ml/report', methods=['GET'])
@require_auth
def ml_report():
    if not MODEL_DATA:
        return jsonify({'error': 'ML model is not available'}), 503

    evaluation = MODEL_DATA.get('evaluation')
    if not evaluation:
        return jsonify({'error': 'Model evaluation metadata is missing. Run python train_model.py'}), 503

    classes = MODEL_DATA['le_category'].classes_.tolist()
    class_report = []
    for category in classes:
        metrics = evaluation['classification_report'].get(category, {})
        class_report.append({
            'cat': category,
            'precision': metrics.get('precision', 0),
            'recall': metrics.get('recall', 0),
            'f1': metrics.get('f1-score', 0),
            'support': int(metrics.get('support', 0)),
        })

    return jsonify({
        'model': 'Random Forest',
        'estimators': int(getattr(MODEL_DATA['model'], 'n_estimators', 0)),
        'accuracy': evaluation['accuracy'],
        'sample_count': evaluation['sample_count'],
        'test_count': evaluation['test_count'],
        'category_count': evaluation['category_count'],
        'feature_count': len(MODEL_DATA['features']),
        'algorithm_comparison': evaluation['algorithm_comparison'],
        'feature_importance': evaluation['feature_importance'],
        'classification_report': class_report,
    })

# ── TRANSACTIONS ──────────────────────────

@app.route('/transactions/<int:user_id>', methods=['GET'])
@require_auth
def get_transactions(user_id):
    user_id = own_user_id(user_id)
    if user_id is None:
        return jsonify({'error': 'Forbidden'}), 403
    conn = get_db()
    rows = conn.execute(
        'SELECT * FROM transactions WHERE user_id=? ORDER BY date DESC',
        (user_id,)
    ).fetchall()
    conn.close()

    txns = [{
        'id': r['id'], 'merchant': r['merchant'],
        'amount': r['amount'], 'category': r['category'],
        'confidence': r['confidence'], 'date': r['date']
    } for r in rows]

    return jsonify({'transactions': txns, 'total': len(txns)})


@app.route('/users/lookup', methods=['POST'])
@require_auth
def lookup_user():
    d = request.get_json() or {}
    search_value = (d.get('upi') or d.get('email') or '').strip()
    if not search_value:
        return jsonify({'error': 'UPI or email is required'}), 400

    conn = get_db()
    user = get_user_by_upi(conn, search_value) or get_user_by_email(conn, search_value)
    conn.close()

    if not user:
        return jsonify({'error': 'Recipient not found'}), 404

    return jsonify({
        'success': True,
        'user': {
            'id': user['id'],
            'firstname': user['firstname'],
            'lastname': user['lastname'],
            'email': user['email'],
            'upi': user['upi'],
            'account_number': user['account_number'],
            'balance': user['balance']
        }
    })


@app.route('/transfer', methods=['POST'])
@require_auth
def transfer_funds():
    if not has_upi_setup(request.auth_user_id):
        return jsonify({'error': 'Complete UPI setup before making payments'}), 403
    d = request.get_json() or {}
    payer_id = request.auth_user_id
    recipient_upi = normalize_upi(d.get('recipient_upi') or d.get('recipient') or '')
    amount = float(d.get('amount', 0) or 0)
    note = (d.get('note') or d.get('merchant') or 'Transfer').strip()
    category = (d.get('category') or 'Transfer').strip() or 'Transfer'
    confidence = int(d.get('confidence', 0) or 0)

    if not payer_id:
        return jsonify({'error': 'Payer is required'}), 400
    if not recipient_upi:
        return jsonify({'error': 'Recipient UPI is required'}), 400
    if amount <= 0:
        return jsonify({'error': 'Transfer amount must be greater than zero'}), 400

    conn = get_db()
    payer = conn.execute('SELECT * FROM users WHERE id=?', (payer_id,)).fetchone()
    if not payer:
        conn.close()
        return jsonify({'error': 'Payer account not found'}), 404

    recipient = get_user_by_upi(conn, recipient_upi)
    if not recipient:
        conn.close()
        return jsonify({'error': 'Recipient UPI not found'}), 404

    if int(payer['id']) == int(recipient['id']):
        conn.close()
        return jsonify({'error': 'Payer and recipient cannot be the same account'}), 400

    if float(payer['balance']) < amount:
        conn.close()
        return jsonify({'error': 'Insufficient balance for this transfer'}), 400

    now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    try:
        conn.execute('BEGIN IMMEDIATE')
        conn.execute('UPDATE users SET balance = balance - ? WHERE id=?', (amount, payer_id))
        conn.execute('UPDATE users SET balance = balance + ? WHERE id=?', (amount, recipient['id']))
        conn.execute('''
            INSERT INTO transactions (user_id, merchant, amount, category, confidence, date)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (payer_id, note or recipient['upi'], amount, category, confidence, now))
        conn.execute('''
            INSERT INTO transactions (user_id, merchant, amount, category, confidence, date)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (recipient['id'], payer['upi'], amount, 'Incoming Transfer', 100, now))
        conn.execute('''
            INSERT INTO account_ledger (payer_id, recipient_id, amount, note, status, created_at)
            VALUES (?, ?, ?, ?, 'completed', ?)
        ''', (payer_id, recipient['id'], amount, note, now))
        conn.commit()

        updated_payer = conn.execute('SELECT balance FROM users WHERE id=?', (payer_id,)).fetchone()
        updated_recipient = conn.execute('SELECT balance FROM users WHERE id=?', (recipient['id'],)).fetchone()
        conn.close()

        return jsonify({
            'success': True,
            'transfer_id': conn.execute('SELECT last_insert_rowid() AS id').fetchone()['id'] if False else None,
            'payer_balance': float(updated_payer['balance']),
            'recipient_balance': float(updated_recipient['balance']),
            'recipient': {
                'id': recipient['id'],
                'name': f"{recipient['firstname']} {recipient['lastname']}".strip(),
                'upi': recipient['upi'],
                'account_number': recipient['account_number']
            }
        })
    except Exception as exc:
        conn.rollback()
        conn.close()
        return jsonify({'error': str(exc)}), 500


@app.route('/transactions', methods=['POST'])
@require_auth
def add_transaction():
    if not has_upi_setup(request.auth_user_id):
        return jsonify({'error': 'Complete UPI setup before making payments'}), 403
    d = request.get_json() or {}
    if d.get('recipient_upi') or d.get('recipient'):
        return transfer_funds()

    user_id    = request.auth_user_id
    merchant   = d.get('merchant','').strip()
    amount     = float(d.get('amount', 0) or 0)
    category   = d.get('category','')
    confidence = d.get('confidence', 0)

    if not all([user_id, merchant, amount, category]):
        return jsonify({'error': 'Missing required fields'}), 400

    conn = get_db()
    user = conn.execute('SELECT balance FROM users WHERE id=?', (user_id,)).fetchone()
    if not user:
        conn.close()
        return jsonify({'error': 'User not found'}), 404
    if float(user['balance']) < amount:
        conn.close()
        return jsonify({'error': 'Insufficient balance'}), 400

    conn.execute('UPDATE users SET balance = balance - ? WHERE id=?', (amount, user_id))
    conn.execute('''
        INSERT INTO transactions (user_id, merchant, amount, category, confidence)
        VALUES (?, ?, ?, ?, ?)
    ''', (user_id, merchant, amount, category, confidence))
    conn.commit()

    user = conn.execute('SELECT balance FROM users WHERE id=?', (user_id,)).fetchone()
    conn.close()

    return jsonify({'success': True, 'balance': user['balance']})

# ── DASHBOARD ─────────────────────────────

@app.route('/dashboard/<int:user_id>', methods=['GET'])
@require_auth
def dashboard(user_id):
    user_id = own_user_id(user_id)
    if user_id is None:
        return jsonify({'error': 'Forbidden'}), 403
    conn = get_db()
    rows = conn.execute(
        'SELECT * FROM transactions WHERE user_id=? ORDER BY date DESC',
        (user_id,)
    ).fetchall()
    conn.close()

    if not rows:
        return jsonify({'category_wise':[], 'month_wise':[], 'total':0, 'count':0})

    df = pd.DataFrame([dict(r) for r in rows])
    df['date'] = pd.to_datetime(df['date'])
    df['month'] = df['date'].dt.strftime('%b %Y')

    # Category totals
    cat_wise = (
        df.groupby('category')['amount'].sum().round(2)
        .reset_index().rename(columns={'amount':'total'})
        .sort_values('total', ascending=False)
        .to_dict(orient='records')
    )

    # Month-wise totals
    month_wise = (
        df.groupby('month')['amount'].sum().round(2)
        .reset_index().rename(columns={'amount':'total'})
        .to_dict(orient='records')
    )

    total = round(df['amount'].sum(), 2)
    count = len(df)
    avg   = round(total/count, 2) if count else 0
    top   = cat_wise[0]['category'] if cat_wise else None

    return jsonify({
        'category_wise': cat_wise,
        'month_wise':    month_wise,
        'total':         total,
        'count':         count,
        'avg':           avg,
        'top_category':  top
    })

# ─────────────────────────────────────────
# Run
# ─────────────────────────────────────────
if __name__ == '__main__':
    init_db()
    print("\n" + "="*50)
    print("  🚀 PaySmart API → http://localhost:5000")
    print("="*50 + "\n")
    app.run(debug=True, port=5000)
