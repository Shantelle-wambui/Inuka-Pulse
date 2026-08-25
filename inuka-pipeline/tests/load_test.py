"""
Inuka Pulse — Load Testing Script
=================================

Tests system performance at 100K beneficiary scale.

Targets:
- KPI strip: < 1 second response time
- Dashboard metrics refresh: < 60 seconds
- ML prediction batch: < 5 minutes for 100K beneficiaries
- ETL cycle: < 60 seconds

Usage:
    python tests/load_test.py --endpoint kpis
    python tests/load_test.py --endpoint all
    python tests/load_test.py --generate-data --scale 100000
"""

import argparse
import json
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd

# Add src to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


class LoadTestConfig:
    """Configuration for load tests."""
    
    # Backend URL (default to localhost)
    API_BASE_URL = os.getenv("INUKA_API_URL", "http://localhost:8080")
    
    # Performance targets (in seconds)
    TARGETS = {
        "kpi_strip": 1.0,
        "dashboard_refresh": 60.0,
        "ml_prediction_batch": 300.0,  # 5 minutes
        "etl_cycle": 60.0,
        "single_request": 0.5,
    }
    
    # Load test parameters
    CONCURRENT_USERS = 10
    REQUESTS_PER_USER = 100
    
    # Scale parameters
    DEFAULT_BENEFICIARY_COUNT = 100_000
    DEFAULT_PROGRAM_COUNT = 500
    DEFAULT_DONOR_COUNT = 50


