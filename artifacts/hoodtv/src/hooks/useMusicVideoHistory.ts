import { useState, useCallback } from "react";

export interface MusicVideoEntry {
  id: string;
  title: string;
  author: string;
  thumbnail: string;
  watchedAt: number;
  progress?: number;   // 0-100 percent watched
  duration?: number;   // total seconds
}

const KEY = "hoodtv_music_history";

function load(): MusicVideoEntry[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(items: MusicVideoEntry[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
}

export function useMusicVideoHistory() {
  const [history, setHistory] = useState<MusicVideoEntry[]>(load);

  const record = useCallback((entry: Omit<MusicVideoEntry, "watchedAt">) => {
    setHistory((prev) => {
      const existing = prev.find((v) => v.id === entry.id);
      const next = [
        { ...existing, ...entry, watchedAt: Date.now() },
        ...prev.filter((v) => v.id !== entry.id),
      ].slice(0, 50);
      save(next);
      return next;
    });
  }, []);

  const updateProgress = useCallback((id: string, progress: number, duration?: number) => {
    setHistory((prev) => {
      const idx = prev.findIndex((v) => v.id === id);
      if (idx === -1) return prev;
      const next = [...prev];
      next[idx] = { ...next[idx], progress, ...(duration ? { duration } : {}) };
      save(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((v) => v.id !== id);
      save(next);
      return next;
    });
  }, []);

  const clear = useCallback(() => {
    save([]);
    setHistory([]);
  }, []);

  return { history, record, updateProgress, remove, clear };
}
