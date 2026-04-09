import { useEffect, useRef, useState, useCallback } from "react";
import Hls from "hls.js";

export interface TrackOption {
  language: string;
  url: string;
}

interface Props {
  src: string;
  poster?: string;
  tracks?: TrackOption[];
  onReady?: (v: HTMLVideoElement) => void;
  onError?: (code: number | string) => void;
  sourceType?: string;
}

type Level = { height: number; bitrate: number };

/** Thin router — delegates to the correct player implementation. */
export function VideoPlayer(props: Props) {
  if (props.sourceType === "embed") {
    return (
      <div style={{ position: "relative", width: "100%", height: "100%", background: "#000" }}>
        <iframe
          src={props.src}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          allowFullScreen
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          referrerPolicy="no-referrer"
          title="Video player"
        />
      </div>
    );
  }
  return <HlsMp4Player {...props} />;
}

/** HLS + MP4 player — all hooks live here, never renders for embed sources. */
function HlsMp4Player({ src, poster, tracks = [], onReady, onError, sourceType }: Props) {
  const videoRef      = useRef<HTMLVideoElement>(null);
  const hlsRef        = useRef<Hls | null>(null);
  const wrapRef       = useRef<HTMLDivElement>(null);
  const netRetryRef   = useRef(0);
  const mediaRetryRef = useRef(0);

  const [muted,      setMuted]     = useState(true);
  const [buffering,  setBuffering] = useState(true);
  const [levels,     setLevels]    = useState<Level[]>([]);
  const [curLevel,   setCurLevel]  = useState(-1);
  const [qOpen,      setQOpen]     = useState(false);
  const [errMsg,     setErrMsg]    = useState("");
  const [needsClick, setNeedsClick] = useState(false);

  // ref callback: set muted=true immediately on DOM creation
  // (React's `muted` prop has a known bug and doesn't always apply to the DOM)
  const setVideoRef = useCallback((el: HTMLVideoElement | null) => {
    (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
    if (el) {
      el.muted  = true;
      el.setAttribute("muted", "");  // set HTML attribute too (Chrome autoplay policy checks this)
      el.volume = 1;
    }
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    hlsRef.current?.destroy();
    hlsRef.current = null;

    netRetryRef.current   = 0;
    mediaRetryRef.current = 0;
    setMuted(true);
    setBuffering(true);
    setLevels([]);
    setCurLevel(-1);
    setQOpen(false);
    setErrMsg("");
    setNeedsClick(false);

    video.muted  = true;
    video.volume = 1;

    const onWaiting = () => setBuffering(true);
    const onPlaying = () => setBuffering(false);
    const onCanPlay = () => setBuffering(false);
    video.addEventListener("waiting", onWaiting);
    video.addEventListener("playing", onPlaying);
    video.addEventListener("canplay", onCanPlay);

    // ── MP4 native path ──────────────────────────────────────────────────────
    if (sourceType === "mp4") {
      video.src = src;
      if (poster) video.poster = poster;
      const onVideoError = () => { setErrMsg("Stream unavailable"); onError?.(4); };
      video.addEventListener("error", onVideoError);

      video.play().catch(() => setNeedsClick(true));
      onReady?.(video);

      return () => {
        video.removeEventListener("waiting",  onWaiting);
        video.removeEventListener("playing",  onPlaying);
        video.removeEventListener("canplay",  onCanPlay);
        video.removeEventListener("error",    onVideoError);
        video.src = "";
      };
    }

    // ── HLS.js path ──────────────────────────────────────────────────────────
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker:           false,
        lowLatencyMode:         false,
        maxBufferLength:        30,
        maxMaxBufferLength:     60,
        startLevel:             -1,
        abrEwmaDefaultEstimate: 2_000_000,
        progressive:            false,
        fragLoadingTimeOut:     30_000,
        manifestLoadingTimeOut: 20_000,
        levelLoadingTimeOut:    20_000,
      });
      hlsRef.current = hls;

      hls.on(Hls.Events.MANIFEST_PARSED, (_e, d) => {
        console.log("[hoodTV] MANIFEST_PARSED levels:", d.levels.length, "src:", src.slice(0, 80));
        setLevels(d.levels.map((l) => ({ height: l.height, bitrate: l.bitrate })));
        setCurLevel(hls.currentLevel);

        // Attempt muted autoplay. Chrome always allows muted play.
        video.muted = true;
        video.play()
          .then(() => {
            console.log("[hoodTV] play() succeeded muted");
            setBuffering(false);
          })
          .catch((err) => {
            console.warn("[hoodTV] play() rejected:", err?.name, err?.message);
            setNeedsClick(true);
            setBuffering(false);
          });

        onReady?.(video);
      });

      hls.on(Hls.Events.LEVEL_SWITCHED, (_e, d) => setCurLevel(d.level));

      hls.on(Hls.Events.ERROR, (_e, d) => {
        console.error("[hoodTV] HLS error:", d.type, d.details, "fatal:", d.fatal, "src:", src.slice(0, 80));
        if (!d.fatal) return;
        if (d.type === Hls.ErrorTypes.NETWORK_ERROR) {
          if (netRetryRef.current < 3) {
            netRetryRef.current++;
            hls.startLoad();
          } else {
            hls.destroy();
            setErrMsg("Stream unavailable");
            onError?.(d.type);
          }
        } else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) {
          if (mediaRetryRef.current < 2) {
            mediaRetryRef.current++;
            hls.recoverMediaError();
          } else {
            hls.destroy();
            setErrMsg("Stream unavailable");
            onError?.(d.type);
          }
        } else {
          setErrMsg("Stream unavailable");
          onError?.(d.type);
        }
      });

      hls.on(Hls.Events.MEDIA_ATTACHED, () => hls.loadSource(src));
      hls.attachMedia(video);

    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari native HLS
      video.src = src;
      if (poster) video.poster = poster;
      video.play().catch(() => setNeedsClick(true));
      video.addEventListener("error", () => { setErrMsg("Stream unavailable"); onError?.(4); });
      onReady?.(video);
    } else {
      setErrMsg("HLS not supported in this browser");
      onError?.(4);
    }

    return () => {
      video.removeEventListener("waiting", onWaiting);
      video.removeEventListener("playing", onPlaying);
      video.removeEventListener("canplay", onCanPlay);
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
  }, [src]);

  // Close quality menu on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.querySelector(".hd-qmenu")?.contains(e.target as Node)) {
        setQOpen(false);
      }
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // click-to-play / unmute button handler
  const startPlay = useCallback(async () => {
    const v = videoRef.current;
    if (!v) return;

    // First try unmuted play (user gesture is active)
    v.muted = false;
    v.volume = 1;
    try {
      await v.play();
      setMuted(false);
      setNeedsClick(false);
      setBuffering(false);
    } catch {
      // Unmuted play blocked — try muted as fallback
      v.muted = true;
      try {
        await v.play();
        setMuted(true);       // still muted but playing — unmute btn appears
        setNeedsClick(false);
        setBuffering(false);
      } catch {
        // Even muted play failed — re-show the click button
        setNeedsClick(true);
        setBuffering(false);
      }
    }
  }, []);

  const unmute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted  = false;
    v.volume = 1;
    setMuted(false);
  }, []);

  const setQuality = useCallback((lvl: number) => {
    if (hlsRef.current) hlsRef.current.currentLevel = lvl;
    setCurLevel(lvl);
    setQOpen(false);
  }, []);

  const labelOf = (i: number) => {
    if (i === -1) return "Auto";
    const l = levels[i];
    if (!l) return `Q${i + 1}`;
    if (l.height >= 1080) return "1080p";
    if (l.height >= 720)  return "720p";
    if (l.height >= 480)  return "480p";
    if (l.height >= 360)  return "360p";
    return `${l.height}p`;
  };

  return (
    <div ref={wrapRef} style={S.wrap}>
      <video
        ref={setVideoRef}
        style={S.video}
        controls
        playsInline
        autoPlay
        poster={poster}
        preload="auto"
      >
        {tracks.map((t) => {
          const proxied = t.url.startsWith("http")
            ? `/api/proxy/hls?url=${encodeURIComponent(t.url)}`
            : t.url;
          return (
            <track key={t.language} kind="subtitles" src={proxied} srcLang={t.language} label={t.language} />
          );
        })}
      </video>

      {/* buffering spinner */}
      {buffering && !errMsg && !needsClick && <div style={S.spinner} />}

      {/* error overlay */}
      {errMsg && (
        <div style={S.errOverlay}>
          <div style={S.errBox}>
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#c0bdf5" strokeWidth="1.5">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <p style={S.errText}>{errMsg}</p>
          </div>
        </div>
      )}

      {/* click-to-play overlay — autoplay was blocked entirely */}
      {needsClick && !errMsg && (
        <div style={S.playOverlay} onClick={startPlay}>
          <div style={S.playBtn}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="currentColor">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
          </div>
          <p style={S.playHint}>Tap to play</p>
        </div>
      )}

      {/* unmute button — video is playing but muted */}
      {!needsClick && !errMsg && muted && (
        <button style={S.unmuteBtn} onClick={unmute}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
            <line x1="23" y1="9" x2="17" y2="15"/>
            <line x1="17" y1="9" x2="23" y2="15"/>
          </svg>
          Tap to unmute
        </button>
      )}

      {/* quality switcher */}
      {levels.length > 1 && !errMsg && (
        <div style={S.qWrap} className="hd-qmenu">
          <button style={S.qBtn} onClick={() => setQOpen(o => !o)}>
            {labelOf(curLevel)} ▾
          </button>
          {qOpen && (
            <div style={S.qMenu}>
              {[{ i: -1, label: "Auto" }, ...levels.map((_, i) => ({ i, label: labelOf(i) }))].map(({ i, label }) => (
                <div
                  key={i}
                  style={{ ...S.qItem, ...(curLevel === i ? S.qActive : {}) }}
                  onClick={() => setQuality(i)}
                >
                  {label}
                  {curLevel === i && <span style={S.qDot} />}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── inline styles ─────────────────────────────────────────────────────────────
const A = "rgba";
const S: Record<string, React.CSSProperties> = {
  wrap: {
    position: "relative",
    width: "100%",
    height: "100%",
    background: "#000",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  video: {
    width: "100%",
    height: "100%",
    objectFit: "contain",
    background: "#000",
  },
  spinner: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: 44,
    height: 44,
    marginTop: -22,
    marginLeft: -22,
    borderRadius: "50%",
    border: `3px solid ${A}(127,119,221,0.2)`,
    borderTop: "3px solid #7F77DD",
    animation: "hd-spin 0.8s linear infinite",
    pointerEvents: "none",
  },
  errOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: A + "(5,5,12,0.85)",
  },
  errBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    padding: "28px 36px",
    borderRadius: 14,
    background: A + "(255,255,255,0.04)",
    border: `1px solid ${A}(127,119,221,0.2)`,
  },
  errText: {
    color: "#c0bdf5",
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    margin: 0,
  },
  playOverlay: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    background: "rgba(5,5,12,0.6)",
    cursor: "pointer",
    zIndex: 10,
  },
  playBtn: {
    width: 72,
    height: 72,
    borderRadius: "50%",
    background: "rgba(127,119,221,0.9)",
    backdropFilter: "blur(12px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    boxShadow: "0 4px 24px rgba(127,119,221,0.5)",
    transition: "transform 0.15s",
  },
  playHint: {
    color: "rgba(255,255,255,0.75)",
    fontSize: 14,
    fontFamily: "'DM Sans', sans-serif",
    margin: 0,
    letterSpacing: "0.04em",
  },
  unmuteBtn: {
    position: "absolute",
    bottom: 72,
    right: 18,
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "10px 18px",
    borderRadius: 24,
    background: A + "(127,119,221,0.88)",
    backdropFilter: "blur(12px)",
    border: `1px solid ${A}(192,189,245,0.3)`,
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    boxShadow: `0 4px 20px ${A}(127,119,221,0.4)`,
    animation: "hd-pop 0.3s cubic-bezier(0.34,1.56,0.64,1)",
    zIndex: 10,
  },
  qWrap: {
    position: "absolute",
    top: 14,
    right: 18,
    zIndex: 10,
  },
  qBtn: {
    padding: "6px 13px",
    borderRadius: 18,
    background: A + "(5,5,12,0.75)",
    backdropFilter: "blur(12px)",
    border: `1px solid ${A}(127,119,221,0.3)`,
    color: "#c0bdf5",
    fontSize: 12,
    fontWeight: 600,
    fontFamily: "'DM Sans', sans-serif",
    cursor: "pointer",
    letterSpacing: "0.04em",
  },
  qMenu: {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    background: A + "(8,8,20,0.97)",
    backdropFilter: "blur(16px)",
    border: `1px solid ${A}(127,119,221,0.2)`,
    borderRadius: 10,
    overflow: "hidden",
    minWidth: 100,
    boxShadow: `0 8px 32px ${A}(0,0,0,0.6)`,
  },
  qItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "9px 14px",
    fontSize: 12,
    fontFamily: "'DM Sans', sans-serif",
    color: A + "(255,255,255,0.65)",
    cursor: "pointer",
    gap: 10,
  },
  qActive: {
    background: A + "(127,119,221,0.14)",
    color: "#c0bdf5",
  },
  qDot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#7F77DD",
    flexShrink: 0,
    display: "inline-block",
  },
};

if (typeof document !== "undefined" && !document.getElementById("hd-kf")) {
  const st = document.createElement("style");
  st.id = "hd-kf";
  st.textContent = `
    @keyframes hd-spin { to { transform: rotate(360deg); } }
    @keyframes hd-pop  {
      from { opacity:0; transform: scale(0.8) translateY(8px); }
      to   { opacity:1; transform: scale(1)   translateY(0);   }
    }
  `;
  document.head.appendChild(st);
}
