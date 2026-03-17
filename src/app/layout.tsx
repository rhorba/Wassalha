import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "./providers";
import { Toaster } from "@/components/ui/sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";
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
    <ClerkProvider afterSignInUrl="/dashboard" afterSignUpUrl="/dashboard">
      <html lang="fr">
        <body>
          <Providers>{children}</Providers>
          <Toaster richColors />
          <SpeedInsights />
        </body>
      </html>
    </ClerkProvider>
  );
}
