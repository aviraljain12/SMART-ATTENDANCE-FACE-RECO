# FaceTrack Project Progress & Technical Audit

This document records the exact state of FaceTrack as of **Phase 0 (Baseline Audit)** following the merge of PR #2 ([commit `b7d2c1f`](https://github.com/aviraljain12/SMART-ATTENDANCE-FACE-RECO/commit/b7d2c1f61323bff557569de133a1e97fbac1bcf5)).

---

## 1. Executive Summary & Starting Point

FaceTrack is currently operating in a **stable mock-mode milestone**.
- **Working functionality**: Dynamic employee registration, webcam lifecycle stabilization, multi-pose live face enrollment, unenrolled user rejection, mismatch rejection, multi-candidate kiosk identification with runner-up margin enforcement, and single daily attendance recording.
- **Backend state**: Supabase is **not yet connected** in the live environment (`isSupabaseConfigured = false` due to placeholder credentials in `.env`).
- **Test baseline**: 102 automated unit and integration tests passing (`npm test`), production Vite bundle building with 0 errors (`npm run build`).

---

## 2. Verified Working Features (Confirmed by Tests & Manual Review)

| Feature | Primary File(s) | Status | Verification Detail |
| :--- | :--- | :--- | :--- |
| **Dynamic Employee Registration** | [`src/pages/auth/Login.jsx`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/pages/auth/Login.jsx)<br>[`src/services/authService.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/services/authService.js) | Verified | Allows entering Full Name, Employee ID, Department, Email, Password. Account initializes with `has_face_registered: false`. Tested in `tests/genuineBiometrics.test.js` (Test 14). |
| **Stable Camera Stream Lifecycle** | [`src/hooks/useCamera.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/hooks/useCamera.js) | Verified | Stream caching fast-path prevents camera blinking on re-renders. Single stream active, tracks properly terminated on unmount. Tested in `tests/lifecycleAndStability.test.js` (Tests 1–4). |
| **Enrollment Camera Decoupling** | [`src/components/face-recognition/FaceEnrollment.jsx`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/components/face-recognition/FaceEnrollment.jsx) | Verified | Camera effect depends strictly on `inCapturePhase` boolean, eliminating infinite start-stop cleanup loop. Transitions between sample poses 1 -> 2 -> 3 without camera flicker. |
| **Multi-Pose Genuine Biometric Capture** | [`src/components/face-recognition/FaceEnrollment.jsx`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/components/face-recognition/FaceEnrollment.jsx)<br>[`src/services/faceRecognitionService.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/services/faceRecognitionService.js) | Verified | Captures 3 distinct 128-d vectors (frontal, slight left, slight right). Frontal symmetry verified on pose 1; angled poses permitted on poses 2 & 3. Synthetic vectors purged. |
| **Unenrolled User Rejection** | [`src/services/attendanceService.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/services/attendanceService.js)<br>[`src/hooks/useFaceRecognition.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/hooks/useFaceRecognition.js) | Verified | Returns `Face Not Registered` and rejects attendance submission for users without active 128-d descriptors. Tested in `tests/genuineBiometrics.test.js` (Test 3 & 9). |
| **Face Mismatch Rejection** | [`src/services/faceRecognitionService.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/services/faceRecognitionService.js) | Verified | Euclidean distance $> 0.55$ returns `Face Mismatch` and resets consecutive match counter. Tested in `tests/genuineBiometrics.test.js` (Test 4). |
| **Kiosk Multi-Candidate Matching** | [`src/services/faceRecognitionService.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/services/faceRecognitionService.js)<br>[`src/pages/admin/LiveKiosk.jsx`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/pages/admin/LiveKiosk.jsx) | Verified | Identifies employee from organization candidate pool and requires $\ge 0.05$ separation margin against runner-up. Tested in `tests/genuineBiometrics.test.js` (Test 6 & 11). |
| **Attendance Deduplication & Locking** | [`src/hooks/useFaceRecognition.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/hooks/useFaceRecognition.js) | Verified | Requires 2 consecutive frames. Locks submission permanently upon success or already-marked response. Scanner reset retains lock. Tested in `tests/lifecycleAndStability.test.js` (Tests 6, 7, 9). |

---

## 3. In-Depth Investigation of Previously Identified Concerns

A line-by-line audit of the codebase was conducted to investigate the 5 previously flagged concerns. Here are the confirmed technical findings:

