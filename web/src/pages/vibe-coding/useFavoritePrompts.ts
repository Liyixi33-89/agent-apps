import { useState, useEffect, useCallback } from 'react';
import { favoriteDB } from './db';
import type { FavoritePrompt } from './types';

export const useFavoritePrompts = () => {
  const [favorites, setFavorites] = useState<FavoritePrompt[]>([]);

  useEffect(() => {
    favoriteDB.getAll()
      .then((items) => {
        const sorted = items.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setFavorites(sorted);
      })
      .catch(console.error);
  }, []);

  const addFavorite = useCallback(async (text: string) => {
    // 去重
    if (favorites.some((f) => f.text === text)) return;
    const item: FavoritePrompt = {
      id: `fav-${Date.now()}`,
      text,
      createdAt: new Date().toISOString(),
    };
    await favoriteDB.save(item);
    setFavorites((prev) => [item, ...prev]);
  }, [favorites]);

  const removeFavorite = useCallback(async (id: string) => {
    await favoriteDB.remove(id);
    setFavorites((prev) => prev.filter((f) => f.id !== id));
  }, []);

  const isFavorite = useCallback(
    (text: string) => favorites.some((f) => f.text === text),
    [favorites]
  );

  return { favorites, addFavorite, removeFavorite, isFavorite };
};
