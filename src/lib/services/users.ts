import { eq } from "drizzle-orm";
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

export async function updateUserProfile(userId: string, patch: UserProfilePatch) {
  const [updated] = await db
    .update(users)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();
  return updated;
}
