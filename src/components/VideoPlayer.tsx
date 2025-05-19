
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
         // Fine-tune HLS.js options here if needed
         // For example, to enable detailed debugging:
         debug: true, // Enabled HLS.js debugging
      });
      hlsRef.current = hls;
      hls.loadSource(manifestUrl);
      hls.attachMedia(videoElement);
      hls.on(HlsConstructor.Events.MANIFEST_PARSED, () => {
        videoElement.play().catch(error => console.warn("Autoplay was prevented for HLS.js:", error));
      });
      hls.on(HlsConstructor.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case HlsConstructor.ErrorTypes.NETWORK_ERROR:
              console.error('HLS.js: Fatal network error encountered.', data);
              // hls.startLoad(); // Example recovery attempt
              break;
            case HlsConstructor.ErrorTypes.MEDIA_ERROR:
              console.error('HLS.js: Fatal media error encountered.', data);
              // hls.recoverMediaError(); // Example recovery attempt
              break;
            default:
              console.error('HLS.js: Fatal error.', data);
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
        // Remove the specific event listener for native HLS
        videoElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
      }
    };
  }, [manifestUrl]); // Dependency array is correct

  return (
    <div className="w-full aspect-video bg-black rounded-lg shadow-lg overflow-hidden">
      <video ref={videoRef} controls className="w-full h-full" data-ai-hint="video stream"></video>
    </div>
  );
}
