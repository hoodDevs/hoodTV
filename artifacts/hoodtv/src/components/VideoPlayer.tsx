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
  onError?: (code: number | string) => void;
}

export function VideoPlayer({ src, sourceType, poster, tracks = [], onReady, onError }: VideoPlayerProps) {
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
    if (!video || !src) return;

    let isActive = true;
    setError(null);
    setShowUnmute(false);

    if (!shaka.Player.isBrowserSupported()) {
      setError("Your browser does not support this player.");
      return;
    }

    const prevPlayer = playerRef.current;
    playerRef.current = null;

    async function run() {
      if (prevPlayer) {
        try { await prevPlayer.destroy(); } catch {}
      }
      if (!isActive) return;

      const player = new shaka.Player();
      playerRef.current = player;

      player.configure({
        mediaSource: {
          forceTransmux: true,
        },
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
          stallThreshold: 3,
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
            ignoreManifestProgramDateTime: true,
          },
        },
        abr: {
          enabled: true,
          defaultBandwidthEstimate: 1e6,
        },
      });

      player.addEventListener("error", (e: Event) => {
        if (!isActive) return;
        const err = (e as CustomEvent<shaka.util.Error>).detail;
        console.warn("[Shaka] error event", err?.code, err?.message);
        if (err?.severity === shaka.util.Error.Severity.CRITICAL) {
          setError(`Playback error (${err.code})`);
          onError?.(err.code);
        }
      });

      try {
        await player.attach(video!);
        if (!isActive) return;

        await player.load(src, null, "application/vnd.apple.mpegurl");
        if (!isActive) return;

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
        if (!isActive) return;
        const e = err as shaka.util.Error;
        const code = e?.code ?? "unknown";
        console.error("[Shaka] load failed:", code, e?.message, "data:", JSON.stringify(e?.data));
        if (code !== 7000) {
          setError(`Failed to load stream (${code})`);
          onError?.(code);
        }
      }
    }

    run();

    return () => {
      isActive = false;
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
      />

      {/* Unmute overlay */}
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

      {/* In-player error */}
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
