import { useSyncExternalStore } from "react";

interface HighlightState {
  highlightedKey: string | null;
}

let state: HighlightState = { highlightedKey: null };
let timer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

export function setHighlight(key: string | null): void {
  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }

  state = { highlightedKey: key };
  emit();

  if (key === null) {
    return;
  }

  timer = setTimeout(() => {
    timer = null;
    state = { highlightedKey: null };
    emit();
  }, 4_000);
}

export function getHighlightState(): HighlightState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function useHighlightStore(): HighlightState {
  return useSyncExternalStore(
    subscribe,
    getHighlightState,
    getHighlightState,
  );
}
