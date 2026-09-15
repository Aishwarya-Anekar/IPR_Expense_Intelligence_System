# 💳 PaySmart — Expense Intelligence System

> **An ML-powered digital payment and personal expense intelligence system for transaction management, automated expense categorization, spending analysis, and budget monitoring.**

PaySmart is a full-stack web application that combines **digital payment simulation with Machine Learning-based expense categorization and financial analytics**.

The system allows users to register and securely log in, configure their UPI details, perform simulated UPI transactions, view transaction history, analyze spending patterns, set category-wise monthly limits, and obtain ML-powered expense predictions.

The project also provides a dedicated **ML Model Report** containing model accuracy, algorithm comparison, feature importance, classification metrics, and live prediction functionality.

---

## 🚀 Key Features

### 🔐 User Authentication

* User registration and login
* Password hashing
* JWT-based authentication
* Access and refresh token mechanism
* Session management
* Protected API routes
* Logout and session revocation
* User-specific transaction data

---

### 💰 Simulated UPI Payment System

* UPI ID setup
* UPI PIN configuration
* PIN-based payment authorization
* Merchant/payment recipient handling
* Transaction amount validation
* Balance validation
* Transaction recording
* Account ledger management
* Payment success/failure handling

> **Note:** PaySmart implements a simulated UPI payment environment for academic/project purposes. It does not transfer real money or connect directly to banks/NPCI payment infrastructure.

---

### 🤖 Machine Learning Expense Categorization

PaySmart automatically predicts the category of an expense using a trained Machine Learning model.

The system uses features such as:

* Transaction amount
* Log-transformed amount
* Amount range/bucket
* Hour of transaction
* Day of week
* Month
* Encoded merchant

The trained **Random Forest Classifier** is used as the primary prediction model.

Supported expense categories include:

* Restaurant
* Market
* Food
* Coffee
* Transport
* Business
* Mobile Recharge
* Electricity
* Medicines
* Hospital
* Stationary
* Entertainment
* Education
* Other

---

### 📊 Expense Intelligence Dashboard

The dashboard provides a visual analysis of the user's spending.

It includes:

* Total spending for the current month
* Total number of transactions
* Average transaction amount
* Top spending category
* Category-wise spending chart
* Monthly spending trend
* Category spending limits
* Limit utilization
* Spending warnings
* Month-over-month spending alerts

---

### 🎯 Category-wise Spending Limits

Users can define their own monthly spending limits for different categories.

The system provides:

* Monthly category limits
* Current spending calculation
* Percentage of limit used
* Remaining amount
* 80% threshold warning
* Limit exceeded notification
* Payment-time limit warnings

Limits are stored per month so that they can be maintained across monthly periods.

---

### 📈 ML Model Evaluation

A dedicated ML Report page provides detailed information about the trained model.

It displays:

* Overall model accuracy
* Number of training samples
* Number of expense categories
* Number of features
* Algorithm comparison
* Feature importance
* Precision
* Recall
* F1-score
* Support
* Live ML prediction

The project compares:

1. Naive Bayes
2. Logistic Regression
3. Decision Tree
4. Random Forest

The Random Forest model is used as the primary model.

---

### 🧾 Transaction History

Users can view their previous transactions with information such as:

* Merchant
* Amount
* Category
* Date/time
* Prediction confidence

Transactions are associated with the authenticated user.

---

### 📱 QR Code Support

The application provides QR-code functionality for the simulated payment workflow, allowing users to generate/use QR-based payment information within the application.

---

## 🏗️ System Architecture

```text
                    ┌──────────────────────────┐
                    │       React Frontend     │
                    │                          │
                    │  Authentication          │
                    │  Dashboard               │
                    │  Payments                │
                    │  Transactions            │
                    │  ML Report               │
                    │  Spending Limits         │
                    └────────────┬─────────────┘
                                 │
                                 │ REST API
                                 ▼
                    ┌──────────────────────────┐
                    │      Flask Backend       │
                    │                          │
                    │ Authentication API       │
                    │ Transaction API          │
                    │ UPI Setup API            │
                    │ Prediction API            │
                    │ ML Report API            │
                    └────────────┬─────────────┘
                                 │
                ┌────────────────┼────────────────┐
                │                │                │
                ▼                ▼                ▼
        ┌─────────────┐   ┌─────────────┐   ┌──────────────┐
        │   SQLite    │   │ ML Model    │   │   Training   │
        │  Database   │   │ Random      │   │   Dataset    │
        │             │   │ Forest      │   │              │
        └─────────────┘   └─────────────┘   └──────────────┘
```

