
"use client";

import React, { useEffect, useRef } from 'react';

// Vidstack imports
import { MediaPlayer, MediaProvider, type MediaPlayerInstance } from '@vidstack/react';
import { DefaultAudioLayout, DefaultVideoLayout, defaultLayoutIcons } from '@vidstack/react/player/layouts/default';

// Vidstack styles
import 'vidstack/player/styles/default/theme.css';
import 'vidstack/player/styles/default/layouts/video.css';


interface VideoPlayerProps {
  manifestUrl: string;
}

export function VideoPlayer({ manifestUrl }: VideoPlayerProps) {
  const player = useRef<MediaPlayerInstance>(null);

  useEffect(() => {
    // You can interact with the player instance here if needed.
    // For example, to listen to events:
    // player.current?.addEventListener('error', (event) => console.error('Vidstack Player Error:', event));
  }, []);

  if (!manifestUrl) {
    return (
      <div className="w-full aspect-video bg-black rounded-lg shadow-lg overflow-hidden flex items-center justify-center text-muted-foreground">
        <p>No video source provided.</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl aspect-video bg-black rounded-lg shadow-lg overflow-hidden" data-ai-hint="video stream player">
      <MediaPlayer
        ref={player}
        title="Demo Stream" // You might want to make title dynamic if available
        src={manifestUrl}
        playsInline
        autoPlay
        className="w-full h-full"
        crossOrigin // Important for HLS, especially if it involves different origins for segments/keys
        // Poster can be added here if you have a poster image URL
        // poster="https://placehold.co/1280x720.png" 
      >
        <MediaProvider />
        <DefaultVideoLayout icons={defaultLayoutIcons} />
        {/* If you might also play audio-only HLS, you could conditionally render DefaultAudioLayout */}
        {/* <DefaultAudioLayout icons={defaultLayoutIcons} /> */}
      </MediaPlayer>
    </div>
  );
}
