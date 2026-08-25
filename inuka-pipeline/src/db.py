"""
Inuka Pipeline — Database Connection Module
============================================
Provides PostgreSQL connectivity for the ETL/ML pipeline.

Supports two modes:
  - 'file' (default): Read from CSV, write to Parquet/JSON (original behavior)
  - 'postgres': Read from PostgreSQL, write predictions back to the database

Configuration via environment variables:
  DATABASE_URL     — Full PostgreSQL connection string (Railway format)
  PIPELINE_MODE    — 'file' or 'postgres'

Usage:
    from src.db import get_engine, get_connection, is_postgres_mode
    
    if is_postgres_mode():
        df = pd.read_sql("SELECT * FROM beneficiary_prediction", get_engine())
    else:
        df = pd.read_csv("data/raw/inuka/dim_beneficiary.csv")
"""

import os
from contextlib import contextmanager
from pathlib import Path
from typing import Optional
from urllib.parse import urlparse

# Load .env file if present
try:
    from dotenv import load_dotenv
    env_path = Path(__file__).parent.parent / ".env"
    if env_path.exists():
        load_dotenv(env_path)
        print(f"  Loaded environment from {env_path}")
except ImportError:
    pass  # python-dotenv not installed, rely on system env vars

# ── Configuration ─────────────────────────────────────────────────────────────

def get_database_url() -> Optional[str]:
    """
    Get the PostgreSQL connection URL from environment.
    
    Supports:
      - DATABASE_URL (Railway/Heroku format)
      - Individual DB_* variables as fallback
    
    Returns:
        Connection URL string or None if not configured.
    """
    # Primary: full URL (Railway provides this)
    url = os.environ.get("DATABASE_URL")
    if url:
        # Railway sometimes uses 'postgres://' which psycopg2 doesn't like
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)
        return url
    
    # Fallback: individual components
    host = os.environ.get("DB_HOST")
    port = os.environ.get("DB_PORT", "5432")
    name = os.environ.get("DB_NAME")
    user = os.environ.get("DB_USER")
    password = os.environ.get("DB_PASSWORD")
    
    if all([host, name, user, password]):
        return f"postgresql://{user}:{password}@{host}:{port}/{name}"
    
    return None


def is_postgres_mode() -> bool:
    """
    Check if the pipeline should use PostgreSQL mode.
    
    Returns True if:
      - PIPELINE_MODE=postgres AND DATABASE_URL is set
      
    Returns False otherwise (uses file-based mode).
    """
    mode = os.environ.get("PIPELINE_MODE", "file").lower()
    if mode != "postgres":
        return False
    
    url = get_database_url()
    if not url:
        print("  Warning: PIPELINE_MODE=postgres but DATABASE_URL not set. Falling back to file mode.")
        return False
    
    return True


def get_db_info() -> dict:
    """
    Parse DATABASE_URL and return connection info for display (no password).
    """
    url = get_database_url()
    if not url:
        return {"configured": False}
    
    try:
        parsed = urlparse(url)
        return {
            "configured": True,
            "host": parsed.hostname,
            "port": parsed.port,
            "database": parsed.path.lstrip("/"),
            "user": parsed.username,
        }
    except Exception:
        return {"configured": True, "raw": url[:30] + "..."}


# ── SQLAlchemy Engine (lazy singleton) ────────────────────────────────────────

_engine = None

def get_engine():
    """
    Get or create a SQLAlchemy engine for PostgreSQL.
    
    Uses connection pooling for efficiency.
    Raises RuntimeError if DATABASE_URL is not configured.
    """
    global _engine
    
    if _engine is not None:
        return _engine
    
    url = get_database_url()
    if not url:
        raise RuntimeError(
            "DATABASE_URL not configured. Set it in .env or as an environment variable.\n"
            "Example: DATABASE_URL=postgresql://user:pass@host:5432/dbname"
        )
    
    try:
        from sqlalchemy import create_engine, text
        _engine = create_engine(
            url,
            pool_size=5,
            max_overflow=10,
            pool_timeout=30,
            pool_recycle=1800,  # Recycle connections after 30 minutes
        )
        # Test the connection
        with _engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        print(f"  PostgreSQL connected: {get_db_info().get('host')}")
        return _engine
    except ImportError:
        raise RuntimeError("SQLAlchemy not installed. Run: pip install sqlalchemy")
    except Exception as e:
        raise RuntimeError(f"Failed to connect to PostgreSQL: {e}")


