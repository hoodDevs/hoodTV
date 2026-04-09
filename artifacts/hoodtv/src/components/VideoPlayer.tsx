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

const PLAYER_CSS = `
  .hood-player-wrap {
    position: relative;
    width: 100%;
    height: 100%;
    background: #000;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .hood-video {
    width: 100%;
    height: 100%;
    object-fit: contain;
    display: block;
    background: #000;
  }

  /* Native controls baseline styled via accent color */
  .hood-video::-webkit-media-controls-panel {
    background: linear-gradient(to top, rgba(5,5,12,0.95) 0%, rgba(5,5,12,0.5) 100%);
  }
  .hood-video::-webkit-media-controls-play-button,
  .hood-video::-webkit-media-controls-mute-button,
  .hood-video::-webkit-media-controls-fullscreen-button {
    filter: hue-rotate(220deg) brightness(1.3);
  }

  .hood-unmute {
    position: absolute;
    bottom: 70px;
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
    animation: unmute-pop 0.3s cubic-bezier(0.34,1.56,0.64,1);
  }
  .hood-unmute:hover {
    background: rgba(157,151,232,0.9);
    transform: scale(1.04);
  }
  @keyframes unmute-pop {
    from { opacity: 0; transform: scale(0.8) translateY(8px); }
    to   { opacity: 1; transform: scale(1) translateY(0); }
  }

  .hood-quality-btn {
    position: absolute;
    top: 14px;
    right: 18px;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 6px 13px;
    border-radius: 18px;
    background: rgba(5,5,12,0.72);
    backdrop-filter: blur(12px);
    border: 1px solid rgba(127,119,221,0.28);
    color: rgba(192,189,245,0.9);
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    font-family: 'DM Sans', sans-serif;
    transition: all 0.18s;
    z-index: 9;
    letter-spacing: 0.04em;
  }
  .hood-quality-btn:hover {
    background: rgba(127,119,221,0.22);
    border-color: rgba(127,119,221,0.5);
    color: #c0bdf5;
  }

  .hood-quality-menu {
    position: absolute;
    top: 46px;
    right: 18px;
    background: rgba(8,8,18,0.97);
    backdrop-filter: blur(16px);
    border: 1px solid rgba(127,119,221,0.2);
    border-radius: 10px;
    overflow: hidden;
    z-index: 20;
    min-width: 110px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    animation: menu-drop 0.15s ease;
  }
  @keyframes menu-drop {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  .hood-quality-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 9px 14px;
    font-size: 12px;
    font-family: 'DM Sans', sans-serif;
    color: rgba(255,255,255,0.65);
    cursor: pointer;
    transition: all 0.12s;
    gap: 10px;
  }
  .hood-quality-item:hover {
    background: rgba(127,119,221,0.18);
    color: #c0bdf5;
  }
  .hood-quality-item.active {
    background: rgba(127,119,221,0.12);
    color: #c0bdf5;
  }
  .hood-quality-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #7F77DD;
    flex-shrink: 0;
  }

  .hood-buf-spinner {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 44px;
    height: 44px;
    margin: -22px 0 0 -22px;
    border-radius: 50%;
    border: 3px solid rgba(127,119,221,0.18);
    border-top: 3px solid #7F77DD;
    animation: hls-spin 0.8s linear infinite;
    pointer-events: none;
    z-index: 5;
  }
  @keyframes hls-spin {
    to { transform: rotate(360deg); }
  }
`;

