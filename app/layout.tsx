import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Disc Engine",
  description: "A physical disc viewer for premium collectible pressings."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
