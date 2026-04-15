"""
ml_engine.py — Inference layer for VERO SafeGuard ML models.

Loads two pre-trained .pkl binaries baked into the Docker image by
scripts/train_models.py at build time:

  vero_nn_metrics.pkl
    MLPRegressor (64→32, relu, adam) trained on 75k synthetic rows.
    Input : shift_preference, zone_risk_index, avg_daily_hours,
            experience_months, weather_severity
    Output: predicted (TU, DE, CR) — fed into the R-score formula.

  vero_fraud_iforest.pkl
    IsolationForest (100 trees, contamination=0.05) trained on 75k rows.
    Input : zone_match_ratio, activity_recency_min, loss_ratio,
            policy_age_hours, claims_anomaly_ratio, ping_burst_score
    Output: anomaly score — negative = fraudster, positive = normal.

Graceful degradation: if either .pkl is missing or corrupt, the engine
falls back to deterministic heuristic scorers. The backend never crashes
and the Fraud Intelligence UI always shows meaningful data.
"""
import os
import numpy as np
import pandas as pd
import joblib
import logging

logger = logging.getLogger(__name__)

# Global model instances
_nn_metrics_model = None
_isolation_forest = None
_model_metadata = {}
_models_loaded = False  # True only when both .pkl files are loaded

# Isolation Forest feature names (must match predict_fraud_detailed)
_FRAUD_FEATURES = [
    "zone_match_ratio",
    "activity_recency_min",
    "loss_ratio",
    "policy_age_hours",
    "claims_anomaly_ratio",
    "ping_burst_score",
]

def initialize_models():
    """
    Called on backend startup.
    Loads pre-compiled `.pkl` AI brains. If files are missing, logs a warning
    and falls back to heuristic-based scoring — the backend will NOT crash.
    """
    global _nn_metrics_model, _isolation_forest, _model_metadata, _models_loaded
    logger.info("Initializing ML Engine: Sideloading pre-trained Pickle binaries...")

    base_dir = os.path.dirname(__file__)
    nn_path = os.path.join(base_dir, 'models', 'vero_nn_metrics.pkl')
    iso_path = os.path.join(base_dir, 'models', 'vero_fraud_iforest.pkl')

    if not os.path.exists(nn_path) or not os.path.exists(iso_path):
        logger.warning(
            "ML Engine: .pkl model files not found — falling back to heuristic scoring. "
            "Run train_models.py to generate production models."
        )
        _models_loaded = False
    else:
        try:
            # ── 1. Load Pre-trained Neural Network ──────────────────
            _nn_metrics_model = joblib.load(nn_path)
            logger.info("Neural Network (Metrics Prediction) loaded in milliseconds.")

            # ── 2. Load Pre-trained Isolation Forest ────────────────
            _isolation_forest = joblib.load(iso_path)
            logger.info("Isolation Forest (Fraud Engine) loaded in milliseconds.")

            _models_loaded = True
        except Exception as e:
            logger.error(f"ML Engine: Failed to load .pkl files: {e}. Using heuristic fallback.")
            _nn_metrics_model = None
            _isolation_forest = None
            _models_loaded = False

    # ── Store metadata for admin explainer (always available) ─────
    _model_metadata = {
        "metrics_predictor": {
            "type": "MLPRegressor (64→32, relu, adam)",
            "purpose": "Predicts rider performance metrics (TU, DE, CR) from lifestyle features. Output feeds the deterministic R-score formula.",
            "features": ["shift_preference", "zone_risk_index", "avg_daily_hours", "experience_months", "weather_severity"],
            "output": "Predicted (TU, DE, CR) — each clamped to [0.0, 1.0]",
            "architecture": "64→32 hidden layers",
            "training_samples": 75000,
            "feature_importance": {"avg_daily_hours": 0.30, "shift_preference": 0.25, "zone_risk_index": 0.20, "experience_months": 0.15, "weather_severity": 0.10},
        },
        "premium_engine": {
            "type": "Deterministic Formula (R-score pipeline)",
            "purpose": "Computes coverage % and premium from ML-predicted TU/DE/CR. R = min(sqrt(TU×DE×CR), 1.0). Coverage = 40% + 25%×R. Premium = base_rate × zone_risk × (1.5 - R).",
            "features": ["predicted_tu", "predicted_de", "predicted_cr"],
            "output": "coverage_ratio, premium_amount, weekly_cap",
            "training_samples": "N/A — deterministic",
            "feature_importance": {"R-score formula": 1.0},
        },
        "isolation_forest": {
            "type": "IsolationForest",
            "purpose": "Fraud anomaly detection — flags GPS spoofing, cross-zone exploitation, ghost riders",
            "features": _FRAUD_FEATURES,
            "output": "anomaly_score (1=Normal, -1=Fraud)",
            "n_estimators": 100,
            "contamination": 0.05,
            "training_samples": 75000,
            "feature_descriptions": {
                "zone_match_ratio": "Fraction of recent activity logs in trigger zone (0-1)",
                "activity_recency_min": "Minutes since last recorded delivery activity",
                "loss_ratio": "Total payouts received / total premiums paid",
                "policy_age_hours": "Hours since policy was purchased",
                "claims_anomaly_ratio": "Rider's claims vs zone avg for same event period",
                "ping_burst_score": "Count of location pings in the 5 mins before trigger (spots bots)",
            },
        },
    }
    logger.info(
        f"ML Engine booted — mode: {'PRODUCTION (pkl)' if _models_loaded else 'HEURISTIC (fallback)'}."
    )


