import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sesh — drinks leaderboard",
    short_name: "Sesh",
    description: "Log your drinks. Climb the leaderboard.",
    start_url: "/",
    display: "standalone",
    background_color: "#0e0b09",
    theme_color: "#0e0b09",
    icons: [
      { src: "/icon", sizes: "512x512", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
