import { eq } from "drizzle-orm";
import { ImageResponse } from "next/og";
import { db, schema } from "@/db";
import { getUser } from "@/lib/auth";
import { drinkInfo, formatUnits } from "@/lib/drinks";
import { getSeshDrinks, getSeshLeaderboard, isMember, requireSesh } from "@/lib/queries";
import { formatDuration, formatInTz } from "@/lib/time";

const PODIUM = ["#fbbf24", "#d6d3d1", "#d97745"];

/** 1080×1920 story-sized recap image for a sesh. Members only. */
export async function GET(_req: Request, ctx: RouteContext<"/g/[groupId]/s/[seshId]/recap">) {
  const { groupId, seshId } = await ctx.params;
  const me = await getUser();
  if (!me || !(await isMember(groupId, me.id))) return new Response("Not found", { status: 404 });
  const sesh = await requireSesh(groupId, seshId);
  const [group] = await db.select().from(schema.groups).where(eq(schema.groups.id, groupId));

  const [board, items] = await Promise.all([getSeshLeaderboard(sesh.id), getSeshDrinks(sesh.id)]);
  const total = board.reduce((n, r) => n + r.drinks, 0);
  const units = board.reduce((n, r) => n + r.units, 0);
  const byType = new Map<string, number>();
  for (const d of items) byType.set(d.type, (byType.get(d.type) ?? 0) + d.quantity);
  const top = [...byType.entries()].sort((a, b) => b[1] - a[1])[0];
  const end = sesh.endedAt ?? new Date();
  const when = formatInTz(sesh.startedAt, group.timezone, { weekday: "long", day: "numeric", month: "long" });

  // Satori (the renderer) needs explicit display:flex on every multi-child element and no emoji fonts
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          padding: "110px 90px",
          background: "linear-gradient(180deg, #3a2410 0%, #0e0b09 45%)",
          color: "#f6eee4",
        }}
      >
        <div style={{ display: "flex", fontSize: 44, fontWeight: 800, color: "#fbbf24", letterSpacing: -1 }}>sesh</div>
        <div style={{ display: "flex", marginTop: 70, fontSize: 40, color: "#a8998a" }}>{group.name}</div>
        <div style={{ display: "flex", marginTop: 10, fontSize: 104, fontWeight: 800, lineHeight: 1.05, letterSpacing: -3 }}>
          {sesh.name}
        </div>
        <div style={{ display: "flex", marginTop: 20, fontSize: 36, color: "#a8998a" }}>
          {`${when} · ${formatDuration(sesh.startedAt, end)}`}
        </div>

        <div style={{ display: "flex", marginTop: 70, gap: 30 }}>
          {[
            [String(total), "drinks"],
            [formatUnits(units), "units"],
            [String(board.length), board.length === 1 ? "legend" : "legends"],
          ].map(([value, label]) => (
            <div
              key={label}
              style={{
                display: "flex",
                flexDirection: "column",
                flex: 1,
                padding: "30px 34px",
                borderRadius: 36,
                background: "#19140f",
                border: "2px solid #33291f",
              }}
            >
              <div style={{ display: "flex", fontSize: 84, fontWeight: 800 }}>{value}</div>
              <div style={{ display: "flex", fontSize: 32, color: "#a8998a" }}>{label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: 60, gap: 22 }}>
          {board.slice(0, 6).map((r, i) => (
            <div key={r.userId} style={{ display: "flex", alignItems: "center", gap: 30 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 84,
                  height: 84,
                  borderRadius: 42,
                  fontSize: 40,
                  fontWeight: 800,
                  background: i < 3 ? PODIUM[i] : "#231c15",
                  color: i < 3 ? "#0e0b09" : "#a8998a",
                }}
              >
                {String(i + 1)}
              </div>
              <div style={{ display: "flex", flex: 1, fontSize: i === 0 ? 58 : 48, fontWeight: i === 0 ? 800 : 600 }}>
                {r.displayName}
              </div>
              <div style={{ display: "flex", fontSize: i === 0 ? 64 : 52, fontWeight: 800 }}>{String(r.drinks)}</div>
            </div>
          ))}
        </div>

        {top && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              marginTop: 60,
              padding: "30px 34px",
              borderRadius: 36,
              background: "#19140f",
              border: "2px solid #33291f",
            }}
          >
            <div style={{ display: "flex", fontSize: 32, color: "#a8998a" }}>Drink of the night</div>
            <div style={{ display: "flex", fontSize: 60, fontWeight: 800, color: "#fbbf24" }}>
              {`${drinkInfo(top[0]).label} ×${top[1]}`}
            </div>
          </div>
        )}

        <div style={{ display: "flex", marginTop: "auto", fontSize: 30, color: "#6f6254" }}>logged on sesh</div>
      </div>
    ),
    { width: 1080, height: 1920, headers: { "Cache-Control": "private, no-store" } },
  );
}
