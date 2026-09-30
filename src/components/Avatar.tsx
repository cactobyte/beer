export function Avatar({ emoji, size = "md" }: { emoji: string; size?: "sm" | "md" | "lg" }) {
  const cls = { sm: "size-7 text-base", md: "size-10 text-xl", lg: "size-16 text-4xl" }[size];
  return (
    <span className={`${cls} inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-card-hi`}>
      {emoji}
    </span>
  );
}
