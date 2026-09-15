# ============================================================
#   STEP 1: Train ML Model & Save as model.pkl
#   Run this file ONCE before starting the Flask API
#   Command: python train_model.py
# ============================================================

import os
import pickle
import random
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import accuracy_score, classification_report
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import GaussianNB
from sklearn.preprocessing import LabelEncoder
from sklearn.tree import DecisionTreeClassifier

import warnings
warnings.filterwarnings('ignore')


def generate_synthetic_dataset(path='expense_dataset.csv', rows=2500):
    """Create a realistic fallback dataset if the original CSV is absent."""
    if os.path.exists(path):
        return path

    rng = random.Random(42)
    merchants = {
        'Zomato': 'Restaurant',
        'Swiggy': 'Restaurant',
        'KFC': 'Restaurant',
        'McDonalds': 'Restaurant',
        'DMart': 'Market',
        'BigBazaar': 'Market',
        'Reliance': 'Market',
        'Blinkit': 'Market',
        'Starbucks': 'Coffee',
        'CafeCoffeeDay': 'Coffee',
        'Barista': 'Coffee',
        'OlaCabs': 'Transport',
        'Uber': 'Transport',
        'IRCTC': 'Transport',
        'Rapido': 'Transport',
        'Razorpay': 'Business',
        'Zoho': 'Business',
        'Meesho': 'Business',
    }

    records = []
    start_date = datetime.now() - timedelta(days=365)

    for i in range(rows):
        merchant, category = list(merchants.items())[i % len(merchants)]
        base_amount = [120, 180, 260, 380, 620, 910, 1350, 2000, 3200, 4600][i % 10]
        amount = max(60, base_amount + rng.randint(-80, 120))
        dt = start_date + timedelta(days=i // 6, hours=(i * 7) % 24, minutes=(i * 13) % 60)
        records.append({
            'date': dt.strftime('%Y-%m-%d %H:%M:%S'),
            'merchant': merchant,
            'amount': round(amount, 2),
            'category': category
        })

    df = pd.DataFrame(records)
    df.to_csv(path, index=False)
    print(f"✅ Created synthetic dataset: {path} ({len(df)} rows)")
    return path


def train_and_save_model(dataset_path='expense_dataset.csv'):
    print("=" * 50)
    print("   TRAINING ML MODEL...")
    print("=" * 50)

    df = pd.read_csv(dataset_path)
    print(f"\n✅ Dataset loaded: {df.shape[0]} rows")

    df['date'] = pd.to_datetime(df['date'])
    df['hour'] = df['date'].dt.hour
    df['day_of_week'] = df['date'].dt.dayofweek
    df['month'] = df['date'].dt.month
    df['amount_log'] = np.log1p(df['amount'])
    df['amount_bin'] = pd.cut(
        df['amount'],
        bins=[0, 5, 15, 40, 100, 300, 99999],
        labels=[0, 1, 2, 3, 4, 5]
    ).astype(int)

    le_merchant = LabelEncoder()
    df['merchant_enc'] = le_merchant.fit_transform(df['merchant'])

    le_category = LabelEncoder()
    y = le_category.fit_transform(df['category'])

    FEATURES = ['amount', 'amount_log', 'amount_bin',
                'hour', 'day_of_week', 'month', 'merchant_enc']
    X = df[FEATURES]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    model = RandomForestClassifier(
        n_estimators=300,
        max_depth=25,
        random_state=42,
        n_jobs=-1
    )
    model.fit(X_train, y_train)

    predictions = model.predict(X_test)
    acc = accuracy_score(y_test, predictions)
    print(f"✅ Model trained — Accuracy: {acc * 100:.2f}%")
    print(f"   Categories: {le_category.classes_.tolist()}")

    report = classification_report(
        y_test,
        predictions,
        labels=list(range(len(le_category.classes_))),
        target_names=le_category.classes_.tolist(),
        output_dict=True,
        zero_division=0
    )

    comparison_models = {
        'Naive Bayes': GaussianNB(),
        'Logistic Regression': LogisticRegression(max_iter=1000, random_state=42),
        'Decision Tree': DecisionTreeClassifier(max_depth=25, random_state=42),
        'Random Forest': model,
    }
    algorithm_comparison = []
    for name, comparison_model in comparison_models.items():
        comparison_model.fit(X_train, y_train)
        comparison_accuracy = accuracy_score(y_test, comparison_model.predict(X_test))
        algorithm_comparison.append({
            'name': name,
            'accuracy': round(float(comparison_accuracy), 6),
            'status': 'best' if name == 'Random Forest' else 'comparison',
        })

    model_data = {
        'model': model,
        'le_merchant': le_merchant,
        'le_category': le_category,
        'features': FEATURES,
        'evaluation': {
            'accuracy': round(float(acc), 6),
            'sample_count': int(len(df)),
            'test_count': int(len(X_test)),
            'category_count': int(len(le_category.classes_)),
            'classification_report': report,
            'algorithm_comparison': algorithm_comparison,
            'feature_importance': [
                {'name': feature, 'importance': round(float(importance), 6)}
                for feature, importance in zip(FEATURES, model.feature_importances_)
            ],
        }
    }

    with open('model.pkl', 'wb') as f:
        pickle.dump(model_data, f)

    print("\n✅ model.pkl saved successfully!")
    print("   Now run: python app.py")
    return model_data


def ensure_model_ready():
    if not os.path.exists('expense_dataset.csv'):
        generate_synthetic_dataset()
    if not os.path.exists('model.pkl'):
        train_and_save_model('expense_dataset.csv')
    return os.path.exists('model.pkl')


if __name__ == '__main__':
    ensure_model_ready()
