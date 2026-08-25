"""
Inuka Pulse — ML Models Package
================================
Contains implementations for all 5 ML models:

Model 1: Dropout Risk (existing) - Logistic Regression
Model 2: Demand Forecasting - LightGBM Regressor (NEW)
Model 3: Reach Forecasting - LightGBM Regressor (NEW)
Model 4: Outcome Forecasting - XGBoost Classifier (NEW)
Model 5: Allocation Optimization - Weighted scoring formula (no ML)
"""

from pathlib import Path

MODELS_DIR = Path(__file__).parent.parent.parent / "models"
MODELS_DIR.mkdir(parents=True, exist_ok=True)
