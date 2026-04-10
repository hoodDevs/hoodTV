/**
 * MusicVideoPlayer — hoodTV themed video player
 *
 * Uses the YouTube IFrame Player API for reliable video streaming, with a
 * fully custom themed control overlay. YouTube controls are hidden; all
 * interaction goes through our own UI.
 */
import { useRef, useState, useEffect, useCallback, useId } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipBack, SkipForward,
} from "lucide-react";

const SPEEDS = [0.75, 1, 1.25, 1.5, 2] as const;
type Speed = typeof SPEEDS[number];

interface Props {
  videoId: string;
  title?: string;
  onPrev?: () => void;
  onNext?: () => void;
  hasPrev?: boolean;
  hasNext?: boolean;
  autoplayEnabled?: boolean;
  onProgress?: (pct: number, duration: number) => void;
}

declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

function fmt(s: number) {
  if (!isFinite(s) || isNaN(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

let ytApiCallbacks: Array<() => void> = [];
let ytApiScriptAdded = false;

function loadYtApi(): Promise<void> {
  return new Promise((resolve) => {
    // Already ready — resolve immediately
    if (window.YT?.Player) { resolve(); return; }

    ytApiCallbacks.push(resolve);

    // Script is already in the DOM (e.g. after HMR) — poll until YT is ready
    if (ytApiScriptAdded || document.getElementById("yt-iframe-api")) {
      ytApiScriptAdded = true;
      const poll = setInterval(() => {
        if (window.YT?.Player) {
          clearInterval(poll);
          const cbs = ytApiCallbacks.splice(0);
          cbs.forEach((cb) => cb());
        }
      }, 100);
      return;
    }

    // First load — inject script and hook the global callback
    ytApiScriptAdded = true;
    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (prevReady) prevReady();
      const cbs = ytApiCallbacks.splice(0);
      cbs.forEach((cb) => cb());
    };
    const tag = document.createElement("script");
    tag.id = "yt-iframe-api";
    tag.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(tag);
  });
}

export function MusicVideoPlayer({ videoId, title, onPrev, onNext, hasPrev = false, hasNext = false, autoplayEnabled = true, onProgress }: Props) {
  const uid = useId().replace(/:/g, "");
  const iframeContainerId = `ytplayer-${uid}`;

  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const rafRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onProgressRef = useRef(onProgress);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(80);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [seeking, setSeeking] = useState(false);
  const [playerError, setPlayerError] = useState(false);
  const [playbackRate, setPlaybackRate] = useState<Speed>(1);

  // Tick: update current time via RAF
  const startTick = useCallback(() => {
    const tick = () => {
      const p = playerRef.current;
      if (p?.getCurrentTime) {
        const ct = p.getCurrentTime() || 0;
        setCurrentTime(ct);
        if (!duration) {
          const d = p.getDuration?.() || 0;
          if (d > 0) setDuration(d);
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(tick);

    // Report progress every 5 seconds while playing
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    progressIntervalRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime || !onProgressRef.current) return;
      const ct = p.getCurrentTime() || 0;
      const d = p.getDuration?.() || 0;
      if (d > 0) onProgressRef.current(Math.min(100, (ct / d) * 100), d);
    }, 5000);
  }, [duration]);

  const stopTick = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (progressIntervalRef.current) { clearInterval(progressIntervalRef.current); progressIntervalRef.current = null; }
  }, []);

  // Initialise / re-initialise player when videoId changes
  useEffect(() => {
    let destroyed = false;
    setReady(false);
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setPlayerError(false);
    stopTick();

    loadYtApi().then(() => {
      if (destroyed) return;
      if (playerRef.current) {
        try { playerRef.current.destroy(); } catch {}
        playerRef.current = null;
      }

      playerRef.current = new window.YT.Player(iframeContainerId, {
        videoId,
        height: "100%",
        width: "100%",
        playerVars: {
          controls: 0,
          disablekb: 1,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          iv_load_policy: 3,
          cc_load_policy: 0,
          playsinline: 1,
          autoplay: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: (e: any) => {
            if (destroyed) return;
            const d = e.target.getDuration?.() || 0;
            setDuration(d > 0 ? d : 0);
            setVolume(e.target.getVolume?.() ?? 80);
            setMuted(e.target.isMuted?.() ?? false);
            setReady(true);
          },
          onStateChange: (e: any) => {
            if (destroyed) return;
            // -1=unstarted, 0=ended, 1=playing, 2=paused, 3=buffering, 5=cued
            const s = e.data;
            if (s === 1) { setPlaying(true); startTick(); }
            else if (s === 2) { setPlaying(false); stopTick(); }
            else if (s === 0) {
              setPlaying(false); stopTick();
              if (autoplayEnabled && onNext) onNext();
            }
            if (s === 1 || s === 3) {
              const dur = e.target.getDuration?.() || 0;
              if (dur > 0) setDuration(dur);
            }
          },
          onError: () => {
            if (destroyed) return;
            setPlayerError(true);
          },
        },
      });
    });

    return () => {
      destroyed = true;
      stopTick();
    };
  }, [videoId]);

  // Fullscreen change listener
  useEffect(() => {
    const onFS = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFS);
    return () => document.removeEventListener("fullscreenchange", onFS);
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const p = playerRef.current;
      if (!p) return;
      if (e.code === "Space") { e.preventDefault(); playing ? p.pauseVideo() : p.playVideo(); }
      if (e.code === "KeyF") toggleFullscreen();
      if (e.code === "KeyM") toggleMute();
      if (e.code === "ArrowLeft") p.seekTo(Math.max(0, (p.getCurrentTime?.() || 0) - 10), true);
      if (e.code === "ArrowRight") p.seekTo(Math.min(duration, (p.getCurrentTime?.() || 0) + 10), true);
      if (e.code === "KeyN" && onNext) onNext();
      if (e.code === "KeyP" && onPrev) onPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [playing, duration]);

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3200);
  }, []);

  const togglePlay = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (playing) p.pauseVideo();
    else p.playVideo();
  }, [playing]);

  const toggleMute = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (muted) { p.unMute(); setMuted(false); }
    else { p.mute(); setMuted(true); }
  }, [muted]);

  const cycleSpeed = useCallback(() => {
    const idx = SPEEDS.indexOf(playbackRate);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    setPlaybackRate(next);
    playerRef.current?.setPlaybackRate?.(next);
  }, [playbackRate]);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) await el.requestFullscreen();
      else await document.exitFullscreen();
    } catch {}
  }, []);

  const seekTo = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const bar = progressRef.current;
    const p = playerRef.current;
    if (!bar || !p || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    p.seekTo(pct * duration, true);
    setSeeking(false);
  }, [duration]);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => !fullscreen && setShowControls(false)}
      onClick={togglePlay}
      style={{
        position: "relative",
        background: "#000",
        borderRadius: 16,
        overflow: "hidden",
        aspectRatio: "16/9",
        width: "100%",
        cursor: showControls ? "default" : "none",
        userSelect: "none",
        boxShadow: "0 0 0 1px rgba(127,119,221,0.15), 0 20px 60px rgba(0,0,0,0.8)",
      }}
    >
      {/* YouTube iframe container — placed here; YT API replaces this div */}
      <div
        id={iframeContainerId}
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          pointerEvents: "none",
        }}
      />

      {/* Invisible click-shield over the iframe (prevents default YT click behaviour) */}
      <div
        style={{
          position: "absolute", inset: 0,
          zIndex: 1, cursor: showControls ? "default" : "none",
        }}
        onClick={togglePlay}
        onMouseMove={resetHideTimer}
      />

      {/* Loading spinner */}
      {!ready && !playerError && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 2,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 16, background: "rgba(5,5,12,0.9)",
          pointerEvents: "none",
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            border: "3px solid rgba(127,119,221,0.18)",
            borderTopColor: "#7F77DD",
            animation: "mv-spin 0.75s linear infinite",
          }} />
          <span style={{
            color: "rgba(192,189,245,0.55)", fontSize: 13,
            letterSpacing: "0.06em", fontFamily: "DM Sans, sans-serif",
          }}>
            Loading…
          </span>
        </div>
      )}

      {/* Error state */}
      {playerError && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 2,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            background: "#05050c", gap: 18,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div style={{
            width: 56, height: 56, borderRadius: "50%",
            background: "rgba(127,119,221,0.1)",
            border: "1px solid rgba(127,119,221,0.25)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 24, opacity: 0.8,
          }}>⚠</div>
          <div style={{
            color: "rgba(255,255,255,0.45)", fontSize: 14,
            fontFamily: "DM Sans, sans-serif", textAlign: "center",
          }}>
            This video isn't available for playback
          </div>
        </div>
      )}

      {/* Big play icon when paused */}
      {ready && !playing && !playerError && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 2,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "rgba(127,119,221,0.82)",
            backdropFilter: "blur(10px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 60px rgba(127,119,221,0.55), 0 0 120px rgba(127,119,221,0.2)",
          }}>
            <Play size={36} color="#fff" fill="#fff" style={{ marginLeft: 6 }} />
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          zIndex: 3,
          background: "linear-gradient(to top, rgba(5,5,12,0.98) 0%, rgba(5,5,12,0.6) 55%, transparent 100%)",
          padding: "60px 20px 20px",
          opacity: showControls && !playerError ? 1 : 0,
          transition: "opacity 0.25s ease",
          pointerEvents: showControls && !playerError ? "auto" : "none",
        }}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          onClick={seekTo}
          onMouseDown={() => setSeeking(true)}
          onMouseUp={() => setSeeking(false)}
          style={{
            position: "relative",
            height: seeking ? 6 : 4,
            borderRadius: 4,
            background: "rgba(255,255,255,0.12)",
            marginBottom: 14,
            cursor: "pointer",
            transition: "height 0.15s ease",
          }}
        >
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${pct}%`,
            background: "linear-gradient(90deg, #7F77DD 0%, #c0bdf5 100%)",
            borderRadius: 4,
            transition: seeking ? "none" : "width 0.1s linear",
          }}>
            <div style={{
              position: "absolute", right: -8, top: "50%",
              transform: "translateY(-50%)",
              width: 17, height: 17, borderRadius: "50%",
              background: "#c0bdf5",
              boxShadow: "0 0 14px rgba(127,119,221,1), 0 0 30px rgba(127,119,221,0.4)",
            }} />
          </div>
        </div>

        {/* Controls row */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Prev */}
          <button
            onClick={(e) => { e.stopPropagation(); onPrev?.(); }}
            disabled={!hasPrev}
            title="Previous (P)"
            style={{
              background: "none", border: "none",
              color: hasPrev ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)",
              cursor: hasPrev ? "pointer" : "not-allowed",
              padding: "4px 5px", display: "flex", alignItems: "center", borderRadius: 6,
              transition: "color 0.15s",
            }}
          >
            <SkipBack size={20} fill={hasPrev ? "currentColor" : "none"} />
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            style={{
              background: "none", border: "none", color: "#fff",
              cursor: "pointer", padding: "4px 6px",
              display: "flex", alignItems: "center", borderRadius: 6,
            }}
          >
            {playing ? <Pause size={22} fill="#fff" /> : <Play size={22} fill="#fff" style={{ marginLeft: 2 }} />}
          </button>

          {/* Next */}
          <button
            onClick={(e) => { e.stopPropagation(); onNext?.(); }}
            disabled={!hasNext}
            title="Next (N)"
            style={{
              background: "none", border: "none",
              color: hasNext ? "rgba(255,255,255,0.8)" : "rgba(255,255,255,0.2)",
              cursor: hasNext ? "pointer" : "not-allowed",
              padding: "4px 5px", display: "flex", alignItems: "center", borderRadius: 6,
              transition: "color 0.15s",
            }}
          >
            <SkipForward size={20} fill={hasNext ? "currentColor" : "none"} />
          </button>

          <span style={{
            color: "rgba(255,255,255,0.6)", fontSize: 12,
            fontFamily: "monospace", letterSpacing: "0.05em", whiteSpace: "nowrap",
          }}>
            {fmt(currentTime)} / {fmt(duration)}
          </span>

          <div style={{ flex: 1 }} />

          <button
            onClick={toggleMute}
            style={{
              background: "none", border: "none",
              color: "rgba(255,255,255,0.75)", cursor: "pointer",
              padding: 4, display: "flex", alignItems: "center", borderRadius: 6,
            }}
          >
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>
          <input
            type="range" min={0} max={100} step={1}
            value={muted ? 0 : volume}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              const p = playerRef.current;
              if (!p) return;
              p.setVolume(val);
              if (val === 0) { p.mute(); setMuted(true); }
              else if (muted) { p.unMute(); setMuted(false); }
              setVolume(val);
            }}
            style={{ width: 80, accentColor: "#7F77DD", cursor: "pointer" }}
          />

          <button
            onClick={(e) => { e.stopPropagation(); cycleSpeed(); }}
            title="Playback speed"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: playbackRate !== 1 ? "#c0bdf5" : "rgba(255,255,255,0.75)",
              cursor: "pointer",
              padding: "2px 8px", borderRadius: 6,
              fontSize: 12, fontWeight: 700, fontFamily: "monospace",
              letterSpacing: "0.03em",
              transition: "color 0.15s, background 0.15s",
            }}
          >
            {playbackRate === 1 ? "1×" : `${playbackRate}×`}
          </button>

          <button
            onClick={toggleFullscreen}
            style={{
              background: "none", border: "none",
              color: "rgba(255,255,255,0.75)", cursor: "pointer",
              padding: 4, display: "flex", alignItems: "center", borderRadius: 6,
            }}
          >
            {fullscreen ? <Minimize size={19} /> : <Maximize size={19} />}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes mv-spin { to { transform: rotate(360deg); } }
        #${iframeContainerId} iframe {
          width: 100% !important;
          height: 100% !important;
          border: none !important;
        }
      `}</style>
    </div>
  );
}