@contextmanager
def get_connection():
    """
    Context manager for raw psycopg2 connection.
    
    Usage:
        with get_connection() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM dim_site")
                rows = cur.fetchall()
    """
    import psycopg2
    
    url = get_database_url()
    if not url:
        raise RuntimeError("DATABASE_URL not configured")
    
    conn = psycopg2.connect(url)
    try:
        yield conn
    finally:
        conn.close()


# ── Data Loading Functions ────────────────────────────────────────────────────

def load_beneficiaries_from_db() -> "pd.DataFrame":
    """
    Load beneficiary data from the database.
    
    Maps the backend's beneficiary_prediction table to the format
    expected by the feature engineering pipeline.
    """
    import pandas as pd
    
    query = """
    SELECT DISTINCT ON (beneficiary_id)
        beneficiary_id,
        cohort_id,
        pillar,
        county,
        predicted_band AS current_status
    FROM beneficiary_prediction
    ORDER BY beneficiary_id, as_of_date DESC
    """
    
    return pd.read_sql(query, get_engine())


def load_sessions_from_db() -> "pd.DataFrame":
    """
    Load session attendance data from the database.
    
    Note: This requires the backend to have a sessions table.
    If not available, falls back to file mode.
    """
    import pandas as pd
    
    query = """
    SELECT 
        beneficiary_id,
        session_date,
        attendance_status
    FROM fact_sessions
    ORDER BY session_date
    """
    
    try:
        return pd.read_sql(query, get_engine())
    except Exception as e:
        print(f"  Warning: Could not load sessions from DB: {e}")
        return pd.DataFrame()


def load_disbursements_from_db() -> "pd.DataFrame":
    """Load disbursement data from the database."""
    import pandas as pd
    
    query = """
    SELECT 
        beneficiary_id,
        expected_date,
        status,
        delay_days
    FROM fact_disbursements
    ORDER BY expected_date
    """
    
    try:
        return pd.read_sql(query, get_engine())
    except Exception as e:
        print(f"  Warning: Could not load disbursements from DB: {e}")
        return pd.DataFrame()


def load_field_visits_from_db() -> "pd.DataFrame":
    """Load field visit data from the database."""
    import pandas as pd
    
    query = """
    SELECT 
        fa.audit_id AS visit_id,
        fa.site_id AS cohort_id,
        fa.inspection_date AS visit_date,
        fa.auditor AS officer_name,
        CASE 
            WHEN fa.findings LIKE '%No Contact%' THEN 'No Contact'
            ELSE 'Completed'
        END AS visit_outcome
    FROM fact_audits fa
    ORDER BY fa.inspection_date
    """
    
    try:
        return pd.read_sql(query, get_engine())
    except Exception as e:
        print(f"  Warning: Could not load field visits from DB: {e}")
        return pd.DataFrame()


def load_assessments_from_db() -> "pd.DataFrame":
    """Load assessment data from the database."""
    import pandas as pd
    
    # The backend may not have a dedicated assessments table
    # Return empty DataFrame if not available
    query = """
    SELECT 
        beneficiary_id,
        assessment_date,
        score
    FROM fact_assessments
    ORDER BY assessment_date
    """
    
    try:
        return pd.read_sql(query, get_engine())
    except Exception as e:
        print(f"  Warning: Could not load assessments from DB: {e}")
        return pd.DataFrame()


# ── Prediction Writing Functions ──────────────────────────────────────────────

