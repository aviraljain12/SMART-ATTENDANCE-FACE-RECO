# Changelog

All notable changes to the FaceTrack (Real-Time Face Recognition-Based Smart Attendance Management System) will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased] - Phase 0 Baseline Audit

### Added
- **Project Documentation System**: Established comprehensive engineering documentation under [`docs/`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/docs/):
  - [`docs/ARCHITECTURE.md`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/docs/ARCHITECTURE.md): Complete architectural specifications, component boundaries, sequence flows, dual-mode fallback, and database schema.
  - [`docs/PROJECT_PROGRESS.md`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE SYSTEM/docs/PROJECT_PROGRESS.md): Verified functionality, gap analysis, and detailed audit of 5 critical security/data concerns.
  - [`docs/ROADMAP.md`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/docs/ROADMAP.md): Step-by-step phased engineering roadmap from mock baseline to live backend deployment.
  - [`docs/TEST_RESULTS.md`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/docs/TEST_RESULTS.md): Full test execution records (102 tests across 3 suites) and Vite production build metrics.

---

## [2.0.0] - 2026-11-03

### Merged
- **Pull Request #2**: [Real Biometric Verification & Camera Stability](https://github.com/aviraljain12/SMART-ATTENDANCE-FACE-RECO/pull/2) merged into `main` via commit [`b7d2c1f`](https://github.com/aviraljain12/SMART-ATTENDANCE-FACE-RECO/commit/b7d2c1f61323bff557569de133a1e97fbac1bcf5).

### Added
- **Dynamic Employee Registration**: Added self-registration flow in [`src/pages/auth/Login.jsx`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/pages/auth/Login.jsx) and [`src/services/authService.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/services/authService.js) allowing any new employee to register with Full Name, Employee ID, Email, Department, and Password. Accounts initialize with `has_face_registered: false`.
- **Stream Fast-Path Reuse**: Added active stream caching in [`src/hooks/useCamera.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/hooks/useCamera.js) to reuse running MediaStream tracks and avoid webcam renegotiation.
- **Real-Time Enrollment Feedback**: Added dynamic guide oval and live detection indicators (emerald when aligned, cyan when positioning, rose for multiple faces) in [`src/components/face-recognition/FaceEnrollment.jsx`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/components/face-recognition/FaceEnrollment.jsx).
- **Automated Verification Suites**: Added comprehensive unit test suites:
  - [`tests/faceRecognition.test.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/tests/faceRecognition.test.js) (22 tests)
  - [`tests/lifecycleAndStability.test.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/tests/lifecycleAndStability.test.js) (40 tests)
  - [`tests/genuineBiometrics.test.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/tests/genuineBiometrics.test.js) (40 tests)

### Fixed
- **Enrollment Camera Blinking Loop**: Removed `[currentStep, isActive]` from `useEffect` dependencies in [`src/components/face-recognition/FaceEnrollment.jsx`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/components/face-recognition/FaceEnrollment.jsx), decoupling camera lifecycle from state updates and pose changes (commit [`5c4a0e8`](https://github.com/aviraljain12/SMART-ATTENDANCE-FACE-RECO/commit/5c4a0e80507e5ca805e0148b667b0bc3cc8170c4)).
- **Synthetic Biometric Purge**: Purged all fake mathematical `Math.sin()` / `Math.cos()` descriptors from [`src/services/mockDatabase.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/services/mockDatabase.js) (commit [`434ae20`](https://github.com/aviraljain12/SMART-ATTENDANCE-FACE-RECO/commit/434ae209e4c62e8644fe77112390f3a5b6efa6a0)).
- **Unenrolled User Attendance Lock**: Blocked attendance check-in for users without an active biometric registration in [`src/services/attendanceService.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/services/attendanceService.js) and [`supabase/functions/mark-attendance/index.ts`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/supabase/functions/mark-attendance/index.ts).
- **Multi-Candidate Kiosk Matching**: Enforced runner-up separation margin (`minMargin = 0.05`) in [`src/services/faceRecognitionService.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/services/faceRecognitionService.js) to reject ambiguous face candidates.
- **Hardcoded Prototype Identity Cleanup**: Removed hardcoded placeholder employee names (*Elena Rostova*, *Sarah Jenkins*, *Damian Vance*) from live recognition display in [`src/components/face-recognition/AttendanceScanner.jsx`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/components/face-recognition/AttendanceScanner.jsx).
- **Camera & Recognition Stability**: Fixed interval recreation and callback identity restarts in [`src/hooks/useFaceRecognition.js`](file:///c:/Users/AVIRAL%20JAIN/Documents/SMART%20ATTENDANCE%20SYSTEM/src/hooks/useFaceRecognition.js) (commit [`00eff9c`](https://github.com/aviraljain12/SMART-ATTENDANCE-FACE-RECO/commit/00eff9c3f4e3c9ea531bfa2a9eb7864aa9f8602b)).

---

## [1.0.0] - 2026-11-02

### Added
- Initial prototype release of Smart Attendance System (commit [`5639b52`](https://github.com/aviraljain12/SMART-ATTENDANCE-FACE-RECO/commit/5639b52a70ffa626ab47984fdc8c35cb15bb51ac)):
  - React 18 + Vite frontend with Tailwind CSS.
  - Role-based views for Admin (Dashboard, Live Kiosk, User Management, Reports, Audit Logs, Settings) and Employee (Dashboard, Mark Attendance, Attendance History, Profile).
  - Integration with `@vladmandic/face-api` using local models in `/public/models`.
  - Supabase schema migrations and Edge Functions for attendance, face registration, user management, and reporting.
  - In-browser mock database fallback for local demonstration.
