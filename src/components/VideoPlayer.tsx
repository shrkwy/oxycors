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
    let Hls: typeof HlsJs | undefined;
    if (typeof window !== 'undefined') {
      Hls = require('hls.js').default;
    }


    if (!manifestUrl || !videoRef.current || !Hls) {
      return;
    }

    const videoElement = videoRef.current;

    if (Hls.isSupported()) {
      if (hlsRef.current) {
        hlsRef.current.destroy();
      }
      const hls = new Hls({
         // Fine-tune HLS.js options here if needed
         // For example, to enable detailed debugging:
         // debug: process.env.NODE_ENV === 'development',
      });
      hlsRef.current = hls;
      hls.loadSource(manifestUrl);
      hls.attachMedia(videoElement);
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        videoElement.play().catch(error => console.warn("Autoplay was prevented:", error));
      });
      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Fatal network error encountered, trying to recover...', data);
              // hls.startLoad(); // Example recovery attempt
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
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
      videoElement.addEventListener('loadedmetadata', () => {
        videoElement.play().catch(error => console.warn("Autoplay was prevented:", error));
      });
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
         // Remove event listeners if added directly
      }
    };
  }, [manifestUrl, Hls]);

  return (
    <div className="w-full aspect-video bg-black rounded-lg shadow-lg overflow-hidden">
      <video ref={videoRef} controls className="w-full h-full" data-ai-hint="video stream"></video>
    </div>
  );
}
