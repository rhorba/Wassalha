import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { UserProfilePatch } from "@/lib/validations/users";

interface UserProfileData {
  id:                   string;
  email:                string;
  name:                 string | null;
  role:                 "retailer" | "admin";
  businessName:         string | null;
  phone:                string | null;
  defaultSenderAddress: string | null;
  defaultSenderCity:    string | null;
}

async function fetchUserProfile(): Promise<UserProfileData> {
  const res = await fetch("/api/users/me");
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json() as Promise<UserProfileData>;
}

async function patchUserProfile(patch: UserProfilePatch): Promise<UserProfileData> {
  const res = await fetch("/api/users/me", {
    method:  "PATCH",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json() as Promise<UserProfileData>;
}

export function useUserProfile() {
  return useQuery({
    queryKey: ["user-profile"],
    queryFn:  fetchUserProfile,
  });
}

export function useUpdateUserProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: patchUserProfile,
    onSuccess:  () => {
      void queryClient.invalidateQueries({ queryKey: ["user-profile"] });
    },
  });
}
