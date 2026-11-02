import { useState, useEffect, useRef, useCallback } from 'react';

// Reliable helper to stop all tracks on a MediaStream
function stopMediaStream(stream) {
  if (!stream) return;
  try {
    const tracks = stream.getTracks();
    tracks.forEach((track) => {
      try {
        track.stop();
      } catch (err) {
        console.warn('Error stopping media track:', err);
      }
    });
  } catch (err) {
    console.warn('Error accessing stream tracks:', err);
  }
}

export function useCamera() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const requestIdRef = useRef(0);
  const selectedDeviceIdRef = useRef('');
  const isActiveRef = useRef(false);

  const [isActive, setIsActive] = useState(false);
  const [permissionState, setPermissionState] = useState('prompt'); // prompt, granted, denied, unavailable
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState('');
  const [error, setError] = useState(null);

  // Sync refs
  useEffect(() => {
    selectedDeviceIdRef.current = selectedDeviceId;
  }, [selectedDeviceId]);

  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // List available video devices (stable callback)
  const updateDeviceList = useCallback(async () => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = allDevices.filter((d) => d.kind === 'videoinput');
      setDevices(videoInputs);
      if (videoInputs.length > 0 && !selectedDeviceIdRef.current) {
        setSelectedDeviceId(videoInputs[0].deviceId);
        selectedDeviceIdRef.current = videoInputs[0].deviceId;
      }
    } catch (err) {
      console.warn('Could not enumerate video devices:', err);
    }
  }, []);

  // Stop Camera (stable callback)
  const stopCamera = useCallback(() => {
    // Invalidate any in-flight getUserMedia requests
    requestIdRef.current += 1;

    if (streamRef.current) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsActive(false);
    isActiveRef.current = false;
  }, []);

  // Start Camera with request cancellation and playback synchronization
  const startCamera = useCallback(async (deviceIdToUse) => {
    requestIdRef.current += 1;
    const currentRequestId = requestIdRef.current;

    setError(null);

    // Stop any existing active stream before acquiring a new one
    if (streamRef.current) {
      stopMediaStream(streamRef.current);
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsActive(false);
    isActiveRef.current = false;

    const targetDeviceId = deviceIdToUse || selectedDeviceIdRef.current;

    const constraints = {
      video: targetDeviceId
        ? { deviceId: { exact: targetDeviceId }, width: { ideal: 640 }, height: { ideal: 480 } }
        : { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      audio: false,
    };

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('navigator.mediaDevices.getUserMedia is not supported');
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Check if this request was superseded while getUserMedia was resolving
      if (currentRequestId !== requestIdRef.current) {
        stopMediaStream(stream);
        return;
      }

      // Attach stream to video element and ensure playback is ready
      if (videoRef.current) {
        const video = videoRef.current;
        video.srcObject = stream;

        try {
          await video.play();
        } catch (playErr) {
          // If request was cancelled while awaiting play
          if (currentRequestId !== requestIdRef.current) {
            stopMediaStream(stream);
            return;
          }
          console.warn('Video playback deferred or interrupted:', playErr);
        }
      }

      // Check again after play resolution
      if (currentRequestId !== requestIdRef.current) {
        stopMediaStream(stream);
        return;
      }

      streamRef.current = stream;
      setPermissionState('granted');
      setIsActive(true);
      isActiveRef.current = true;

      await updateDeviceList();
    } catch (err) {
      // If superseded by a newer request, ignore error
      if (currentRequestId !== requestIdRef.current) {
        return;
      }

      console.error('Camera access error:', err);
      setIsActive(false);
      isActiveRef.current = false;

      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setPermissionState('denied');
        setError('Camera permission was denied. Please allow camera access in your browser settings.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setPermissionState('unavailable');
        setError('No camera device found on this system.');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setError('Camera is currently in use by another application or process.');
      } else {
        setError(`Camera error: ${err.message || 'Unable to start camera'}`);
      }
    }
  }, [updateDeviceList]);

  // Switch Device (stable callback)
  const switchDevice = useCallback(async (newDeviceId) => {
    setSelectedDeviceId(newDeviceId);
    selectedDeviceIdRef.current = newDeviceId;
    if (isActiveRef.current) {
      await startCamera(newDeviceId);
    }
  }, [startCamera]);

  // Cleanup on unmount - stop all tracks and cancel in-flight requests
  useEffect(() => {
    return () => {
      requestIdRef.current += 1;
      if (streamRef.current) {
        stopMediaStream(streamRef.current);
        streamRef.current = null;
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  return {
    videoRef,
    isActive,
    permissionState,
    devices,
    selectedDeviceId,
    error,
    startCamera,
    stopCamera,
    switchDevice,
  };
}