---

## 🛠️ Technology Stack

### Frontend

* React.js
* React Router
* JavaScript
* CSS Modules
* Chart.js
* React Chart.js 2
* QRCode React

### Backend

* Python
* Flask
* Flask REST APIs
* SQLite
* JWT Authentication
* Password Hashing

### Machine Learning

* Python
* Scikit-learn
* Pandas
* NumPy
* Random Forest
* Logistic Regression
* Decision Tree
* Gaussian Naive Bayes
* Label Encoding

### Development & Testing

* Git
* GitHub
* GitHub Actions
* Node.js
* npm
* Python unittest

---

## 📁 Project Structure

```text
IPR_Expense_Intelligence_System/
│
├── .github/
│   └── workflows/
│       └── ci.yml
│
├── paysmart/
│   │
│   ├── src/
│   │   ├── components/
│   │   │   ├── Sidebar.jsx
│   │   │   └── ...
│   │   │
│   │   ├── context/
│   │   │   ├── AuthContext.jsx
│   │   │   └── TransactionContext.jsx
│   │   │
│   │   ├── pages/
│   │   │   ├── Auth.jsx
│   │   │   ├── Home.jsx
│   │   │   ├── SendMoney.jsx
│   │   │   ├── QR.jsx
│   │   │   ├── History.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── MLReport.jsx
│   │   │   ├── Limits.jsx
│   │   │   └── UpiSetup.jsx
│   │   │
│   │   ├── App.jsx
│   │   └── ...
│   │
│   ├── app.py
│   ├── train_model.py
│   ├── requirements.txt
│   ├── package.json
│   ├── package-lock.json
│   ├── expense_dataset.csv
│   ├── tests/
│   │   └── test_api.py
│   │
│   └── scripts/
│       └── validate_backend.py
│
└── README.md
```

---

# 🧠 Machine Learning Pipeline

The ML pipeline consists of the following steps:

```text
Transaction Dataset
        │
        ▼
Data Preprocessing
        │
        ▼
Feature Engineering
        │
        ├── Amount
        ├── Amount Log
        ├── Amount Bin
        ├── Hour
        ├── Day of Week
        ├── Month
        └── Merchant Encoding
        │
        ▼
Train/Test Split
       80/20
        │
        ▼
Train Multiple Algorithms
        │
        ├── Naive Bayes
        ├── Logistic Regression
        ├── Decision Tree
        └── Random Forest
        │
        ▼
Model Evaluation
        │
        ├── Accuracy
        ├── Precision
        ├── Recall
        ├── F1 Score
        └── Feature Importance
        │
        ▼
Random Forest Model
        │
        ▼
model.pkl
        │
        ▼
Flask Prediction API
        │
        ▼
React ML Prediction Interface
```

---

# 📊 Model Training

The project includes `train_model.py`, which:

1. Loads the expense dataset.
2. Generates a synthetic dataset if the required dataset is unavailable.
3. Performs date/time feature extraction.
4. Performs amount transformation.
5. Encodes merchant and category values.
6. Splits the dataset into training and testing sets.
7. Trains multiple ML algorithms.
8. Evaluates their accuracy.
9. Generates a classification report.
10. Calculates Random Forest feature importance.
11. Saves the trained model to `model.pkl`.

### Run model training

```bash
cd paysmart
python train_model.py
```

---

# 🔌 Backend API

The Flask backend provides APIs for:

### Authentication

```text
POST /auth/register
POST /auth/login
POST /auth/refresh
POST /auth/logout
```

### Transactions

```text
GET  /transactions/<user_id>
POST /transactions
```

### Machine Learning

```text
POST /predict
GET  /ml/report
```

### Health Check

```text
GET /
```

The backend validates authenticated users before allowing access to protected resources.

---

# 💻 Installation & Setup

## Prerequisites

Make sure the following are installed:

* Python 3.10+
* Node.js 18+
* npm
* Git

---

## 1. Clone the Repository

```bash
git clone https://github.com/Aishwarya-Anekar/IPR_Expense_Intelligence_System.git
```

```bash
cd IPR_Expense_Intelligence_System
```

---

# 🐍 2. Backend Setup

Navigate to the project directory:

```bash
cd paysmart
```

Create a virtual environment:

### Windows

```bash
python -m venv .venv
```

Activate it:

