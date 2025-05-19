
"use client";

import type HlsJs from 'hls.js';
import React, { useEffect, useRef } from 'react';

interface VideoPlayerProps {
  manifestUrl: string;
}

export function VideoPlayer({ manifestUrl }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<HlsJs | null>(null);

  useEffect(() => {
    let HlsConstructor: typeof HlsJs | undefined;
    if (typeof window !== 'undefined') {
      HlsConstructor = require('hls.js').default;
    }

    if (!manifestUrl || !videoRef.current || !HlsConstructor) {
      return;
    }

    const videoElement = videoRef.current;

    // Define the event handler for native HLS playback to allow removal
    const handleLoadedMetadata = () => {
      videoElement.play().catch(error => console.warn("Autoplay was prevented for native HLS:", error));
    };

    if (HlsConstructor.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      const hls = new HlsConstructor({
         debug: true, // Enabled HLS.js debugging
         // Example: Enable automatic recovery on network errors
         // abrEwmaDefaultEstimate: 500000, // Optional: provide a default bandwidth estimate
         // lowLatencyMode: false, // Set to true if it's a low-latency stream
      });
      hlsRef.current = hls;
      hls.loadSource(manifestUrl);
      hls.attachMedia(videoElement);

      hls.on(HlsConstructor.Events.MANIFEST_PARSED, () => {
        videoElement.play().catch(error => console.warn("Autoplay was prevented for HLS.js:", error));
      });

      hls.on(HlsConstructor.Events.ERROR, (event, data) => {
        console.error(`HLS.js Error: Type: ${data.type}, Details: ${data.details}, Fatal: ${data.fatal}`, data);
        if (data.fatal) {
          switch (data.type) {
            case HlsConstructor.ErrorTypes.NETWORK_ERROR:
              console.warn('HLS.js: Fatal network error encountered. Attempting to recover...');
              hls.startLoad(); // Attempt to restart loading
              break;
            case HlsConstructor.ErrorTypes.MEDIA_ERROR:
              console.warn('HLS.js: Fatal media error encountered. Attempting to recover...');
              hls.recoverMediaError(); // Attempt to recover from media error
              // If recoverMediaError is not enough, you might need to hls.startLoad() or hls.swapAudioCodec() if applicable
              break;
            default:
              console.error('HLS.js: Unrecoverable fatal error. Destroying HLS instance.');
              hls.destroy();
              hlsRef.current = null;
              break;
          }
        } else {
          console.warn('HLS.js: Non-fatal error.', data);
        }
      });
    } else if (videoElement.canPlayType('application/vnd.apple.mpegurl')) {
      // Native HLS support (e.g., Safari)
      videoElement.src = manifestUrl;
      videoElement.addEventListener('loadedmetadata', handleLoadedMetadata);
    } else {
      console.error("HLS.js is not supported and native HLS playback is not available.");
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      if (videoElement) {
        videoElement.removeAttribute('src'); // Clean up src
        videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
        // It's also good to pause and empty the video element
        videoElement.pause();
        // videoElement.load(); // This can sometimes help, but removeAttribute('src') is often enough
      }
    };
  }, [manifestUrl]); // Dependency array is correct

  return (
    <div className="w-full aspect-video bg-black rounded-lg shadow-lg overflow-hidden">
      <video ref={videoRef} controls className="w-full h-full" data-ai-hint="video stream"></video>
    </div>
  );
}

