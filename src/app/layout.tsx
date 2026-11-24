import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Akwaaba Cargo — China-to-Ghana Pre-Order Batches",
  description:
    "Run China-to-Ghana pre-order batches with one WhatsApp link, Mobile Money deposits, and automatic SMS updates.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f6b47",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        {/* Subtle Ghana flag-inspired top accent bar */}
        <div className="flex h-1 w-full" aria-hidden="true">
          <div className="flex-1 bg-[#ce1126]" />
          <div className="flex-1 bg-[#fcd116]" />
          <div className="flex-1 bg-[#006b3f]" />
        </div>
        {children}
      </body>
    </html>
  );
}
