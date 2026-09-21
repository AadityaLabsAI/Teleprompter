import { useEffect, useState } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') return initialValue;
      const item = window.localStorage.getItem(key);
      if (item === null) return initialValue;
      const parsed = JSON.parse(item) as T;
      return parsed;
    } catch {
      try {
        window.localStorage.removeItem(key);
      } catch {
        // Storage can be unavailable in privacy-restricted contexts.
      }
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch {
      // Settings remain available for the current session if storage is unavailable.
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue] as const;
}
