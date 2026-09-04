"use client";

import { useEffect, useState } from "react";
import { Clapperboard, Tv } from "lucide-react";
import type { CatalogHit } from "@/lib/catalog";
import { searchCatalog } from "@/lib/catalog";
import type { TitleKind } from "@/lib/types";

export function CatalogPicker({
  kind,
  query,
  onApprove,
}: {
  kind: TitleKind;
  query: string;
  onApprove: (hit: CatalogHit) => void;
}) {
  const [hits, setHits] = useState<CatalogHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHits([]);
      return;
    }
    const t = window.setTimeout(async () => {
      setSearching(true);
      try {
        const local = await searchCatalog(kind, q);
        if (local.length) {
          setHits(local);
          return;
        }
        const res = await fetch(
          `/api/catalog/search?kind=${encodeURIComponent(kind)}&q=${encodeURIComponent(q)}`,
        );
        const json = (await res.json()) as { hits?: CatalogHit[] };
        setHits(json.hits ?? []);
      } catch {
        setHits([]);
      } finally {
        setSearching(false);
      }
    }, 320);
    return () => window.clearTimeout(t);
  }, [kind, query]);

  if (query.trim().length < 2) {
    return null;
  }

  return (
    <div className="mt-2">
      {searching ? <p className="text-xs text-muted">Finding covers…</p> : null}
      {hits.length > 0 ? (
        <ul className="mt-1 max-h-56 space-y-1 overflow-y-auto">
          {hits.map((hit) => (
            <li key={hit.id}>
              <button
                type="button"
                onClick={() => onApprove(hit)}
                className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left hover:bg-white/5"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={hit.coverUrl || "/icons/icon-192.png"}
                  alt=""
                  className="h-14 w-9 rounded-md object-cover"
                />
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-1.5">
                    {kind === "movie" || kind === "series" ? (
                      hit.kind === "series" ? (
                        <Tv size={12} className="shrink-0 text-brand-glow" />
                      ) : (
                        <Clapperboard size={12} className="shrink-0 text-muted" />
                      )
                    ) : null}
                    <span className="block truncate text-sm text-cream" dir="auto">
                      {hit.title}
                    </span>
                  </span>
                  <span className="block truncate text-xs text-muted" dir="auto">
                    {hit.creator}
                    {hit.year ? ` · ${hit.year}` : ""}
                    {hit.kind === "series"
                      ? " · series"
                      : hit.kind === "movie" && hit.totalUnits
                        ? ` · ${hit.totalUnits} min`
                        : hit.totalUnits
                          ? ` · ${hit.totalUnits}`
                          : ""}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : !searching ? (
        <p className="text-xs text-muted">No catalog match — add it yourself below.</p>
      ) : null}
    </div>
  );
}
