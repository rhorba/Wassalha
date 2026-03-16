import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { getUserProfile, updateUserProfile } from "@/lib/services/users";
import { UserProfilePatchSchema } from "@/lib/validations/users";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const profile = await getUserProfile(userId);
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
  return NextResponse.json(updated);
}
