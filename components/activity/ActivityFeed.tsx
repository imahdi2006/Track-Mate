"use client";

import Link from "next/link";
import { relativeTime } from "@/lib/utils";
import type { Activity, Profile } from "@/lib/types";

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

export function ActivityFeed({
  activities,
  me,
  buddy,
  compact = false,
}: {
  activities: Activity[];
  me: Profile;
  buddy: Profile | null;
  compact?: boolean;
}) {
  const list = compact ? activities.slice(0, 6) : activities;

  if (list.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted">
        No activity yet. Turn a page to start the timeline.
      </p>
    );
  }

  return (
    <ul className="space-y-2">
      {list.map((a) => {
        const actor =
          a.userId === me.id ? "You" : buddy?.id === a.userId ? buddy.displayName : "Someone";
        return (
          <li key={a.id}>
            <Link
              href={a.bookId ? `/book/${a.bookId}` : "/activity"}
              className="block rounded-2xl bg-white/4 px-3 py-2.5 transition hover:bg-white/8"
            >
              <p className="text-sm text-cream/90" dir="auto">
                {label(a, actor)}
              </p>
              <p className="mt-0.5 text-[11px] text-muted">{relativeTime(a.createdAt)}</p>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
