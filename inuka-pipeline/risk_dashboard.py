import json
from pathlib import Path

import pandas as pd
import streamlit as st


# ---------------------------------------------------------
# Configuration
# ---------------------------------------------------------

st.set_page_config(
    page_title="Inuka Pulse - Risk Dashboard",
    page_icon="📊",
    layout="wide",
)

BASE_DIR = Path(__file__).resolve().parent
WAREHOUSE = BASE_DIR / "data" / "warehouse"

PREDICTIONS_FILE = WAREHOUSE / "inuka_predictions_export.json"
FEATURE_IMPORTANCE_FILE = WAREHOUSE / "inuka_feature_importance.json"
BACKTEST_FILE = WAREHOUSE / "inuka_backtest_report.json"


# ---------------------------------------------------------
# Load data
# ---------------------------------------------------------

@st.cache_data
def load_predictions():
    with open(PREDICTIONS_FILE, "r") as f:
        return pd.DataFrame(json.load(f))


@st.cache_data
def load_feature_importance():
    with open(FEATURE_IMPORTANCE_FILE, "r") as f:
        return pd.DataFrame(json.load(f))


@st.cache_data
def load_backtest():
    with open(BACKTEST_FILE, "r") as f:
        return json.load(f)


predictions = load_predictions()
importance = load_feature_importance()
backtest = load_backtest()


# ---------------------------------------------------------
# Title
# ---------------------------------------------------------

st.title("📊 Inuka Pulse — Beneficiary Risk Command Center")
st.caption(
    "Interactive inspection of the Inuka Pulse dropout prediction model"
)


# ---------------------------------------------------------
# Sidebar filters
# ---------------------------------------------------------

st.sidebar.header("Filters")

counties = sorted(predictions["county"].dropna().unique())

selected_counties = st.sidebar.multiselect(
    "County",
    counties,
    default=counties,
)

pillars = sorted(predictions["pillar"].dropna().unique())

selected_pillars = st.sidebar.multiselect(
    "Pillar",
    pillars,
    default=pillars,
)

risk_bands = sorted(predictions["predicted_band"].dropna().unique())

selected_risk = st.sidebar.multiselect(
    "Risk band",
    risk_bands,
    default=risk_bands,
)

filtered = predictions[
    predictions["county"].isin(selected_counties)
    & predictions["pillar"].isin(selected_pillars)
    & predictions["predicted_band"].isin(selected_risk)
].copy()


# ---------------------------------------------------------
# KPI cards
# ---------------------------------------------------------

total = len(filtered)

dropout = len(filtered[filtered["predicted_band"] == "Dropout"])

disengaged = len(
    filtered[filtered["predicted_band"] == "Disengaged"]
)

at_risk = len(
    filtered[filtered["predicted_band"] == "At-Risk"]
)

active = len(
    filtered[filtered["predicted_band"] == "Active"]
)


col1, col2, col3, col4, col5 = st.columns(5)

col1.metric("Beneficiaries", f"{total:,}")
col2.metric("🔴 Dropout", f"{dropout:,}")
col3.metric("🟠 Disengaged", f"{disengaged:,}")
col4.metric("🟡 At-Risk", f"{at_risk:,}")
col5.metric("🟢 Active", f"{active:,}")


st.divider()


# ---------------------------------------------------------
# Risk distribution
# ---------------------------------------------------------

left, right = st.columns(2)

with left:
    st.subheader("Risk Distribution")

    risk_counts = (
        filtered["predicted_band"]
        .value_counts()
        .rename_axis("Risk Band")
        .reset_index(name="Beneficiaries")
    )

    st.bar_chart(
        risk_counts.set_index("Risk Band")
    )


with right:
    st.subheader("Dropout Probability")

    st.line_chart(
        filtered["dropout_prob"]
        .sort_values()
        .reset_index(drop=True)
    )


# ---------------------------------------------------------
# Feature importance
# ---------------------------------------------------------

st.divider()

st.subheader("🧠 Model Feature Importance")

importance_display = importance.copy()

importance_display["importance_percent"] = (
    importance_display["importance"] * 100
)

importance_display = importance_display.sort_values(
    "importance_percent",
    ascending=True,
)

st.bar_chart(
    importance_display.set_index("feature")[
        "importance_percent"
    ]
)

st.caption(
    "Higher importance means the feature has a larger influence "
    "on the Logistic Regression model."
)


# ---------------------------------------------------------
# Model performance
# ---------------------------------------------------------

st.divider()

st.subheader("🤖 Model Performance")

m1, m2, m3, m4 = st.columns(4)

m1.metric(
    "Precision",
    f"{backtest['precision']:.1%}",
)

m2.metric(
    "Recall",
    f"{backtest['recall']:.1%}",
)

m3.metric(
    "F1 Score",
    f"{backtest['f1']:.1%}",
)

m4.metric(
    "Test Rows",
    f"{backtest['test_rows']:,}",
)


st.caption(
    f"Model: {backtest['model']} | "
    f"Split date: {backtest['split_date']}"
)


# ---------------------------------------------------------
# Beneficiary table
# ---------------------------------------------------------

st.divider()

st.subheader("👥 Beneficiary Risk List")

display_df = filtered[
    [
        "beneficiary_id",
        "cohort_id",
        "pillar",
        "county",
        "dropout_prob",
        "predicted_band",
        "top_features",
    ]
].copy()

display_df["dropout_prob"] = (
    display_df["dropout_prob"] * 100
).round(1)

display_df = display_df.sort_values(
    "dropout_prob",
    ascending=False,
)

display_df = display_df.rename(
    columns={
        "beneficiary_id": "Beneficiary",
        "cohort_id": "Cohort",
        "pillar": "Pillar",
        "county": "County",
        "dropout_prob": "Dropout Risk %",
        "predicted_band": "Risk Band",
        "top_features": "Top Risk Factors",
    }
)

st.dataframe(
    display_df,
    use_container_width=True,
    hide_index=True,
)


# ---------------------------------------------------------
# Individual beneficiary lookup
# ---------------------------------------------------------

st.divider()

st.subheader("🔎 Inspect Individual Beneficiary")

beneficiary_ids = sorted(
    filtered["beneficiary_id"].unique()
)

if beneficiary_ids:

    selected_beneficiary = st.selectbox(
        "Select beneficiary",
        beneficiary_ids,
    )

    beneficiary = filtered[
        filtered["beneficiary_id"]
        == selected_beneficiary
    ].iloc[0]

    a, b, c, d = st.columns(4)

    a.metric(
        "Beneficiary",
        beneficiary["beneficiary_id"],
    )

    b.metric(
        "Risk",
        beneficiary["predicted_band"],
    )

    c.metric(
        "Dropout Probability",
        f"{beneficiary['dropout_prob']:.1%}",
    )

    d.metric(
        "County",
        beneficiary["county"],
    )

    st.write(
        "**Top risk factors:**",
        beneficiary["top_features"].replace("|", " → "),
    )

    st.write(
        "**Cohort:**",
        beneficiary["cohort_id"],
    )

    st.write(
        "**Pillar:**",
        beneficiary["pillar"],
    )


# ---------------------------------------------------------
# Footer
# ---------------------------------------------------------

st.divider()

st.caption(
    "Inuka Pulse ML inspection dashboard • "
    "Generated from the current prediction pipeline"
)
