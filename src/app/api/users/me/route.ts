import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserProfile, updateUserProfile, upsertUserFromClerk } from "@/lib/services/users";
import { UserProfilePatchSchema } from "@/lib/validations/users";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let profile = await getUserProfile(userId);

  // Lazy upsert — Clerk webhook doesn't fire to localhost, so new sign-ups
  // may not have a DB row yet. Create it on first profile fetch.
  if (!profile) {
    const clerkUser = await currentUser();
    if (!clerkUser) return NextResponse.json({ error: "User not found" }, { status: 404 });
    await upsertUserFromClerk(clerkUser);
    profile = await getUserProfile(userId);
  }

  if (!profile) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json(profile);
}

export async function PATCH(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body: unknown = await req.json();
  const parsed = UserProfilePatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: { message: "Validation error", issues: parsed.error.issues } },
      { status: 422 },
    );
  }

  const updated = await updateUserProfile(userId, parsed.data);
  if (!updated) return NextResponse.json({ error: "User not found" }, { status: 404 });

  return NextResponse.json(updated);
}
