import { UserButton } from "@clerk/nextjs";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-200 px-6 py-4 flex items-center justify-between">
        <span className="font-semibold text-zinc-900">Wassalha</span>
        <UserButton />
      </header>
      <main className="px-6 py-8">{children}</main>
    </div>
  );
}
