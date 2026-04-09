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
}

export function VideoPlayer({ src, sourceType, poster, tracks = [], onReady }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [muted, setMuted] = useState(true);
  const [showUnmute, setShowUnmute] = useState(false);
  const [hlsError, setHlsError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    setHlsError(null);
    setShowUnmute(false);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const isHls = sourceType === "hls"
      || src.includes(".m3u8")
      || src.includes("/proxy/hls")
      || src.includes("mpegurl");

    console.log("[VideoPlayer] src=", src.slice(0, 80), "isHls=", isHls);

    const suppressMediaError = (e: Event) => {
      e.stopImmediatePropagation();
    };
    video.addEventListener("error", suppressMediaError, true);

    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: false,
        lowLatencyMode: false,
        backBufferLength: 30,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        startLevel: -1,
        fragLoadingTimeOut: 30000,
        manifestLoadingTimeOut: 20000,
        levelLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6,
        manifestLoadingMaxRetry: 4,
        levelLoadingMaxRetry: 4,
        fragLoadingRetryDelay: 1000,
        xhrSetup: (xhr) => {
          xhr.withCredentials = false;
        },
      });

      hls.loadSource(src);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_e, data) => {
        console.log("[HLS] manifest parsed, levels:", data.levels.length);
        video.muted = true;
        const p = video.play();
        if (p) {
          p.then(() => {
            setShowUnmute(true);
          }).catch((err) => {
            console.warn("[HLS] play() blocked by browser:", err?.message ?? err);
            setShowUnmute(false);
          });
        }
        onReady?.(video);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        console.warn("[HLS]", data.type, data.details, "fatal:", data.fatal);
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              hls.recoverMediaError();
              break;
            default:
              setHlsError(`Playback error: ${data.details}`);
              hls.destroy();
              break;
          }
        }
      });

      hlsRef.current = hls;

    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      video.muted = true;
      video.addEventListener("loadedmetadata", () => {
        video.play().then(() => setShowUnmute(true)).catch(() => {});
        onReady?.(video);
      }, { once: true });
    } else if (!isHls) {
      video.src = src;
      video.muted = true;
      video.play().then(() => setShowUnmute(true)).catch(() => {});
      onReady?.(video);
    } else {
      setHlsError("HLS playback is not supported in this browser.");
    }

    return () => {
      try { hlsRef.current?.destroy(); } catch {}
      hlsRef.current = null;
      video.removeEventListener("error", suppressMediaError, true);
      try {
        video.pause();
        video.removeAttribute("src");
        video.load();
      } catch {}
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

      {hlsError && (
        <div className="hoodtv-err">{hlsError}</div>
      )}
    </div>
  );
}
