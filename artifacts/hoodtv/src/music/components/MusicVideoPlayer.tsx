import { useRef, useState, useEffect, useCallback } from "react";
import { Play, Pause, Volume2, VolumeX, Maximize, Minimize } from "lucide-react";

interface Props {
  videoId: string;
  title?: string;
}

function fmt(s: number) {
  if (!isFinite(s) || isNaN(s)) return "0:00";
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

export function MusicVideoPlayer({ videoId, title }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeking, setSeeking] = useState(false);

  const src = `/api/yt/video/stream?videoId=${videoId}`;

  const resetHideTimer = useCallback(() => {
    setShowControls(true);
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    hideTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 3000);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play().catch(() => {}); }
    else { v.pause(); }
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = !v.muted;
    setMuted(v.muted);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const el = containerRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
        setFullscreen(true);
      } else {
        await document.exitFullscreen();
        setFullscreen(false);
      }
    } catch {}
  }, []);

  const seekTo = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    const bar = progressRef.current;
    if (!v || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    v.currentTime = pct * duration;
    setSeeking(false);
  }, [duration]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onTime = () => setCurrentTime(v.currentTime);
    const onDuration = () => setDuration(isFinite(v.duration) ? v.duration : 0);
    const onWaiting = () => setLoading(true);
    const onCanPlay = () => { setLoading(false); setError(null); };
    const onProgress = () => {
      if (v.buffered.length > 0) setBuffered(v.buffered.end(v.buffered.length - 1));
    };
    const onError = () => setError("Failed to load video stream.");
    const onFullscreenChange = () => setFullscreen(!!document.fullscreenElement);

    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("durationchange", onDuration);
    v.addEventListener("waiting", onWaiting);
    v.addEventListener("canplay", onCanPlay);
    v.addEventListener("progress", onProgress);
    v.addEventListener("error", onError);
    document.addEventListener("fullscreenchange", onFullscreenChange);

    return () => {
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("durationchange", onDuration);
      v.removeEventListener("waiting", onWaiting);
      v.removeEventListener("canplay", onCanPlay);
      v.removeEventListener("progress", onProgress);
      v.removeEventListener("error", onError);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
    };
  }, [videoId]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space") { e.preventDefault(); togglePlay(); }
      if (e.code === "KeyF") toggleFullscreen();
      if (e.code === "KeyM") toggleMute();
      if (e.code === "ArrowLeft") { if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10); }
      if (e.code === "ArrowRight") { if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, toggleFullscreen, toggleMute, duration]);

  const pct = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufPct = duration > 0 ? (buffered / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      onMouseMove={resetHideTimer}
      onMouseLeave={() => setShowControls(false)}
      onClick={togglePlay}
      style={{
        position: "relative",
        background: "#000",
        borderRadius: 16,
        overflow: "hidden",
        cursor: showControls ? "default" : "none",
        userSelect: "none",
      }}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        playsInline
        style={{ width: "100%", display: "block", maxHeight: "72vh", background: "#000" }}
        title={title}
      />

      {/* Spinner */}
      {loading && !error && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <div style={{
            width: 52, height: 52, borderRadius: "50%",
            border: "3px solid rgba(255,255,255,0.08)",
            borderTopColor: "#7F77DD",
            animation: "mv-spin 0.8s linear infinite",
          }} />
        </div>
      )}

      {/* Error state */}
      {error && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.85)",
          color: "#888", fontSize: 15, gap: 12,
        }}>
          <div style={{ fontSize: 32 }}>⚠</div>
          <div>{error}</div>
          <div style={{ fontSize: 13, color: "#555" }}>Stream may be unavailable for this video</div>
        </div>
      )}

      {/* Big play icon in centre when paused */}
      {!playing && !loading && !error && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{
            width: 72, height: 72, borderRadius: "50%",
            background: "rgba(127,119,221,0.85)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 0 40px rgba(127,119,221,0.5)",
          }}>
            <Play size={32} color="#fff" fill="#fff" style={{ marginLeft: 4 }} />
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", bottom: 0, left: 0, right: 0,
          background: "linear-gradient(to top, rgba(0,0,0,0.92) 0%, rgba(0,0,0,0.4) 60%, transparent 100%)",
          padding: "48px 20px 18px",
          opacity: showControls ? 1 : 0,
          transition: "opacity 0.25s ease",
          pointerEvents: showControls ? "auto" : "none",
        }}
      >
        {/* Progress bar */}
        <div
          ref={progressRef}
          onClick={seekTo}
          onMouseDown={() => setSeeking(true)}
          style={{
            position: "relative", height: seeking ? 6 : 4, borderRadius: 3,
            background: "rgba(255,255,255,0.18)", marginBottom: 14, cursor: "pointer",
            transition: "height 0.15s ease",
          }}
        >
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${bufPct}%`, background: "rgba(255,255,255,0.25)", borderRadius: 3,
          }} />
          <div style={{
            position: "absolute", left: 0, top: 0, bottom: 0,
            width: `${pct}%`, background: "#7F77DD", borderRadius: 3,
            transition: seeking ? "none" : "width 0.1s linear",
          }}>
            <div style={{
              position: "absolute", right: -7, top: "50%", transform: "translateY(-50%)",
              width: 14, height: 14, borderRadius: "50%",
              background: "#c0bdf5", boxShadow: "0 0 10px rgba(127,119,221,0.9)",
              opacity: showControls ? 1 : 0, transition: "opacity 0.2s",
            }} />
          </div>
        </div>

        {/* Buttons row */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={togglePlay}
            style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", padding: "4px 8px", display: "flex", alignItems: "center", borderRadius: 6 }}
          >
            {playing
              ? <Pause size={22} fill="#fff" />
              : <Play size={22} fill="#fff" style={{ marginLeft: 2 }} />}
          </button>

          <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 13, fontFamily: "monospace", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>
            {fmt(currentTime)} / {fmt(duration)}
          </span>

          <div style={{ flex: 1 }} />

          {/* Volume */}
          <button
            onClick={toggleMute}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", borderRadius: 6 }}
          >
            {muted || volume === 0 ? <VolumeX size={18} /> : <Volume2 size={18} />}
          </button>

          <input
            type="range" min={0} max={1} step={0.02} value={muted ? 0 : volume}
            onChange={(e) => {
              const v = videoRef.current;
              if (!v) return;
              const val = parseFloat(e.target.value);
              v.volume = val;
              v.muted = val === 0;
              setVolume(val);
              setMuted(val === 0);
            }}
            style={{ width: 80, accentColor: "#7F77DD", cursor: "pointer" }}
          />

          <button
            onClick={toggleFullscreen}
            style={{ background: "none", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", padding: 4, display: "flex", alignItems: "center", borderRadius: 6 }}
          >
            {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes mv-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
