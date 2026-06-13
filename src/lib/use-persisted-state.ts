import { useEffect, useState } from "react";
import { store } from "./lord-store";

/** Reactive localStorage hook. */
export function usePersistedState<T>(key: string, initial: T): [T, (v: T | ((p: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => store.get(key, initial));

  useEffect(() => {
    store.set(key, value);
  }, [key, value]);

  return [value, setValue];
}
