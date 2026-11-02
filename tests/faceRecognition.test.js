// Pure Biometric Comparison & Validation Test Suite
const DEFAULT_MATCH_THRESHOLD = 0.55;

function isValidDescriptor(descriptor) {
  if (!descriptor) return false;
  if (!Array.isArray(descriptor) && !(descriptor instanceof Float32Array)) {
    return false;
  }
  if (descriptor.length !== 128) {
    return false;
  }
  for (let i = 0; i < 128; i++) {
    const val = descriptor[i];
    if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
      return false;
    }
  }
  return true;
}

function compareFaceDescriptors(descA, descB, threshold = DEFAULT_MATCH_THRESHOLD) {
  if (!isValidDescriptor(descA) || !isValidDescriptor(descB)) {
    return {
      match: false,
      distance: 999,
      confidence: 0,
      valid: false,
      error: 'INVALID_DESCRIPTOR_DIMENSIONS',
    };
  }

  let sum = 0;
  for (let i = 0; i < 128; i++) {
    const diff = descA[i] - descB[i];
    sum += diff * diff;
  }
  const distance = Math.sqrt(sum);
  const match = distance <= threshold;
  const confidence = Math.max(0, Math.min(1, 1 - (distance / (threshold * 1.5))));

  return {
    match,
    distance: Math.round(distance * 1000) / 1000,
    confidence: Math.round(confidence * 100) / 100,
    valid: true,
  };
}

function matchUserFace(liveDescriptor, enrolledDescriptorsList, threshold = DEFAULT_MATCH_THRESHOLD) {
  if (!isValidDescriptor(liveDescriptor)) {
    return {
      match: false,
      distance: 999,
      confidence: 0,
      valid: false,
      error: 'INVALID_LIVE_DESCRIPTOR',
    };
  }

  if (!Array.isArray(enrolledDescriptorsList) || enrolledDescriptorsList.length === 0) {
    return {
      match: false,
      distance: 999,
      confidence: 0,
      valid: false,
      error: 'NO_ENROLLED_DESCRIPTORS',
    };
  }

  const validEnrolled = enrolledDescriptorsList.filter(isValidDescriptor);
  if (validEnrolled.length === 0) {
    return {
      match: false,
      distance: 999,
      confidence: 0,
      valid: false,
      error: 'NO_VALID_ENROLLED_DESCRIPTORS',
    };
  }

  let bestMatch = { match: false, distance: 999, confidence: 0, valid: true };

  for (const storedDesc of validEnrolled) {
    const res = compareFaceDescriptors(liveDescriptor, storedDesc, threshold);
    if (res.valid && res.distance < bestMatch.distance) {
      bestMatch = res;
    }
  }

  return bestMatch;
}

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

console.log('=== Running Face Recognition Hardening Test Suite ===\n');

// 1. Test isValidDescriptor
assert(!isValidDescriptor(null), 'isValidDescriptor rejects null');
assert(!isValidDescriptor(undefined), 'isValidDescriptor rejects undefined');
assert(!isValidDescriptor('fake-descriptor'), 'isValidDescriptor rejects strings');
assert(!isValidDescriptor([1, 2, 3]), 'isValidDescriptor rejects arrays of length != 128');
assert(!isValidDescriptor(new Array(128)), 'isValidDescriptor rejects uninitialized arrays');
assert(!isValidDescriptor(new Array(128).fill(NaN)), 'isValidDescriptor rejects arrays with NaN');
assert(!isValidDescriptor(new Array(128).fill(Infinity)), 'isValidDescriptor rejects arrays with Infinity');

const validDescA = new Array(128).fill(0).map((_, i) => Math.sin(i * 0.1));
assert(isValidDescriptor(validDescA), 'isValidDescriptor accepts valid 128-float array');

const validFloat32 = new Float32Array(128).map((_, i) => Math.cos(i * 0.1));
assert(isValidDescriptor(validFloat32), 'isValidDescriptor accepts valid Float32Array of length 128');

// 2. Test compareFaceDescriptors
const identicalComparison = compareFaceDescriptors(validDescA, validDescA, DEFAULT_MATCH_THRESHOLD);
assert(identicalComparison.match === true, 'compareFaceDescriptors matches identical vectors');
assert(identicalComparison.distance === 0, 'compareFaceDescriptors has 0 distance for identical vectors');
assert(identicalComparison.confidence === 1, 'compareFaceDescriptors has 1.0 confidence for identical vectors');

const invalidComparison = compareFaceDescriptors(validDescA, [1, 2, 3]);
assert(invalidComparison.match === false && !invalidComparison.valid, 'compareFaceDescriptors rejects invalid descriptor dimensions');

const differentDesc = new Array(128).fill(0).map((_, i) => Math.sin(i * 0.9 + 5.0));
const mismatchComparison = compareFaceDescriptors(validDescA, differentDesc, DEFAULT_MATCH_THRESHOLD);
assert(mismatchComparison.match === false, 'compareFaceDescriptors rejects non-matching vectors');
assert(mismatchComparison.distance > DEFAULT_MATCH_THRESHOLD, 'compareFaceDescriptors distance exceeds threshold for different faces');

// 3. Test matchUserFace (FAIL CLOSED RULES)
assert(matchUserFace(validDescA, []).match === false, 'matchUserFace rejects empty enrolled list');
assert(matchUserFace(validDescA, null).match === false, 'matchUserFace rejects null enrolled list');
assert(matchUserFace(validDescA, undefined).match === false, 'matchUserFace rejects undefined enrolled list');
assert(matchUserFace(validDescA, ['corrupt', [1, 2]]).match === false, 'matchUserFace rejects invalid descriptors in list');
assert(matchUserFace(null, [validDescA]).match === false, 'matchUserFace rejects null live descriptor');

// Test matching against registered list
const enrolledList = [validDescA];
const matchResult = matchUserFace(validDescA, enrolledList, DEFAULT_MATCH_THRESHOLD);
assert(matchResult.match === true, 'matchUserFace matches live face against enrolled list');

const mismatchResult = matchUserFace(differentDesc, enrolledList, DEFAULT_MATCH_THRESHOLD);
assert(mismatchResult.match === false, 'matchUserFace rejects unregistered live face against enrolled list');

console.log(`\n=== Test Results: ${passed} Passed, ${failed} Failed ===`);
if (failed > 0) {
  process.exit(1);
}
