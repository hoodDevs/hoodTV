import { useEffect, useRef } from "react";
import videojs from "video.js";
import "video.js/dist/video-js.css";
import type Player from "video.js/dist/types/player";

export interface TrackOption {
  language: string;
  url: string;
}

interface VideoPlayerProps {
  src: string;
  sourceType?: string;
  poster?: string;
  tracks?: TrackOption[];
  onReady?: (player: Player) => void;
}

export function VideoPlayer({ src, sourceType, poster, tracks = [], onReady }: VideoPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    if (playerRef.current) {
      playerRef.current.dispose();
      playerRef.current = null;
    }

    const videoEl = document.createElement("video");
    videoEl.className = "video-js vjs-big-play-centered";
    videoEl.setAttribute("crossorigin", "anonymous");
    containerRef.current.appendChild(videoEl);

    const englishTrack = tracks.find((t) => t.language.toLowerCase().includes("english"));
    const textTracks = (englishTrack ? [englishTrack, ...tracks.filter((t) => t !== englishTrack)] : tracks)
      .slice(0, 8)
      .map((t, i) => ({
        kind: "subtitles" as const,
        src: t.url,
        srclang: t.language.slice(0, 2).toLowerCase(),
        label: t.language,
        default: i === 0 && !!englishTrack,
      }));

    const player = videojs(videoEl, {
      controls: true,
      autoplay: true,
      preload: "auto",
      fill: true,
      poster,
      html5: {
        vhs: {
          overrideNative: true,
          enableLowInitialPlaylist: true,
          withCredentials: false,
        },
        nativeVideoTracks: false,
        nativeAudioTracks: false,
        nativeTextTracks: false,
      },
      sources: [{ src, type: (sourceType === "hls" || src.includes(".m3u8") || src.includes("/proxy/hls")) ? "application/x-mpegURL" : "video/mp4" }],
      tracks: textTracks,
    });

    player.ready(() => {
      onReady?.(player);
    });

    playerRef.current = player;

    return () => {
      playerRef.current?.dispose();
      playerRef.current = null;
    };
  }, [src]);

  useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .video-js {
        background: #000;
        width: 100% !important;
        height: 100% !important;
      }
      .video-js video {
        object-fit: contain;
      }
      .video-js .vjs-tech {
        object-fit: contain;
      }
      .video-js .vjs-control-bar {
        background: linear-gradient(to top, rgba(0,0,0,0.85) 0%, transparent 100%);
        height: 46px;
        padding: 0 8px;
        display: flex;
        align-items: center;
      }
      .video-js .vjs-play-progress,
      .video-js .vjs-volume-level { background: #7F77DD; }
      .video-js .vjs-play-progress:before { color: #9D97E8; }
      .video-js .vjs-slider { background: rgba(255,255,255,0.18); border-radius: 2px; }
      .video-js .vjs-load-progress { background: rgba(255,255,255,0.12); }
      .video-js .vjs-progress-holder { height: 4px; border-radius: 2px; }
      .video-js:hover .vjs-progress-holder { height: 6px; }
      .video-js .vjs-big-play-button {
        background: rgba(127,119,221,0.8);
        border: none;
        border-radius: 50%;
        width: 68px;
        height: 68px;
        line-height: 68px;
        font-size: 28px;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        margin: 0;
        box-shadow: 0 4px 24px rgba(127,119,221,0.5);
        transition: background 0.2s, transform 0.15s, box-shadow 0.2s;
      }
      .video-js:hover .vjs-big-play-button {
        background: #7F77DD;
        box-shadow: 0 6px 32px rgba(127,119,221,0.65);
        transform: translate(-50%, -50%) scale(1.06);
      }
      .video-js .vjs-time-control { display: flex; align-items: center; line-height: 1; }
      .video-js .vjs-current-time { display: flex; }
      .video-js .vjs-subs-caps-button { display: flex; }
      .video-js .vjs-button > .vjs-icon-placeholder:before { line-height: 46px; }
      .video-js .vjs-time-divider { display: flex; align-items: center; }
      /* Push error/no-source text below the overlaid top bar */
      .video-js .vjs-modal-dialog,
      .video-js .vjs-error-display {
        padding-top: 70px;
        font-size: 13px;
        color: rgba(255,255,255,0.35);
      }
      .video-js .vjs-error-display:before { display: none; }
    `;
    document.head.appendChild(style);
    return () => style.remove();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", background: "#000", overflow: "hidden" }}
    />
  );
}
