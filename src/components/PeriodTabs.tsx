import Link from "next/link";
import { PERIODS, type Period } from "@/lib/drinks";

export function PeriodTabs({ base, current }: { base: string; current: Period }) {
  return (
    <nav className="-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
      {(Object.keys(PERIODS) as Period[]).map((p) => (
        <Link
          key={p}
          href={p === "tonight" ? base : `${base}?period=${p}`}
          scroll={false}
          replace
          className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
            p === current ? "bg-foam text-bg" : "text-muted hover:bg-card-hi hover:text-ink"
          }`}
        >
          {PERIODS[p]}
        </Link>
      ))}
    </nav>
  );
}