### 3.1 Concern 1: Direct Attendance Insertion Fallback
- **Location**: [`src/services/attendanceService.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/services/attendanceService.js) lines 38–78
- **Confirmed Finding**: **CONFIRMED DEFECT / SECURITY RISK**
- **Analysis**:
  When `isSupabaseConfigured` is true, the code invokes the Edge Function `mark-attendance`:
  ```javascript
  const { data: edgeData, error: edgeError } = await supabase.functions.invoke('mark-attendance', {
    body: { matchConfidence, verificationMethod },
  });
  if (!edgeError && edgeData) {
    return edgeData;
  }
  // Fallback starts here:
  const { data: reg, error: regError } = await supabase.from('face_registrations').select('id')...
  const { data, error } = await supabase.from('attendance').insert({ ... })
  ```
  If the Edge Function fails (due to network timeout, service interruption, or edge-level validation rejection), the client directly falls back to inserting a record into `supabase.from('attendance')`.
- **Security Impact**: Bypasses edge-level validation and allows the browser client to dictate attendance state directly. If RLS policies permit insertion, a client can forge attendance even when the edge function intentionally fails or rejects the call.

---

### 3.2 Concern 2: Default Confidence Values
- **Location**:
  - [`src/services/attendanceService.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/services/attendanceService.js) line 33: `matchConfidence = 0.96`
  - [`supabase/functions/mark-attendance/index.ts`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/supabase/functions/mark-attendance/index.ts) line 110: `confidence_score: matchConfidence || 0.95`
- **Confirmed Finding**: **CONFIRMED DEFECT**
- **Analysis**:
  If the caller passes `undefined` or omits `matchConfidence`, the client defaults to `0.96`, and the Edge Function defaults to `0.95`.
- **Impact**: Real biometric confidence derived from facial vector distance is masked by artificial defaults. A client could trigger attendance without measuring genuine confidence.

---

