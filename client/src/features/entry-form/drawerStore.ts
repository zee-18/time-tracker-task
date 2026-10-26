import { useSyncExternalStore } from "react";
import type { Entry } from "../../api/types";
import type { TaskPath } from "../tree/selection";

export type DrawerState =
  | { mode: "closed" }
  | { mode: "create"; task: TaskPath }
  | { mode: "edit"; entry: Entry };

export type OpenDrawerState = Exclude<DrawerState, { mode: "closed" }>;

let state: DrawerState = { mode: "closed" };
let returnFocusTarget: HTMLElement | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

function rememberOpener(): void {
  if (state.mode !== "closed") {
    return;
  }

  returnFocusTarget =
    document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
}

export function openCreate(task: TaskPath): void {
  rememberOpener();
  state = { mode: "create", task };
  emit();
}

export function openEdit(entry: Entry): void {
  rememberOpener();
  state = { mode: "edit", entry };
  emit();
}

export function closeDrawer(): void {
  if (state.mode === "closed") {
    return;
  }

  state = { mode: "closed" };
  emit();
}

export function restoreDrawerFocus(): void {
  const target = returnFocusTarget;

  if (target !== null && target.isConnected) {
    target.focus();
  }
}

export function getDrawerState(): DrawerState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function useDrawer(): DrawerState {
  return useSyncExternalStore(subscribe, getDrawerState, getDrawerState);
}
