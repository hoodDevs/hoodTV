import { useState, useCallback } from "react";
import type { MediaItem } from "@/lib/api";

const STORAGE_KEY = "hoodtv_watchlist";

function loadWatchlist(): MediaItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveWatchlist(items: MediaItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function useWatchlist() {
  const [watchlist, setWatchlist] = useState<MediaItem[]>(loadWatchlist);

  const addToWatchlist = useCallback((item: MediaItem) => {
    setWatchlist((prev) => {
      if (prev.some((i) => i.id === item.id)) return prev;
      const next = [item, ...prev];
      saveWatchlist(next);
      return next;
    });
  }, []);

  const removeFromWatchlist = useCallback((id: string) => {
    setWatchlist((prev) => {
      const next = prev.filter((i) => i.id !== id);
      saveWatchlist(next);
      return next;
    });
  }, []);

  const isInWatchlist = useCallback(
    (id: string) => watchlist.some((i) => i.id === id),
    [watchlist]
  );

  const toggleWatchlist = useCallback(
    (item: MediaItem) => {
      if (isInWatchlist(item.id)) {
        removeFromWatchlist(item.id);
      } else {
        addToWatchlist(item);
      }
    },
    [isInWatchlist, addToWatchlist, removeFromWatchlist]
  );

  return { watchlist, addToWatchlist, removeFromWatchlist, isInWatchlist, toggleWatchlist };
}
