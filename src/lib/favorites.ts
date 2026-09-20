"use client";

import { useSyncExternalStore } from "react";

/**
 * Favorites (task 43, п.4): a tiny global store behind useSyncExternalStore.
 *
 * Available AFTER wallet authorization: the API requires a session cookie
 * (nr_phantom / nr_metamask). Until then the store keeps `authNeeded` so the
 * heart button can trigger the connect flow instead of failing silently.
 *
 * One GET /api/favorites hydrates the whole feed (codes + meta); toggles are
 * optimistic (UI reacts instantly, the request settles in the background).
 * If the DB is down the optimistic state still renders (best-effort UX).
 */

export interface FavoriteMeta {
  postCode: string;
  title: string;
  author: string;
  hasVideo: boolean;
  createdAt: string;
}

interface FavoritesState {
  codes: ReadonlySet<string>;
  items: readonly FavoriteMeta[];
  authNeeded: boolean;
  ready: boolean;
}

let state: FavoritesState = {
  codes: new Set<string>(),
  items: [],
  authNeeded: false,
  ready: false,
};

const listeners = new Set<() => void>();
const LOCAL_KEY = "nr-favorites-fallback"; // DB-down degradation

function emit() {
  for (const l of listeners) l();
}

function setState(patch: Partial<FavoritesState>) {
  state = { ...state, ...patch };
  emit();
}

function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function getSnapshot(): FavoritesState {
  return state;
}

/** server snapshot: identical object → no hydration mismatches */
function getServerSnapshot(): FavoritesState {
  return state;
}

export function useFavoritesStore(): FavoritesState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/* ---------------- local fallback (DB down / offline) ---------------- */

function localSet(): Set<string> {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    return new Set<string>(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set<string>();
  }
}

function localSave(codes: Set<string>) {
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify([...codes]));
  } catch {
    /* private mode */
  }
}

/* ---------------- public API ---------------- */

/** Hydrate once per page load: session favorites (or authNeeded flag). */
export async function hydrateFavorites(): Promise<void> {
  if (state.ready) return;
  try {
    const r = await fetch("/api/favorites", { cache: "no-store" });
    if (r.status === 401) {
      setState({ ready: true, authNeeded: true });
      return;
    }
    if (!r.ok) {
      // DB/network down — show local fallback hearts
      const codes = localSet();
      setState({
        ready: true,
        codes,
        items: [...codes].map(
          (c) => ({ postCode: c, title: "", author: "", hasVideo: true, createdAt: "" }) as FavoriteMeta
        ),
      });
      return;
    }
    const d = (await r.json()) as { favorites?: FavoriteMeta[] };
    const items = d.favorites ?? [];
    setState({
      ready: true,
      authNeeded: false,
      items,
      codes: new Set(items.map((i) => i.postCode)),
    });
  } catch {
    setState({ ready: true });
  }
}

/**
 * Toggle a favorite. Optimistic; returns:
 *   "on" | "off"  — applied,
 *   "auth"        — wallet session required (UI should trigger connect),
 *   "error"       — request failed and the optimistic change was rolled back.
 */
export async function toggleFavorite(
  postCode: string,
  meta?: { title?: string; author?: string; hasVideo?: boolean }
): Promise<"on" | "off" | "auth" | "error"> {
  if (state.authNeeded) return "auth";

  const isOn = state.codes.has(postCode);
  const nextCodes = new Set(state.codes);
  let nextItems = state.items;
  if (isOn) {
    nextCodes.delete(postCode);
    nextItems = state.items.filter((i) => i.postCode !== postCode);
  } else {
    nextCodes.add(postCode);
    nextItems = [
      {
        postCode,
        title: meta?.title ?? "",
        author: meta?.author ?? "",
        hasVideo: meta?.hasVideo ?? true,
        createdAt: new Date().toISOString(),
      },
      ...state.items,
    ];
  }
  const prev = state;
  setState({ codes: nextCodes, items: nextItems });

  try {
    const r = await fetch("/api/favorites", {
      method: isOn ? "DELETE" : "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        postCode,
        title: meta?.title,
        author: meta?.author,
        hasVideo: meta?.hasVideo,
      }),
    });
    if (r.status === 401) {
      setState({ authNeeded: true });
      return "auth";
    }
    if (!r.ok) {
      // DB down → keep the optimistic state, remember locally (best-effort)
      const codes = localSet();
      if (isOn) codes.delete(postCode);
      else codes.add(postCode);
      localSave(codes);
      return isOn ? "off" : "on";
    }
    if (r.ok) {
      const d = (await r.json().catch(() => ({}))) as { favorites?: FavoriteMeta[] };
      if (d.favorites) {
        setState({
          items: d.favorites,
          codes: new Set(d.favorites.map((i) => i.postCode)),
        });
      }
    }
    return isOn ? "off" : "on";
  } catch {
    setState({ codes: prev.codes, items: prev.items });
    return "error";
  }
}

/** The heart UI listens for connect-success to re-hydrate after auth. */
export function resetFavoritesAfterAuth(): void {
  state = { codes: new Set(), items: [], authNeeded: false, ready: false };
  emit();
  void hydrateFavorites();
}
