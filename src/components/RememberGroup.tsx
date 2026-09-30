"use client";

import { useEffect } from "react";

import { LAST_GROUP_COOKIE } from "@/lib/constants";

/** Remembers the last group viewed so opening the app lands straight on it. */
export function RememberGroup({ id }: { id: string }) {
  useEffect(() => {
    document.cookie = `${LAST_GROUP_COOKIE}=${id}; path=/; max-age=31536000; samesite=lax`;
  }, [id]);
  return null;
}
