"""
ml_engine.py — Production-grade ML components for VERO SafeGuard.

Three offline models trained on synthetic data at startup:
  1. Random Forest  — Rider reliability prediction (R-factor)
  2. XGBoost        — Zone-aware premium risk pricing
  3. Isolation Forest — 5-feature fraud anomaly detection

All models use deterministic features derived from real database records.
"""
import numpy as np
import pandas as pd
from xgboost import XGBRegressor
from sklearn.ensemble import RandomForestRegressor, IsolationForest
import logging

logger = logging.getLogger(__name__)

# Global model instances
_xgboost_risk_model = None
_rf_rider_model = None
_isolation_forest = None

# Feature metadata for admin explainer
_model_metadata = {}

# Isolation Forest feature names (must match predict_fraud_detailed)
_FRAUD_FEATURES = [
    "zone_match_ratio",
    "activity_recency_min",
    "loss_ratio",
    "policy_age_hours",
    "claims_anomaly_ratio",
]


def initialize_models():
    """
    Called on backend startup.
    Generates 50,000 synthetic rows of realistic gig worker data
    and trains the three offline ML models.
    """
    global _xgboost_risk_model, _rf_rider_model, _isolation_forest, _model_metadata
    logger.info("Initializing ML Engine: Generating synthetic data pipeline...")

    n_samples = 50000
    np.random.seed(42)

    # ── 1. Random Forest: Rider Reliability Prediction ────────────────────────
    # Features: [Time_Utilization, Delivery_Efficiency, Completion_Rate]
    # Target: R_Score (Future Reliability)
    tu = np.random.normal(0.65, 0.15, n_samples).clip(0.1, 1.0)
    de = np.random.normal(0.60, 0.20, n_samples).clip(0.1, 1.0)
    cr = np.random.normal(0.85, 0.10, n_samples).clip(0.2, 1.0)

    y_r = np.minimum(np.sqrt(tu * de * cr) + np.random.normal(0, 0.05, n_samples), 1.0)

    X_rf = pd.DataFrame({"tu": tu, "de": de, "cr": cr})
    _rf_rider_model = RandomForestRegressor(n_estimators=10, max_depth=5, random_state=42)
    _rf_rider_model.fit(X_rf, y_r)

    rf_importance = dict(zip(["tu", "de", "cr"], _rf_rider_model.feature_importances_.round(4).tolist()))
    logger.info(f"RandomForest (Rider Factor) trained. Importance: {rf_importance}")

    # ── 2. XGBoost: Zone Risk Premium Prediction ─────────────────────────────
    # Features: [Zone_Base_Risk, Rider_Factor]
    # Target: Premium Risk Multiplier
    zone_base_risks = np.random.uniform(1.0, 1.5, n_samples)
    rider_factors = y_r

    y_premium_mult = zone_base_risks * (1.5 - rider_factors) + np.random.normal(0, 0.02, n_samples)

    X_xgb = pd.DataFrame({"base_risk": zone_base_risks, "rider_factor": rider_factors})
    _xgboost_risk_model = XGBRegressor(n_estimators=20, max_depth=4, learning_rate=0.1, random_state=42)
    _xgboost_risk_model.fit(X_xgb, y_premium_mult)

    xgb_importance = dict(zip(["base_risk", "rider_factor"], _xgboost_risk_model.feature_importances_.round(4).tolist()))
    logger.info(f"XGBoost (Pricing) trained. Importance: {xgb_importance}")

    # ── 3. Isolation Forest: 5-Feature Fraud Detection ───────────────────────
    # Features: zone_match_ratio, activity_recency_min, loss_ratio,
    #           policy_age_hours, claims_anomaly_ratio
    #
    # Normal (95%): mix of new AND returning riders who are active in zone
    # Fraud  (5%):  zone mismatch, stale activity, high loss ratio
    n_normal = int(n_samples * 0.95)
    n_fraud = n_samples - n_normal

    # Normal riders — includes both new riders (age 0+) and returning riders
    # Key insight: a new rider with HIGH zone match + recent activity is NORMAL
    zone_match_normal = np.random.beta(8, 2, n_normal)              # ~0.8 avg
    recency_normal = np.random.exponential(30, n_normal).clip(1, 180)  # up to 3h
    loss_ratio_normal = np.random.exponential(0.3, n_normal).clip(0, 2)  # low
    # Policy age: mix of new (0+) and established (24-168h) — ALL ages can be legit
    policy_age_normal = np.concatenate([
        np.random.uniform(0, 24, n_normal // 3),      # 1/3 brand-new riders
        np.random.uniform(24, 168, n_normal - n_normal // 3),  # 2/3 established
    ])
    np.random.shuffle(policy_age_normal)
    claims_anomaly_normal = np.random.normal(1.0, 0.3, n_normal).clip(0, 3)

    # Fraudulent riders — the defining features are ZONE MISMATCH + STALE ACTIVITY
    # NOT policy age alone (that would punish new legitimate riders)
    zone_match_fraud = np.random.beta(2, 8, n_fraud)                 # ~0.2 avg LOW
    recency_fraud = np.random.uniform(180, 1440, n_fraud)             # very stale (3h+)
    loss_ratio_fraud = np.random.uniform(1.5, 5.0, n_fraud)           # very high
    policy_age_fraud = np.random.uniform(0.5, 500, n_fraud)           # any age can be fraud
    claims_anomaly_fraud = np.random.uniform(2.5, 8.0, n_fraud)       # way above avg

    X_iso = pd.DataFrame({
        "zone_match_ratio": np.concatenate([zone_match_normal, zone_match_fraud]),
        "activity_recency_min": np.concatenate([recency_normal, recency_fraud]),
        "loss_ratio": np.concatenate([loss_ratio_normal, loss_ratio_fraud]),
        "policy_age_hours": np.concatenate([policy_age_normal, policy_age_fraud]),
        "claims_anomaly_ratio": np.concatenate([claims_anomaly_normal, claims_anomaly_fraud]),
    })

    _isolation_forest = IsolationForest(
        n_estimators=100, contamination=0.05, max_samples="auto", random_state=42
    )
    _isolation_forest.fit(X_iso)
    logger.info("IsolationForest (Fraud) trained on 5 deterministic features.")

    # ── Store metadata for admin explainer ────────────────────────────────────
    _model_metadata = {
        "random_forest": {
            "type": "RandomForestRegressor",
            "purpose": "Rider reliability prediction (R-factor)",
            "features": ["time_utilization", "delivery_efficiency", "completion_rate"],
            "output": "rider_reliability_factor (0-1)",
            "n_estimators": 10,
            "max_depth": 5,
            "training_samples": n_samples,
            "feature_importance": rf_importance,
        },
        "xgboost": {
            "type": "XGBRegressor",
            "purpose": "Zone-aware premium risk multiplier",
            "features": ["zone_base_risk", "rider_factor"],
            "output": "premium_risk_multiplier",
            "n_estimators": 20,
            "max_depth": 4,
            "learning_rate": 0.1,
            "training_samples": n_samples,
            "feature_importance": xgb_importance,
        },
        "isolation_forest": {
            "type": "IsolationForest",
            "purpose": "Fraud anomaly detection — flags GPS spoofing, cross-zone exploitation, ghost riders",
            "features": _FRAUD_FEATURES,
            "output": "anomaly_score (1=Normal, -1=Fraud)",
            "n_estimators": 100,
            "contamination": 0.05,
            "training_samples": n_samples,
            "feature_descriptions": {
                "zone_match_ratio": "Fraction of recent activity logs in trigger zone (0-1)",
                "activity_recency_min": "Minutes since last recorded delivery activity",
                "loss_ratio": "Total payouts received / total premiums paid",
                "policy_age_hours": "Hours since policy was purchased",
                "claims_anomaly_ratio": "Rider's claims vs zone average for same event period",
            },
        },
    }
    logger.info("ML Engine successfully booted with offline sklearn & xgboost models.")


def predict_premium_multiplier(zone_base_risk: float, tu: float, de: float, cr: float) -> tuple[float, float]:
    """
    Takes rider history and zone risk.
    Returns (predicted_rider_factor, predicted_premium_multiplier)
    """
    if _rf_rider_model is None or _xgboost_risk_model is None:
        raise ValueError("Models not initialized")

    X_rider = pd.DataFrame({"tu": [tu], "de": [de], "cr": [cr]})
    predicted_r = _rf_rider_model.predict(X_rider)[0]

    X_premium = pd.DataFrame({"base_risk": [zone_base_risk], "rider_factor": [predicted_r]})
    predicted_mult = _xgboost_risk_model.predict(X_premium)[0]

    return float(predicted_r), float(predicted_mult)


def predict_fraud_detailed(
    zone_match_ratio: float,
    activity_recency_min: float,
    loss_ratio: float,
    policy_age_hours: float,
    claims_anomaly_ratio: float,
) -> dict:
    """
    5-feature fraud detection with full explainability.
    Returns:
      {
        "prediction": 1 or -1,
        "anomaly_score": float,
        "result": "PASS" or "BLOCK",
        "features": {
          "zone_match_ratio": {"value": 0.8, "status": "✓", "detail": "4/5 logs match zone"},
          ...
        }
      }
    """
    if _isolation_forest is None:
        raise ValueError("Isolation Forest not initialized")

    X = pd.DataFrame({
        "zone_match_ratio": [zone_match_ratio],
        "activity_recency_min": [activity_recency_min],
        "loss_ratio": [loss_ratio],
        "policy_age_hours": [policy_age_hours],
        "claims_anomaly_ratio": [claims_anomaly_ratio],
    })

    prediction = int(_isolation_forest.predict(X)[0])
    score = float(_isolation_forest.decision_function(X)[0])

    # Build explainable breakdown
    features = {
        "zone_match_ratio": {
            "value": round(zone_match_ratio, 3),
            "status": "✓" if zone_match_ratio >= 0.5 else "✗",
            "detail": f"{int(zone_match_ratio * 5)}/5 recent logs in trigger zone",
        },
        "activity_recency_min": {
            "value": round(activity_recency_min, 1),
            "status": "✓" if activity_recency_min < 60 else "✗",
            "detail": f"Last activity {int(activity_recency_min)} min ago",
        },
        "loss_ratio": {
            "value": round(loss_ratio, 3),
            "status": "✓" if loss_ratio < 1.8 else "✗",
            "detail": f"Payout/premium ratio: {loss_ratio:.2f}×",
        },
        "policy_age_hours": {
            "value": round(policy_age_hours, 1),
            "status": "✓" if policy_age_hours > 24 else "✗",
            "detail": f"Policy purchased {policy_age_hours:.1f}h ago",
        },
        "claims_anomaly_ratio": {
            "value": round(claims_anomaly_ratio, 3),
            "status": "✓" if claims_anomaly_ratio < 2.0 else "✗",
            "detail": f"Claims vs zone avg: {claims_anomaly_ratio:.2f}×",
        },
    }

    result = "PASS" if prediction == 1 else "BLOCK"

    return {
        "prediction": prediction,
        "anomaly_score": round(score, 4),
        "result": result,
        "features": features,
    }


def predict_fraud_anomaly(distance_km: float, time_delta_mins: float) -> int:
    """
    Legacy 2-feature fraud check. Kept for backward compatibility.
    Returns 1 if Normal, -1 if Anomaly (Fraud).
    """
    # Map old 2-feature interface to new 5-feature model
    zone_match = 0.2 if distance_km > 20 else 0.8
    loss_ratio = 0.5  # assume average
    policy_age = 48.0  # assume aged policy
    claims_anomaly = 1.0  # assume normal
    result = predict_fraud_detailed(zone_match, time_delta_mins, loss_ratio, policy_age, claims_anomaly)
    return result["prediction"]


def get_model_metadata() -> dict:
    """Returns ML model specs for the admin dashboard explainer."""
    return _model_metadata
