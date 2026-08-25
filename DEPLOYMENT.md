# Inuka Pulse — Deployment Guide

This guide covers three deployment paths:

1. [Local development with Docker Compose](#1-local-docker-compose)
2. [Production on Render (recommended)](#2-render-deployment)
3. [GitHub Actions ETL cron (for production)](#3-github-actions-etl-cron)

---

## System overview

The system has four components:

| Component | Technology | What it does |
|-----------|-----------|--------------|
| **Database** | PostgreSQL 15 | Stores all beneficiary data, predictions, follow-ups, and reports |
| **Backend** | Spring Boot (Java 17) | REST API, authentication, ETL loading, ML alert rules |
| **Frontend** | Next.js 16 | Web dashboard for Directors, Analysts, and Case Managers |
| **Pipeline** | Python 3.11 | Generates beneficiary features, runs ML scoring, produces live_batch.json |

---

## 1. Local Docker Compose

Runs all four components on your machine. No cloud account needed.

### Prerequisites

- [Docker Desktop](https://docs.docker.com/get-docker/) (version 24+)
- Git

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/Shantelle-wambui/Inuka-Pulse.git
cd Inuka-Pulse

# 2. Copy the environment template
cp .env.docker .env

# 3. (Optional) Edit .env to set a real JWT secret
#    At minimum, change JWT_SECRET from the placeholder value:
nano .env      # or open with any text editor

# 4. Build and start all services
docker compose up --build

# 5. Wait for all services to be healthy (takes ~2 minutes on first run):
#    ✅ db:        "database system is ready to accept connections"
#    ✅ backend:   Spring Boot started successfully on port 8080
#    ✅ frontend:  Ready on http://localhost:3000
#    ✅ pipeline:  "Initial run complete. Entering 10-minute loop..."
```

### What starts up

| Service | URL | Notes |
|---------|-----|-------|
| Frontend | http://localhost:3000 | Main web app |
| Backend API | http://localhost:8080 | REST endpoints |
| Database | localhost:5432 | PostgreSQL (for DB tools like DBeaver) |

### Default login credentials (seeded by Flyway)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@inukapulse.org | inuka2024 |
| Programme Director | director@inukapulse.org | inuka2024 |
| Analyst | analyst@inukapulse.org | inuka2024 |
| Case Manager | case.manager@inukapulse.org | inuka2024 |

> **Note:** Change all passwords immediately after first login. These are seeded for development only.

### Stopping and resetting

```bash
# Stop services (keeps data)
docker compose down

# Stop and delete all data (full reset)
docker compose down -v

# Rebuild after code changes
docker compose up --build
```

### How the pipeline shares data with the backend

The pipeline container writes `live_batch.json` and `inuka_predictions_export.json` to the `pipeline-data` Docker volume. The backend reads from the same volume every 2 minutes. No HTTP push, no Cloudflare issues. If the pipeline container is stopped, the backend simply continues serving its last loaded data.

---

## 2. Render Deployment

Render hosts the PostgreSQL database and the Spring Boot backend. The Next.js frontend is deployed separately on Vercel (recommended) or as a second Render service.

### 2a. Deploy the backend on Render

1. **Fork or connect the repository** to your Render account at [dashboard.render.com](https://dashboard.render.com).

2. **Create a Blueprint** — Render detects `render.yaml` automatically. Click **New → Blueprint** and point it at your repository.

   This provisions two resources automatically:
   - `inuka-pulse-db` — Managed PostgreSQL database (free tier)
   - `inuka-pulse-backend` — Spring Boot Docker web service

3. **Set the required secrets** in the Render dashboard under the `inuka-pulse-backend` service → **Environment**:

   | Variable | Value |
   |----------|-------|
   | `JWT_SECRET` | Generate with: `openssl rand -base64 48` |
   | `CORS_ALLOWED_ORIGINS` | Your Vercel frontend URL, e.g. `https://inuka-pulse.vercel.app` |
   | `ETL_LIVE_BATCH_URL` | Your Cloudflare R2 public URL, e.g. `https://pub-xxx.r2.dev/live_batch.json` |
   | `ETL_PREDICTIONS_URL` | `https://pub-xxx.r2.dev/inuka_predictions_export.json` |
   | `ETL_API_KEY` | Generate with: `openssl rand -hex 32` |
   | `GROQ_API_KEY` | From [console.groq.com](https://console.groq.com) — optional, leave blank to use template narratives |

4. **Deploy** — Render builds the Docker image and runs Flyway migrations automatically on first boot.

5. **Health check** — the backend is healthy when `https://your-render-service.onrender.com/actuator/health` returns `{"status":"UP"}`.

### 2b. Deploy the frontend on Vercel

1. Import the repository into [vercel.com](https://vercel.com).

2. Set the **Root Directory** to `inuka-pulse-frontend`.

3. Set the environment variable:

   | Variable | Value |
   |----------|-------|
   | `NEXT_PUBLIC_INUKA_API_URL` | Your Render backend URL, e.g. `https://inuka-pulse-backend.onrender.com` |

4. Deploy. Vercel builds the Next.js app and serves it on a `*.vercel.app` domain.

5. **After Vercel gives you the URL**, go back to Render and update `CORS_ALLOWED_ORIGINS` to your Vercel URL. Trigger a Render redeploy so the backend picks up the new CORS origin.

### Render free tier notes

- The free Render web service **spins down after 15 minutes of inactivity** and takes ~30 seconds to cold-start. Upgrade to the Starter plan ($7/month) to keep it always-on.
- The free PostgreSQL database is available for 90 days. After that, you need to upgrade or migrate.

---

## 3. GitHub Actions ETL Cron

The ETL cron runs the Python pipeline on GitHub's servers every 10 minutes and uploads the output files to Cloudflare R2. The Render backend polls R2 every 2 minutes and loads the latest batch.

### Why this architecture

Render free-tier services sit behind Cloudflare, which blocks direct HTTP POST from external clients (returns 403). The R2 pull model avoids this: the pipeline writes to R2 (no Cloudflare), and the backend reads from R2 (its own outbound request, no issue).

### Prerequisites

1. A [Cloudflare account](https://cloudflare.com) with R2 enabled (free 10 GB/month)
2. An R2 bucket — create at: Cloudflare dashboard → R2 → Create bucket

### R2 bucket setup

1. Create a bucket named `inuka-pipeline` (or any name).
2. Enable **public access** for the bucket (R2 → your bucket → Settings → Public access → Enable).
3. Note the public URL: `https://pub-<hash>.r2.cloudflarestorage.com` or your custom domain.
4. Create an **API token** with `Object Read & Write` permissions for the bucket.

### GitHub Secrets setup

Go to your repository → Settings → Secrets and variables → Actions → New repository secret:

| Secret | Where to find it |
|--------|-----------------|
| `R2_ACCOUNT_ID` | Cloudflare dashboard → right sidebar |
| `R2_ACCESS_KEY_ID` | From the R2 API token you created |
| `R2_SECRET_ACCESS_KEY` | From the R2 API token you created |
| `R2_BUCKET` | Your bucket name, e.g. `inuka-pipeline` |

### Triggering the cron

The workflow file is at `.github/workflows/etl-cron.yml`. It runs automatically every 10 minutes once secrets are set. You can also trigger it manually from GitHub → Actions → ETL Live Cron → Run workflow.

### Verify it's working

1. Go to GitHub → Actions → ETL Live Cron — you should see runs every 10 minutes.
2. Open your R2 bucket — `live_batch.json` and `inuka_predictions_export.json` should appear/update.
3. Call `https://your-render-service.onrender.com/api/config/etl` — `lastLoadedAt` will update when the backend polls and loads new data.

---

## Environment variable reference

### `.env` (Docker Compose)

| Variable | Required | Description |
|----------|----------|-------------|
| `POSTGRES_DB` | No | Database name (default: `inuka_pulse`) |
| `POSTGRES_USER` | No | DB username (default: `inuka`) |
| `POSTGRES_PASSWORD` | **Yes** | Change from default in production |
| `JWT_SECRET` | **Yes** | Min 40 chars — signs all auth tokens |
| `CORS_ALLOWED_ORIGINS` | No | Frontend URL (default: `http://localhost:3000`) |
| `NEXT_PUBLIC_INUKA_API_URL` | No | Backend URL browser uses (default: `http://localhost:8080`) |
| `ETL_LIVE_BATCH_URL` | No | R2 URL for live_batch.json — blank = use file volume |
| `ETL_PREDICTIONS_URL` | No | R2 URL for predictions — blank = use file volume |
| `ETL_API_KEY` | No | API key for ETL endpoint authentication |
| `GROQ_API_KEY` | No | LLM narrative enhancement — blank = use templates |
| `LLM_ENABLED` | No | `true`/`false` (default: `true`) |

### Render environment variables (set in Render dashboard)

| Variable | Required | Description |
|----------|----------|-------------|
| `JWT_SECRET` | **Yes** | Different from local — generate a new one |
| `CORS_ALLOWED_ORIGINS` | **Yes** | Your Vercel frontend URL |
| `ETL_LIVE_BATCH_URL` | **Yes** | R2 public URL for live_batch.json |
| `ETL_PREDICTIONS_URL` | **Yes** | R2 public URL for predictions export |
| `ETL_API_KEY` | Recommended | Secures the ETL endpoint |
| `GROQ_API_KEY` | No | Optional LLM narratives |

---

## Troubleshooting

### Backend won't start — "Failed to obtain JDBC Connection"
The database isn't ready yet. The backend has a 60-second `start_period` in docker-compose and will retry. Wait another minute and check `docker compose logs backend`.

### Frontend shows blank page or API errors
Check that `NEXT_PUBLIC_INUKA_API_URL` points to the correct backend URL and that CORS is configured with the right origin. In Docker Compose, the browser calls `http://localhost:8080` directly (not through Docker DNS).

### Flyway migration error — "Table already exists"
The `baseline-on-migrate: true` and `out-of-order: true` settings handle this. If you see a checksum mismatch error, it means a migration file was edited after it ran. Never edit existing migration files — create a new one.

### Predictions not updating
Check the pipeline container: `docker compose logs pipeline`. If using R2, check GitHub Actions ran successfully and the R2 bucket has updated files. The backend polls every 2 minutes — wait one cycle and check `GET /api/config/etl` for `lastLoadedAt`.

### "Cannot read properties of undefined" on the Analyst survival curve page
This is the old HSE analytics page at `/dashboard/inuka/analytics`. It expects a different data shape than the Inuka pipeline provides. The page has been updated with a null guard — redeploy to pick up the fix.
