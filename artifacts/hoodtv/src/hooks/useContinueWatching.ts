import { useState, useCallback } from "react";
import type { MediaItem } from "@/lib/api";

const STORAGE_KEY = "hoodtv_continue_watching";

export interface WatchProgress extends MediaItem {
  progress: number;
  watchedAt: number;
  season?: number;
  episode?: number;
}

function load(): WatchProgress[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(items: WatchProgress[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useContinueWatching() {
  const [continueWatching, setContinueWatching] = useState<WatchProgress[]>(load);

  const addProgress = useCallback((item: MediaItem, progress: number, season?: number, episode?: number) => {
    setContinueWatching((prev) => {
      const next = [
        { ...item, progress, watchedAt: Date.now(), season, episode },
        ...prev.filter((i) => i.id !== item.id),
      ].slice(0, 20);
      save(next);
      return next;
    });
  }, []);

  const removeProgress = useCallback((id: string) => {
    setContinueWatching((prev) => {
      const next = prev.filter((i) => i.id !== id);
      save(next);
      return next;
    });
  }, []);

  return { continueWatching, addProgress, removeProgress };
}
