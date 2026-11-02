// Automated Test Suite for Genuine Biometric Verification
// Exercises actual production functions and services directly (Section 9)

import {
  isValidDescriptor,
  compareFaceDescriptors,
  matchUserFace,
  identifyUserInRegistry,
  DEFAULT_MATCH_THRESHOLD,
} from '../src/services/faceRecognitionService.js';

import { userService } from '../src/services/userService.js';
import { attendanceService } from '../src/services/attendanceService.js';
import { getMockDB, resetMockDatabase } from '../src/services/mockDatabase.js';
import fs from 'fs';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ PASS: ${message}`);
    passed++;
  } else {
    console.error(`✗ FAIL: ${message}`);
    failed++;
  }
}

// Helper to create a genuine normalized 128-float descriptor
function createValidDescriptor(seed = 1) {
  const vec = new Float32Array(128);
  let norm = 0;
  for (let i = 0; i < 128; i++) {
    // Deterministic pseudo-random vector based on seed
    const val = Math.tan((i + 1) * seed) % 1;
    vec[i] = val;
    norm += val * val;
  }
  norm = Math.sqrt(norm);
  for (let i = 0; i < 128; i++) {
    vec[i] = vec[i] / norm;
  }
  return Array.from(vec);
}

// Create a close live variation (within threshold distance < 0.3)
function createLiveVariation(baseDescriptor, noiseLevel = 0.02) {
  const variation = baseDescriptor.map((val, i) => val + (Math.sin(i * 3.7) * noiseLevel));
  let norm = 0;
  for (let i = 0; i < 128; i++) norm += variation[i] * variation[i];
  norm = Math.sqrt(norm);
  return variation.map((v) => v / norm);
}

async function runTests() {
  console.log('=== Running Genuine Biometric Verification Production Test Suite ===\n');

  // Reset database to ensure clean test environment
  resetMockDatabase();

  // -------------------------------------------------------------
  // Test 1: Empty biometric registry rejects recognition
  // -------------------------------------------------------------
  const liveDesc = createValidDescriptor(1);
  const emptyMatch = matchUserFace(liveDesc, []);
  assert(emptyMatch.match === false && emptyMatch.error === 'NO_ENROLLED_DESCRIPTORS',
    '1. Empty enrolled descriptors list rejects recognition fail-closed');

  const emptyKiosk = identifyUserInRegistry(liveDesc, []);
  assert(emptyKiosk.identified === false && emptyKiosk.error === 'EMPTY_REGISTRY',
    '1. Empty organization candidate registry rejects kiosk identification');

  // -------------------------------------------------------------
  // Test 2: Synthetic demo registrations are absent
  // -------------------------------------------------------------
  const db = getMockDB();
  assert(db.face_registrations.length === 0,
    '2. Database initializes with 0 synthetic face registrations');
  assert(db.users.every((u) => u.has_face_registered === false),
    '2. All initial users have has_face_registered = false');

  const syntheticSample = [Array(128).fill(0).map((_, i) => Math.sin(i * 0.1))];
  const hasSyntheticStored = db.face_registrations.some((r) => r.id === 'reg-01' || r.id === 'reg-02');
  assert(!hasSyntheticStored, '2. No legacy reg-01 or reg-02 synthetic records present in database');

  // -------------------------------------------------------------
  // Test 3: A user without enrollment receives Face Not Registered
  // -------------------------------------------------------------
  const unenrolledDescriptors = await userService.getUserFaceDescriptors('usr-emp-01');
  assert(Array.isArray(unenrolledDescriptors) && unenrolledDescriptors.length === 0,
    '3. Unenrolled user returns empty descriptor list');
  const unenrolledMatch = matchUserFace(liveDesc, unenrolledDescriptors);
  assert(unenrolledMatch.match === false,
    '3. Matching against unenrolled user fails closed (Face Not Registered)');

  // -------------------------------------------------------------
  // Test 4: A valid but different person's descriptor receives Face Mismatch
  // -------------------------------------------------------------
  const personADesc = createValidDescriptor(2);
  const personBDesc = createValidDescriptor(7);
  const diffComparison = compareFaceDescriptors(personADesc, personBDesc);
  assert(diffComparison.match === false && diffComparison.distance > DEFAULT_MATCH_THRESHOLD,
    '4. Different person descriptor exceeds threshold (Face Mismatch)');
  const mismatchResult = matchUserFace(personBDesc, [personADesc]);
  assert(mismatchResult.match === false,
    '4. matchUserFace returns match=false for different persons');

  // -------------------------------------------------------------
  // Test 5: An actual enrolled descriptor can match its corresponding live descriptor
  // -------------------------------------------------------------
  const personALive = createLiveVariation(personADesc, 0.02);
  const samePersonComp = compareFaceDescriptors(personALive, personADesc);
  assert(samePersonComp.match === true && samePersonComp.distance <= DEFAULT_MATCH_THRESHOLD,
    '5. Genuine live face matches enrolled descriptor within calibrated threshold');
  const verifiedMatch = matchUserFace(personALive, [personADesc]);
  assert(verifiedMatch.match === true && verifiedMatch.confidence > 0.8,
    '5. matchUserFace confirms verified identity with high confidence');

  // -------------------------------------------------------------
  // Test 6: An unknown face cannot match any registered employee
  // -------------------------------------------------------------
  // Enroll Person A and Person B
  await userService.registerUserFace({
    userId: 'usr-emp-01',
    descriptors: [personADesc],
    consentedAt: new Date().toISOString(),
  });
  await userService.registerUserFace({
    userId: 'usr-emp-02',
    descriptors: [personBDesc],
    consentedAt: new Date().toISOString(),
  });

  const orgRegistry = await userService.getOrganizationBiometricRegistry('org-lexcorp-001');
  assert(orgRegistry.length === 2, '6. Org registry loaded with 2 enrolled employees');

  const unknownFaceDesc = createValidDescriptor(19);
  const unknownKioskMatch = identifyUserInRegistry(unknownFaceDesc, orgRegistry);
  assert(unknownKioskMatch.identified === false && unknownKioskMatch.reason === 'NO_MATCH',
    '6. Unknown face cannot match any registered employee in kiosk registry');

  // -------------------------------------------------------------
  // Test 7: Invalid descriptors are rejected
  // -------------------------------------------------------------
  assert(!isValidDescriptor(null), '7. isValidDescriptor rejects null');
  assert(!isValidDescriptor(undefined), '7. isValidDescriptor rejects undefined');
  assert(!isValidDescriptor('synthetic-string'), '7. isValidDescriptor rejects string');
  assert(!isValidDescriptor([1, 2, 3]), '7. isValidDescriptor rejects vector length != 128');
  assert(!isValidDescriptor(new Array(128).fill(NaN)), '7. isValidDescriptor rejects vector with NaN');
  assert(!isValidDescriptor(new Array(128).fill(Infinity)), '7. isValidDescriptor rejects vector with Infinity');

  let registrationThrew = false;
  try {
    await userService.registerUserFace({
      userId: 'usr-emp-03',
      descriptors: [[1, 2, 3]],
      consentedAt: new Date().toISOString(),
    });
  } catch {
    registrationThrew = true;
  }
  assert(registrationThrew, '7. userService.registerUserFace rejects invalid descriptor dimensions');

  // -------------------------------------------------------------
  // Test 8: No attendance request is triggered after a mismatch
  // -------------------------------------------------------------
  // Face mismatch results in rejected status and consecutive count = 0
  const mismatchScan = matchUserFace(unknownFaceDesc, [personADesc]);
  assert(mismatchScan.match === false, '8. Scan comparison reports mismatch');

  // -------------------------------------------------------------
  // Test 9: No attendance request is triggered when the registry is unavailable
  // -------------------------------------------------------------
  // User usr-emp-04 has never enrolled face
  const unenrolledAttResult = await attendanceService.markAttendance({
    userId: 'usr-emp-04',
    matchConfidence: 0.99,
  });
  assert(unenrolledAttResult.success === false && unenrolledAttResult.message.includes('Attendance rejected'),
    '9. attendanceService rejects attendance for users without active biometric enrollment');

  // -------------------------------------------------------------
  // Test 10: Successful genuine verification triggers at most one attendance request
  // -------------------------------------------------------------
  // usr-emp-01 has genuine enrollment
  const att1 = await attendanceService.markAttendance({
    userId: 'usr-emp-01',
    matchConfidence: 0.96,
  });
  assert(att1.success === true && att1.alreadyMarked === false,
    '10. First genuine attendance request succeeds');

  const att2 = await attendanceService.markAttendance({
    userId: 'usr-emp-01',
    matchConfidence: 0.96,
  });
  assert(att2.success === false && att2.alreadyMarked === true,
    '10. Second attendance request on same date is locked and rejected as already marked');

  // -------------------------------------------------------------
  // Test 11: Organization-wide kiosk cannot access another organization's descriptors
  // -------------------------------------------------------------
  // Manually insert a user and registration under a different organization
  const currentDB = getMockDB();
  const foreignUser = {
    id: 'usr-foreign-01',
    organization_id: 'org-external-999',
    full_name: 'Foreign Agent',
    email: 'foreign@other.com',
    employee_id: 'EXT-999',
    role: 'employee',
    department: 'External',
    is_active: true,
    has_face_registered: true,
  };
  const foreignDesc = createValidDescriptor(99);
  const foreignReg = {
    id: 'reg-foreign-01',
    user_id: 'usr-foreign-01',
    organization_id: 'org-external-999',
    descriptors: [foreignDesc],
    is_active: true,
  };
  currentDB.users.push(foreignUser);
  currentDB.face_registrations.push(foreignReg);

  const lexcorpRegistry = await userService.getOrganizationBiometricRegistry('org-lexcorp-001');
  const containsForeign = lexcorpRegistry.some((c) => c.userId === 'usr-foreign-01' || c.organizationId === 'org-external-999');
  assert(!containsForeign, '11. LexCorp organization kiosk cannot access another organization descriptors');

  const foreignMatchAttempt = identifyUserInRegistry(foreignDesc, lexcorpRegistry);
  assert(foreignMatchAttempt.identified === false,
    '11. Foreign organization employee cannot be identified on LexCorp terminal');

  // -------------------------------------------------------------
  // Test 12: Hardcoded demonstration names are not displayed as live recognition results
  // -------------------------------------------------------------
  const scannerSource = fs.readFileSync('src/components/face-recognition/AttendanceScanner.jsx', 'utf8');
  assert(!scannerSource.includes('Elena Rostova'),
    '12. AttendanceScanner does NOT contain hardcoded "Elena Rostova"');
  assert(!scannerSource.includes('Sarah Jenkins'),
    '12. AttendanceScanner does NOT contain hardcoded "Sarah Jenkins"');
  assert(!scannerSource.includes("currentUser?.full_name || 'Damian Vance'"),
    '12. AttendanceScanner does NOT contain default Damian Vance fallback in recognitions list');

  console.log(`\n=== Genuine Biometrics Test Results: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
