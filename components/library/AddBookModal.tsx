"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, Library, Pencil, Search } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { CatalogPicker } from "@/components/library/CatalogPicker";
import { CoverPicker } from "@/components/library/CoverPicker";
import { KindToggle, ShelfStatusToggle } from "@/components/library/ShelfToggles";
import { BookCover } from "@/components/ui/BookCover";
import { BidiText } from "@/components/ui/BidiText";
import { fetchSeriesSeasons, type CatalogHit, type SeriesSeason } from "@/lib/catalog";
import {
  creatorLabel,
  defaultTotalUnits,
  catalogHint,
  kindNoun,
  kindNounPlural,
  unitNoun,
  unitTotalPlaceholder,
} from "@/lib/media";
import type { BookStatus, TitleKind } from "@/lib/types";
import { useSessionStore } from "@/lib/store/session-store";
import { useToastStore } from "@/lib/store/toast-store";

export function AddBookModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const addBook = useSessionStore((s) => s.addBook);
  const [kind, setKind] = useState<TitleKind>("book");
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pages, setPages] = useState(String(defaultTotalUnits("book")));
  const [cover, setCover] = useState("");
  const [status, setStatus] = useState<BookStatus>("currently_reading");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"search" | "review">("search");
  const [manual, setManual] = useState(false);
  const [showTitle, setShowTitle] = useState("");
  const [seasons, setSeasons] = useState<SeriesSeason[]>([]);
  const [seasonKey, setSeasonKey] = useState("all");

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setTitle("");
    setAuthor("");
    setCover("");
    setPages(String(defaultTotalUnits(kind)));
    setStatus("currently_reading");
    setStep("search");
    setManual(false);
    setBusy(false);
    setShowTitle("");
    setSeasons([]);
    setSeasonKey("all");
  }, [open]);

  function pickKind(next: TitleKind) {
    setKind(next);
    if (step === "search") {
      setPages(String(defaultTotalUnits(next)));
    }
  }

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
    setManual(false);
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
    setStep("review");
  }

  function startManual() {
    setManual(true);
    setStep("review");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await addBook({
        title: title.trim(),
        author: author.trim() || "Unknown",
        totalPages: Math.max(1, Number(pages) || 1),
        coverUrl: cover.trim() || null,
        status,
        kind,
      });
      onClose();
    } catch (err) {
      useToastStore.getState().push({
        title: "Couldn’t add that",
        body: err instanceof Error ? err.message : "Try again",
        tone: "warn",
      });
    } finally {
      setBusy(false);
    }
  }

  const noun = kindNoun(kind);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add to library"
      icon={<Library size={22} />}
    >
      {step === "search" ? (
        <div className="space-y-3">
          <KindToggle value={kind} onChange={pickKind} />
          <label className="relative block">
            <Search size={16} className="absolute top-4 left-3 text-muted" />
            <Input
              className="pl-9"
              dir="auto"
              autoFocus
              placeholder={`Search ${kindNounPlural(kind)}…`}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          {query.trim().length < 2 ? (
            <p className="text-[11px] text-muted">{catalogHint(kind)}</p>
          ) : null}
          <CatalogPicker kind={kind} query={query} onApprove={(hit) => void approve(hit)} />
          {busy && step === "search" ? (
            <p className="text-center text-xs text-muted">Loading seasons…</p>
          ) : null}
          <button
            type="button"
            className="flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl text-sm text-muted hover:bg-white/5 hover:text-cream"
            onClick={startManual}
          >
            <Pencil size={14} />
            Not listed — add it yourself
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-3">
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1 text-sm text-muted"
            onClick={() => {
              setStep("search");
              setManual(false);
            }}
          >
            <ArrowLeft size={16} />
            Search again
          </button>

          {!manual ? (
            <div className="flex gap-3 rounded-2xl bg-white/5 p-3">
              <BookCover
                title={title}
                author={author}
                coverUrl={cover}
                className="h-28 w-[4.5rem] shrink-0 rounded-xl"
              />
              <div className="min-w-0 flex-1">
                <BidiText as="p" className="font-display text-lg leading-snug">
                  {title || `Untitled ${noun}`}
                </BidiText>
                <BidiText as="p" className="mt-0.5 text-sm text-muted">
                  {author || creatorLabel(kind)}
                </BidiText>
                <p className="mt-2 text-xs text-muted">
                  {pages} {unitNoun(kind, Number(pages) || 0)}
                </p>
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
                <button
                  type="button"
                  className="mt-2 inline-flex min-h-11 items-center gap-1 text-xs text-brand-glow"
                  onClick={() => setManual(true)}
                >
                  <Pencil size={12} />
                  Fix title, cover, or length
                </button>
              </div>
            </div>
          ) : (
            <>
              <CoverPicker value={cover} onChange={setCover} compact />
              <Input
                dir="auto"
                placeholder="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
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
            </>
          )}

          <ShelfStatusToggle kind={kind} value={status} onChange={setStatus} />
          <Button type="submit" className="w-full" disabled={busy || !title.trim()}>
            {busy ? "Adding…" : `Add ${noun}`}
          </Button>
        </form>
      )}
    </Modal>
  );
}
