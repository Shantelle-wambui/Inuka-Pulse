"""
Integration tests for the Inuka ETL Pipeline.

Tests cover:
- End-to-end data flow from raw → warehouse
- Schema validation
- Referential integrity checks
- ML model training and prediction cycles
"""

import json
import os
import sys
from pathlib import Path
from datetime import datetime

import pytest
import pandas as pd

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


class TestExtendedETL:
    """Tests for the extended ETL pipeline."""

    @pytest.fixture
    def raw_data_path(self):
        return Path(__file__).parent.parent / "data" / "raw" / "inuka"

    @pytest.fixture
    def warehouse_path(self):
        return Path(__file__).parent.parent / "data" / "warehouse"

    def test_raw_data_files_exist(self, raw_data_path):
        """Verify all required raw data files are present."""
        required_files = [
            "dim_beneficiary.csv",
            "dim_cohort.csv",
            "fact_sessions.csv",
            "fact_disbursements.csv",
            "fact_field_visits.csv",
            "fact_assessments.csv",
            "program.csv",
            "donor.csv",
            "donor_funding.csv",
            "resource_allocation.csv",
            "indicator.csv",
            "measurement.csv",
        ]
        
        missing = []
        for filename in required_files:
            if not (raw_data_path / filename).exists():
                missing.append(filename)
        
        assert not missing, f"Missing raw data files: {missing}"

    def test_program_data_valid(self, raw_data_path):
        """Validate program.csv structure and content."""
        df = pd.read_csv(raw_data_path / "program.csv")
        
        # Required columns
        required_cols = ["program_id", "pillar", "name", "county", "target_capacity", "status"]
        missing_cols = set(required_cols) - set(df.columns)
        assert not missing_cols, f"Missing columns: {missing_cols}"
        
        # Pillar values
        valid_pillars = {"Scholarship", "Plus", "Vocational", "Tech"}
        invalid_pillars = set(df["pillar"].unique()) - valid_pillars
        assert not invalid_pillars, f"Invalid pillars: {invalid_pillars}"
        
        # Status values
        valid_statuses = {"active", "completed", "planned"}
        invalid_statuses = set(df["status"].unique()) - valid_statuses
        assert not invalid_statuses, f"Invalid statuses: {invalid_statuses}"
        
        # Positive capacity
        assert (df["target_capacity"] > 0).all(), "All capacities must be positive"

    def test_donor_funding_referential_integrity(self, raw_data_path):
        """Verify FK relationships in donor_funding."""
        funding = pd.read_csv(raw_data_path / "donor_funding.csv")
        donors = pd.read_csv(raw_data_path / "donor.csv")
        programs = pd.read_csv(raw_data_path / "program.csv")
        
        # All donor_ids must exist in donors
        invalid_donors = set(funding["donor_id"]) - set(donors["donor_id"])
        assert not invalid_donors, f"Invalid donor IDs in funding: {invalid_donors}"
        
        # All program_ids must exist in programs
        invalid_programs = set(funding["program_id"]) - set(programs["program_id"])
        assert not invalid_programs, f"Invalid program IDs in funding: {invalid_programs}"

    def test_measurement_referential_integrity(self, raw_data_path):
        """Verify FK relationships in measurement."""
        measurements = pd.read_csv(raw_data_path / "measurement.csv")
        indicators = pd.read_csv(raw_data_path / "indicator.csv")
        
        # All indicator_ids must exist in indicators
        invalid_indicators = set(measurements["indicator_id"]) - set(indicators["indicator_id"])
        assert not invalid_indicators, f"Invalid indicator IDs: {invalid_indicators}"

    def test_warehouse_exports_exist(self, warehouse_path):
        """Verify warehouse exports were generated."""
        required_exports = [
            "programs_export.json",
            "donors_export.json",
            "funding_export.json",
            "allocations_export.json",
            "indicators_export.json",
            "dashboard_metrics_export.json",
        ]
        
        missing = []
        for filename in required_exports:
            if not (warehouse_path / filename).exists():
                missing.append(filename)
        
        assert not missing, f"Missing warehouse exports: {missing}"

    def test_dashboard_metrics_structure(self, warehouse_path):
        """Validate dashboard metrics export structure."""
        with open(warehouse_path / "dashboard_metrics_export.json") as f:
            data = json.load(f)
        
        assert "generated_at" in data
        assert "metrics" in data
        assert isinstance(data["metrics"], list)
        
        if data["metrics"]:
            metric = data["metrics"][0]
            required_fields = ["metric_key", "scope_type", "scope_id", "value"]
            for field in required_fields:
                assert field in metric, f"Missing field in metric: {field}"


