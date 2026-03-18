import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { FeedbackButton } from "@/components/feedback/feedback-button";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { sessionClaims } = await auth();
  const role = (sessionClaims?.metadata as { role?: string } | undefined)?.role;
  const isAdmin = role === "admin";

  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-semibold text-zinc-900">Wassalha</span>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              Dashboard
            </Link>
            <Link href="/compare" className="text-muted-foreground hover:text-foreground">
              Compare
            </Link>
            <Link href="/analytics" className="text-muted-foreground hover:text-foreground">
              Analytiques
            </Link>
            {isAdmin && (
              <Link
                href="/admin/carriers"
                className="text-muted-foreground hover:text-foreground"
              >
                Carriers
              </Link>
            )}
            {isAdmin && (
              <Link
                href="/admin/billing"
                className="text-muted-foreground hover:text-foreground"
              >
                Facturation
              </Link>
            )}
          </nav>
        </div>
        <UserButton />
      </header>
      <main className="px-6 py-8">{children}</main>
      <FeedbackButton />
    </div>
  );
}