### 3.3 Concern 3: Hardcoded Dashboard Statistics
- **Location**:
  - [`src/pages/admin/Dashboard.jsx`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/pages/admin/Dashboard.jsx) lines 41–43, 142, 153, 164, 175, 189
  - [`src/components/face-recognition/AttendanceScanner.jsx`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/components/face-recognition/AttendanceScanner.jsx) lines 17, 44
  - [`src/services/attendanceService.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/services/attendanceService.js) line 213
- **Confirmed Finding**: **CONFIRMED DEFECT**
- **Analysis**:
  1. In `Dashboard.jsx`:
     ```javascript
     const totalMembers = metrics?.totalEmployees || 6;
     const presentCount = metrics?.presentToday || 3;
     ```
     Because `0` is falsy in JavaScript, if `presentToday` is genuinely `0` (e.g. at the start of the work day), `0 || 3` evaluates to **3**! The dashboard incorrectly displays 3 employees present when 0 have checked in.
  2. The following dashboard cards display static, hardcoded numbers instead of querying data:
     - `On Leave`: hardcoded to `1` (both in UI and in `attendanceService.js` line 213: `onLeaveToday: 1, // sample metrics matching screenshot`)
     - `Weekly Off`: hardcoded to `0`
     - `Holiday`: hardcoded to `0`
     - `Checked Out`: hardcoded to `0`
     - `Attendance Source`: hardcoded to `100% Face Camera Kiosk`, `1 Live Active Kiosks`.
  3. In `AttendanceScanner.jsx`:
     - Initial state: `useState({ total: 6, present: 0 })`
     - Fallback: `total: data?.totalEmployees || 6`

---

### 3.4 Concern 4: Descriptor / Descriptors Schema Inconsistency
- **Location**:
  - Database Migration: [`supabase/migrations/20261102_initial_schema.sql`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/supabase/migrations/20261102_initial_schema.sql) line 39
  - Edge Function: [`supabase/functions/register-face/index.ts`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/supabase/functions/register-face/index.ts) line 65
  - User Service: [`src/services/userService.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/services/userService.js) lines 25, 48
  - Mock Database: [`src/services/mockDatabase.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/services/mockDatabase.js) line 133
- **Confirmed Finding**: **CRITICAL ARCHITECTURAL BUG (BLOCKS LIVE SUPABASE MODE)**
- **Analysis**:
  1. The Postgres schema defines the column as **singular**:
     ```sql
     CREATE TABLE public.face_registrations ( ... descriptor JSONB NOT NULL ... );
     ```
  2. Edge function `register-face` inserts into the singular column:
     ```typescript
     insert({ ..., descriptor: descriptors }) // Note: inserting array of 3 descriptors into 'descriptor'
     ```
  3. In `userService.getUserFaceDescriptors()` (Supabase branch):
     ```javascript
     .select('descriptor')
     return (data?.map((d) => d.descriptor) || []).filter(isValidDescriptor);
     ```
     Since `register-face` stored an array of 3 descriptors into `descriptor`, `d.descriptor` is `Array(3)` (array of arrays). `isValidDescriptor(Array(3))` checks `length === 128`, which evaluates to `false`! Consequently, `getUserFaceDescriptors()` returns `[]` (empty)!
  4. In `userService.getOrganizationBiometricRegistry()` (Supabase branch):
     ```javascript
     .select('id, user_id, descriptors, organization_id, profiles(...)')
     ```
     This queries column `'descriptors'` (**plural**)! In Postgres, this will immediately throw:
     `error: column "descriptors" does not exist`.

---

### 3.5 Concern 5: Backend Face Verification Reality Check
- **Location**: [`supabase/functions/mark-attendance/index.ts`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/supabase/functions/mark-attendance/index.ts) lines 32–66, 110
- **Confirmed Finding**: **CRITICAL SECURITY GAP (NO BACKEND BIOMETRIC VERIFICATION)**
- **Analysis**:
  Does the backend verify the face? **NO.**
  1. The client performs facial recognition locally in the browser via `faceRecognitionService.js`.
  2. The client then calls `mark-attendance` passing only:
     ```json
     { "matchConfidence": 0.97, "verificationMethod": "Face Recognition" }
     ```
  3. The Edge Function inspects the database to check if an active row exists in `face_registrations`:
     ```typescript
     const { data: registration } = await supabaseClient
       .from("face_registrations")
       .select("id")
       .eq("user_id", user.id)
       .eq("is_active", true)
       .maybeSingle();
     ```
  4. If an active row exists, the Edge Function **blindly trusts** the client's payload and records attendance with `confidence_score: matchConfidence || 0.95`.
  5. The raw live facial vector is **never sent to the backend**, and the backend **never computes Euclidean distance** against the stored biometric template.
- **Architectural Implication**: Any caller with an authenticated session and an enrolled record can POST to `mark-attendance` with `{ "matchConfidence": 0.99 }` from a curl script, completely bypassing the camera and live face match.

---

### 3.6 Additional Audit Discovery: Edge Function vs Client Property Mismatch
- **Location**:
  - Edge Function: [`supabase/functions/get-dashboard-stats/index.ts`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/supabase/functions/get-dashboard-stats/index.ts) line 49: returns `{ totalUsers, presentToday, absentToday, todayAttendance }`
  - Frontend Consumer: [`src/services/attendanceService.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/services/attendanceService.js) line 210: expects `{ totalEmployees, presentToday, absentToday }`
  - Consumer: [`src/components/face-recognition/AttendanceScanner.jsx`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/components/face-recognition/AttendanceScanner.jsx) line 44: `total: data?.totalEmployees || 6`
- **Confirmed Finding**: Property naming mismatch. In Supabase mode, `data?.totalEmployees` is `undefined`, causing the scanner and dashboard to always fall back to `6`.

---

## 4. Current Status Matrix

| Component | Mock-Mode Status | Cloud / Supabase Status | Priority for Next Phase |
| :--- | :--- | :--- | :--- |
| **Employee Registration** | Stable & Persistent | Schema ready, pending auth trigger | Medium |
| **Webcam Lifecycle** | Stable (0 flickering) | N/A (Client-only) | Done |
| **Multi-Pose Face Enrollment** | Stable & Genuine | Schema column bug (`descriptor` vs `descriptors`) | High (Phase 1/2) |
| **Attendance Verification** | Working (Client-side) | **Vulnerable** (No backend vector verification) | High (Phase 1) |
| **Attendance Deduplication** | Working (Daily unique) | Working (Postgres unique constraint) | Done |
| **Attendance Direct Insertion** | Safe (Mock DB only) | **Insecure** (Client fallback bypasses Edge Fn) | High (Phase 1) |
| **Admin Dashboard Stats** | Functional with mock counts | Property mismatch + falsy 0 bug | Medium (Phase 2) |
| **Kiosk Identification** | Working with margin check | Query bug (selects non-existent `descriptors` col) | High (Phase 2) |