export function VideoPlayer({ src, poster, tracks = [], onReady, onError }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [showUnmute, setShowUnmute] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const [buffering, setBuffering] = useState(true);
  const [levels, setLevels] = useState<{ height: number; bitrate: number }[]>([]);
  const [currentLevel, setCurrentLevel] = useState(-1);
  const [qualityOpen, setQualityOpen] = useState(false);
  const qualityRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setShowUnmute(false);
    setIsMuted(true);
    setBuffering(true);
    setLevels([]);
    setCurrentLevel(-1);
    setQualityOpen(false);

    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onCanPlay = () => setBuffering(false);

    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onCanPlay);

    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: false,
        lowLatencyMode: false,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        startLevel: -1,
        abrEwmaDefaultEstimate: 2_000_000,
        progressive: false,
        xhrSetup: (xhr: XMLHttpRequest) => {
          xhr.withCredentials = false;
        },
      });

      hlsRef.current = hls;

      hls.on(Hls.Events.MEDIA_ATTACHED, () => {
        hls.loadSource(src);
      });

      hls.on(Hls.Events.MANIFEST_PARSED, (_event, data) => {
        setLevels(data.levels.map((l) => ({ height: l.height, bitrate: l.bitrate })));
        setCurrentLevel(hls.currentLevel);
        video.muted = true;
        video.play().then(() => {
          setShowUnmute(true);
          onReady?.(video);
        }).catch(() => {});
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_event, data) => {
        setCurrentLevel(data.level);
      });

      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) {
          if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
            hls.startLoad();
          } else if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
            hls.recoverMediaError();
          } else {
            onError?.(data.type);
          }
        }
      });

      hls.attachMedia(video);
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      if (poster) video.poster = poster;
      video.muted = true;
      video.play().then(() => {
        setShowUnmute(true);
        setBuffering(false);
        onReady?.(video);
      }).catch(() => {});

      const onErr = () => onError?.(4);
      video.addEventListener("error", onErr);
      return () => {
        video.removeEventListener("error", onErr);
        video.removeEventListener("waiting", onWaiting);
        video.removeEventListener("playing", onPlaying);
        video.removeEventListener("canplay", onCanPlay);
      };
    } else {
      onError?.(4);
    }

    return () => {
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onCanPlay);
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [src]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (qualityRef.current && !qualityRef.current.contains(e.target as Node)) {
        setQualityOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleUnmute = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = false;
      video.volume = 1;
    }
    setIsMuted(false);
    setShowUnmute(false);
  };

  const setQuality = (level: number) => {
    if (hlsRef.current) {
      hlsRef.current.currentLevel = level;
      setCurrentLevel(level);
    }
    setQualityOpen(false);
  };

  const labelFor = (idx: number) => {
    if (idx === -1) return "Auto";
    const l = levels[idx];
    if (!l) return `Q${idx + 1}`;
    if (l.height >= 1080) return "1080p";
    if (l.height >= 720) return "720p";
    if (l.height >= 480) return "480p";
    if (l.height >= 360) return "360p";
    return `${l.height}p`;
  };

  const qualityOptions = [
    { level: -1, label: "Auto" },
    ...levels.map((_, i) => ({ level: i, label: labelFor(i) })),
  ];

  return (
    <div className="hood-player-wrap">
      <style>{PLAYER_CSS}</style>

      <video
        ref={videoRef}
        className="hood-video"
        controls
        playsInline
        muted
        poster={poster}
        crossOrigin="anonymous"
        preload="auto"
      >
        {tracks.map((t) => (
          <track
            key={t.language}
            kind="subtitles"
            src={t.url}
            srcLang={t.language}
            label={t.language}
          />
        ))}
      </video>

      {buffering && (
        <div className="hood-buf-spinner" />
      )}

      {showUnmute && isMuted && (
        <button className="hood-unmute" onClick={handleUnmute}>
          🔊 Tap to unmute
        </button>
      )}

      {levels.length > 1 && (
        <div ref={qualityRef} style={{ position: "absolute", top: 14, right: 18, zIndex: 10 }}>
          <button className="hood-quality-btn" onClick={() => setQualityOpen(o => !o)}>
            ▤ {labelFor(currentLevel)}
          </button>
          {qualityOpen && (
            <div className="hood-quality-menu">
              {qualityOptions.map(({ level, label }) => (
                <div
                  key={level}
                  className={`hood-quality-item${currentLevel === level ? " active" : ""}`}
                  onClick={() => setQuality(level)}
                >
                  <span>{label}</span>
                  {currentLevel === level && <span className="hood-quality-dot" />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
