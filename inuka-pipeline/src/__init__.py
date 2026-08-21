"""
inuka-pipeline
==============
Python ETL pipeline and dropout prediction model for the Inuka Foundation
beneficiary monitoring platform (Inuka Pulse).

Modules
-------
generate_inuka_data  — generates synthetic Inuka beneficiary datasets
inuka_features       — feature engineering for dropout model
inuka_predict        — logistic regression dropout prediction model
inuka_diagnostics    — analytics: control charts, survival curves, correlations
inuka_live_bridge    — converts predictions → live_batch.json for the Java backend
"""
