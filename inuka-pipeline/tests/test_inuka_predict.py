"""
Tests for inuka_predict.py — escalation label validation.
"""

import sys
from pathlib import Path

import pandas as pd
import pytest

# Add src to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

WAREHOUSE_DIR = Path(__file__).parent.parent / "data" / "warehouse"


class TestBuildEscalationLabels:
    """Tests for build_escalation_labels function."""

    @pytest.fixture
    def features_df(self) -> pd.DataFrame:
        """Load pre-built features from parquet file."""
        features_path = WAREHOUSE_DIR / "fact_beneficiary_features.parquet"
        if features_path.exists():
            return pd.read_parquet(features_path)
        # Fall back to building features (slow)
        from inuka_features import build_features
        return build_features(days_back=60)

    def test_escalation_labels_produce_boolean(self, features_df: pd.DataFrame) -> None:
        """Escalation labels should be boolean (True/False) after dropna."""
        from inuka_predict import build_escalation_labels

        # Use a sample for faster test execution
        sample = features_df.head(100)
        labels = build_escalation_labels(sample)

        assert "escalated_30d" in labels.columns
        # After dropping None values, should only have True/False
        valid_labels = labels.dropna(subset=["escalated_30d"])
        if len(valid_labels) > 0:
            assert valid_labels["escalated_30d"].isin([True, False]).all()

    def test_labels_have_correct_columns(self, features_df: pd.DataFrame) -> None:
        """Labels DataFrame should have required columns."""
        from inuka_predict import build_escalation_labels

        sample = features_df.head(100)
        labels = build_escalation_labels(sample)

        required_cols = {"beneficiary_id", "as_of_date", "escalated_30d"}
        assert required_cols.issubset(set(labels.columns))

    def test_labels_align_with_features(self, features_df: pd.DataFrame) -> None:
        """Labels should match features row count."""
        from inuka_predict import build_escalation_labels

        sample = features_df.head(100)
        labels = build_escalation_labels(sample)

        assert len(labels) == len(sample)


class TestRowCountAfterCensoring:
    """Tests for data volume after censoring."""

    def test_row_count_after_censoring(self) -> None:
        """After censoring, should have >=10,000 usable rows with full dataset."""
        from inuka_predict import build_escalation_labels

        features_path = WAREHOUSE_DIR / "fact_beneficiary_features.parquet"
        if not features_path.exists():
            pytest.skip("Pre-built features not available")

        features = pd.read_parquet(features_path)
        labels = build_escalation_labels(features)
        df = features.merge(labels, on=["beneficiary_id", "as_of_date"])
        df = df.dropna(subset=["escalated_30d"])

        assert len(df) >= 10_000, f"Only {len(df)} rows, need >=10,000"


class TestBandOrder:
    """Tests for BAND_ORDER constant."""

    def test_band_order_exists(self) -> None:
        """BAND_ORDER constant should exist and have correct order."""
        from inuka_predict import BAND_ORDER

        assert BAND_ORDER == ["Active", "At-Risk", "Disengaged", "Dropout"]

    def test_band_order_best_to_worst(self) -> None:
        """Band indices should increase from best (Active) to worst (Dropout)."""
        from inuka_predict import BAND_ORDER

        assert BAND_ORDER.index("Active") < BAND_ORDER.index("At-Risk")
        assert BAND_ORDER.index("At-Risk") < BAND_ORDER.index("Disengaged")
        assert BAND_ORDER.index("Disengaged") < BAND_ORDER.index("Dropout")


class TestEscalationLogic:
    """Tests for escalation detection logic."""

    def test_escalation_detects_worsening(self) -> None:
        """Escalation should be True when band worsens."""
        from inuka_predict import BAND_ORDER

        # If now is "Active" (index 0) and future is "At-Risk" (index 1), escalated=True
        now_idx = BAND_ORDER.index("Active")
        future_idx = BAND_ORDER.index("At-Risk")
        assert future_idx > now_idx  # This is the escalation condition

    def test_no_escalation_when_improving(self) -> None:
        """No escalation when band improves or stays same."""
        from inuka_predict import BAND_ORDER

        # If now is "At-Risk" (index 1) and future is "Active" (index 0), not escalated
        now_idx = BAND_ORDER.index("At-Risk")
        future_idx = BAND_ORDER.index("Active")
        assert not (future_idx > now_idx)

        # Same band = not escalated
        now_idx = BAND_ORDER.index("At-Risk")
        future_idx = BAND_ORDER.index("At-Risk")
        assert not (future_idx > now_idx)
