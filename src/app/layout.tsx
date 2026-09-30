import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist } from "next/font/google";
import "./globals.css";

const body = Geist({ variable: "--font-body", subsets: ["latin"] });
const display = Bricolage_Grotesque({ variable: "--font-display", subsets: ["latin"], weight: ["600", "800"] });

export const metadata: Metadata = {
  title: { default: "Sesh", template: "%s · Sesh" },
  description: "Log your drinks. Climb the leaderboard. Regret nothing.",
  appleWebApp: { capable: true, title: "Sesh", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#0e0b09",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${body.variable} ${display.variable} antialiased`}>
      <body className="min-h-dvh font-sans">{children}</body>
    </html>
  );
}
