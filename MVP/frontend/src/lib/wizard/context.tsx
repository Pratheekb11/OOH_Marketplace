"use client";

import { createContext, useCallback, useContext, useEffect, useReducer, useState } from "react";
import type { ReactNode } from "react";
import { initialWizardState, wizardReducer } from "./reducer";
import type { WizardAction, WizardState } from "./types";

export const WIZARD_DRAFT_STORAGE_KEY = "adspace_wizard_draft";

interface WizardContextValue {
  state: WizardState;
  dispatch: React.Dispatch<WizardAction>;
  /** False until the mount-once sessionStorage read has resolved. Gate
   * rendering of the actual step forms on this so inputs never flash empty
   * and then snap to a restored draft. */
  hydrated: boolean;
  /** Writes the current state to sessionStorage immediately (the mirroring
   * effect already does this on every change — this is for the "Save
   * Draft" button, which needs a synchronous confirmation to toast off). */
  saveDraftNow: () => void;
}

const WizardContext = createContext<WizardContextValue | null>(null);

/**
 * Owns the single `useReducer` for the entire 5-step form. Deliberately NOT
 * a lazy initializer reading sessionStorage — that runs during the client's
 * first render, before hydration reconciles, and React 19 discards the
 * whole tree on a server/client mismatch. Instead:
 *   1. First render uses `initialWizardState` (same on server and client).
 *   2. A mount-once effect reads sessionStorage and dispatches HYDRATE.
 *   3. A separate effect mirrors `state` to sessionStorage on every change,
 *      but only once `hydrated` is true (otherwise step (2) would race with
 *      an empty-state write and clobber a real draft).
 */
export function WizardProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(wizardReducer, initialWizardState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(WIZARD_DRAFT_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<WizardState>;
        dispatch({ type: "HYDRATE", state: { ...initialWizardState, ...parsed } });
      }
    } catch {
      // Corrupt or inaccessible sessionStorage — proceed with a blank draft.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.sessionStorage.setItem(WIZARD_DRAFT_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable (quota, private mode) — draft just won't survive a refresh.
    }
  }, [state, hydrated]);

  const saveDraftNow = useCallback(() => {
    try {
      window.sessionStorage.setItem(WIZARD_DRAFT_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state]);

  return (
    <WizardContext.Provider value={{ state, dispatch, hydrated, saveDraftNow }}>
      {children}
    </WizardContext.Provider>
  );
}

export function useWizard(): WizardContextValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error("useWizard must be used within a WizardProvider");
  return ctx;
}

/** Called on successful submit — clears the draft so the next visit to
 * /list-your-space starts clean instead of resurrecting the just-submitted
 * listing. */
export function clearWizardDraft(): void {
  try {
    window.sessionStorage.removeItem(WIZARD_DRAFT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
