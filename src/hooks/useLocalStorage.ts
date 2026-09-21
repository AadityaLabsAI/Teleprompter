import { useEffect, useState } from 'react';

const isCompatible = <T,>(value: unknown, initialValue: T): value is T => {
  if (typeof initialValue === 'boolean') return typeof value === 'boolean';
  if (typeof initialValue === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (typeof initialValue === 'string') return typeof value === 'string';
  return value !== null && typeof value === 'object';
};

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      if (typeof window === 'undefined') return initialValue;
      const item = window.localStorage.getItem(key);
      if (item === null) return initialValue;
      const parsed: unknown = JSON.parse(item);
      return isCompatible(parsed, initialValue) ? parsed : initialValue;
    } catch {
      try { window.localStorage.removeItem(key); } catch { /* storage may be unavailable */ }
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(storedValue));
    } catch {
      // The app remains usable for the current session if storage is unavailable.
    }
  }, [key, storedValue]);

  return [storedValue, setStoredValue] as const;
}
