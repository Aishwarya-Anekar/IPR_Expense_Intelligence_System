# 💳 PaySmart — React + Flask + SQLite

## 🚀 How to Run (2 terminals needed)

### Terminal 1 — Backend (Flask + SQLite)
```bash
pip install flask flask-cors scikit-learn pandas numpy
python train_model.py     # trains ML model → saves model.pkl
python app.py             # starts API at http://localhost:5000
```

### Terminal 2 — Frontend (React)
```bash
npm install
npm start                 # opens http://localhost:3000
```

## Validation

Run these checks from the `paysmart` folder after installing dependencies:

```bash
python train_model.py
python -m unittest discover -s tests -v
python scripts/validate_backend.py
npm run validate
```

The backend tests use a temporary SQLite database and cover health checks, authentication,
ML report delivery, UPI setup enforcement, payment completion, and registration validation.
GitHub Actions runs the backend tests and frontend build on every push and pull request.

## 🗂 Project Structure
```
paysmart/
├── app.py                ← Flask API (backend)
├── train_model.py        ← ML model training
├── expense_dataset.csv   ← Training dataset
├── model.pkl             ← Saved ML model (after training)
├── paysmart.db           ← SQLite database (auto-created)
├── requirements.txt      ← Python dependencies
├── package.json          ← React dependencies
├── public/index.html
└── src/
    ├── context/
    │   ├── AuthContext.jsx         ← Login/Register → Flask API
    │   └── TransactionContext.jsx  ← Transactions → Flask API
    ├── components/
    │   ├── Sidebar.jsx
    │   └── TransactionItem.jsx
    ├── pages/
    │   ├── Auth.jsx       ← Login & Register
    │   ├── Home.jsx       ← Balance + recent transactions
    │   ├── SendMoney.jsx  ← ML prediction + payment
    │   ├── QR.jsx         ← QR code
    │   ├── History.jsx    ← All transactions
    │   └── Dashboard.jsx  ← Charts + budget
    ├── App.jsx
    └── index.css

## 🔑 Demo Login
Email: arjun@demo.com
Password: Demo@123
Or click "Demo Login" button

## 🗃️ Database (paysmart.db)
Tables:
- users        → stores all registered users
- transactions → stores all payments with ML category
```
