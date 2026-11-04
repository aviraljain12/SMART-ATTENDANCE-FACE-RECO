# FaceTrack System Architecture

This document provides a comprehensive architectural specification of the FaceTrack Real-Time Face Recognition-Based Smart Attendance Management System.

---

## 1. High-Level Architecture Overview

FaceTrack operates as a single-page progressive web application with a dual-mode data layer:
1. **Mock-Data Mode (Current Baseline)**: Fully local, in-memory/localStorage persistent execution enabling end-to-end face enrollment, camera tracking, and biometric attendance without requiring a live backend.
2. **Supabase Production Mode**: Integrates with Supabase PostgreSQL (Row-Level Security) and Deno-based Supabase Edge Functions for authenticated cloud-hosted biometric attendance.

```mermaid
flowchart TD
    subgraph Client["Client Browser (React 18 + Vite)"]
        UI["UI Layer (Tailwind CSS, Lucide Icons)"]
        CamHook["Camera Controller (useCamera.js)"]
        RecoHook["Recognition Engine (useFaceRecognition.js)"]
        EnrollComp["Enrollment Flow (FaceEnrollment.jsx)"]
        ScanComp["Scanner Flow (AttendanceScanner.jsx)"]
        BioService["Biometrics Service (faceRecognitionService.js)"]
        AuthService["Auth Service (authService.js)"]
        AttService["Attendance Service (attendanceService.js)"]
        UserService["User Service (userService.js)"]
    end

    subgraph BiometricCore["Client-Side Neural Models (/public/models)"]
        TinyFace["TinyFaceDetector (320x320)"]
        Landmarks["FaceLandmark68Net (68 points)"]
        FaceReco["FaceRecognitionNet (128-d Vector)"]
    end

    subgraph DataLayer["Dual-Mode Storage Engine"]
        MockDB[("Mock DB (localStorage / Memory)")]
        SupaClient["Supabase JS Client (v2.49)"]
    end

    subgraph Backend["Supabase Cloud Platform (Optional)"]
        EdgeAtt["Edge Fn: mark-attendance"]
        EdgeReg["Edge Fn: register-face"]
        EdgeStats["Edge Fn: get-dashboard-stats"]
        EdgeUsers["Edge Fn: manage-users"]
        EdgeExport["Edge Fn: export-attendance"]
        Postgres[("PostgreSQL 15 (RLS Enabled)")]
    end

    UI --> CamHook
    UI --> RecoHook
    EnrollComp --> BioService
    ScanComp --> RecoHook
    BioService --> BiometricCore
    RecoHook --> BioService
    RecoHook --> AttService
    EnrollComp --> UserService

    AuthService --> DataLayer
    AttService --> DataLayer
    UserService --> DataLayer

    DataLayer -->|isSupabaseConfigured = false| MockDB
    DataLayer -->|isSupabaseConfigured = true| SupaClient
    SupaClient --> Backend
    EdgeAtt --> Postgres
    EdgeReg --> Postgres
    EdgeStats --> Postgres
    EdgeUsers --> Postgres
    EdgeExport --> Postgres
```

---

## 2. Frontend Subsystems

### 2.1 Camera Lifecycle Management ([`useCamera.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/hooks/useCamera.js))

The camera controller provides rock-solid stream acquisition with explicit hardware renegotiation protections:
- **Fast-Path Stream Reuse**: If `streamRef.current` is active and healthy on the target device, `startCamera()` verifies `<video>` attachment and playback without calling `navigator.mediaDevices.getUserMedia()`.
- **Request Cancellation**: Uses a monotonic `requestIdRef` counter to discard streams from slow or obsolete `getUserMedia()` invocations.
- **Auto-Attachment Synchronizer**: A dedicated DOM effect ensures that when the `<video>` element mounts or re-renders while `isActive` is true, `videoRef.current.srcObject` is wired up and playing.
- **Deterministic Teardown**: `stopCamera()` and component unmount invoke `track.stop()` across all active media tracks.

