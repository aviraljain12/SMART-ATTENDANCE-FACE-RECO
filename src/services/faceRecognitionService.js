// Browser-based Face Recognition Engine
// Using @vladmandic/face-api with local model weights exclusively
import * as faceapi from '@vladmandic/face-api';

const LOCAL_MODEL_URL = '/models';

// Default Euclidean distance threshold for 128-dimensional biometric embeddings.
// Values <= 0.55 indicate identity match under standard FaceNet embeddings.
export const DEFAULT_MATCH_THRESHOLD = 0.55;

let modelsLoaded = false;
let modelLoadingError = null;
let modelLoadingPromise = null;

/**
 * Validates whether a descriptor is a valid 128-dimensional biometric embedding.
 * Must be an Array or Float32Array of length 128 containing only finite numbers.
 */
export function isValidDescriptor(descriptor) {
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

/**
 * Load face-api neural models (TinyFaceDetector, FaceLandmark68Net, FaceRecognitionNet)
 * Strictly loads from the local /models directory. Does NOT switch to remote CDNs.
 */
export async function loadFaceRecognitionModels() {
  if (modelsLoaded) {
    return { success: true, error: null };
  }
  if (modelLoadingError) {
    return { success: false, error: modelLoadingError };
  }
  if (modelLoadingPromise) {
    return modelLoadingPromise;
  }

  modelLoadingPromise = (async () => {
    try {
      console.log('Loading face-api neural models from local /models directory...');
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(LOCAL_MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(LOCAL_MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(LOCAL_MODEL_URL),
      ]);
      modelsLoaded = true;
      modelLoadingError = null;
      console.log('Face-api neural models loaded successfully from local storage.');
      return { success: true, error: null };
    } catch (err) {
      const errMsg = err?.message || 'Failed to load local models from /models';
      console.error('Local face recognition model load failed:', errMsg);
      modelsLoaded = false;
      modelLoadingError = errMsg;
      return { success: false, error: errMsg };
    } finally {
      modelLoadingPromise = null;
    }
  })();

  return modelLoadingPromise;
}

export function areModelsLoaded() {
  return modelsLoaded;
}

export function getModelLoadingError() {
  return modelLoadingError;
}

/**
 * Detect faces in real-time video frame.
 * Strict Neural Pipeline:
 * - Rejects frames if models are not loaded (fails closed).
 * - Rejects frames with zero faces.
 * - Rejects frames with multiple faces (>1 face).
 * - Validates 128-dimensional descriptor.
 * - Performs face alignment validation (head pose symmetry check).
 *
 * NOTE: Face detection and face recognition are separate operations.
 * Face detection locates and extracts features.
 * Recognition compares features against authorized enrolled biometric profiles.
 */
export async function detectFaceInVideo(videoElement) {
  if (!videoElement || videoElement.readyState < 2) {
    return {
      detected: false,
      modelsReady: modelsLoaded,
      message: 'Video stream initializing...',
    };
  }

  // Fail closed if neural models are unavailable.
  // Never synthesize artificial biometric descriptors or return fake successes.
  if (!modelsLoaded) {
    return {
      detected: false,
      modelsReady: false,
      error: 'MODELS_UNAVAILABLE',
      message: 'Neural face models are not loaded. Recognition unavailable.',
    };
  }

  const videoWidth = videoElement.videoWidth || 640;
  const videoHeight = videoElement.videoHeight || 480;

  try {
    const options = new faceapi.TinyFaceDetectorOptions({
      inputSize: 320,
      scoreThreshold: 0.45,
    });

    const detections = await faceapi
      .detectAllFaces(videoElement, options)
      .withFaceLandmarks()
      .withFaceDescriptors();

    // Zero faces detected
    if (!detections || detections.length === 0) {
      return {
        detected: false,
        modelsReady: true,
        multipleFaces: false,
        count: 0,
        message: 'No face detected. Please position your face in the camera view.',
        videoWidth,
        videoHeight,
      };
    }

    // Multiple faces detected (reject frame)
    if (detections.length > 1) {
      return {
        detected: false,
        modelsReady: true,
        multipleFaces: true,
        count: detections.length,
        message: `Multiple faces (${detections.length}) detected. Only 1 person permitted.`,
        videoWidth,
        videoHeight,
      };
    }

    const single = detections[0];
    const box = single.detection.box;
    const landmarks = single.landmarks;
    const rawDescriptor = single.descriptor;

    // Validate descriptor integrity
    if (!isValidDescriptor(rawDescriptor)) {
      return {
        detected: false,
        modelsReady: true,
        error: 'INVALID_DESCRIPTOR',
        message: 'Unable to extract a valid 128-dimensional biometric descriptor.',
        videoWidth,
        videoHeight,
      };
    }

    const descriptor = Array.from(rawDescriptor);
    const detectionScore = Math.round(single.detection.score * 100) / 100;

    // Face alignment validation (head pose symmetry check)
    // Checks if the face is looking directly forward towards the camera
    const nose = landmarks.getNose();
    const leftEye = landmarks.getLeftEye();
    const rightEye = landmarks.getRightEye();

    const noseTip = nose[3] || nose[0];
    const eyeCenterLeft = leftEye[0];
    const eyeCenterRight = rightEye[3] || rightEye[0];
    const distToLeft = Math.abs(noseTip.x - eyeCenterLeft.x);
    const distToRight = Math.abs(rightEye[rightEye.length - 1].x - noseTip.x);
    const symmetryRatio = distToLeft > 0 ? distToRight / distToLeft : 1;

    // Face alignment threshold (not a proof of liveness, purely orientation check)
    const isFaceAligned = symmetryRatio >= 0.55 && symmetryRatio <= 1.82;

    return {
      detected: true,
      modelsReady: true,
      multipleFaces: false,
      detectionScore, // Detection confidence (separate from recognition confidence)
      box: {
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
      },
      videoWidth,
      videoHeight,
      descriptor,
      isFaceAligned,
      alignmentMessage: isFaceAligned ? 'Face aligned' : 'Please face directly forward toward the camera',
      message: isFaceAligned ? 'Face detected and aligned' : 'Please face directly forward toward the camera',
    };
  } catch (err) {
    console.error('Neural detection pass error:', err);
    return {
      detected: false,
      modelsReady: true,
      error: 'DETECTION_ERROR',
      message: 'Error during facial detection pass: ' + (err.message || 'Unknown error'),
      videoWidth,
      videoHeight,
    };
  }
}

/**
 * Compare two 128-dimensional biometric vectors using Euclidean distance.
 * Returns: { match: boolean, distance: number, confidence: number, valid: boolean }
 *
 * Requirements:
 * - Rejects invalid or missing descriptors.
 * - Distance <= threshold implies identity match.
 * - Lower distance = higher similarity.
 */
export function compareFaceDescriptors(descA, descB, threshold = DEFAULT_MATCH_THRESHOLD) {
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

  // Recognition confidence (separate from detection score)
  const confidence = Math.max(0, Math.min(1, 1 - (distance / (threshold * 1.5))));

  return {
    match,
    distance: Math.round(distance * 1000) / 1000,
    confidence: Math.round(confidence * 100) / 100,
    valid: true,
  };
}

/**
 * Match a live face descriptor against an enrolled list of descriptors for a user.
 *
 * Strict Security Rules:
 * - Live descriptor must be valid 128-d vector.
 * - Enrolled list must be non-empty and contain valid 128-d vectors.
 * - If enrolled list is empty or missing, REJECT (never auto-authenticate).
 * - Fails closed on any ambiguity.
 */
export function matchUserFace(liveDescriptor, enrolledDescriptorsList, threshold = DEFAULT_MATCH_THRESHOLD) {
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

  // Filter to ensure only strictly valid enrolled vectors are evaluated
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
