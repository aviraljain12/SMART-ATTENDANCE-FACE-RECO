# FaceAttend - Smart Face Recognition Attendance System
**Version 2.0 · Finalized Product Specification · November 2026**

A cloud-based, organization-oriented attendance management web application that uses browser-based facial recognition to identify registered employees or students and automatically record their daily attendance in Supabase PostgreSQL.

---

## 🚀 Key Features

1. **Browser-Based Face Recognition**
   - MediaDevices camera API with real-time face landmark tracking.
   - 128-dimensional biometric descriptor extraction and Euclidean distance matching.
   - Multi-face rejection (prevents proxy attendance).
   - Liveness and lighting checks.

2. **Once-Per-Day Attendance Constraint**
   - Organization timezone-aware date resolution (`Asia/Kolkata` default).
   - Database-level uniqueness constraint (`UNIQUE (user_id, attendance_date)`).
   - Instant duplicate rejection with clear status feedback.

3. **Role-Based Workspaces & Dashboards**
   - **Employee Workspace**: Live attendance check-in status, radial working gauges, monthly breakdown, working history, and biometric profile manager.
   - **Admin Console**: Executive attendance statistics donut, check-in vs absent counts, live attendance terminal (Kiosk mode), member management, date-filtered reports with CSV export, and audit trail.

4. **Biometric Privacy & Consent (TC-14)**
   - Explicit biometric consent modal before capture.
   - Raw photos are never uploaded or persisted on servers; only mathematical feature vectors are stored.
   - 1-click consent withdrawal and biometric data deletion workflow.

5. **Dual-Mode Backend**
   - **Cloud Mode**: Seamless integration with Supabase Auth, PostgreSQL, Row-Level Security (RLS), and Supabase Edge Functions.
   - **Local / Offline Mode**: Works out of the box with persistent local storage and instant persona switching (`Sourav Roy`, `Damian Vance`, `Dr. Sarah Connor`).

---

## 🛠️ Technology Stack

- **Frontend**: React 18, Vite 6, Tailwind CSS, Framer Motion, Lucide Icons, Canvas Confetti.
- **Biometrics**: `@vladmandic/face-api` & client-side vision descriptor engine.
- **Backend**: Supabase Auth, PostgreSQL with RLS, Supabase Edge Functions (Deno).

---

## 📦 Project Structure

```
face-attendance-system/
├── public/
├── src/
│   ├── components/
│   │   ├── common/
│   │   ├── layout/
│   │   │   ├── Navbar.jsx
│   │   │   └── Sidebar.jsx
│   │   └── face-recognition/
│   │       ├── FaceCamera.jsx
│   │       ├── FaceEnrollment.jsx
│   │       └── AttendanceScanner.jsx
│   ├── pages/
│   │   ├── auth/
│   │   │   └── Login.jsx
│   │   ├── employee/
│   │   │   ├── Dashboard.jsx
│   │   │   ├── MarkAttendancePage.jsx
│   │   │   ├── AttendanceHistoryPage.jsx
│   │   │   └── ProfilePage.jsx
│   │   └── admin/
│   │       ├── Dashboard.jsx
│   │       ├── LiveKiosk.jsx
│   │       ├── UserManagement.jsx
│   │       ├── ReportsPage.jsx
│   │       ├── AuditLogsPage.jsx
│   │       └── SettingsPage.jsx
│   ├── services/
│   │   ├── supabase.js
│   │   ├── authService.js
│   │   ├── attendanceService.js
│   │   ├── userService.js
│   │   ├── faceRecognitionService.js
│   │   └── mockDatabase.js
│   ├── hooks/
│   │   ├── useAuth.js
│   │   ├── useCamera.js
│   │   └── useFaceRecognition.js
│   ├── context/
│   │   └── AuthContext.jsx
│   ├── utils/
│   │   ├── dateUtils.js
│   │   └── validation.js
│   ├── App.jsx
│   └── main.jsx
├── supabase/
│   ├── migrations/
│   │   └── 20261102_initial_schema.sql
│   └── functions/
│       ├── mark-attendance/index.ts
│       ├── register-face/index.ts
│       ├── get-dashboard-stats/index.ts
│       ├── manage-users/index.ts
│       └── export-attendance/index.ts
├── .env.example
├── package.json
└── README.md
```

---

## 🏃 Running the Application

### 1. Install Dependencies
```bash
npm install
```

### 2. Start Local Development Server
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### 3. Connect Live Supabase Project (Optional)
Add your Supabase project credentials to `.env`:
```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```
Run the SQL migration in [supabase/migrations/20261102_initial_schema.sql](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/supabase/migrations/20261102_initial_schema.sql) in your Supabase SQL editor.
