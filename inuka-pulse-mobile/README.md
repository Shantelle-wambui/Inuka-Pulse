# Inuka Pulse Mobile

React Native / Expo app for Inuka Foundation Case Managers. Built with Expo SDK 54, expo-router, Zustand, and Axios.

---

## Screens

| Screen | Route | Description |
|--------|-------|-------------|
| Login | `(auth)/login` | Authenticates against the Inuka backend |
| Home | `(app)/home` | Morning dashboard — caseload summary, alerts, open tasks |
| My Caseload | `(app)/caseload` | Full beneficiary list with risk band filters and search |
| Beneficiary Profile | `(app)/beneficiary/[id]` | ML dropout risk gauge, engagement score, risk factors, visit history |
| Submit Visit | `(app)/visit/[beneficiaryId]` | Record a field visit or follow-up call |

---

## Tech Stack

- Expo SDK 54 / React Native 0.81
- Expo Router v6 (file-based navigation)
- Zustand (auth state management)
- Axios (API client with automatic JWT injection)
- Expo SecureStore (encrypted token storage on device)
- Brand colours: Teal `#00999E` / Red `#C42152`

---

## Credentials

| Role | Email | Password | Use for |
|------|-------|----------|---------|
| Case Manager | `officer@inuka.org` | `sentinel@admin` | Mobile app |
| Admin | `admin@inuka.org` | `sentinel@admin` | Web dashboard only |
| Programme Director | `director@inuka.org` | `sentinel@admin` | Web dashboard only |
| Coordinator | `coordinator@inuka.org` | `sentinel@admin` | Web dashboard only |

**Only the Case Manager account should be used for the mobile app.** Admin, Director, and Coordinator are back-office roles intended for the web dashboard.

---

## Prerequisites

Before running the app you need:

1. The **Inuka Pulse backend** running (Spring Boot on port 8080)
2. **Node.js 18+** installed on your machine
3. **Expo Go** installed on your phone (Play Store / App Store)
4. Your phone and laptop on the **same WiFi network**

---

## Setup (First Time)

```bash
# 1. Go into the mobile folder
cd /home/shantel/Inuka-Pulse/inuka-pulse-mobile

# 2. Install dependencies
npm install --legacy-peer-deps

# 3. Create the environment file
# For local dev replace the IP with your machine's actual WiFi IP (see step below)
echo "EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:8080" > .env
```

### Finding your WiFi IP (Windows + WSL users)

Open **Command Prompt** (not WSL) and run:

```
ipconfig
```

Look for **Wireless LAN adapter Wi-Fi → IPv4 Address**. It will look like `172.16.x.x` or `192.168.x.x`. Use that IP.

Example `.env` file:
```
EXPO_PUBLIC_API_URL=http://172.16.3.205:8080
```

### Windows + WSL: Port Forwarding (required)

The backend runs inside WSL. Your phone can't reach WSL directly. Run these commands in **PowerShell as Administrator** to bridge the connection:

```powershell
# Forward backend port
netsh interface portproxy add v4tov4 listenport=8080 listenaddress=0.0.0.0 connectport=8080 connectaddress=172.22.188.178

# Forward Metro bundler port
netsh interface portproxy add v4tov4 listenport=8081 listenaddress=0.0.0.0 connectport=8081 connectaddress=172.22.188.178

# Allow through Windows Firewall
netsh advfirewall firewall add rule name="WSL Backend 8080" dir=in action=allow protocol=TCP localport=8080
netsh advfirewall firewall add rule name="WSL Expo 8081" dir=in action=allow protocol=TCP localport=8081
```

Replace `172.22.188.178` with the WSL IP shown in your `ipconfig` output under **vEthernet (WSL)**.

---

## Running the App

### Step 1 — Start the backend

```bash
cd /home/shantel/Inuka-Pulse/inuka-pulse-backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=postgres
```

Verify it's up: open `http://localhost:8080/actuator/health` in your browser. You should see `{"status":"UP"}`.

### Step 2 — Start Metro (Expo bundler)

Open a **new terminal** and run:

```bash
cd /home/shantel/Inuka-Pulse/inuka-pulse-mobile
REACT_NATIVE_PACKAGER_HOSTNAME=172.16.3.205 npx expo start --lan --clear
```

Replace `172.16.3.205` with your actual Windows WiFi IP from the `ipconfig` step above.

You will see a QR code and output like:

```
› Metro waiting on exp://172.16.3.205:8081
› Scan the QR code above with Expo Go (Android) or the Camera app (iOS)
```

### Step 3 — Open on your phone

- **Android**: Open Expo Go → tap **Scan QR code** → point at the QR code on screen
- **iPhone**: Open the Camera app → point at the QR code → tap the banner that appears

The app takes about 30 seconds to bundle the first time. After that, hot reload is instant.

---

## App Flow — Step by Step

This is the full journey a case manager takes through the app.

### 1. Login

- Open the app — you land on the **teal login screen** with the Inuka logo
- Enter:
  - Email: `officer@inuka.org`
  - Password: `sentinel@admin`
  - Tap the eye icon on the password field to confirm what you typed
- Tap **Sign in**
- Your JWT token is saved securely on the device — you stay logged in until you tap logout

---

### 2. Home Dashboard

After login you land on the **Home screen**:

