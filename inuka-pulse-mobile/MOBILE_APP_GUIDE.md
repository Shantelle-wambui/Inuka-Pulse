# Inuka Pulse Mobile — Complete Application Guide

This document covers everything about the Inuka Pulse mobile app: what it is, how it works, how to run it locally, how data flows through the system, and what is needed to deploy it for real users.

---

## 1. What the App Is

Inuka Pulse Mobile is a field tool for **Case Managers** at Inuka Foundation. It gives case managers on-the-ground access to their assigned beneficiaries, the ML model's risk predictions, and a way to record field visits — all from their phone.

It is **not** a replacement for the web dashboard. It is a companion to it. The web dashboard is for Programme Directors and Admins sitting at a desk. The mobile app is for case managers driving to beneficiary homes in the field.

**Who uses it:** Case Managers only  
**Who does not use it:** Admins, Programme Directors, Coordinators, Donors — those roles use the web dashboard

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Expo (React Native) | SDK 54 |
| Runtime | React Native | 0.81.5 |
| Navigation | Expo Router | v6 |
| State management | Zustand | v5 |
| HTTP client | Axios | v1.7 |
| Token storage | Expo SecureStore | v14 |
| Language | TypeScript | strict mode |
| Brand colours | Teal `#00999E` / Red `#C42152` | — |

---

## 3. Screens and What They Do

### Screen 1 — Login
- The entry point. Shows the Inuka logo, "Case Manager Portal" title
- Connects to `/api/auth/login` on the backend
- JWT token is saved **encrypted on the device** using Expo SecureStore (not plain storage)
- Session persists across app restarts — you stay logged in until you tap logout
- Password eye toggle so you can confirm what you typed

### Screen 2 — Home Dashboard
- First screen after login
- Shows a greeting with the case manager's name and today's date
- **4 KPI cards**: Total beneficiaries, Needs Action, At-Risk, Active
- **Active Alerts**: high-severity system alerts for the case manager's caseload
- **Open Tasks**: CAPA interventions assigned to them with due dates
- Pull-to-refresh updates all data
- Logout button top right

### Screen 3 — My Caseload
- Full list of beneficiaries assigned to this case manager
- Sorted by **dropout probability descending** — highest risk appears first
- Each card shows: Beneficiary ID, risk band (colour coded), cohort, county, pillar, dropout risk bar
- **Risk band colours**: Red = High Risk, Orange = Disengaged, Amber = At-Risk, Green = Active
- Filter chips: All / High Risk / At-Risk / Disengaged / Active
- Search bar: search by ID, cohort, county, or pillar
- Tap any row → opens Beneficiary Profile

### Screen 4 — Beneficiary Profile
- The "wow" screen for the hackathon demo
- Shows the ML model's output directly on the phone:
  - **Dropout Risk gauge** — visual bar e.g. "78% dropout risk"
  - **Engagement Score gauge** — 0–100 score
  - **Top Risk Factors** — ranked list of reasons the model flagged this person (e.g. "Missed 3 disbursements", "No session attendance in 6 weeks")
- Profile details: cohort, pillar, county, assessment date
- **Visit History** — last 5 recorded follow-ups with type, date, outcome, and notes
- **Submit Field Visit** button at the bottom → pre-fills the visit form with this beneficiary

### Screen 5 — Submit Visit
- The most operationally important screen
- Fields:
  - Beneficiary ID (pre-filled from profile, or type manually)
  - Visit Type: Home Visit / Phone Call / SMS / Other
  - Outcome: Reached / No answer / Left message / Escalated
  - Observations & Notes (free text)
  - Next Action (optional)
  - Visit date (auto-set to today)
- Tap Submit → data goes straight to the backend API
- Success screen confirms the record was saved
- "Submit Another" button to record back-to-back visits without navigating away

---

## 4. How Data Flows Through the System

```
Case Manager's Phone
        │
        │  POST /api/beneficiaries/{id}/follow-ups
        │  GET  /api/beneficiaries/my-caseload
        │  GET  /api/beneficiaries/my-caseload/summary
        │  GET  /api/alerts
        │  GET  /api/capas
        │
        ▼
  Spring Boot Backend (port 8080)
        │
        ├── PostgreSQL Database
        │       └── Stores visit records, beneficiary data,
        │           risk predictions, alerts, CAPAs
        │
        └── Web Dashboard (Next.js, port 3000)
                └── Programme Director sees the visit
                    record submitted from the phone
                    in real time
```

**The full loop for the hackathon demo story:**

1. ML model runs → generates dropout predictions → stored in DB
2. Case manager opens mobile app → sees beneficiary flagged as 78% dropout risk
3. Case manager drives to visit the beneficiary
4. Case manager submits a visit record from the field on the phone
5. Record hits the backend API → saved to PostgreSQL immediately
6. Programme Director opens the web dashboard → sees the new visit in the activity feed

