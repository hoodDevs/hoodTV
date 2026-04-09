import { useEffect, useRef, useState } from "react";
import videojs from "video.js";
import type Player from "video.js/dist/types/player";
import "video.js/dist/video-js.css";

export interface TrackOption {
  language: string;
  url: string;
}

interface VideoPlayerProps {
  src: string;
  sourceType?: string;
  poster?: string;
  tracks?: TrackOption[];
  onReady?: (video: HTMLVideoElement) => void;
  onError?: (code: number | string) => void;
}

const HOOD_CSS = `
  /* ── Container ── */
  .hoodtv-vjs.video-js {
    width: 100%;
    height: 100%;
    background: #000;
    font-family: 'DM Sans', sans-serif;
    --vjs-theme-hood: #7F77DD;
  }

  /* ── Big play button ── */
  .hoodtv-vjs .vjs-big-play-button {
    width: 72px;
    height: 72px;
    line-height: 72px;
    border-radius: 50%;
    border: 2px solid rgba(127,119,221,0.55);
    background: rgba(10,10,20,0.7);
    backdrop-filter: blur(12px);
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    margin: 0;
    transition: all 0.2s;
  }
  .hoodtv-vjs .vjs-big-play-button .vjs-icon-placeholder::before {
    font-size: 36px;
    color: #c0bdf5;
    line-height: 72px;
  }
  .hoodtv-vjs:hover .vjs-big-play-button,
  .hoodtv-vjs .vjs-big-play-button:focus {
    background: rgba(127,119,221,0.25);
    border-color: #9D97E8;
  }

  /* ── Control bar ── */
  .hoodtv-vjs .vjs-control-bar {
    display: flex;
    align-items: center;
    height: 46px;
    padding: 0 10px;
    background: linear-gradient(to top, rgba(5,5,12,0.95) 0%, rgba(5,5,12,0.6) 100%);
    backdrop-filter: blur(8px);
    border-top: 1px solid rgba(127,119,221,0.08);
    font-family: 'DM Sans', sans-serif;
  }

  /* ── Progress / seek bar ── */
  .hoodtv-vjs .vjs-progress-control {
    flex: 1;
    height: 100%;
    display: flex;
    align-items: center;
  }
  .hoodtv-vjs .vjs-progress-holder {
    height: 3px;
    border-radius: 3px;
    background: rgba(255,255,255,0.15);
    margin: 0 4px;
    transition: height 0.15s;
  }
  .hoodtv-vjs .vjs-progress-control:hover .vjs-progress-holder {
    height: 5px;
  }
  .hoodtv-vjs .vjs-play-progress {
    background: #7F77DD;
    border-radius: 3px;
  }
  .hoodtv-vjs .vjs-play-progress::before {
    font-size: 12px;
    color: #c0bdf5;
    top: -4px;
  }
  .hoodtv-vjs .vjs-load-progress {
    background: rgba(127,119,221,0.22);
    border-radius: 3px;
  }
  .hoodtv-vjs .vjs-load-progress div {
    background: rgba(127,119,221,0.18);
  }
  .hoodtv-vjs .vjs-slider:focus {
    box-shadow: none;
    text-shadow: none;
  }

  /* ── Volume ── */
  .hoodtv-vjs .vjs-volume-panel {
    display: flex;
    align-items: center;
  }
  .hoodtv-vjs .vjs-volume-bar {
    height: 3px;
    border-radius: 3px;
    background: rgba(255,255,255,0.15);
    margin: 0 6px;
    width: 60px;
  }
  .hoodtv-vjs .vjs-volume-level {
    background: #9D97E8;
    border-radius: 3px;
  }
  .hoodtv-vjs .vjs-volume-level::before {
    font-size: 10px;
    color: #c0bdf5;
    top: -4px;
  }

  /* ── Buttons ── */
  .hoodtv-vjs .vjs-button > .vjs-icon-placeholder::before {
    font-size: 20px;
    color: rgba(255,255,255,0.75);
    line-height: 46px;
    transition: color 0.15s;
  }
  .hoodtv-vjs .vjs-button:hover > .vjs-icon-placeholder::before {
    color: #c0bdf5;
  }
  .hoodtv-vjs .vjs-button:focus {
    outline: none;
    box-shadow: none;
    text-shadow: none;
  }

  /* ── Time display ── */
  .hoodtv-vjs .vjs-time-control {
    font-size: 12px;
    font-family: 'DM Sans', sans-serif;
    color: rgba(255,255,255,0.5);
    padding: 0 4px;
    line-height: 46px;
    min-width: auto;
  }
  .hoodtv-vjs .vjs-current-time { color: rgba(255,255,255,0.85); }
  .hoodtv-vjs .vjs-time-divider { color: rgba(255,255,255,0.3); min-width: 12px; }
  .hoodtv-vjs .vjs-duration { color: rgba(255,255,255,0.4); }

  /* ── Playback rate ── */
  .hoodtv-vjs .vjs-playback-rate .vjs-playback-rate-value {
    font-size: 12px;
    font-family: 'DM Sans', sans-serif;
    color: rgba(255,255,255,0.6);
    line-height: 46px;
  }
  .hoodtv-vjs .vjs-menu-content {
    background: rgba(10,10,20,0.95);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(127,119,221,0.18);
    border-radius: 8px;
    font-family: 'DM Sans', sans-serif;
  }
  .hoodtv-vjs .vjs-menu-item {
    font-size: 13px;
    color: rgba(255,255,255,0.65);
    padding: 8px 16px;
  }
  .hoodtv-vjs .vjs-menu-item:hover,
  .hoodtv-vjs .vjs-menu-item.vjs-selected {
    background: rgba(127,119,221,0.18);
    color: #c0bdf5;
  }

  /* ── Subtitles ── */
  .hoodtv-vjs .vjs-text-track-display > div > div > div {
    background: rgba(0,0,0,0.75) !important;
    color: #fff !important;
    font-family: 'DM Sans', sans-serif !important;
    font-size: 1em !important;
    border-radius: 4px;
    padding: 2px 8px;
  }

  /* ── Loading spinner ── */
  .hoodtv-vjs .vjs-loading-spinner {
    border: 3px solid rgba(127,119,221,0.2);
    border-top-color: #7F77DD;
    width: 42px;
    height: 42px;
    border-radius: 50%;
    animation: vjs-spin 0.8s linear infinite;
    margin: -21px 0 0 -21px;
  }
  .hoodtv-vjs .vjs-loading-spinner::before,
  .hoodtv-vjs .vjs-loading-spinner::after {
    display: none;
  }

  /* ── Error display ── */
  .hoodtv-vjs .vjs-error-display {
    background: rgba(5,5,12,0.92) !important;
  }
  .hoodtv-vjs .vjs-error-display .vjs-modal-dialog-content {
    font-family: 'DM Sans', sans-serif;
    color: rgba(255,255,255,0.5);
    font-size: 13px;
  }

  /* ── Fullscreen ── */
  .hoodtv-vjs.vjs-fullscreen .vjs-control-bar {
    height: 52px;
  }
  .hoodtv-vjs.vjs-fullscreen .vjs-button > .vjs-icon-placeholder::before {
    line-height: 52px;
  }
  .hoodtv-vjs.vjs-fullscreen .vjs-time-control {
    line-height: 52px;
  }

  /* ── Hover fade ── */
  .hoodtv-vjs.vjs-user-inactive.vjs-playing .vjs-control-bar {
    opacity: 0;
    transition: opacity 0.4s;
  }
  .hoodtv-vjs.vjs-user-active .vjs-control-bar {
    opacity: 1;
    transition: opacity 0.2s;
  }

  /* ── Tooltip ── */
  .hoodtv-vjs .vjs-time-tooltip {
    background: rgba(10,10,20,0.9);
    border-radius: 5px;
    color: #c0bdf5;
    font-family: 'DM Sans', sans-serif;
    font-size: 11px;
    padding: 3px 7px;
    border: 1px solid rgba(127,119,221,0.25);
  }

  /* ── Unmute hint ── */
  .hood-unmute {
    position: absolute;
    bottom: 62px;
    right: 18px;
    display: flex;
    align-items: center;
    gap: 7px;
    padding: 9px 16px;
    border-radius: 22px;
    background: rgba(127,119,221,0.82);
    backdrop-filter: blur(10px);
    border: 1px solid rgba(192,189,245,0.28);
    color: #fff;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: background 0.2s, transform 0.15s;
    box-shadow: 0 4px 18px rgba(127,119,221,0.38);
    z-index: 9;
  }
  .hood-unmute:hover {
    background: rgba(157,151,232,0.9);
    transform: scale(1.04);
  }
`;