def write_predictions_to_db(predictions_df: "pd.DataFrame") -> int:
    """
    Write predictions to the beneficiary_prediction table.
    
    Uses upsert logic: inserts new rows, updates existing ones
    based on (beneficiary_id, as_of_date) uniqueness.
    
    Args:
        predictions_df: DataFrame with columns:
            beneficiary_id, cohort_id, pillar, county, as_of_date,
            dropout_prob, predicted_band, top_features
    
    Returns:
        Number of rows written.
    """
    import pandas as pd
    from datetime import datetime
    from sqlalchemy import text
    
    if predictions_df.empty:
        return 0
    
    # Prepare the data
    df = predictions_df.copy()
    
    # Ensure required columns exist
    required_cols = ["beneficiary_id", "as_of_date", "dropout_prob", "predicted_band"]
    missing = set(required_cols) - set(df.columns)
    if missing:
        raise ValueError(f"Missing required columns: {missing}")
    
    # Add computed columns if not present
    if "engagement_score" not in df.columns:
        df["engagement_score"] = df.apply(
            lambda r: compute_engagement_score(r["dropout_prob"], r["predicted_band"]),
            axis=1
        )
    
    if "engagement_band" not in df.columns:
        df["engagement_band"] = df["engagement_score"].apply(to_engagement_band)
    
    # Convert as_of_date to date type
    df["as_of_date"] = pd.to_datetime(df["as_of_date"]).dt.date
    
    # Add created_at timestamp
    df["created_at"] = datetime.now()
    
    # Write to database
    engine = get_engine()
    
    # Use pandas to_sql with upsert-like behavior
    # First, delete existing rows for the same (beneficiary_id, as_of_date)
    with engine.begin() as conn:
        for _, row in df.iterrows():
            conn.execute(
                text("""
                DELETE FROM beneficiary_prediction 
                WHERE beneficiary_id = :ben_id AND as_of_date = :as_of
                """),
                {"ben_id": row["beneficiary_id"], "as_of": row["as_of_date"]}
            )
    
    # Insert new rows
    df.to_sql(
        "beneficiary_prediction",
        engine,
        if_exists="append",
        index=False,
        method="multi",
        chunksize=500
    )
    
    return len(df)


def compute_engagement_score(dropout_prob: float, predicted_band: str) -> float:
    """
    Compute engagement score (0-100) from dropout probability.
    
    Higher score = more engaged / lower dropout risk.
    """
    base_score = (1.0 - dropout_prob) * 100
    
    # Band-based adjustment
    band_adjustments = {
        "Active": 5,
        "At-Risk": 0,
        "Disengaged": -5,
        "Dropout": -10,
    }
    adjustment = band_adjustments.get(predicted_band, 0)
    
    return max(0, min(100, base_score + adjustment))


def to_engagement_band(score: float) -> str:
    """Map engagement score to band."""
    if score >= 70:
        return "High"
    elif score >= 40:
        return "Medium"
    else:
        return "Low"


# ── Utility Functions ─────────────────────────────────────────────────────────

def test_connection() -> bool:
    """
    Test the database connection.
    
    Returns True if connection succeeds, False otherwise.
    """
    try:
        from sqlalchemy import text
        engine = get_engine()
        with engine.connect() as conn:
            result = conn.execute(text("SELECT 1 AS test"))
            row = result.fetchone()
            return row[0] == 1
    except Exception as e:
        print(f"  Connection test failed: {e}")
        return False


def print_db_status():
    """Print database connection status for diagnostics."""
    info = get_db_info()
    
    print("\n=== Database Configuration ===")
    if not info.get("configured"):
        print("  Status: NOT CONFIGURED")
        print("  Mode:   File-based (CSV/Parquet)")
        print("  Tip:    Set DATABASE_URL in .env to enable PostgreSQL mode")
    else:
        print(f"  Status: Configured")
        print(f"  Host:   {info.get('host', 'N/A')}")
        print(f"  Port:   {info.get('port', 'N/A')}")
        print(f"  DB:     {info.get('database', 'N/A')}")
        print(f"  User:   {info.get('user', 'N/A')}")
        print(f"  Mode:   {'PostgreSQL' if is_postgres_mode() else 'File-based'}")
        
        if is_postgres_mode():
            if test_connection():
                print("  Conn:   OK")
            else:
                print("  Conn:   FAILED")
    print("==============================\n")


# ── CLI ───────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print_db_status()
    
    if is_postgres_mode():
        print("Testing database operations...")
        
        if test_connection():
            print("  Connection test: PASSED")
            
            # Try to query beneficiary count
            try:
                import pandas as pd
                df = pd.read_sql(
                    "SELECT COUNT(*) as count FROM beneficiary_prediction",
                    get_engine()
                )
                print(f"  Beneficiary predictions in DB: {df['count'].iloc[0]}")
            except Exception as e:
                print(f"  Query test: {e}")
        else:
            print("  Connection test: FAILED")
    else:
        print("Running in file mode. Set PIPELINE_MODE=postgres to use database.")