### 2.2 Neural Face Recognition Engine ([`faceRecognitionService.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/services/faceRecognitionService.js))

Biometric processing executes via `@vladmandic/face-api` using local neural weights stored in `/public/models`:
1. **Model Suite**:
   - `tinyFaceDetector`: Real-time face boundary localization (`inputSize: 320`, `scoreThreshold: 0.45`).
   - `faceLandmark68Net`: 68-point 2D facial landmark extraction.
   - `faceRecognitionNet`: ResNet-34 based deep network projecting faces into a normalized 128-dimensional Euclidean space.
2. **Descriptor Validation**:
   - Every candidate vector must satisfy `isValidDescriptor()`: exactly 128 finite numeric values.
3. **Head Pose Alignment Check**:
   - Compares eye-to-nose horizontal symmetry distances (`symmetryRatio = distToRight / distToLeft`).
   - Frontal pose requires ratio between `0.55` and `1.82`.
4. **Distance & Confidence Calculation**:
   - Euclidean distance: $d = \sqrt{\sum_{i=1}^{128} (A_i - B_i)^2}$
   - Calibrated threshold: `DEFAULT_MATCH_THRESHOLD = 0.55`.
   - Confidence mapping: $C = \max(0, \min(1, 1 - \frac{d}{1.5 \times 0.55}))$.
5. **Kiosk Multi-Candidate Identification**:
   - Evaluates live descriptor against all active organization employees.
   - Requires best match $d \le 0.55$.
   - Enforces runner-up margin: $d_{\text{runner-up}} - d_{\text{best}} \ge 0.05$ to reject ambiguous matches.

### 2.3 Biometric Enrollment ([`FaceEnrollment.jsx`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/components/face-recognition/FaceEnrollment.jsx))

```mermaid
sequenceDiagram
    autonumber
    actor Employee
    participant UI as FaceEnrollment.jsx
    participant Cam as useCamera.js
    participant Neural as faceRecognitionService.js
    participant Service as userService.js
    participant DB as MockDB / Supabase

    Employee->>UI: Open Enrollment Screen (Step 0)
    Employee->>UI: Check Biometric Consent Box
    Employee->>UI: Click "Continue to Camera"
    UI->>Cam: startCamera()
    Cam-->>UI: Active MediaStream attached to <video>
    
    loop Live Guidance Loop (every 350ms)
        UI->>Neural: detectFaceInVideo(video)
        Neural-->>UI: { detected, isFaceAligned, multipleFaces }
        UI->>UI: Update Guide Oval (Emerald / Cyan / Rose)
    end

    Note over Employee, UI: Step 1: Frontal Pose
    Employee->>UI: Click "Capture Sample 01"
    UI->>Neural: detectFaceInVideo(video)
    Neural-->>UI: Valid 128-d vector #1
    UI->>UI: Store sample #1 -> Advance to Step 2 (Camera remains live)

    Note over Employee, UI: Step 2: Slight Left Pose
    Employee->>UI: Click "Capture Sample 02"
    UI->>Neural: detectFaceInVideo(video)
    Neural-->>UI: Valid 128-d vector #2
    UI->>UI: Store sample #2 -> Advance to Step 3 (Camera remains live)

    Note over Employee, UI: Step 3: Slight Right Pose
    Employee->>UI: Click "Capture Sample 03"
    UI->>Neural: detectFaceInVideo(video)
    Neural-->>UI: Valid 128-d vector #3

    UI->>Service: registerUserFace({ userId, descriptors: [v1, v2, v3], consentedAt })
    Service->>DB: Save face_registrations record & set has_face_registered = true
    DB-->>Service: Confirmation
    Service-->>UI: { success: true }
    UI->>Cam: stopCamera()
    UI->>UI: Display Step 4 (Success Confirmation)
```

### 2.4 Attendance Scanning & Deduplication ([`useFaceRecognition.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/hooks/useFaceRecognition.js))

