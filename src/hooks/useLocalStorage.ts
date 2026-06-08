import { useState } from 'react';

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue = (value: T | ((prev: T) => T)) => {
    // Calcular el nuevo valor sincrónicamente (antes de React)
    const newValue = typeof value === 'function'
      ? (value as (prev: T) => T)(storedValue)
      : value;
    // Guardar en localStorage de forma SÍNCRONA en el event handler
    try {
      window.localStorage.setItem(key, JSON.stringify(newValue));
    } catch (e) {
      console.error('[localStorage] Error guardando', key, e);
    }
    // Actualizar React state
    setStoredValue(newValue);
  };

  return [storedValue, setValue] as const;
}
