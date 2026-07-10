import { useEffect, useRef } from "react";

export function useClickOutside<T extends HTMLElement>(onClickOutside: () => void, enabled = true) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onClickOutside();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [onClickOutside, enabled]);

  return ref;
}
