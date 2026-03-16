import { eq } from "drizzle-orm";
import type { User as ClerkUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import type { UserProfilePatch } from "@/lib/validations/users";

export async function getUserProfile(userId: string) {
  return db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id:                   true,
      email:                true,
      name:                 true,
      role:                 true,
      businessName:         true,
      phone:                true,
      defaultSenderAddress: true,
      defaultSenderCity:    true,
    },
  });
}

export async function upsertUserFromClerk(clerkUser: ClerkUser) {
  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const name  = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") || null;
  await db
    .insert(users)
    .values({ id: clerkUser.id, email, name })
    .onConflictDoNothing();
}

export async function updateUserProfile(userId: string, patch: UserProfilePatch) {
  const [updated] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}