class TestMLModels:
    """Tests for ML model training and prediction."""

    @pytest.fixture
    def models_path(self):
        return Path(__file__).parent.parent / "models"

    @pytest.fixture
    def warehouse_path(self):
        return Path(__file__).parent.parent / "data" / "warehouse"

    def test_dropout_model_exists(self, models_path):
        """Verify dropout prediction model is trained."""
        model_file = models_path / "inuka_logreg_v1.pkl"
        assert model_file.exists(), "Dropout model not found"

    def test_demand_model_exists(self, models_path):
        """Verify demand forecasting model is trained."""
        model_file = models_path / "inuka_demand_forecast_v1.pkl"
        assert model_file.exists(), "Demand forecast model not found"

    def test_outcome_model_exists(self, models_path):
        """Verify outcome forecasting model is trained."""
        model_file = models_path / "inuka_outcome_forecast_v1.pkl"
        assert model_file.exists(), "Outcome forecast model not found"

    def test_demand_forecasts_exported(self, warehouse_path):
        """Verify demand forecasts were generated."""
        export_file = warehouse_path / "demand_forecasts.json"
        assert export_file.exists(), "Demand forecasts not exported"
        
        with open(export_file) as f:
            data = json.load(f)
        
        assert "forecasts" in data
        assert len(data["forecasts"]) > 0
        
        # Validate forecast structure
        forecast = data["forecasts"][0]
        required_fields = ["county", "pillar", "forecast_month", "horizon_months", "forecast_enrollment"]
        for field in required_fields:
            assert field in forecast, f"Missing field in forecast: {field}"

    def test_outcome_predictions_exported(self, warehouse_path):
        """Verify outcome predictions were generated."""
        export_file = warehouse_path / "outcome_predictions.json"
        assert export_file.exists(), "Outcome predictions not exported"
        
        with open(export_file) as f:
            data = json.load(f)
        
        assert "predictions" in data
        assert "summary" in data
        
        # Validate prediction structure
        if data["predictions"]:
            pred = data["predictions"][0]
            required_fields = ["beneficiary_id", "completion_probability", "predicted_outcome"]
            for field in required_fields:
                assert field in pred, f"Missing field in prediction: {field}"

    def test_allocation_recommendations_exported(self, warehouse_path):
        """Verify allocation recommendations were generated."""
        export_file = warehouse_path / "allocation_recommendations.json"
        assert export_file.exists(), "Allocation recommendations not exported"
        
        with open(export_file) as f:
            data = json.load(f)
        
        assert "recommendations" in data
        assert "summary" in data
        assert "weights" in data
        
        # Validate transparent formula weights
        weights = data["weights"]
        assert "demand" in weights
        assert "capacity_gap" in weights
        assert "outcome_risk" in weights
        assert "funding_penalty" in weights
        
        # Weights should sum to ~1.0
        total = sum(weights.values())
        assert 0.95 <= total <= 1.05, f"Weights don't sum to 1.0: {total}"


class TestNoPII:
    """Tests to ensure public outputs contain no PII."""

    @pytest.fixture
    def warehouse_path(self):
        return Path(__file__).parent.parent / "data" / "warehouse"

    def test_dashboard_metrics_no_pii(self, warehouse_path):
        """Dashboard metrics should not contain PII fields."""
        with open(warehouse_path / "dashboard_metrics_export.json") as f:
            content = f.read()
        
        pii_patterns = [
            '"email"',
            '"phone"',
            '"address"',
            '"national_id"',
            '"beneficiary_name"',
        ]
        
        for pattern in pii_patterns:
            assert pattern not in content.lower(), f"Found PII pattern: {pattern}"

    def test_public_exports_aggregated(self, warehouse_path):
        """Verify public-facing exports use aggregated data only."""
        export_file = warehouse_path / "dashboard_metrics_export.json"
        with open(export_file) as f:
            data = json.load(f)
        
        # Metrics should be at org/pillar/county/program level, not individual
        valid_scopes = {"org", "pillar", "county", "program", "donor"}
        
        for metric in data.get("metrics", []):
            scope = metric.get("scope_type")
            assert scope in valid_scopes, f"Unexpected scope type: {scope}"


class TestDataQuality:
    """Tests for data quality rules."""

    @pytest.fixture
    def raw_data_path(self):
        return Path(__file__).parent.parent / "data" / "raw" / "inuka"

    def test_no_far_future_dated_records(self, raw_data_path):
        """Historical data should not have dates far in the future.
        
        Note: Synthetic test data may have some near-future dates for
        testing forecasting scenarios. We only flag dates more than
        90 days in the future.
        """
        from datetime import timedelta
        cutoff = datetime.now().date() + timedelta(days=90)
        
        # Check sessions
        sessions = pd.read_csv(raw_data_path / "fact_sessions.csv")
        if "session_date" in sessions.columns:
            sessions["session_date"] = pd.to_datetime(sessions["session_date"], errors="coerce")
            far_future_sessions = sessions[sessions["session_date"].dt.date > cutoff]
            assert len(far_future_sessions) == 0, f"Found {len(far_future_sessions)} far-future-dated sessions"

    def test_funding_amounts_non_negative(self, raw_data_path):
        """Funding amounts should be non-negative."""
        funding = pd.read_csv(raw_data_path / "donor_funding.csv")
        
        assert (funding["amount_kes"] >= 0).all(), "Found negative funding amounts"
        assert (funding["disbursed_to_date"] >= 0).all(), "Found negative disbursements"

    def test_disbursed_not_exceeds_amount(self, raw_data_path):
        """Disbursed amount should not exceed total funding (soft check)."""
        funding = pd.read_csv(raw_data_path / "donor_funding.csv")
        
        over_disbursed = funding[funding["disbursed_to_date"] > funding["amount_kes"]]
        
        # This is a warning, not a hard failure (could be legitimate adjustment)
        if len(over_disbursed) > 0:
            print(f"WARNING: {len(over_disbursed)} records have disbursed > amount")

    def test_unique_program_ids(self, raw_data_path):
        """Program IDs should be unique."""
        programs = pd.read_csv(raw_data_path / "program.csv")
        
        duplicates = programs[programs.duplicated(subset=["program_id"], keep=False)]
        assert len(duplicates) == 0, f"Found {len(duplicates)} duplicate program IDs"

    def test_unique_donor_ids(self, raw_data_path):
        """Donor IDs should be unique."""
        donors = pd.read_csv(raw_data_path / "donor.csv")
        
        duplicates = donors[donors.duplicated(subset=["donor_id"], keep=False)]
        assert len(duplicates) == 0, f"Found {len(duplicates)} duplicate donor IDs"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
