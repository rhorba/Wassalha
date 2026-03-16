import { z } from "zod";

export const UserProfileSchema = z.object({
  businessName:         z.string().min(1, "Business name required").max(100),
  phone:                z.string().regex(/^\+?[0-9]{9,15}$/, "Enter a valid phone number"),
  defaultSenderAddress: z.string().min(5, "Address too short").max(300),
  defaultSenderCity:    z.string().min(2, "City required"),
});

// PATCH accepts any subset of the profile — steps save independently
export const UserProfilePatchSchema = UserProfileSchema.partial();

export type UserProfilePatch = z.infer<typeof UserProfilePatchSchema>;
export type UserProfile = z.infer<typeof UserProfileSchema>;
