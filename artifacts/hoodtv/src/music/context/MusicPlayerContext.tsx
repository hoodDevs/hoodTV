import {
  createContext,
  useContext,
  useRef,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from "react";
import type { Track } from "../lib/musicApi";

interface PlayerState {
  currentTrack: Track | null;
  queue: Track[];
  queueIndex: number;
  isPlaying: boolean;
  progress: number;
  duration: number;
  volume: number;
  shuffle: boolean;
  repeat: "none" | "one" | "all";
}

interface PlayerActions {
  play: (track: Track, queue?: Track[], index?: number) => void;
  pause: () => void;
  resume: () => void;
  togglePlay: () => void;
  next: () => void;
  prev: () => void;
  seek: (ratio: number) => void;
  setVolume: (v: number) => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
}

const MusicPlayerContext = createContext<(PlayerState & PlayerActions) | null>(null);

export function MusicPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<PlayerState>({
    currentTrack: null,
    queue: [],
    queueIndex: 0,
    isPlaying: false,
    progress: 0,
    duration: 0,
    volume: 0.8,
    shuffle: false,
    repeat: "none",
  });

  useEffect(() => {
    const audio = new Audio();
    audio.volume = 0.8;
    audioRef.current = audio;

    const onTimeUpdate = () => {
      setState((s) => ({
        ...s,
        progress: audio.duration ? audio.currentTime / audio.duration : 0,
        duration: audio.duration || 0,
      }));
    };
    const onEnded = () => handleEnded();
    const onPlay = () => setState((s) => ({ ...s, isPlaying: true }));
    const onPause = () => setState((s) => ({ ...s, isPlaying: false }));

    audio.addEventListener("timeupdate", onTimeUpdate);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);

    return () => {
      audio.removeEventListener("timeupdate", onTimeUpdate);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.pause();
    };
  }, []);

  const handleEnded = useCallback(() => {
    setState((s) => {
      if (s.repeat === "one") {
        audioRef.current!.currentTime = 0;
        audioRef.current!.play().catch(() => {});
        return s;
      }
      const nextIndex = s.queueIndex + 1;
      if (nextIndex < s.queue.length) {
        const nextTrack = s.queue[nextIndex];
        if (nextTrack.previewUrl) {
          audioRef.current!.src = nextTrack.previewUrl;
          audioRef.current!.play().catch(() => {});
        }
        return { ...s, currentTrack: nextTrack, queueIndex: nextIndex };
      }
      if (s.repeat === "all" && s.queue.length > 0) {
        const first = s.queue[0];
        if (first.previewUrl) {
          audioRef.current!.src = first.previewUrl;
          audioRef.current!.play().catch(() => {});
        }
        return { ...s, currentTrack: first, queueIndex: 0 };
      }
      return { ...s, isPlaying: false };
    });
  }, []);

  const play = useCallback((track: Track, queue: Track[] = [], index = 0) => {
    const audio = audioRef.current!;
    const q = queue.length ? queue : [track];
    const i = queue.length ? index : 0;
    if (track.previewUrl) {
      audio.src = track.previewUrl;
      audio.play().catch(() => {});
    }
    setState((s) => ({ ...s, currentTrack: track, queue: q, queueIndex: i, isPlaying: true }));
  }, []);

  const pause = useCallback(() => { audioRef.current!.pause(); }, []);
  const resume = useCallback(() => { audioRef.current!.play().catch(() => {}); }, []);
  const togglePlay = useCallback(() => {
    const audio = audioRef.current!;
    if (audio.paused) audio.play().catch(() => {}); else audio.pause();
  }, []);

  const next = useCallback(() => {
    setState((s) => {
      const nextIndex = s.shuffle
        ? Math.floor(Math.random() * s.queue.length)
        : s.queueIndex + 1;
      if (nextIndex < s.queue.length) {
        const t = s.queue[nextIndex];
        if (t.previewUrl) {
          audioRef.current!.src = t.previewUrl;
          audioRef.current!.play().catch(() => {});
        }
        return { ...s, currentTrack: t, queueIndex: nextIndex };
      }
      return s;
    });
  }, []);

  const prev = useCallback(() => {
    const audio = audioRef.current!;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    setState((s) => {
      const prevIndex = Math.max(0, s.queueIndex - 1);
      const t = s.queue[prevIndex];
      if (t && t.previewUrl) {
        audio.src = t.previewUrl;
        audio.play().catch(() => {});
      }
      return { ...s, currentTrack: t ?? s.currentTrack, queueIndex: prevIndex };
    });
  }, []);

  const seek = useCallback((ratio: number) => {
    const audio = audioRef.current!;
    if (audio.duration) audio.currentTime = ratio * audio.duration;
  }, []);

  const setVolume = useCallback((v: number) => {
    audioRef.current!.volume = v;
    setState((s) => ({ ...s, volume: v }));
  }, []);

  const toggleShuffle = useCallback(() => setState((s) => ({ ...s, shuffle: !s.shuffle })), []);
  const toggleRepeat = useCallback(() =>
    setState((s) => ({
      ...s,
      repeat: s.repeat === "none" ? "all" : s.repeat === "all" ? "one" : "none",
    })), []);

  return (
    <MusicPlayerContext.Provider
      value={{ ...state, play, pause, resume, togglePlay, next, prev, seek, setVolume, toggleShuffle, toggleRepeat }}
    >
      {children}
    </MusicPlayerContext.Provider>
  );
}

export function useMusicPlayer() {
  const ctx = useContext(MusicPlayerContext);
  if (!ctx) throw new Error("useMusicPlayer must be inside MusicPlayerProvider");
  return ctx;
}
