import os
import pandas as pd
import numpy as np
from sklearn.neural_network import MLPRegressor
from sklearn.ensemble import IsolationForest
import joblib

# Paths
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODELS_DIR = os.path.join(BASE_DIR, "app", "models")
os.makedirs(MODELS_DIR, exist_ok=True)

print("Starting ML Model Generation...")

# 1. Train MLPRegressor for Rider Metrics
print("Generating 75,000 synthetic rows for Metrics model...")
np.random.seed(42)
N_METRICS = 75000

# Features: shift, zone_risk, hours, experience, weather
X_metrics = pd.DataFrame({
    "shift_preference": np.random.randint(0, 3, N_METRICS),
    "zone_risk_index": np.random.uniform(1.0, 1.5, N_METRICS),
    "avg_daily_hours": np.random.uniform(4.0, 16.0, N_METRICS),
    "experience_months": np.random.randint(1, 60, N_METRICS),
    "weather_severity": np.random.uniform(0.0, 1.0, N_METRICS),
})

# Synthesize Targets (TU, DE, CR) based on heuristics (to bootstrap the ML)
tu = 0.5 + (X_metrics["avg_daily_hours"] / 20) + (X_metrics["experience_months"] / 120)
de = 0.4 + (X_metrics["avg_daily_hours"] / 16) + (1.0 - X_metrics["weather_severity"]) * 0.2
cr = 0.55 + (X_metrics["experience_months"] / 100) - X_metrics["zone_risk_index"] * 0.15

Y_metrics = pd.DataFrame({
    "tu": np.clip(tu, 0.0, 1.0),
    "de": np.clip(de, 0.0, 1.0),
    "cr": np.clip(cr, 0.0, 1.0),
})

print("Training MLPRegressor (MultiOutput)...")
# We use a relatively small architecture so training is fast (demo purposes)
metrics_model = MLPRegressor(hidden_layer_sizes=(64, 32), max_iter=20, random_state=42)
metrics_model.fit(X_metrics, Y_metrics)
joblib.dump(metrics_model, os.path.join(MODELS_DIR, "vero_nn_metrics.pkl"))
print("Saved vero_nn_metrics.pkl")


# 2. Train IsolationForest for Fraud Detection (now 6 features)
print("Generating 75,000 synthetic rows for Fraud model...")
N_FRAUD = 75000
fraud_rate = 0.05

# 95% Normal Behavior
normal_mask = np.random.rand(N_FRAUD) > fraud_rate
fraud_mask = ~normal_mask

X_fraud = pd.DataFrame({
    "zone_match_ratio": np.where(normal_mask, np.random.uniform(0.6, 1.0, N_FRAUD), np.random.uniform(0.0, 0.3, N_FRAUD)),
    "activity_recency_min": np.where(normal_mask, np.random.uniform(1.0, 60.0, N_FRAUD), np.random.uniform(120.0, 300.0, N_FRAUD)),
    "loss_ratio": np.where(normal_mask, np.random.uniform(0.5, 1.5, N_FRAUD), np.random.uniform(3.0, 8.0, N_FRAUD)),
    "policy_age_hours": np.where(normal_mask, np.random.uniform(48.0, 2000.0, N_FRAUD), np.random.uniform(1.0, 12.0, N_FRAUD)),
    "claims_anomaly_ratio": np.where(normal_mask, np.random.uniform(0.8, 1.5, N_FRAUD), np.random.uniform(3.0, 6.0, N_FRAUD)),
    "ping_burst_score": np.where(normal_mask, np.random.randint(0, 4, N_FRAUD), np.random.randint(10, 30, N_FRAUD)), # NEW FEATURE: Bots have huge ping bursts
})

print("Training IsolationForest...")
# Train the IF (it's unsupervised, we feed it everything)
fraud_model = IsolationForest(contamination=fraud_rate, random_state=42, n_estimators=100)
fraud_model.fit(X_fraud)
joblib.dump(fraud_model, os.path.join(MODELS_DIR, "vero_fraud_iforest.pkl"))
print("Saved vero_fraud_iforest.pkl")

print("\n--- ML Training Complete ---")
print("You can safely upload the new .pkl files to GitHub.")
