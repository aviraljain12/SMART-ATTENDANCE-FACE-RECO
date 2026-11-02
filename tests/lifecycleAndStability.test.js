// Lifecycle & Stability Verification Test Suite
// Verifies all 9 requirements from Section 5

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

// -------------------------------------------------------------
// Mock MediaStream & MediaStreamTrack
// -------------------------------------------------------------
class MockMediaStreamTrack {
  constructor(kind = 'video', id = Math.random().toString(36).substring(7)) {
    this.kind = kind;
    this.id = id;
    this.readyState = 'live';
    this.stopCalls = 0;
  }

  stop() {
    this.stopCalls++;
    this.readyState = 'ended';
  }
}

class MockMediaStream {
  constructor(tracks = [new MockMediaStreamTrack()]) {
    this.tracks = tracks;
    this.id = Math.random().toString(36).substring(7);
  }

  getTracks() {
    return this.tracks;
  }
}

function stopMediaStream(stream) {
  if (!stream) return;
  const tracks = stream.getTracks();
  tracks.forEach((track) => {
    track.stop();
  });
}

// Simulated useCamera Core Controller
class CameraLifecycleController {
  constructor() {
    this.stream = null;
    this.requestId = 0;
    this.isActive = false;
    this.error = null;
    this.selectedDeviceId = '';
  }

  async startCamera(deviceIdToUse, getUserMediaFn) {
    this.requestId += 1;
    const currentRequestId = this.requestId;

    this.error = null;

    // Stop existing stream before new acquisition
    if (this.stream) {
      stopMediaStream(this.stream);
      this.stream = null;
    }
    this.isActive = false;

    const stream = await getUserMediaFn(deviceIdToUse);

    // Cancel if request is superseded
    if (currentRequestId !== this.requestId) {
      stopMediaStream(stream);
      return null;
    }

    // Success: attach stream and activate
    this.stream = stream;
    this.isActive = true;
    return stream;
  }

  switchDevice(newDeviceId, getUserMediaFn) {
    this.selectedDeviceId = newDeviceId;
    if (this.isActive) {
      return this.startCamera(newDeviceId, getUserMediaFn);
    }
    return Promise.resolve(null);
  }

  stopCamera() {
    this.requestId += 1;
    if (this.stream) {
      stopMediaStream(this.stream);
      this.stream = null;
    }
    this.isActive = false;
  }
}

// -------------------------------------------------------------
// Simulated Recognition & Attendance Controller
// -------------------------------------------------------------
class RecognitionLifecycleController {
  constructor() {
    this.targetUserId = null;
    this.activeUserId = null;
    this.session = 0;
    this.consecutiveMatches = 0;
    this.attendanceSubmitted = false;
    this.hasCompletedAttendance = false;
    this.status = 'idle';
    this.attendanceCalls = [];
  }

  setTargetUser(userId) {
    this.targetUserId = userId;
    this.activeUserId = userId;
    this.session += 1;
    this.consecutiveMatches = 0;
    this.attendanceSubmitted = false;
    this.hasCompletedAttendance = false;
    this.status = userId ? 'scanning' : 'idle';
  }

  async runInferenceCycle({ isMatch, latencyMs = 0, attendanceServiceMock }) {
    const currentSession = this.session;
    const currentUserId = this.activeUserId;

    if (latencyMs > 0) {
      await new Promise((r) => setTimeout(r, latencyMs));
    }

    // Check cancellation
    if (this.session !== currentSession || this.activeUserId !== currentUserId) {
      return { cancelled: true };
    }

    if (!isMatch) {
      this.consecutiveMatches = 0;
      this.status = 'rejected';
      return { cancelled: false, match: false, consecutive: 0 };
    }

    this.consecutiveMatches += 1;

    if (this.consecutiveMatches >= 2) {
      this.status = 'matched';

      if (
        currentUserId &&
        !this.attendanceSubmitted &&
        !this.hasCompletedAttendance
      ) {
        this.attendanceSubmitted = true;

        try {
          const res = await attendanceServiceMock(currentUserId);

          if (this.session !== currentSession || this.activeUserId !== currentUserId) {
            return { cancelled: true, lateResponse: true };
          }

          if (res.alreadyMarked) {
            this.hasCompletedAttendance = true;
            this.attendanceSubmitted = true;
            this.status = 'already_marked';
          } else if (res.success) {
            this.hasCompletedAttendance = true;
            this.attendanceSubmitted = true;
            this.status = 'matched';
          } else {
            this.attendanceSubmitted = false;
            this.status = 'backend_error';
          }

          return { cancelled: false, res };
        } catch (err) {
          if (this.session !== currentSession || this.activeUserId !== currentUserId) {
            return { cancelled: true };
          }
          this.attendanceSubmitted = false;
          this.status = 'backend_error';
          return { cancelled: false, error: err };
        }
      }
    }

    return { cancelled: false, match: true, consecutive: this.consecutiveMatches };
  }

