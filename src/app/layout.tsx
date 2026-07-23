import type { Metadata, Viewport } from "next";
// Self-hosted: bundled with the app, no external font request.
import "@fontsource-variable/bricolage-grotesque";
import "./globals.css";

export const metadata: Metadata = {
  title: "2W Order Management",
  description: "Dealer order management — order to dispatch",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#2563eb",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  // Light is the definitive mode per the design system; dark is opt-in
  // via a `dark` class on <html>, matching darkMode: ["class"].
  return (
    <html lang="en">
      <body className="min-h-dvh antialiased">{children}</body>
    </html>
  );
}
