import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Wassalha — COD Delivery Aggregator",
  description: "Compare, book, and track COD deliveries across Morocco.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fr">
      <head>
        <link rel="preconnect" href="https://accounts.clerk.dev" />
        <link rel="preconnect" href="https://clerk.accounts.dev" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://eu.i.posthog.com" />
      </head>
      <body>{children}</body>
    </html>
  );
}
