import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-50 px-4">
      <div className="text-center max-w-lg">
        <h1 className="text-4xl font-bold tracking-tight text-zinc-900">Wassalha</h1>
        <p className="mt-4 text-lg text-zinc-500">
          Comparez, réservez et suivez vos livraisons COD au Maroc.
        </p>
        <div className="mt-8 flex gap-4 justify-center">
          <Button asChild>
            <Link href="/sign-up">Commencer</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/sign-in">Se connecter</Link>
          </Button>
        </div>
      </div>
    </main>
  );
}
