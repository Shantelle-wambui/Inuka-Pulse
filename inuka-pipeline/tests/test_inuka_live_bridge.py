"""
Tests for inuka_live_bridge.py

Validates that the live bridge correctly converts ML predictions
to incidents with proper beneficiary traceability.
"""

import pytest
import json
from pathlib import Path
import sys
sys.path.insert(0, "src")


def test_incidents_include_beneficiary_id():
    """Incidents in live_batch.json should have beneficiary_id field."""
    from inuka_live_bridge import load_predictions_as_incidents
    
    incidents = load_predictions_as_incidents("test-batch-123")
    
    assert len(incidents) > 0, "Should have at least one incident"
    for inc in incidents[:5]:  # Check first 5
        assert "beneficiary_id" in inc, "Incident missing beneficiary_id field"
        assert inc["beneficiary_id"], "beneficiary_id should not be empty"
        assert inc["beneficiary_id"].startswith("BEN-"), "beneficiary_id should start with BEN-"
