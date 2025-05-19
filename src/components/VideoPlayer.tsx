
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
         // debug: process.env.NODE_ENV === 'development',
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
              console.error('Fatal network error encountered, trying to recover...', data);
              // hls.startLoad(); // Example recovery attempt
              break;
            case HlsConstructor.ErrorTypes.MEDIA_ERROR:
              console.error('Fatal media error encountered, trying to recover...', data);
              // hls.recoverMediaError(); // Example recovery attempt
              break;
            default:
              console.error('Fatal HLS error:', data);
              hls.destroy();
              hlsRef.current = null;
              break;
          }
        } else {
          console.warn('Non-fatal HLS error:', data);
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
  }, [manifestUrl]); // Corrected dependency array

  return (
    <div className="w-full aspect-video bg-black rounded-lg shadow-lg overflow-hidden">
      <video ref={videoRef} controls className="w-full h-full" data-ai-hint="video stream"></video>
    </div>
  );
}
