/**
 * MusicVideoPlayer — hoodTV custom player
 *
 * Plays YouTube music videos via the /api/yt/video/stream proxy (muxed MP4,
 * no YouTube branding, no iframes). Full custom controls overlay.
 */
import { useRef, useState, useEffect, useCallback } from "react";
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

function fmt(s: number) {
  if (!isFinite(s) || isNaN(s) || s < 0) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function MusicVideoPlayer({
  videoId, title, onPrev, onNext,
  hasPrev = false, hasNext = false,
  autoplayEnabled = true, onProgress,
}: Props) {
  const containerRef   = useRef<HTMLDivElement>(null);
  const videoRef       = useRef<HTMLVideoElement>(null);
  const progressRef    = useRef<HTMLDivElement>(null);
  const hideTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressIntRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onProgressRef  = useRef(onProgress);
  useEffect(() => { onProgressRef.current = onProgress; }, [onProgress]);

  const [playing,      setPlaying]      = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [volume,       setVolume]       = useState(1);
  const [muted,        setMuted]        = useState(false);
  const [fullscreen,   setFullscreen]   = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [seeking,      setSeeking]      = useState(false);
  const [buffering,    setBuffering]    = useState(true);
  const [playerError,  setPlayerError]  = useState(false);
  const [needsClick,   setNeedsClick]   = useState(false);
  const [playbackRate, setPlaybackRate] = useState<Speed>(1);

  const streamSrc = `/api/yt/video/stream?videoId=${videoId}`;

  // ── Wire up video events ───────────────────────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    // Reset state for new video
    setPlaying(false);
    setCurrentTime(0);
    setDuration(0);
    setBuffering(true);
    setPlayerError(false);
    setNeedsClick(false);
    if (progressIntRef.current) clearInterval(progressIntRef.current);

    v.load();

    const onLoadedMeta = () => {
      setDuration(v.duration || 0);
      setBuffering(false);
    };
    const onTimeUpdate = () => {
      setCurrentTime(v.currentTime);
    };
    const onPlaying = () => { setPlaying(true); setBuffering(false); setNeedsClick(false); };
    const onPause   = () => setPlaying(false);
    const onWaiting = () => setBuffering(true);
    const onCanPlay = () => setBuffering(false);
    const onEnded   = () => {
      setPlaying(false);
      if (autoplayEnabled && onNext) onNext();
    };
    const onError   = () => {
      setPlayerError(true);
      setBuffering(false);
    };
    const onDurationChange = () => {
      if (v.duration && isFinite(v.duration)) setDuration(v.duration);
    };

    v.addEventListener("loadedmetadata", onLoadedMeta);
    v.addEventListener("timeupdate",     onTimeUpdate);
    v.addEventListener("playing",        onPlaying);
    v.addEventListener("pause",          onPause);
    v.addEventListener("waiting",        onWaiting);
    v.addEventListener("canplay",        onCanPlay);
    v.addEventListener("ended",          onEnded);
    v.addEventListener("error",          onError);
    v.addEventListener("durationchange", onDurationChange);

    // Start autoplay
    v.play().catch(() => setNeedsClick(true));

    // Report progress every 5s
    progressIntRef.current = setInterval(() => {
      if (!v.paused && v.duration > 0 && onProgressRef.current) {
        onProgressRef.current(Math.min(100, (v.currentTime / v.duration) * 100), v.duration);
      }
    }, 5000);

    return () => {
      v.removeEventListener("loadedmetadata", onLoadedMeta);
      v.removeEventListener("timeupdate",     onTimeUpdate);
      v.removeEventListener("playing",        onPlaying);
      v.removeEventListener("pause",          onPause);
      v.removeEventListener("waiting",        onWaiting);
      v.removeEventListener("canplay",        onCanPlay);
      v.removeEventListener("ended",          onEnded);
      v.removeEventListener("error",          onError);
      v.removeEventListener("durationchange", onDurationChange);
      if (progressIntRef.current) clearInterval(progressIntRef.current);
    };
  }, [videoId]);

  // ── Fullscreen listener ────────────────────────────────────────────────────
  useEffect(() => {
    const onFS = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFS);
    return () => document.removeEventListener("fullscreenchange", onFS);
  }, []);

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const v = videoRef.current;
      if (!v) return;
      if (e.code === "Space") { e.preventDefault(); v.paused ? v.play() : v.pause(); }
      if (e.code === "KeyF") toggleFullscreen();
      if (e.code === "KeyM") { v.muted = !v.muted; setMuted(v.muted); }
      if (e.code === "ArrowLeft")  { v.currentTime = Math.max(0, v.currentTime - 10); }
      if (e.code === "ArrowRight") { v.currentTime = Math.min(v.duration, v.currentTime + 10); }
      if (e.code === "KeyN" && onNext) onNext();
      if (e.code === "KeyP" && onPrev) onPrev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // ── Controls auto-hide ─────────────────────────────────────────────────────
  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => setShowControls(false), 3200);
  }, []);

  // ── Actions ────────────────────────────────────────────────────────────────
  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play().catch(() => {});
    else v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const cycleSpeed = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const idx  = SPEEDS.indexOf(playbackRate);
    const next = SPEEDS[(idx + 1) % SPEEDS.length];
    v.playbackRate = next;
    setPlaybackRate(next);
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
    const v   = videoRef.current;
    if (!bar || !v || !v.duration) return;
    const rect = bar.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * v.duration;
    setSeeking(false);
  }, []);

  const startPlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = false;
    try { await v.play(); setMuted(false); setNeedsClick(false); }
    catch {
      v.muted = true;
      try { await v.play(); setMuted(true); setNeedsClick(false); }
      catch { setNeedsClick(true); }
    }
  }, []);

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
      {/* Native video element — no YouTube iframe */}
      <video
        ref={videoRef}
        src={streamSrc}
        preload="auto"
        playsInline
        style={{
          position: "absolute", inset: 0,
          width: "100%", height: "100%",
          objectFit: "contain", background: "#000",
          display: "block",
        }}
      />

      {/* Invisible click-shield (prevents native controls from showing) */}
      <div
        style={{ position: "absolute", inset: 0, zIndex: 1, cursor: showControls ? "default" : "none" }}
        onClick={togglePlay}
        onMouseMove={resetHideTimer}
      />

      {/* Buffering spinner */}
      {buffering && !playerError && !needsClick && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 2,
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          gap: 16, background: "rgba(5,5,12,0.7)",
          pointerEvents: "none",
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            border: "3px solid rgba(127,119,221,0.18)",
            borderTopColor: "#7F77DD",
            animation: "mv-spin 0.75s linear infinite",
          }} />
          <span style={{ color: "rgba(192,189,245,0.55)", fontSize: 13, letterSpacing: "0.06em" }}>
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
          <div style={{ color: "rgba(255,255,255,0.45)", fontSize: 14, textAlign: "center" }}>
            This video isn't available for direct playback
          </div>
        </div>
      )}

      {/* Click-to-play overlay */}
      {needsClick && !playerError && (
        <div
          style={{
            position: "absolute", inset: 0, zIndex: 4,
            display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center",
            gap: 14, background: "rgba(5,5,12,0.65)", cursor: "pointer",
          }}
          onClick={(e) => { e.stopPropagation(); startPlay(); }}
        >
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "rgba(127,119,221,0.9)", backdropFilter: "blur(10px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 60px rgba(127,119,221,0.55)",
          }}>
            <Play size={36} color="#fff" fill="#fff" style={{ marginLeft: 6 }} />
          </div>
          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 14 }}>Tap to play</span>
        </div>
      )}

      {/* Big play icon when paused and ready */}
      {!playing && !buffering && !playerError && !needsClick && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 2,
          display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{
            width: 80, height: 80, borderRadius: "50%",
            background: "rgba(127,119,221,0.82)", backdropFilter: "blur(10px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 60px rgba(127,119,221,0.55), 0 0 120px rgba(127,119,221,0.2)",
          }}>
            <Play size={36} color="#fff" fill="#fff" style={{ marginLeft: 6 }} />
          </div>
        </div>
      )}

      {/* Unmute button */}
      {muted && !needsClick && !playerError && playing && (
        <button
          style={{
            position: "absolute", bottom: 72, right: 18, zIndex: 5,
            display: "flex", alignItems: "center", gap: 8,
            padding: "10px 18px", borderRadius: 24,
            background: "rgba(127,119,221,0.88)", backdropFilter: "blur(12px)",
            border: "1px solid rgba(192,189,245,0.3)", color: "#fff",
            fontSize: 13, fontWeight: 600, fontFamily: "'DM Sans', sans-serif",
            cursor: "pointer", boxShadow: "0 4px 20px rgba(127,119,221,0.4)",
          }}
          onClick={(e) => { e.stopPropagation(); toggleMute(); }}
        >
          <VolumeX size={16} />
          Tap to unmute
        </button>
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
            onClick={(e) => { e.stopPropagation(); togglePlay(); }}
            style={{
              background: "none", border: "none", color: "#fff",
              cursor: "pointer", padding: "4px 6px",
              display: "flex", alignItems: "center", borderRadius: 6,
            }}
          >
            {playing
              ? <Pause size={22} fill="#fff" />
              : <Play  size={22} fill="#fff" style={{ marginLeft: 2 }} />}
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
            onClick={(e) => { e.stopPropagation(); toggleMute(); }}
            style={{
              background: "none", border: "none",
              color: "rgba(255,255,255,0.75)", cursor: "pointer",
              padding: 4, display: "flex", alignItems: "center", borderRadius: 6,
            }}
          >
            {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
          </button>

          <input
            type="range" min={0} max={1} step={0.01}
            value={muted ? 0 : volume}
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => {
              const v   = videoRef.current;
              const val = parseFloat(e.target.value);
              if (!v) return;
              v.volume = val;
              v.muted  = val === 0;
              setVolume(val);
              setMuted(val === 0);
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
            onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }}
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
      `}</style>
    </div>
  );
}