```bash
.venv\Scripts\activate
```

### macOS/Linux

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install Python dependencies:

```bash
pip install -r requirements.txt
```

---

# 🤖 3. Train the ML Model

Run:

```bash
python train_model.py
```

This creates:

```text
model.pkl
```

if the model does not already exist.

---

# 🚀 4. Start the Flask Backend

Run:

```bash
python app.py
```

The backend will run locally, typically on:

```text
http://localhost:5000
```

---

# ⚛️ 5. Frontend Setup

Open another terminal.

Navigate to:

```bash
cd paysmart
```

Install dependencies:

```bash
npm install
```

Start the React application:

```bash
npm start
```

The frontend will normally be available at:

```text
http://localhost:3000
```

---

# 🔄 Application Workflow

```text
User Registration/Login
          │
          ▼
      UPI Setup
          │
          ▼
     Home Dashboard
          │
          ├───────────────┐
          ▼               ▼
    Send Payment      Scan/Generate QR
          │
          ▼
    Enter Amount
          │
          ▼
   ML Expense Prediction
          │
          ▼
   Category Identification
          │
          ▼
   Check Spending Limit
          │
          ▼
      Enter UPI PIN
          │
          ▼
 Simulated Transaction
          │
          ▼
   Database + Ledger
          │
          ▼
   Transaction History
          │
          ▼
   Expense Intelligence
          │
          ├── Dashboard
          ├── Charts
          ├── Spending Alerts
          └── ML Report
```

---

# 🎯 Expense Intelligence Workflow

```text
Transaction
     │
     ▼
Merchant + Amount
     │
     ▼
ML Prediction
     │
     ▼
Expense Category
     │
     ▼
Monthly Category Spending
     │
     ▼
Compare With User Limit
     │
     ├── < 80% → Normal
     │
     ├── 80–99% → Warning
     │
     └── ≥ 100% → Limit Exceeded
```

The dashboard also compares current-month spending against the previous month and generates alerts for significant increases.

---

# 🧪 Testing

The project contains backend regression tests.

Run:

```bash
python -m unittest discover -s tests -v
```

The test suite validates important application functionality including:

* Backend health
* Authentication
* ML report
* UPI setup
* Payment restrictions
* User registration
* API behavior

---

# ⚙️ Continuous Integration

GitHub Actions is configured through:

```text
.github/workflows/ci.yml
```

The CI pipeline performs:

```text
Checkout Repository
        ↓
Setup Python
        ↓
Install Python Dependencies
        ↓
Train ML Model
        ↓
Run Backend Tests
        ↓
Setup Node.js
        ↓
Install Frontend Dependencies
        ↓
Build React Application
```

This helps verify that the project can be installed, tested, and built automatically.

---

# 🔒 Security Features

PaySmart implements several security mechanisms:

* Password hashing
* JWT authentication
* Access tokens
* Refresh tokens
* HTTP-only refresh cookie
* Session expiration
* Session revocation
* Protected API routes
* User-specific transaction access
* Input validation
* UPI PIN verification

> This project is intended as an academic prototype and should not be considered a production banking application.

---


# 🎓 Academic Relevance

PaySmart demonstrates the integration of multiple technologies into a single financial application.

### Major technical areas

```text
Full-Stack Web Development
        +
REST API Development
        +
Database Management
        +
Authentication & Security
        +
Machine Learning
        +
Data Analysis
        +
Data Visualization
        +
Software Testing
        +
Continuous Integration
```

The primary technical contribution is the integration of **ML-based expense categorization with transaction management and expense intelligence**, enabling users to understand their spending patterns and monitor category-wise budgets.

---

# 📈 Expected Outcome

The system provides users with a unified platform to:

* Manage their simulated digital payments
* Automatically categorize expenses
* Monitor monthly spending
* Visualize financial behavior
* Set category-wise spending limits
* Receive spending alerts
* Analyze ML model performance
* Make better spending decisions

---
## ⭐ Project Highlights

```text
✔ Full-stack React + Flask application
✔ Secure user authentication
✔ Simulated UPI payment workflow
✔ Transaction management
✔ ML-based expense categorization
✔ Random Forest classification
✔ Multi-algorithm comparison
✔ Feature importance analysis
✔ Spending analytics dashboard
✔ Category-wise budget limits
✔ Intelligent spending alerts
✔ Transaction history
✔ QR-code functionality
✔ Backend API testing
✔ GitHub Actions CI
```