---

## 5. Running Locally (Development)

### What you need

- Node.js 18 or higher
- Java 21 (for the backend)
- PostgreSQL running locally or a connection to a remote DB
- Expo Go installed on your phone (Play Store / App Store)
- Your phone and laptop on the **same WiFi network**

### Step 1 — Start the backend

```bash
cd /home/shantel/Inuka-Pulse/inuka-pulse-backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=postgres
```

Verify: open `http://localhost:8080/actuator/health` in browser → should show `{"status":"UP"}`

### Step 2 — Set the API URL in the mobile app

Find your machine's WiFi IP address:

- **Linux/Mac**: run `hostname -I` in terminal
- **Windows**: run `ipconfig` in Command Prompt → look for **Wi-Fi → IPv4 Address**

Edit `/home/shantel/Inuka-Pulse/inuka-pulse-mobile/.env`:

```
EXPO_PUBLIC_API_URL=http://YOUR_WIFI_IP:8080
```

Example: `EXPO_PUBLIC_API_URL=http://172.16.3.205:8080`

### Step 3 — Windows + WSL users only: Port forwarding

If you run WSL on Windows, the backend runs inside WSL and your phone can't reach it directly. Run these in **PowerShell as Administrator**:

```powershell
# Get your current WSL IP first
wsl hostname -I

# Forward backend and Metro ports (replace WSL_IP with the output above)
netsh interface portproxy add v4tov4 listenport=8080 listenaddress=0.0.0.0 connectport=8080 connectaddress=WSL_IP
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=WSL_IP

# Allow through Windows Firewall
netsh advfirewall firewall add rule name="WSL 8080" dir=in action=allow protocol=TCP localport=8080
netsh advfirewall firewall add rule name="WSL 8081" dir=in action=allow protocol=TCP localport=8081
```

> Note: The WSL IP changes every time you restart your computer. Re-run `wsl hostname -I` and update the portproxy rules after each restart.

Verify it worked: open `http://YOUR_WIFI_IP:8080/actuator/health` in your **Windows browser**. If it shows `{"status":"UP"}` your phone can reach it.

### Step 4 — Start the Metro bundler

```bash
cd /home/shantel/Inuka-Pulse/inuka-pulse-mobile
REACT_NATIVE_PACKAGER_HOSTNAME=YOUR_WIFI_IP npx expo start --lan --clear
```

A QR code appears. The URL below it should say `exp://YOUR_WIFI_IP:8081`.

### Step 5 — Open on your phone

- **Android**: Open Expo Go → tap Scan QR code → scan
- **iPhone**: Open Camera app → point at QR code → tap banner

App loads in ~30 seconds the first time, instant after that.

### Login credentials

| Role | Email | Password |
|------|-------|----------|
| Case Manager | `officer@inuka.org` | `sentinel@admin` |

---

## 6. Deployment — Getting the App to Real Users

There are two parts to deployment: the **backend** (already hosted or can be hosted) and the **mobile app** (needs to be built into an APK/IPA).

### Part A — Backend Deployment

The backend needs to be on a publicly accessible URL so the phone can reach it over the internet (not just local WiFi).

The project already has deployment configs for:

| Platform | Config file |
|----------|------------|
| Render | `application-render.yml` |
| Railway | `application-railway.yml` |
| Docker | `application-docker.yml` |

**Recommended for hackathon: Render (free tier)**

