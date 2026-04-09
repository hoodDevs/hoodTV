import { useEffect, useRef, useState } from "react";
import shaka from "shaka-player";

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
}

export function VideoPlayer({ src, sourceType, poster, tracks = [], onReady }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const playerRef = useRef<shaka.Player | null>(null);
  const [muted, setMuted] = useState(true);
  const [showUnmute, setShowUnmute] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    shaka.polyfill.installAll();

    const MEDIA_ABORT_MSG = "fetching process for the media resource was aborted";

    const suppressWindowError = (e: ErrorEvent) => {
      if (e.message?.includes(MEDIA_ABORT_MSG)) {
        e.preventDefault();
        e.stopImmediatePropagation();
      }
    };
    const suppressUnhandled = (e: PromiseRejectionEvent) => {
      const msg = e.reason?.message ?? String(e.reason ?? "");
      if (msg.includes(MEDIA_ABORT_MSG) || msg.includes("MEDIA_ELEMENT_ERROR")) {
        e.preventDefault();
      }
    };

    window.addEventListener("error", suppressWindowError, true);
    window.addEventListener("unhandledrejection", suppressUnhandled, true);
    return () => {
      window.removeEventListener("error", suppressWindowError, true);
      window.removeEventListener("unhandledrejection", suppressUnhandled, true);
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setError(null);
    setShowUnmute(false);

    if (!shaka.Player.isBrowserSupported()) {
      setError("Your browser does not support this player.");
      return;
    }

    const suppressMediaError = (e: Event) => e.stopImmediatePropagation();
    video.addEventListener("error", suppressMediaError, true);

    const player = new shaka.Player();
    playerRef.current = player;

    player.configure({
      streaming: {
        bufferingGoal: 60,
        rebufferingGoal: 2,
        bufferBehind: 30,
        retryParameters: {
          maxAttempts: 5,
          baseDelay: 1000,
          backoffFactor: 1.5,
          fuzzFactor: 0.5,
          timeout: 30000,
        },
        stallEnabled: true,
        stallThreshold: 1,
        stallSkip: 0.1,
      },
      manifest: {
        retryParameters: {
          maxAttempts: 4,
          baseDelay: 500,
          backoffFactor: 2,
          fuzzFactor: 0.5,
          timeout: 20000,
        },
        hls: {
          useSafeSeekOffset: true,
          ignoreManifestProgramDateTime: false,
        },
      },
      abr: {
        enabled: true,
        defaultBandwidthEstimate: 1e6,
      },
    });

    player.addEventListener("error", (e: Event) => {
      const err = (e as CustomEvent<shaka.util.Error>).detail;
      console.warn("[Shaka] error", err?.code, err?.message);
      if (err?.severity === shaka.util.Error.Severity.CRITICAL) {
        setError(`Playback error (${err.code})`);
      }
    });

    async function load() {
      try {
        await player.attach(video!);
        await player.load(src);
        console.log("[Shaka] loaded:", src.slice(0, 80));
        video!.muted = true;
        const p = video!.play();
        if (p) {
          p.then(() => setShowUnmute(true)).catch((err) => {
            console.warn("[Shaka] play() blocked:", err?.message ?? err);
          });
        }
        onReady?.(video!);
      } catch (err: unknown) {
        const e = err as shaka.util.Error;
        console.error("[Shaka] load failed:", e.code, e.message);
        if (e.code !== 7000) {
          setError(`Failed to load stream (${e.code ?? "unknown"})`);
        }
      }
    }

    load();

    return () => {
      video.removeEventListener("error", suppressMediaError, true);
      try { video.pause(); } catch {}
      playerRef.current?.destroy().catch(() => {});
      playerRef.current = null;
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
          font-family: 'DM Sans', sans-serif;
        }
        .hoodtv-unmute-btn {
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 14px 28px;
          background: rgba(127,119,221,0.92);
          color: #fff;
          border: none;
          border-radius: 14px;
          font-size: 15px;
          font-weight: 600;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          z-index: 10;
          backdrop-filter: blur(8px);
          box-shadow: 0 8px 40px rgba(127,119,221,0.5);
          transition: background 0.2s, transform 0.15s;
          animation: fadeInScale 0.3s ease;
          white-space: nowrap;
        }
        .hoodtv-unmute-btn:hover {
          background: rgba(157,151,232,0.95);
          transform: translate(-50%, -50%) scale(1.04);
        }
        @keyframes fadeInScale {
          from { opacity: 0; transform: translate(-50%, -50%) scale(0.88); }
          to   { opacity: 1; transform: translate(-50%, -50%) scale(1); }
        }
        .hoodtv-err {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #050508;
          color: rgba(255,255,255,0.45);
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          text-align: center;
          padding: 20px;
          z-index: 20;
        }
      `}</style>

      <video
        ref={videoRef}
        className="hoodtv-player"
        poster={poster}
        controls
        playsInline
        muted={muted}
      >
        {tracks.map((t) => (
          <track
            key={t.language}
            kind="subtitles"
            src={t.url}
            srcLang={t.language.slice(0, 2).toLowerCase()}
            label={t.language}
          />
        ))}
      </video>

      {showUnmute && (
        <button className="hoodtv-unmute-btn" onClick={handleUnmute}>
          🔊 Tap to unmute
        </button>
      )}

      {error && (
        <div className="hoodtv-err">{error}</div>
      )}
    </div>
  );
}