- **2-Consecutive-Match Debounce**: Prevents momentary classification spikes from recording attendance. Identity must match consecutively across at least two frame evaluations.
- **Strict Anti-Duplicate Locking**:
  - In targeted employee mode: locks `attendanceSubmittedRef = true` and `hasCompletedAttendanceRef = true`. Scanner reset retains the submission lock.
  - In kiosk mode: uses `kioskAttendanceLockMapRef` Set to prevent duplicate check-ins for the same employee during the kiosk session.

---

## 3. Data Storage & Schema Architecture

### 3.1 Database Schema (PostgreSQL 15 / Supabase)

Defined in [`supabase/migrations/20261102_initial_schema.sql`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/supabase/migrations/20261102_initial_schema.sql):

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ PROFILES : "belongs to"
    ORGANIZATIONS ||--o{ FACE_REGISTRATIONS : "owns"
    ORGANIZATIONS ||--o{ ATTENDANCE : "records"
    ORGANIZATIONS ||--o{ AUDIT_LOGS : "tracks"
    PROFILES ||--o{ FACE_REGISTRATIONS : "has"
    PROFILES ||--o{ ATTENDANCE : "submits"
    PROFILES ||--o{ AUDIT_LOGS : "performs"

    ORGANIZATIONS {
        uuid id PK
        text name
        text slug UK
        text timezone
        boolean is_active
        timestamptz created_at
    }

    PROFILES {
        uuid id PK "references auth.users"
        uuid organization_id FK
        text full_name
        text email
        text employee_id
        text role "admin | employee"
        text department
        text avatar_url
        boolean is_active
        timestamptz created_at
    }

    FACE_REGISTRATIONS {
        uuid id PK
        uuid user_id FK
        uuid organization_id FK
        jsonb descriptor "Note: schema discrepancy"
        text model_version
        boolean is_active
        timestamptz consented_at
        timestamptz created_at
    }

    ATTENDANCE {
        uuid id PK
        uuid user_id FK
        uuid organization_id FK
        date attendance_date
        timestamptz check_in_time
        text status "Present | Absent | Late | Half-day"
        text verification_method
        numeric confidence_score
        timestamptz created_at
    }

    AUDIT_LOGS {
        uuid id PK
        uuid organization_id FK
        uuid performed_by FK
        text action
        uuid target_user_id FK
        jsonb metadata
        timestamptz created_at
    }
```

### 3.2 Dual-Mode Engine Implementation

| Layer | Mock-Mode (`isSupabaseConfigured = false`) | Supabase Mode (`isSupabaseConfigured = true`) |
| :--- | :--- | :--- |
| **Authentication** | In-memory session key + mock profiles in localStorage | `supabase.auth.signInWithPassword()` / `signUp()` |
| **Biometric Vectors** | `mockDatabase.js` (`db.face_registrations`) | Table `public.face_registrations` / Edge Fn `register-face` |
| **Attendance** | `mockDatabase.js` (`db.attendance`) | Table `public.attendance` / Edge Fn `mark-attendance` |
| **Audit Logs** | `mockDatabase.js` (`db.audit_logs`) | Table `public.audit_logs` |
| **Organization Boundaries** | Filtered by `organization_id: 'org-lexcorp-001'` | Enforced by PostgreSQL Row-Level Security (RLS) |

---

## 4. Edge Functions Architecture

Located under [`supabase/functions/`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/supabase/functions/):

1. **`mark-attendance`**:
   - Validates caller JWT via `supabase.auth.getUser()`.
   - Checks if user has an active row in `face_registrations`.
   - Computes local date using `Asia/Kolkata` timezone.
   - Enforces unique daily attendance via `unique_user_daily_attendance` constraint (`code: 23505`).
2. **`register-face`**:
   - Requires `biometricConsent = true`.
   - Deactivates previous active records for the user (`is_active: false`).
   - Inserts newly captured descriptor(s).
3. **`get-dashboard-stats`**:
   - Aggregates daily check-in counts for admin or user history for employee.
4. **`manage-users`**:
   - Admin-restricted endpoint to list organization users or toggle active status.
5. **`export-attendance`**:
   - Generates CSV report stream of organization attendance records.