Steps:
1. Push the backend to GitHub
2. Go to [render.com](https://render.com) → New Web Service → connect your repo
3. Set environment variables:
   - `DATABASE_URL` — your PostgreSQL connection string
   - `JWT_SECRET` — a long random string (minimum 64 characters)
   - `CORS_ALLOWED_ORIGINS` — `http://localhost:3000,https://your-frontend.vercel.app`
   - `SPRING_PROFILES_ACTIVE` — `render`
4. Deploy → Render gives you a URL like `https://inuka-pulse-backend.onrender.com`

Once deployed, update the mobile app's `.env`:
```
EXPO_PUBLIC_API_URL=https://inuka-pulse-backend.onrender.com
```

Now the phone connects to the deployed backend over the internet — no port forwarding needed, no same-WiFi requirement.

### Part B — Mobile App Distribution

For the hackathon demo you have two options:

#### Option 1 — Expo Go (what we're using now)
- No build needed
- Anyone installs Expo Go on their phone and scans the QR code
- Only works while your Metro server is running on your laptop
- Good enough for a demo, not for real users

#### Option 2 — Build an APK (Android install file)
This creates a real `.apk` file that anyone can install directly on their Android phone — no Expo Go needed, no laptop running.

```bash
# Install EAS CLI (Expo's build tool)
npm install -g eas-cli

# Log in to your Expo account (create one free at expo.dev)
eas login

# Set up EAS for the project
cd /home/shantel/Inuka-Pulse/inuka-pulse-mobile
eas build:configure

# Build an APK for Android
eas build --platform android --profile preview
```

EAS builds it in the cloud (~10–15 minutes) and gives you a download link for the `.apk`. Send that link to anyone — they open it on their Android phone, install it, and they have the real Inuka Pulse app.

**Cost**: EAS free tier gives you 30 builds/month — more than enough for a hackathon.

**Before building**, make sure:
1. `EXPO_PUBLIC_API_URL` in `.env` points to your deployed backend URL (not localhost)
2. The backend is actually deployed and reachable
3. `app.json` has the correct `android.package` name (`org.inukafoundation.pulse`)

#### What an `eas.json` file should look like

Create this file in `inuka-pulse-mobile/`:

```json
{
  "build": {
    "preview": {
      "android": {
        "buildType": "apk"
      }
    },
    "production": {
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

The `preview` profile builds a plain `.apk` (easy to sideload for testing). The `production` profile builds an `.aab` (required for Google Play Store submission).

---

## 7. What's Needed for Production (After Hackathon)

If Inuka Foundation wants to actually deploy this to real field workers:

| What | Why | Effort |
|------|-----|--------|
| Google Play Store account | So field workers install it from Play Store, not sideload | One-time $25 USD fee |
| Deployed backend with custom domain | Stable URL that doesn't change | 1 day |
| Offline-first sync (SQLite + sync queue) | Field areas in Kenya have poor connectivity | 2–3 weeks |
| Push notifications (FCM) | Alert case managers when a beneficiary crosses into high risk | 1 week |
| Real device testing on Tecno/Infinix | Target devices are low-end Android, not flagship phones | Ongoing |
| OTA updates via EAS Update | Push app fixes without requiring Play Store update | 1 day setup |

---

## 8. Backend API Endpoints the Mobile Uses

| Method | Endpoint | Screen | What it does |
|--------|----------|--------|-------------|
| `POST` | `/api/auth/login` | Login | Authenticate and get JWT |
| `GET` | `/api/beneficiaries/my-caseload/summary` | Home | KPI numbers for the dashboard |
| `GET` | `/api/beneficiaries/my-caseload` | Caseload | Full list of assigned beneficiaries with ML predictions |
| `GET` | `/api/beneficiaries/{id}` | Profile | Single beneficiary detail with risk scores |
| `GET` | `/api/beneficiaries/{id}/follow-ups` | Profile | Visit history for a beneficiary |
| `POST` | `/api/beneficiaries/{id}/follow-ups` | Submit Visit | Record a new field visit |
| `GET` | `/api/alerts` | Home | Active system alerts |
| `GET` | `/api/capas` | Home | Open tasks assigned to this case manager |

All endpoints except login require a valid JWT in the `Authorization: Bearer <token>` header. The Axios client handles this automatically.

---

## 9. Folder Structure

```
inuka-pulse-mobile/
├── app/
│   ├── _layout.tsx          # Root layout — auth redirect logic
│   ├── (auth)/
│   │   ├── _layout.tsx      # Auth stack
│   │   └── login.tsx        # Login screen
│   └── (app)/
│       ├── _layout.tsx      # App stack with branded header
│       ├── home.tsx         # Home dashboard
│       ├── caseload.tsx     # My caseload list
│       ├── beneficiary/
│       │   └── [id].tsx     # Beneficiary profile (dynamic route)
│       └── visit/
│           └── [beneficiaryId].tsx  # Submit visit form
├── src/
│   ├── api/
│   │   └── client.ts        # Axios instance + all API functions
│   ├── stores/
│   │   └── authStore.ts     # Zustand auth store
│   └── constants.ts         # Brand colours + API base URL
├── assets/
│   ├── icon.png             # App icon (Inuka logo)
│   ├── splash-icon.png      # Splash screen image
│   └── adaptive-icon.png    # Android adaptive icon
├── app.json                 # Expo config
├── .env                     # API URL (not committed to git)
└── MOBILE_APP_GUIDE.md      # This document
```

---

## 10. Environment Variables

Only one environment variable is needed:

| Variable | Description | Example |
|----------|-------------|---------|
| `EXPO_PUBLIC_API_URL` | Base URL of the Inuka Pulse backend | `https://inuka-pulse-backend.onrender.com` |

Set it in the `.env` file in the `inuka-pulse-mobile/` folder. For local development use your machine's WiFi IP. For production use the deployed backend URL.

`EXPO_PUBLIC_*` variables are safe to bundle into the app — they are not secrets. Never put database passwords or JWT secrets in this file.
