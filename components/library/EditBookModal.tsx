"use client";

import { useEffect, useState } from "react";
import { Pencil, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CatalogPicker } from "@/components/library/CatalogPicker";
import { CoverPicker } from "@/components/library/CoverPicker";
import { KindToggle } from "@/components/library/ShelfToggles";
import { isUsableCoverUrl } from "@/lib/covers";
import { fetchSeriesSeasons, type CatalogHit, type SeriesSeason } from "@/lib/catalog";
import { creatorLabel, kindNoun, parseTitleKind, unitTotalPlaceholder } from "@/lib/media";
import type { Book, TitleKind } from "@/lib/types";
import { useSessionStore } from "@/lib/store/session-store";

export function EditBookModal({
  book,
  open,
  onClose,
}: {
  book: Book;
  open: boolean;
  onClose: () => void;
}) {
  const updateBook = useSessionStore((s) => s.updateBook);
  const [kind, setKind] = useState<TitleKind>(parseTitleKind(book.kind));
  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [pages, setPages] = useState(String(book.totalPages));
  const [cover, setCover] = useState(isUsableCoverUrl(book.coverUrl) ? book.coverUrl! : "");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [showTitle, setShowTitle] = useState("");
  const [seasons, setSeasons] = useState<SeriesSeason[]>([]);
  const [seasonKey, setSeasonKey] = useState("all");

  useEffect(() => {
    if (!open) return;
    setKind(parseTitleKind(book.kind));
    setTitle(book.title);
    setAuthor(book.author);
    setPages(String(book.totalPages));
    setCover(isUsableCoverUrl(book.coverUrl) ? book.coverUrl! : "");
    setQuery("");
    setShowTitle("");
    setSeasons([]);
    setSeasonKey("all");
  }, [open, book]);

  function pickSeason(next: SeriesSeason) {
    setSeasonKey(next.key);
    setPages(String(next.episodes));
    setTitle(`${showTitle}${next.titleSuffix}`);
  }

  async function approve(hit: CatalogHit) {
    setKind(hit.kind);
    setShowTitle(hit.title);
    setTitle(hit.title);
    setAuthor(hit.creator);
    setPages(String(hit.totalUnits));
    setCover(hit.coverUrl ?? "");
    setQuery("");
    setSeasons([]);
    setSeasonKey("all");
    if (hit.kind === "series") {
      setBusy(true);
      try {
        const list = await fetchSeriesSeasons(hit.id);
        setSeasons(list);
        const all = list.find((s) => s.number === "all") ?? list[0];
        if (all) {
          setSeasonKey(all.key);
          setPages(String(all.episodes));
          setTitle(`${hit.title}${all.titleSuffix}`);
        }
      } finally {
        setBusy(false);
      }
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await updateBook(book.id, {
        title: title.trim(),
        author: author.trim() || "Unknown",
        totalPages: Math.max(1, Number(pages) || book.totalPages),
        coverUrl: cover.trim() || null,
        kind,
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={`Edit ${kindNoun(kind)}`} icon={<Pencil size={20} />}>
      <KindToggle value={kind} onChange={setKind} />
      <label className="relative mt-3 mb-2 block">
        <Search size={16} className="absolute top-4 left-3 text-muted" />
        <Input
          className="pl-9"
          dir="auto"
          placeholder="Find a better cover…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </label>
      <CatalogPicker kind={kind} query={query} onApprove={(hit) => void approve(hit)} />
      {busy && !seasons.length ? <p className="mt-1 text-center text-xs text-muted">Loading seasons…</p> : null}
      {seasons.length > 1 ? (
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {seasons.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => pickSeason(s)}
              className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                seasonKey === s.key ? "bg-brand text-white" : "bg-white/8 text-muted"
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>
      ) : null}
      <form onSubmit={submit} className="mt-4 space-y-3">
        <CoverPicker value={cover} onChange={setCover} compact />
        <Input dir="auto" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <div className="grid grid-cols-2 gap-2">
          <Input
            dir="auto"
            placeholder={creatorLabel(kind)}
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
          />
          <Input
            placeholder={unitTotalPlaceholder(kind)}
            inputMode="numeric"
            value={pages}
            onChange={(e) => setPages(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={busy || !title.trim()}>
          {busy ? "Saving…" : "Save changes"}
        </Button>
      </form>
    </Modal>
  );
}
