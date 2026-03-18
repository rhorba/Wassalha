import { ClerkProvider } from "@clerk/nextjs";
import { Providers } from "../providers";
import { Toaster } from "@/components/ui/sonner";
import { SpeedInsights } from "@vercel/speed-insights/next";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider afterSignInUrl="/dashboard" afterSignUpUrl="/dashboard">
      <Providers>
        {children}
        <Toaster richColors />
        <SpeedInsights />
      </Providers>
    </ClerkProvider>
  );
}