class DataScaleGenerator:
    """Generate test data at specified scale."""
    
    def __init__(self, output_dir: Path = None):
        self.output_dir = output_dir or Path(__file__).parent.parent / "data" / "raw" / "inuka"
    
    def generate_at_scale(self, beneficiary_count: int = 100_000):
        """Generate all data files at specified scale."""
        print(f"Generating data at scale: {beneficiary_count:,} beneficiaries")
        start = time.time()
        
        # Calculate proportional counts
        program_count = max(500, beneficiary_count // 200)
        donor_count = max(50, program_count // 10)
        cohort_count = max(2000, beneficiary_count // 50)
        
        print(f"  Programs: {program_count:,}")
        print(f"  Donors: {donor_count:,}")
        print(f"  Cohorts: {cohort_count:,}")
        
        # Generate each file
        self._generate_beneficiaries(beneficiary_count)
        self._generate_cohorts(cohort_count)
        self._generate_programs(program_count)
        self._generate_donors(donor_count)
        self._generate_funding(program_count, donor_count)
        self._generate_sessions(beneficiary_count)
        self._generate_disbursements(beneficiary_count)
        
        elapsed = time.time() - start
        print(f"Data generation complete in {elapsed:.1f}s")
    
    def _generate_beneficiaries(self, count: int):
        """Generate dim_beneficiary.csv at scale."""
        print(f"  Generating {count:,} beneficiaries...")
        
        counties = ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", 
                    "Nyeri", "Machakos", "Kiambu", "Meru", "Kilifi",
                    "Kakamega", "Kajiado", "Uasin Gishu", "Narok", "Garissa"]
        pillars = ["Scholarship", "Plus", "Vocational", "Tech"]
        statuses = ["Active"] * 70 + ["At-Risk"] * 15 + ["Disengaged"] * 10 + ["Dropout"] * 5
        
        np.random.seed(42)
        
        df = pd.DataFrame({
            "beneficiary_id": [f"BEN-{i:06d}" for i in range(1, count + 1)],
            "cohort_id": [f"COH-{np.random.randint(1, max(2000, count // 50)):05d}" for _ in range(count)],
            "county": np.random.choice(counties, count),
            "pillar": np.random.choice(pillars, count),
            "current_status": np.random.choice(statuses, count),
            "enrollment_date": pd.date_range("2023-01-01", periods=count, freq="1min").strftime("%Y-%m-%d"),
        })
        
        df.to_csv(self.output_dir / "dim_beneficiary.csv", index=False)
    
    def _generate_cohorts(self, count: int):
        """Generate dim_cohort.csv at scale."""
        print(f"  Generating {count:,} cohorts...")
        
        counties = ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", 
                    "Nyeri", "Machakos", "Kiambu", "Meru", "Kilifi"]
        pillars = ["Scholarship", "Plus", "Vocational", "Tech"]
        risk_levels = ["Low"] * 50 + ["Medium"] * 30 + ["High"] * 15 + ["Critical"] * 5
        statuses = ["Active"] * 70 + ["At-Risk"] * 20 + ["Inactive"] * 10
        
        np.random.seed(42)
        
        df = pd.DataFrame({
            "cohort_id": [f"COH-{i:05d}" for i in range(1, count + 1)],
            "cohort_name": [f"Cohort {i}" for i in range(1, count + 1)],
            "county": np.random.choice(counties, count),
            "pillar": np.random.choice(pillars, count),
            "start_date": pd.date_range("2023-01-01", periods=count, freq="1D").strftime("%Y-%m-%d"),
            "status": np.random.choice(statuses, count),
            "risk_level": np.random.choice(risk_levels, count),
            "beneficiary_count": np.random.randint(20, 100, count),
        })
        
        df.to_csv(self.output_dir / "dim_cohort.csv", index=False)
    
    def _generate_programs(self, count: int):
        """Generate program.csv at scale."""
        print(f"  Generating {count:,} programs...")
        
        counties = ["Nairobi", "Mombasa", "Kisumu", "Nakuru", "Eldoret", 
                    "Nyeri", "Machakos", "Kiambu", "Meru", "Kilifi",
                    "Kakamega", "Kajiado"]
        pillars = ["Scholarship", "Plus", "Vocational", "Tech"]
        statuses = ["active"] * 80 + ["completed"] * 15 + ["planned"] * 5
        
        np.random.seed(42)
        
        df = pd.DataFrame({
            "program_id": [f"PRG-{i:05d}" for i in range(1, count + 1)],
            "name": [f"Program {i}" for i in range(1, count + 1)],
            "pillar": np.random.choice(pillars, count),
            "county": np.random.choice(counties, count),
            "start_date": pd.date_range("2022-01-01", periods=count, freq="1D").strftime("%Y-%m-%d"),
            "target_capacity": np.random.randint(50, 500, count),
            "status": np.random.choice(statuses, count),
        })
        
        df.to_csv(self.output_dir / "program.csv", index=False)
    
    def _generate_donors(self, count: int):
        """Generate donor.csv at scale."""
        print(f"  Generating {count:,} donors...")
        
        df = pd.DataFrame({
            "donor_id": [f"DON-{i:04d}" for i in range(1, count + 1)],
            "name": [f"Donor Organization {i}" for i in range(1, count + 1)],
            "contact_email": [f"contact{i}@donor{i}.org" for i in range(1, count + 1)],
            "is_active": [True] * count,
        })
        
        df.to_csv(self.output_dir / "donor.csv", index=False)
    
    def _generate_funding(self, program_count: int, donor_count: int):
        """Generate donor_funding.csv at scale."""
        funding_count = program_count * 2  # ~2 funding records per program
        print(f"  Generating {funding_count:,} funding records...")
        
        np.random.seed(42)
        
        df = pd.DataFrame({
            "id": [f"FND-{i:06d}" for i in range(1, funding_count + 1)],
            "donor_id": [f"DON-{np.random.randint(1, donor_count + 1):04d}" for _ in range(funding_count)],
            "program_id": [f"PRG-{np.random.randint(1, program_count + 1):05d}" for _ in range(funding_count)],
            "amount_kes": np.random.uniform(500_000, 50_000_000, funding_count).round(2),
            "disbursed_to_date": np.random.uniform(0, 1, funding_count) * np.random.uniform(500_000, 50_000_000, funding_count),
            "fiscal_year": np.random.choice([2024, 2025, 2026], funding_count),
            "funding_status": np.random.choice(["active"] * 80 + ["completed"] * 20, funding_count),
        })
        
        df.to_csv(self.output_dir / "donor_funding.csv", index=False)
    
    def _generate_sessions(self, beneficiary_count: int):
        """Generate fact_sessions.csv at scale."""
        # ~20 sessions per beneficiary
        session_count = beneficiary_count * 20
        print(f"  Generating {session_count:,} session records...")
        
        np.random.seed(42)
        
        # Generate in chunks to avoid memory issues
        chunk_size = 1_000_000
        chunks = []
        
        for i in range(0, session_count, chunk_size):
            end = min(i + chunk_size, session_count)
            actual_count = end - i
            
            chunk = pd.DataFrame({
                "session_id": [f"SES-{j:08d}" for j in range(i + 1, end + 1)],
                "beneficiary_id": [f"BEN-{np.random.randint(1, beneficiary_count + 1):06d}" for _ in range(actual_count)],
                "session_date": pd.date_range("2023-01-01", periods=actual_count, freq="1min").strftime("%Y-%m-%d"),
                "attended": np.random.choice([True, False], actual_count, p=[0.8, 0.2]),
                "duration_minutes": np.random.randint(30, 180, actual_count),
                "session_type": np.random.choice(["Mentorship", "Skills Lab", "Group Discussion"], actual_count),
            })
            chunks.append(chunk)
        
        df = pd.concat(chunks, ignore_index=True)
        df.to_csv(self.output_dir / "fact_sessions.csv", index=False)
    
    def _generate_disbursements(self, beneficiary_count: int):
        """Generate fact_disbursements.csv at scale."""
        # ~5 disbursements per beneficiary
        disbursement_count = beneficiary_count * 5
        print(f"  Generating {disbursement_count:,} disbursement records...")
        
        np.random.seed(42)
        
        df = pd.DataFrame({
            "disbursement_id": [f"DSB-{i:08d}" for i in range(1, disbursement_count + 1)],
            "beneficiary_id": [f"BEN-{np.random.randint(1, beneficiary_count + 1):06d}" for _ in range(disbursement_count)],
            "amount_kes": np.random.uniform(1000, 50000, disbursement_count).round(2),
            "disbursement_date": pd.date_range("2023-01-01", periods=disbursement_count, freq="1min").strftime("%Y-%m-%d"),
            "status": np.random.choice(["completed", "pending", "delayed"], disbursement_count, p=[0.8, 0.1, 0.1]),
        })
        
        df.to_csv(self.output_dir / "fact_disbursements.csv", index=False)


class EndpointLoadTester:
    """Load test API endpoints."""
    
    def __init__(self, base_url: str = None):
        self.base_url = base_url or LoadTestConfig.API_BASE_URL
        self.results = []
    
    def test_endpoint(
        self,
        endpoint: str,
        method: str = "GET",
        concurrent_users: int = 10,
        requests_per_user: int = 100,
        headers: dict = None,
    ) -> dict:
        """
        Load test a single endpoint.
        
        Returns:
            dict with latency statistics (min, max, avg, p50, p95, p99)
        """
        import requests
        
        url = f"{self.base_url}{endpoint}"
        headers = headers or {}
        
        latencies = []
        errors = 0
        
        def make_request(_):
            try:
                start = time.time()
                if method == "GET":
                    resp = requests.get(url, headers=headers, timeout=30)
                else:
                    resp = requests.post(url, headers=headers, timeout=30)
                elapsed = time.time() - start
                
                if resp.status_code < 400:
                    return elapsed, None
                else:
                    return elapsed, f"HTTP {resp.status_code}"
            except Exception as e:
                return None, str(e)
        
        total_requests = concurrent_users * requests_per_user
        print(f"Testing {endpoint}: {total_requests:,} requests with {concurrent_users} concurrent users...")
        
        start_time = time.time()
        
        with ThreadPoolExecutor(max_workers=concurrent_users) as executor:
            futures = [executor.submit(make_request, i) for i in range(total_requests)]
            
            for future in as_completed(futures):
                latency, error = future.result()
                if latency is not None:
                    latencies.append(latency)
                if error:
                    errors += 1
        
        total_time = time.time() - start_time
        
        if not latencies:
            return {
                "endpoint": endpoint,
                "error": "All requests failed",
                "errors": errors,
            }
        
        latencies_np = np.array(latencies)
        
        result = {
            "endpoint": endpoint,
            "total_requests": total_requests,
            "successful_requests": len(latencies),
            "errors": errors,
            "total_time_s": round(total_time, 2),
            "requests_per_second": round(len(latencies) / total_time, 2),
            "latency_ms": {
                "min": round(latencies_np.min() * 1000, 2),
                "max": round(latencies_np.max() * 1000, 2),
                "avg": round(latencies_np.mean() * 1000, 2),
                "p50": round(np.percentile(latencies_np, 50) * 1000, 2),
                "p95": round(np.percentile(latencies_np, 95) * 1000, 2),
                "p99": round(np.percentile(latencies_np, 99) * 1000, 2),
            },
        }
        
        self.results.append(result)
        return result
    
    def run_all_tests(self, auth_token: Optional[str] = None):
        """Run load tests on all critical endpoints."""
        headers = {}
        if auth_token:
            headers["Authorization"] = f"Bearer {auth_token}"
        
        print("\n" + "=" * 60)
        print("Inuka Pulse Load Test Suite")
        print("=" * 60)
        
        # Public endpoints (no auth)
        public_endpoints = [
            "/api/v1/public/impact-summary",
            "/api/v1/public/pillars",
        ]
        
        for endpoint in public_endpoints:
            result = self.test_endpoint(
                endpoint,
                concurrent_users=LoadTestConfig.CONCURRENT_USERS,
                requests_per_user=LoadTestConfig.REQUESTS_PER_USER,
            )
            self._print_result(result)
        
        # Protected endpoints (need auth)
        if auth_token:
            protected_endpoints = [
                "/api/v1/analytics/kpis",
                "/api/v1/analytics/pillars",
                "/api/v1/analytics/regions",
                "/api/v1/allocations/recommendations",
                "/api/v1/programs",
                "/api/v1/donors",
            ]
            
            for endpoint in protected_endpoints:
                result = self.test_endpoint(
                    endpoint,
                    concurrent_users=LoadTestConfig.CONCURRENT_USERS,
                    requests_per_user=LoadTestConfig.REQUESTS_PER_USER,
                    headers=headers,
                )
                self._print_result(result)
        else:
            print("\n⚠️  Skipping protected endpoints (no auth token provided)")
        
        # Summary
        self._print_summary()
    
    def _print_result(self, result: dict):
        """Print a single test result."""
        if "error" in result:
            print(f"\n❌ {result['endpoint']}: {result['error']}")
            return
        
        lat = result["latency_ms"]
        target = LoadTestConfig.TARGETS.get("single_request", 0.5) * 1000
        
        status = "✅" if lat["p95"] < target else "⚠️"
        
        print(f"\n{status} {result['endpoint']}")
        print(f"   Requests: {result['successful_requests']:,} / {result['total_requests']:,}")
        print(f"   Throughput: {result['requests_per_second']:.0f} req/s")
        print(f"   Latency (ms): avg={lat['avg']:.0f}, p50={lat['p50']:.0f}, p95={lat['p95']:.0f}, p99={lat['p99']:.0f}")
    
    def _print_summary(self):
        """Print summary of all tests."""
        print("\n" + "=" * 60)
        print("SUMMARY")
        print("=" * 60)
        
        passed = 0
        failed = 0
        
        for result in self.results:
            if "error" in result:
                failed += 1
                continue
            
            target = LoadTestConfig.TARGETS.get("single_request", 0.5) * 1000
            if result["latency_ms"]["p95"] < target:
                passed += 1
            else:
                failed += 1
        
        print(f"\nTests Passed: {passed}")
        print(f"Tests Failed: {failed}")
        print(f"Target: p95 < {LoadTestConfig.TARGETS['single_request'] * 1000:.0f}ms")


class ETLLoadTester:
    """Load test the ETL pipeline."""
    
    def __init__(self, pipeline_dir: Path = None):
        self.pipeline_dir = pipeline_dir or Path(__file__).parent.parent
    
    def test_etl_cycle(self) -> dict:
        """Test full ETL cycle timing."""
        import subprocess
        
        print("\nTesting ETL cycle performance...")
        
        start = time.time()
        
        result = subprocess.run(
            ["python3", "-m", "src.extended_etl"],
            cwd=self.pipeline_dir,
            capture_output=True,
            text=True,
        )
        
        elapsed = time.time() - start
        
        target = LoadTestConfig.TARGETS["etl_cycle"]
        status = "✅" if elapsed < target else "⚠️"
        
        print(f"\n{status} ETL Cycle")
        print(f"   Duration: {elapsed:.1f}s (target: <{target:.0f}s)")
        print(f"   Status: {'Success' if result.returncode == 0 else 'Failed'}")
        
        if result.returncode != 0:
            print(f"   Error: {result.stderr[:200]}")
        
        return {
            "test": "etl_cycle",
            "duration_s": round(elapsed, 2),
            "target_s": target,
            "passed": elapsed < target and result.returncode == 0,
            "return_code": result.returncode,
        }
    
    def test_ml_prediction_batch(self) -> dict:
        """Test ML prediction batch timing."""
        import subprocess
        
        print("\nTesting ML prediction batch performance...")
        
        start = time.time()
        
        # Run feature engineering + prediction
        result = subprocess.run(
            ["python3", "-m", "src.inuka_features"],
            cwd=self.pipeline_dir,
            capture_output=True,
            text=True,
        )
        
        if result.returncode == 0:
            result = subprocess.run(
                ["python3", "-m", "src.inuka_predict"],
                cwd=self.pipeline_dir,
                capture_output=True,
                text=True,
            )
        
        elapsed = time.time() - start
        
        target = LoadTestConfig.TARGETS["ml_prediction_batch"]
        status = "✅" if elapsed < target else "⚠️"
        
        print(f"\n{status} ML Prediction Batch")
        print(f"   Duration: {elapsed:.1f}s (target: <{target:.0f}s)")
        print(f"   Status: {'Success' if result.returncode == 0 else 'Failed'}")
        
        return {
            "test": "ml_prediction_batch",
            "duration_s": round(elapsed, 2),
            "target_s": target,
            "passed": elapsed < target and result.returncode == 0,
            "return_code": result.returncode,
        }


def main():
    parser = argparse.ArgumentParser(description="Inuka Pulse Load Testing")
    parser.add_argument("--endpoint", type=str, default="public",
                       choices=["public", "all", "etl", "ml"],
                       help="Which endpoints to test")
    parser.add_argument("--generate-data", action="store_true",
                       help="Generate test data at scale")
    parser.add_argument("--scale", type=int, default=100_000,
                       help="Number of beneficiaries to generate")
    parser.add_argument("--auth-token", type=str, default=None,
                       help="JWT token for protected endpoints")
    
    args = parser.parse_args()
    
    if args.generate_data:
        generator = DataScaleGenerator()
        generator.generate_at_scale(args.scale)
        return
    
    if args.endpoint in ["public", "all"]:
        tester = EndpointLoadTester()
        tester.run_all_tests(auth_token=args.auth_token)
    
    if args.endpoint in ["etl", "all"]:
        etl_tester = ETLLoadTester()
        etl_tester.test_etl_cycle()
    
    if args.endpoint in ["ml", "all"]:
        etl_tester = ETLLoadTester()
        etl_tester.test_ml_prediction_batch()


if __name__ == "__main__":
    main()
