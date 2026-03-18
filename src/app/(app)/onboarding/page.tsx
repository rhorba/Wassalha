"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useUserProfile } from "@/hooks/use-user-profile";
import { StepBusiness } from "./step-business";
import { StepAddress } from "./step-address";
import { StepDone } from "./step-done";

export default function OnboardingPage() {
  const [step, setStep]   = useState(1);
  const router            = useRouter();
  const { data: profile } = useUserProfile();

  // Redirect already-onboarded users — only on initial load (step 1)
  // If step > 1, user is actively going through the wizard; don't interrupt
  useEffect(() => {
    if (step !== 1) return;
    if (profile?.businessName && profile?.defaultSenderCity) {
      router.replace("/dashboard");
    }
  }, [profile, router, step]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-50 px-4 py-12">
      <div className="w-full max-w-md">
        {/* Step indicator */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-2 w-8 rounded-full transition-colors ${
                s <= step ? "bg-primary" : "bg-zinc-200"
              }`}
            />
          ))}
        </div>

        {step === 1 && <StepBusiness onNext={() => setStep(2)} />}
        {step === 2 && <StepAddress  onNext={() => setStep(3)} />}
        {step === 3 && <StepDone />}
      </div>
    </div>
  );
}