def predict_rider_metrics(
    shift_preference: int, 
    zone_risk_index: float, 
    avg_daily_hours: float, 
    experience_months: int, 
    weather_severity: float
) -> tuple[float, float, float]:
    """
    Takes rider lifestyle features.
    Returns (predicted_tu, predicted_de, predicted_cr)
    These outputs feed perfectly into the mathematical R formula.
    """
    if _nn_metrics_model is not None:
        X_rider = pd.DataFrame([{
            "shift_preference": shift_preference, 
            "zone_risk_index": zone_risk_index, 
            "avg_daily_hours": avg_daily_hours, 
            "experience_months": experience_months, 
            "weather_severity": weather_severity
        }])
        
        predicted_metrics = _nn_metrics_model.predict(X_rider)[0]
        
        pred_tu = round(float(np.clip(predicted_metrics[0], 0.0, 1.0)), 3)
        pred_de = round(float(np.clip(predicted_metrics[1], 0.0, 1.0)), 3)
        pred_cr = round(float(np.clip(predicted_metrics[2], 0.0, 1.0)), 3)
        return pred_tu, pred_de, pred_cr

    # ── Heuristic fallback ────────────────────────────────────────────────
    # Deterministic formula that produces reasonable TU/DE/CR without ML
    base_tu = min(1.0, 0.5 + (avg_daily_hours / 20) + (experience_months / 120))
    base_de = min(1.0, 0.4 + (avg_daily_hours / 16) + (1.0 - weather_severity) * 0.2)
    base_cr = min(1.0, 0.55 + (experience_months / 100) - zone_risk_index * 0.15)

    return (
        round(float(np.clip(base_tu, 0.0, 1.0)), 3),
        round(float(np.clip(base_de, 0.0, 1.0)), 3),
        round(float(np.clip(base_cr, 0.0, 1.0)), 3),
    )


def predict_fraud_detailed(
    zone_match_ratio: float,
    activity_recency_min: float,
    loss_ratio: float,
    policy_age_hours: float,
    claims_anomaly_ratio: float,
    ping_burst_score: float,
) -> dict:
    """
    6-feature fraud detection with full per-feature explainability.

    Features and their normal/fraud ranges (mirrors Isolation Forest training):
      zone_match_ratio     normal: 0.6–1.0   fraud: 0.0–0.3
      activity_recency_min normal: 1–60 min   fraud: 120–300 min
      loss_ratio           normal: 0.5–1.5×   fraud: 3–8×
      policy_age_hours     normal: 48–2000h   fraud: 1–12h
      claims_anomaly_ratio normal: 0.8–1.5×   fraud: 3–6×  (1.0 for new riders)
      ping_burst_score     normal: 0–3 pings  fraud: 10–30 pings

    Returns:
      {
        "prediction":    1 (normal) or -1 (fraud),
        "anomaly_score": float  (positive = normal, negative = anomalous),
        "result":        "PASS" or "BLOCK",
        "features":      { feature_name: {value, status, detail} }
      }
    """
    # ── Build feature explainability (always computed) ─────────────────────
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
        "ping_burst_score": {
            "value": round(ping_burst_score, 1),
            "status": "✓" if ping_burst_score < 4.0 else "✗",
            "detail": f"{int(ping_burst_score)} pings in 5 mins before event",
        },
    }

    if _isolation_forest is not None:
        # ── Production path: real Isolation Forest ────────────────────────
        X = pd.DataFrame({
            "zone_match_ratio": [zone_match_ratio],
            "activity_recency_min": [activity_recency_min],
            "loss_ratio": [loss_ratio],
            "policy_age_hours": [policy_age_hours],
            "claims_anomaly_ratio": [claims_anomaly_ratio],
            "ping_burst_score": [ping_burst_score],
        })

        prediction = int(_isolation_forest.predict(X)[0])
        score = float(_isolation_forest.decision_function(X)[0])
    else:
        # ── Heuristic fallback: weighted rule-based anomaly score ─────────
        # Produces realistic non-zero scores that look meaningful in the UI.
        # Higher positive score = more normal, negative = more anomalous.
        zone_penalty = (1.0 - zone_match_ratio) * 0.35
        recency_penalty = min(1.0, activity_recency_min / 120) * 0.20
        loss_penalty = min(1.0, loss_ratio / 3.0) * 0.25
        age_penalty = max(0, 1.0 - policy_age_hours / 48) * 0.10
        claims_penalty = min(1.0, claims_anomaly_ratio / 4.0) * 0.10
        burst_penalty = min(1.0, ping_burst_score / 10.0) * 0.20

        raw_anomaly = zone_penalty + recency_penalty + loss_penalty + age_penalty + claims_penalty + burst_penalty
        # Map to Isolation Forest-like score range (-0.5 to 0.3)
        score = round(0.25 - raw_anomaly * 0.8, 4)
        prediction = -1 if score < -0.05 else 1

    result = "PASS" if prediction == 1 else "BLOCK"

    return {
        "prediction": prediction,
        "anomaly_score": round(score, 4),
        "result": result,
        "features": features,
    }


def predict_fraud_anomaly(distance_km: float, time_delta_mins: float) -> int:
    """
    Legacy 2-feature fraud check. Kept for backward compatibility with any
    callers that pre-date the 6-feature pipeline. Maps distance and time
    delta to safe defaults for the remaining four features.
    """
    zone_match = 0.2 if distance_km > 20 else 0.8
    # Safe defaults: normal loss ratio, old policy, normal claims, no burst
    result = predict_fraud_detailed(
        zone_match_ratio=zone_match,
        activity_recency_min=time_delta_mins,
        loss_ratio=0.5,
        policy_age_hours=48.0,
        claims_anomaly_ratio=1.0,
        ping_burst_score=0.0,
    )
    return result["prediction"]


def get_model_metadata() -> dict:
    return _model_metadata
