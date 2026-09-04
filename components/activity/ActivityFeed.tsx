"use client";

import Link from "next/link";
import { NoteReadTicks } from "@/components/activity/NoteReadTicks";
import { personName } from "@/lib/names";
import { useSessionStore } from "@/lib/store/session-store";
import { formatDateTime, relativeTime } from "@/lib/utils";
import { memberCanAccessBook, type Activity, type MicroNote, type Profile, type RoomMember } from "@/lib/types";
import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";

function actorName(
  userId: string,
  me: Profile,
  members: RoomMember[] | undefined,
  buddy: Profile | null,
): string {
  if (userId === me.id) return "You";
  const member = members?.find((m) => m.userId === userId)?.profile;
  if (member) return personName(member, "Someone");
  if (buddy?.id === userId) return personName(buddy, "Someone");
  return "Someone";
}

function label(activity: Activity, actor: string): string {
  const title = String(activity.payload.bookTitle ?? "the book");
  const page = activity.payload.page;
  switch (activity.kind) {
    case "page_update":
      return `${actor} updated to page ${page} of ${title}`;
    case "reaction":
      return `${actor} reacted ${activity.payload.emoji ?? ""} on page ${page}`;
    case "note":
      return `${actor} left a note on page ${page}`;
    case "book_added":
      return `${actor} added ${title}`;
    case "book_completed":
      return `${actor} finished ${title} with you 🎉`;
    case "pair_joined":
    case "room_joined":
      return `${actor} joined the room`;
    default:
      return `${actor} did something`;
  }
}

function closestNote(activity: Activity, notes: MicroNote[]): MicroNote | undefined {
  if (activity.kind !== "note" && activity.kind !== "reaction") return undefined;
  const page = typeof activity.payload.page === "number" ? activity.payload.page : null;
  const list = notes.filter(
    (n) =>
      n.bookId === activity.bookId &&
      n.userId === activity.userId &&
      (page == null || n.pageNumber === page),
  );
  const prefer =
    activity.kind === "reaction"
      ? list.filter((n) => n.emoji === activity.payload.emoji)
      : list.filter((n) => Boolean(n.note));
  const pool = prefer.length ? prefer : list;
  if (!pool.length) return undefined;
  const t = Date.parse(activity.createdAt);
  return pool.reduce((best, n) =>
    Math.abs(Date.parse(n.createdAt) - t) < Math.abs(Date.parse(best.createdAt) - t) ? n : best,
  );
}

export function ActivityFeed({
  activities,
  me,
  buddy,
  members,
  compact = false,
}: {
  activities: Activity[];
  me: Profile;
  buddy: Profile | null;
  members?: RoomMember[];
  compact?: boolean;
}) {
  const notes = useSessionStore((s) => s.notes);
  const [readList, setReadList] = useState<string[] | null>(null);
  const list = compact ? activities.slice(0, 6) : activities;

  const memberList = members ?? [];

  const items = useMemo(
    () =>
      list.map((a) => {
        const note = closestNote(a, notes);
        return { a, note };
      }),
    [list, notes],
  );

  if (list.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        No activity yet. Turn a page to start the timeline.
      </p>
    );
  }

  return (
    <>
      <ul className="space-y-2">
        {items.map(({ a, note }) => {
          const actor = actorName(a.userId, me, members, buddy);
          const when = formatDateTime(a.createdAt);
          const page = a.payload.page;
          const mine = a.userId === me.id;
          const readers = memberList.filter(
            (m) => m.userId !== a.userId && (!a.bookId || memberCanAccessBook(m, a.bookId)),
          );
          const readBy = note?.readBy ?? [];
          const readSet = new Set(readBy.map((r) => r.userId));
          const readerNames = readers
            .filter((m) => readSet.has(m.userId))
            .map((m) => personName(m.profile, "Someone"));
          const readCount = readerNames.length;
          return (
            <li key={a.id}>
              <div className="rounded-2xl bg-white/4 px-3 py-2.5 transition hover:bg-white/8">
                <Link href={a.bookId ? `/book/${a.bookId}` : "/activity"} className="block">
                  <p className="text-sm text-cream/90" dir="auto">
                    {label(a, actor)}
                  </p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    <span dir="auto">{actor}</span>
                    {typeof page === "number" ? ` · p.${page}` : ""}
                    {when ? ` · ${when}` : ""}
                    {` · ${relativeTime(a.createdAt)}`}
                  </p>
                  {a.bookId ? (
                    <p className="mt-0.5 text-[11px] text-muted/80">
                      Visible to people reading this book
                    </p>
                  ) : (
                    <p className="mt-0.5 text-[11px] text-muted/80">Visible to this room</p>
                  )}
                </Link>
                {note ? (
                  <div className="mt-1 flex justify-end">
                    <NoteReadTicks
                      mine={mine}
                      readCount={readCount}
                      readerNames={readerNames}
                      onOpen={() =>
                        setReadList(
                          readBy.map((r) =>
                            personName(
                              memberList.find((m) => m.userId === r.userId)?.profile,
                              "Someone",
                            ),
                          ),
                        )
                      }
                    />
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
      <Modal open={Boolean(readList)} onClose={() => setReadList(null)} title="Read by">
        {readList && readList.length === 0 ? (
          <p className="text-sm text-muted">Nobody has opened this yet.</p>
        ) : (
          <ul className="space-y-2">
            {(readList ?? []).map((name, i) => (
              <li key={`${name}-${i}`} className="text-sm text-cream" dir="auto">
                {name}
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
