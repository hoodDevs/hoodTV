import { useEffect, useRef, useState } from "react";
import Hls from "hls.js";

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

export function VideoPlayer({ src, poster, tracks = [], onReady, onError }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [muted, setMuted] = useState(true);
  const [showUnmute, setShowUnmute] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    let isActive = true;
    let recoveryAttempts = 0;
    const MAX_RECOVERY = 3;

    setError(null);
    setShowUnmute(false);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const startPlay = () => {
      if (!isActive) return;
      video.muted = true;
      const p = video.play();
      if (p) {
        p.then(() => {
          if (isActive) setShowUnmute(true);
        }).catch((err) => {
          console.warn("[HLS] play() blocked:", err?.message ?? err);
        });
      }
      onReady?.(video);
    };

    const handleFatalError = (detail: string) => {
      if (!isActive) return;
      setError(`Stream unavailable (${detail})`);
      onError?.(detail);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferSize: 60 * 1000 * 1000,
        startLevel: -1,
        abrEwmaDefaultEstimate: 1_500_000,
        fragLoadingMaxRetry: 6,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
        fragLoadingRetryDelay: 1000,
        manifestLoadingRetryDelay: 500,
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        console.log("[HLS] manifest parsed, levels:", hls.levels.length);
        startPlay();
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!isActive) return;
        if (!data.fatal) return;

        recoveryAttempts++;
        if (recoveryAttempts > MAX_RECOVERY) {
          console.error("[HLS] max recovery attempts reached:", data.details);
          handleFatalError(data.details);
          return;
        }

        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            console.warn("[HLS] fatal network error, trying startLoad:", data.details);
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            console.warn("[HLS] fatal media error, trying recoverMediaError:", data.details);
            hls.recoverMediaError();
            break;
          default:
            console.error("[HLS] unrecoverable error:", data.details);
            handleFatalError(data.details);
            break;
        }
      });

      hls.loadSource(src);
      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.addEventListener("loadedmetadata", startPlay, { once: true });
      video.addEventListener("error", () => {
        if (!isActive) return;
        const code = video.error?.code ?? "unknown";
        handleFatalError(String(code));
      }, { once: true });
    } else {
      handleFatalError("unsupported");
    }

    return () => {
      isActive = false;
      try { video.pause(); } catch {}
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      video.src = "";
    };
  }, [src]);

  const handleUnmute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = false;
    setMuted(false);
    setShowUnmute(false);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%", background: "#000" }}>
      <style>{`
        .hoodtv-player {
          width: 100%;
          height: 100%;
          background: #000;
          display: block;
        }
        .hoodtv-player::cue {
          background: rgba(0,0,0,0.75);
          color: #fff;
          font-size: 1.1em;
          font-family: 'DM Sans', sans-serif;
        }
        .unmute-btn:hover {
          background: rgba(127,119,221,0.9) !important;
          transform: scale(1.05);
        }
      `}</style>

      <video
        ref={videoRef}
        className="hoodtv-player"
        muted
        playsInline
        poster={poster}
        preload="none"
      >
        {tracks.map((t) => (
          <track key={t.url} kind="subtitles" src={t.url} srcLang={t.language} label={t.language} />
        ))}
      </video>

      {showUnmute && muted && (
        <button
          className="unmute-btn"
          onClick={handleUnmute}
          style={{
            position: "absolute",
            bottom: "80px",
            right: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 18px",
            borderRadius: "24px",
            background: "rgba(127,119,221,0.8)",
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
            border: "1px solid rgba(192,189,245,0.3)",
            color: "#fff",
            fontSize: "13px",
            fontWeight: 600,
            cursor: "pointer",
            fontFamily: "'DM Sans', sans-serif",
            transition: "all 0.2s",
            zIndex: 20,
            boxShadow: "0 4px 20px rgba(127,119,221,0.4)",
          }}
        >
          🔊 Tap to unmute
        </button>
      )}

      {error && (
        <div style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "rgba(0,0,0,0.75)",
          zIndex: 10,
        }}>
          <p style={{
            color: "rgba(255,255,255,0.55)",
            fontFamily: "'DM Sans', sans-serif",
            fontSize: "13px",
            textAlign: "center",
            padding: "0 24px",
          }}>
            {error}
          </p>
        </div>
      )}
    </div>
  );
}