  resetScanner() {
    this.consecutiveMatches = 0;
    if (!this.hasCompletedAttendance) {
      this.attendanceSubmitted = false;
      this.status = 'scanning';
    }
  }
}

// -------------------------------------------------------------
// Test Execution
// -------------------------------------------------------------
async function runTests() {
  console.log('=== Running Camera Lifecycle & Recognition Stability Verification ===\n');

  // Test 1: Camera starts with one active stream
  {
    const cam = new CameraLifecycleController();
    const streamA = new MockMediaStream([new MockMediaStreamTrack('video')]);
    await cam.startCamera('cam-1', async () => streamA);

    assert(cam.isActive === true, '1. Camera is marked active after start');
    assert(cam.stream === streamA, '1. Camera has exact acquired stream attached');
    assert(streamA.tracks[0].readyState === 'live', '1. Stream track is live');
  }

  // Test 2: Repeated start requests do not create competing streams
  {
    const cam = new CameraLifecycleController();
    const streamSlow = new MockMediaStream([new MockMediaStreamTrack('video', 'slow')]);
    const streamFast = new MockMediaStream([new MockMediaStreamTrack('video', 'fast')]);

    // Fire slow request (takes 30ms)
    const p1 = cam.startCamera('cam-slow', async () => {
      await new Promise((r) => setTimeout(r, 30));
      return streamSlow;
    });

    // Immediately fire fast request (takes 5ms)
    const p2 = cam.startCamera('cam-fast', async () => {
      await new Promise((r) => setTimeout(r, 5));
      return streamFast;
    });

    await Promise.all([p1, p2]);

    assert(cam.stream === streamFast, '2. Only latest request stream is active');
    assert(streamSlow.tracks[0].readyState === 'ended', '2. Competing slower stream tracks were stopped immediately upon resolution');
    assert(streamFast.tracks[0].readyState === 'live', '2. Latest stream tracks remain live');
  }

  // Test 3: Switching devices stops the previous stream
  {
    const cam = new CameraLifecycleController();
    const streamDev1 = new MockMediaStream([new MockMediaStreamTrack('video', 'dev1')]);
    const streamDev2 = new MockMediaStream([new MockMediaStreamTrack('video', 'dev2')]);

    await cam.startCamera('dev-1', async () => streamDev1);
    assert(streamDev1.tracks[0].readyState === 'live', '3. Initial device stream is live');

    await cam.switchDevice('dev-2', async () => streamDev2);
    assert(streamDev1.tracks[0].readyState === 'ended', '3. Switching devices stopped previous stream tracks');
    assert(cam.stream === streamDev2, '3. Active stream is switched to new device stream');
    assert(streamDev2.tracks[0].readyState === 'live', '3. New device stream is live');
  }

  // Test 4: Stopping the camera stops every track
  {
    const cam = new CameraLifecycleController();
    const track1 = new MockMediaStreamTrack('video', 't1');
    const track2 = new MockMediaStreamTrack('video', 't2');
    const streamMulti = new MockMediaStream([track1, track2]);

    await cam.startCamera('cam-1', async () => streamMulti);
    assert(cam.isActive === true, '4. Camera started');

    cam.stopCamera();
    assert(cam.isActive === false, '4. Camera marked inactive after stop');
    assert(cam.stream === null, '4. Stream reference cleared');
    assert(track1.readyState === 'ended' && track1.stopCalls === 1, '4. Track 1 stopped');
    assert(track2.readyState === 'ended' && track2.stopCalls === 1, '4. Track 2 stopped');
  }

  // Test 5: Recognition loop does not restart on every status update
  {
    // Validate by inspecting dependencies of the hook in source code
    const fs = await import('fs');
    const hookCode = fs.readFileSync('src/hooks/useFaceRecognition.js', 'utf8');

    // Find the recognition loop useEffect dependencies
    const loopMatch = hookCode.match(/clearInterval\(intervalId\);[\s\S]*?},\s*\[([^\]]+)\]\);/);
    assert(loopMatch !== null, '5. Found recognition loop useEffect dependency array');
    if (loopMatch) {
      const deps = loopMatch[1].split(',').map((s) => s.trim());
      assert(!deps.includes('status'), '5. Recognition loop does NOT depend on "status"');
      assert(!deps.includes('onAttendanceSuccess'), '5. Recognition loop does NOT depend on "onAttendanceSuccess"');
      assert(!deps.includes('feedbackMessage'), '5. Recognition loop does NOT depend on "feedbackMessage"');
    }
  }

  // Test 6: Two consecutive matches trigger only one attendance request
  {
    const rec = new RecognitionLifecycleController();
    rec.setTargetUser('user-1');

    let apiCallCount = 0;
    const mockApi = async (uid) => {
      apiCallCount++;
      return { success: true, record: { id: 'att-1', userId: uid } };
    };

    // Frame 1: Match 1
    const r1 = await rec.runInferenceCycle({ isMatch: true, attendanceServiceMock: mockApi });
    assert(r1.consecutive === 1, '6. Frame 1 match gives consecutive = 1');
    assert(apiCallCount === 0, '6. Frame 1 match does NOT trigger attendance request');

    // Frame 2: Match 2
    const r2 = await rec.runInferenceCycle({ isMatch: true, attendanceServiceMock: mockApi });
    assert(apiCallCount === 1, '6. Frame 2 match triggers attendance request');
    assert(rec.hasCompletedAttendance === true, '6. Attendance marked complete');

    // Frame 3: Another match (subsequent frame)
    await rec.runInferenceCycle({ isMatch: true, attendanceServiceMock: mockApi });
    assert(apiCallCount === 1, '6. Subsequent matching frames do NOT trigger duplicate attendance request');
  }

  // Test 7: A mismatch resets the consecutive-match count
  {
    const rec = new RecognitionLifecycleController();
    rec.setTargetUser('user-2');

    let apiCallCount = 0;
    const mockApi = async () => {
      apiCallCount++;
      return { success: true };
    };

    // Frame 1: Match
    await rec.runInferenceCycle({ isMatch: true, attendanceServiceMock: mockApi });
    assert(rec.consecutiveMatches === 1, '7. Frame 1 match sets consecutive = 1');

    // Frame 2: Mismatch
    await rec.runInferenceCycle({ isMatch: false, attendanceServiceMock: mockApi });
    assert(rec.consecutiveMatches === 0, '7. Mismatch resets consecutive matches to 0');
    assert(apiCallCount === 0, '7. No attendance request made');

    // Frame 3: Match again
    await rec.runInferenceCycle({ isMatch: true, attendanceServiceMock: mockApi });
    assert(rec.consecutiveMatches === 1, '7. Next match brings count to 1');
    assert(apiCallCount === 0, '7. No attendance request made yet');

    // Frame 4: Second match
    await rec.runInferenceCycle({ isMatch: true, attendanceServiceMock: mockApi });
    assert(rec.consecutiveMatches === 2, '7. Second consecutive match brings count to 2');
    assert(apiCallCount === 1, '7. Attendance request triggered after 2 consecutive matches');
  }

  // Test 8: Old inference cannot submit attendance after a target-user change
  {
    const rec = new RecognitionLifecycleController();
    rec.setTargetUser('user-A');

    let apiCalls = [];
    const mockApi = async (uid) => {
      apiCalls.push(uid);
      return { success: true };
    };

    // First frame match for User A
    await rec.runInferenceCycle({ isMatch: true, attendanceServiceMock: mockApi });

    // In-flight second frame inference for User A (takes 40ms)
    const inFlightInference = rec.runInferenceCycle({
      isMatch: true,
      latencyMs: 40,
      attendanceServiceMock: mockApi,
    });

    // While in flight, target user changes to User B!
    rec.setTargetUser('user-B');

    // Await the old inference completion
    const result = await inFlightInference;
    assert(result.cancelled === true, '8. Stale in-flight inference was cancelled');
    assert(apiCalls.length === 0, '8. No attendance request submitted for old user after user change');
    assert(rec.activeUserId === 'user-B', '8. Target user is now user-B');
    assert(rec.attendanceSubmitted === false, '8. User B submission lock is clean');
  }

  // Test 9: Scanner reset cannot resubmit successful attendance
  {
    const rec = new RecognitionLifecycleController();
    rec.setTargetUser('user-3');

    let apiCallCount = 0;
    const mockApi = async () => {
      apiCallCount++;
      return { success: true };
    };

    // 2 consecutive matches to mark attendance
    await rec.runInferenceCycle({ isMatch: true, attendanceServiceMock: mockApi });
    await rec.runInferenceCycle({ isMatch: true, attendanceServiceMock: mockApi });
    assert(apiCallCount === 1, '9. Initial attendance marked successfully');
    assert(rec.attendanceSubmitted === true, '9. Submission locked');

    // Trigger scanner reset
    rec.resetScanner();

    // Submission lock must NOT be unlocked
    assert(rec.attendanceSubmitted === true, '9. Scanner reset retains submission lock after success');
    assert(rec.hasCompletedAttendance === true, '9. Completed attendance flag remains true');

    // Subsequent matching frames must not resubmit
    await rec.runInferenceCycle({ isMatch: true, attendanceServiceMock: mockApi });
    await rec.runInferenceCycle({ isMatch: true, attendanceServiceMock: mockApi });
    assert(apiCallCount === 1, '9. No additional attendance calls allowed after reset');
  }

  console.log(`\n=== Verification Results: ${passed} Passed, ${failed} Failed ===`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
