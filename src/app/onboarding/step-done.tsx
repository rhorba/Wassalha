"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";

export function StepDone() {
  return (
    <div className="bg-white rounded-xl shadow-sm border p-8 space-y-6 text-center">
      <div className="text-5xl">🎉</div>
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">C&apos;est parti !</h1>
        <p className="text-sm text-zinc-500 mt-2">
          Votre profil est configuré. Faites votre premier envoi maintenant.
        </p>
      </div>
      <Button asChild className="w-full">
        <Link href="/compare">Comparer les transporteurs →</Link>
      </Button>
    </div>
  );
}
