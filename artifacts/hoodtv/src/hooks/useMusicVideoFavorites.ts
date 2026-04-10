import { useState, useCallback } from "react";

export interface MusicVideoFavorite {
  id: string;
  title: string;
  author: string;
  thumbnail: string;
  savedAt: number;
}

const KEY = "hoodtv_music_favorites";

function load(): MusicVideoFavorite[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function save(items: MusicVideoFavorite[]) {
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch {}
}

export function useMusicVideoFavorites() {
  const [favorites, setFavorites] = useState<MusicVideoFavorite[]>(load);

  const add = useCallback((entry: Omit<MusicVideoFavorite, "savedAt">) => {
    setFavorites((prev) => {
      if (prev.some((v) => v.id === entry.id)) return prev;
      const next = [{ ...entry, savedAt: Date.now() }, ...prev];
      save(next);
      return next;
    });
  }, []);

  const remove = useCallback((id: string) => {
    setFavorites((prev) => {
      const next = prev.filter((v) => v.id !== id);
      save(next);
      return next;
    });
  }, []);

  const toggle = useCallback((entry: Omit<MusicVideoFavorite, "savedAt">) => {
    setFavorites((prev) => {
      const exists = prev.some((v) => v.id === entry.id);
      const next = exists
        ? prev.filter((v) => v.id !== entry.id)
        : [{ ...entry, savedAt: Date.now() }, ...prev];
      save(next);
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (id: string) => favorites.some((v) => v.id === id),
    [favorites]
  );

  return { favorites, add, remove, toggle, isFavorite };
}