- Greeting: "Good morning, Grace" with today's date
- **4 KPI cards** showing your caseload at a glance:
  - Total beneficiaries assigned to you
  - Needs Action (requires immediate follow-up)
  - At-Risk (flagged by the ML model)
  - Active (on track)
- **Active Alerts** — high-severity system alerts for your caseload
- **My Open Tasks** — CAPA actions assigned to you with due dates
- Pull down to refresh all data

**Quick Actions:**
- Tap **My Caseload** → goes to the full beneficiary list
- Tap **Submit Visit** → goes straight to the visit form (you'll pick the beneficiary there)

---

### 3. My Caseload

Tap **My Caseload** from the home screen or the quick action button:

- Beneficiaries are listed **highest risk first** (sorted by dropout probability)
- Each card shows:
  - Beneficiary ID
  - Risk band badge (colour coded): **Red = High Risk**, **Orange = Disengaged**, **Amber = At-Risk**, **Green = Active**
  - Cohort, county, pillar
  - A visual dropout probability bar (e.g. "78% dropout risk")
- **Filter chips** at the top: All / High Risk / At-Risk / Disengaged / Active — tap to filter
- **Search bar** — search by beneficiary ID, cohort name, county, or pillar
- Pull down to refresh
- Tap any beneficiary card → opens their **Profile**

---

### 4. Beneficiary Profile

Tap a beneficiary from the caseload list:

- **Risk header card** (coloured border matching the risk band):
  - Beneficiary ID and cohort
  - Risk band pill with icon
  - **Dropout Risk gauge** — visual bar showing e.g. 78% (this is the ML model's prediction)
  - **Engagement Score gauge** — shows 0–100 engagement score from the model

- **Profile section**: cohort, pillar, county, assessment date

- **Top Risk Factors** — the top reasons the ML model flagged this person (e.g. "Missed 3 disbursements", "No session attendance in 6 weeks"). These come directly from the prediction model.

- **Visit History** — last 5 recorded follow-ups with type, date, outcome, and notes

- **Submit Field Visit button** at the bottom — pre-fills the beneficiary ID in the visit form

---

### 5. Submit Visit / Follow-up

Tap **Submit Field Visit** from the beneficiary profile or the Home quick action:

- **Beneficiary ID** — pre-filled if coming from a profile, or type it manually
- **Visit Type** — choose one:
  - Home Visit
  - Phone Call
  - SMS
  - Other
- **Outcome** — choose one:
  - Reached — spoke with beneficiary
  - No answer
  - Left message / voicemail
  - Escalated — welfare concern raised
- **Observations & Notes** — free text field for what you observed
- **Next Action** — optional, e.g. "Follow up in 2 weeks"
- **Visit date** — automatically set to today
- Tap **Submit Visit Record**

On success you see a green confirmation screen. The record is saved to the backend and will appear in the visit history on the beneficiary's profile immediately.

You can tap **Submit Another** to record another visit without going back.

---

### 6. Viewing Updated Data

After submitting a visit:

1. Tap the **back arrow** to return to the Beneficiary Profile
2. The visit history will show your new record at the top
3. Go back to **My Caseload** — pull down to refresh
4. Go back to **Home** — pull down to refresh to see updated KPIs

The data flows: **Mobile → Backend API → Web Dashboard** — a Programme Director viewing the web dashboard will see the visit record you just submitted in real time.

---

### 7. Logout

Tap the logout icon (arrow icon) in the top right of the Home screen. Your session is cleared from the device. The next person who opens the app will see the login screen.

---

## Troubleshooting

### "Network request failed" on login
- Your phone is not on the same WiFi as your laptop
- The backend is not running — check `http://localhost:8080/actuator/health`
- The IP in `.env` is wrong — re-run `ipconfig` and update the `.env` file
- WSL port forwarding is not set up — run the `netsh` commands above

### Login works but caseload is empty
- The Case Manager account has no cohort assignments
- Fix: log into the web dashboard as `admin@inuka.org`, go to **Administration → Assign Case Managers**, and assign Grace Wanjiku to one or more cohorts

### "Project is incompatible with this version of Expo Go"
- Your Expo Go is on a different SDK than the project
- The project targets **SDK 54** — make sure you have the latest Expo Go from the Play Store

### QR code scans but app won't load
- Run `pkill -f metro; pkill -f "expo start"` in WSL to kill stale processes
- Restart: `REACT_NATIVE_PACKAGER_HOSTNAME=YOUR_WIFI_IP npx expo start --lan --clear`
- Clear Expo Go cache on your phone: Settings → Apps → Expo Go → Storage → Clear Cache + Clear Data

### "Runtime not ready" error
- Stop Metro with `Ctrl+C`
- Run: `REACT_NATIVE_PACKAGER_HOSTNAME=YOUR_WIFI_IP npx expo start --lan --clear`
- The `--clear` flag wipes the Metro cache which usually resolves this

---

## Demo Story (Hackathon)

Tell this story while showing the app:

> "Grace is a case manager in Kisumu. She opens the app this morning and sees that two of her beneficiaries crossed into high risk overnight — the ML model flagged them. She taps on David's profile, sees his dropout probability is 78% and the top reason is missed disbursements. She drives to visit him, submits her visit note from the field, and that record appears instantly on the Programme Director's dashboard."

Show each step live: Login → Home KPIs → Caseload → Beneficiary Profile (ML score) → Submit Visit → record appears in history.
