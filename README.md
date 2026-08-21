# Inuka Pulse

**Programme Impact & M&E Intelligence Platform**  
Built for the Inuka Foundation — PLP Hackathon Stage 2, Domain 3: Programme Impact, M&E and Analytics.

---

## What Is This?

Inuka Pulse is a real-time monitoring and evaluation (M&E) dashboard that gives the Inuka Foundation live visibility into beneficiary engagement, dropout risk, and programme impact across all four pillars — Scholarship, Plus, Vocational, and Tech.

It replaces manual monthly reporting with a live intelligence system that predicts which beneficiaries are at risk of dropping out **before** it happens.

---

## Project Structure

```
Inuka-Pulse/
├── inuka-pulse-frontend/   # Next.js 14 dashboard (React, TypeScript)
├── inuka-pulse-backend/    # Spring Boot 3 REST API (Java 21)
├── inuka-pipeline/         # Python ETL pipeline + dropout prediction model
├── INUKA_SYSTEM_OVERVIEW.md  # Full system overview for pitch deck
└── render.yaml             # Cloud deployment config
```

---

## Quick Start

**Backend**
```bash
cd inuka-pulse-backend
./mvnw spring-boot:run
# Runs on http://localhost:8080
```

**Frontend**
```bash
cd inuka-pulse-frontend
pnpm install
pnpm dev
# Runs on http://localhost:3000
```

**Python Pipeline**
```bash
cd inuka-pipeline
python3 src/inuka_live_bridge.py
# Converts beneficiary predictions → live_batch.json for the backend
```

---

## Login Credentials

All accounts use password: `sentinel@admin`

| Email | Role |
|---|---|
| admin@inuka.org | Admin |
| director@inuka.org | Programme Director |
| officer@inuka.org | Field Officer |
| analyst@inuka.org | Analyst |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14, React, TypeScript, Recharts, Leaflet |
| Backend | Java 21, Spring Boot 3, H2 (dev) / PostgreSQL (prod) |
| ML Pipeline | Python 3, Pandas, scikit-learn (Logistic Regression) |
| Auth | JWT (Spring Security) |
| Deployment | Vercel (frontend) + Render (backend) |

---

## Key Features

- **Live M&E Dashboard** — real-time KPIs across all Inuka cohorts
- **Dropout Prediction Model** — flags at-risk beneficiaries before they disengage
- **Kenya Cohort Map** — geographic risk heatmap across all programme locations
- **Automated Alert System** — sound + visual alerts for Critical/High risk cohorts
- **Data Quality Monitoring** — batch tracking with gate pass/fail status
- **Field Officer View** — mobile-friendly alerts and report submission

---

## Branch Strategy

- `main` — stable releases only
- `development` — active development branch (work here)
