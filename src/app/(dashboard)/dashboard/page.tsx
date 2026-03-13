import { auth } from "@clerk/nextjs/server";

export default async function DashboardPage() {
  const { userId } = await auth();

  return (
    <div>
      <h1 className="text-2xl font-bold text-zinc-900">Dashboard</h1>
      <p className="mt-2 text-zinc-500">Welcome. User ID: {userId}</p>
      <p className="mt-4 text-zinc-400 text-sm">
        Phase 2 will add carrier comparison here.
      </p>
    </div>
  );
}