export function VideoPlayer({ src, poster, tracks = [], onReady, onError }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const [showUnmute, setShowUnmute] = useState(false);
  const [isMuted, setIsMuted] = useState(true);

  useEffect(() => {
    if (!src) return;

    const container = containerRef.current;
    if (!container) return;

    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
    }

    setShowUnmute(false);
    setIsMuted(true);

    const videoEl = document.createElement("video");
    videoEl.className = "video-js hoodtv-vjs";
    if (poster) videoEl.poster = poster;
    videoEl.playsInline = true;
    container.appendChild(videoEl);

    const player = videojs(videoEl, {
      html5: {
        vhs: {
          overrideNative: true,
          enableLowInitialPlaylist: true,
          smoothQualityChange: true,
          limitRenditionByPlayerDimensions: false,
          useDevicePixelRatio: false,
          allowSeeksWithinUnsafeLiveWindow: true,
        },
        nativeAudioTracks: false,
        nativeVideoTracks: false,
        nativeTextTracks: false,
      },
      sources: [{ src, type: "application/x-mpegURL" }],
      autoplay: "muted",
      muted: true,
      controls: true,
      preload: "auto",
      fill: true,
      liveui: false,
      playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
      controlBar: {
        children: [
          "playToggle",
          "volumePanel",
          "currentTimeDisplay",
          "timeDivider",
          "durationDisplay",
          "progressControl",
          "playbackRateMenuButton",
          "fullscreenToggle",
        ],
        volumePanel: { inline: true },
      },
      userActions: { hotkeys: true },
      errorDisplay: true,
      textTrackDisplay: true,
    } as any);

    playerRef.current = player;

    tracks.forEach((t) => {
      player.addRemoteTextTrack({
        kind: "subtitles",
        src: t.url,
        srclang: t.language,
        label: t.language,
        default: false,
      }, false);
    });

    player.ready(() => {
      const vid = player.el()?.querySelector("video") as HTMLVideoElement | null;
      if (vid) onReady?.(vid);

      player.play()?.then(() => {
        setShowUnmute(true);
      }).catch(() => {});
    });

    player.on("error", () => {
      const err = player.error();
      const code = err?.code ?? "unknown";
      onError?.(code);
    });

    return () => {
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src]);

  const handleUnmute = () => {
    if (playerRef.current) {
      playerRef.current.muted(false);
      playerRef.current.volume(1);
      setIsMuted(false);
      setShowUnmute(false);
    }
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000" }}>
      <style>{HOOD_CSS}</style>
      <div
        ref={containerRef}
        style={{ width: "100%", height: "100%" }}
        data-vjs-player
      />
      {showUnmute && isMuted && (
        <button className="hood-unmute" onClick={handleUnmute}>
          🔊 Tap to unmute
        </button>
      )}
    </div>
  );
}
