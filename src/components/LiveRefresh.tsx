"use client";

import { useRouter } from "next/navigation";
import { useCallback, useRef } from "react";
import { useGroupVersion } from "@/lib/useGroupVersion";

/** Re-renders the page's server data the moment anything in the group changes. */
export function LiveRefresh({ groupId }: { groupId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Coalesce bursts (e.g. someone logging 3 shots in a row) into one refresh
  const refresh = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => router.refresh(), 100);
  }, [router]);

  useGroupVersion(groupId, refresh);
  return null;
}
