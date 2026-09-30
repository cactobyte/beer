import { ImageResponse } from "next/og";

// Drawn with plain shapes so generation never needs to fetch an emoji font
export function renderIcon(px: number) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0e0b09",
        }}
      >
        <div
          style={{
            width: px * 0.72,
            height: px * 0.72,
            borderRadius: px * 0.2,
            background: "linear-gradient(180deg, #fde68a 0%, #fbbf24 30%, #d97706 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#0e0b09",
            fontSize: px * 0.52,
            fontWeight: 900,
          }}
        >
          S
        </div>
      </div>
    ),
    { width: px, height: px },
  );
}
