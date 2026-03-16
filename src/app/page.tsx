import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const VALUE_PROPS = [
  {
    icon:  "💰",
    title: "Économisez sur les frais",
    desc:  "Comparez les tarifs de 5 transporteurs en temps réel et choisissez le moins cher.",
  },
  {
    icon:  "⚡",
    title: "Réservez en 1 clic",
    desc:  "Une fois le transporteur choisi, la réservation est confirmée en quelques secondes.",
  },
  {
    icon:  "📍",
    title: "Suivi en temps réel",
    desc:  "Suivez chaque colis en direct depuis votre tableau de bord.",
  },
] as const;

const HOW_IT_WORKS = [
  { step: "01", title: "Comparez", desc: "Entrez la ville de départ, la destination et le poids." },
  { step: "02", title: "Réservez", desc: "Choisissez votre transporteur et confirmez en 1 clic." },
  { step: "03", title: "Suivez",   desc: "Recevez les mises à jour de livraison en temps réel." },
] as const;

const CARRIERS = ["Amana", "Aramex", "CTM", "Marocolis", "Sendex"] as const;

const FAQ = [
  {
    q: "Quels transporteurs sont disponibles ?",
    a: "Amana, Aramex, CTM, Marocolis et Sendex — les 5 principaux transporteurs COD au Maroc.",
  },
  {
    q: "Comment fonctionne la commission Wassalha ?",
    a: "Une commission est prélevée sur chaque livraison confirmée. Contactez-nous pour les détails.",
  },
  {
    q: "Puis-je utiliser Wassalha depuis mon téléphone ?",
    a: "Oui, l'interface est entièrement optimisée pour mobile.",
  },
  {
    q: "Quels types de colis puis-je envoyer ?",
    a: "Tout colis COD standard : vêtements, électronique, cosmétiques, etc.",
  },
  {
    q: "Comment suivre mes livraisons ?",
    a: "Depuis votre tableau de bord, chaque expédition est suivie en temps réel avec les mises à jour du transporteur.",
  },
] as const;

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white">
      {/* Navbar */}
      <nav className="flex items-center justify-between px-6 py-4 border-b max-w-6xl mx-auto">
        <span className="text-xl font-bold tracking-tight">Wassalha</span>
        <div className="flex gap-3">
          <Button variant="ghost" asChild>
            <Link href="/sign-in">Connexion</Link>
          </Button>
          <Button asChild>
            <Link href="/sign-up">Commencer</Link>
          </Button>
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 py-20 max-w-3xl mx-auto">
        <h1
          className="text-5xl font-bold tracking-tight text-zinc-900 leading-tight"
          dir="rtl"
        >
          وصّلها بسهولة
        </h1>
        <p className="mt-4 text-xl text-zinc-500">
          Comparez les transporteurs, réservez en 1 clic, suivez en temps réel.
        </p>
        <div className="mt-8 flex gap-4 justify-center flex-wrap">
          <Button size="lg" asChild>
            <Link href="/sign-up">Commencer gratuitement</Link>
          </Button>
          <Button size="lg" variant="outline" asChild>
            <Link href="/sign-in">Se connecter</Link>
          </Button>
        </div>
      </section>

      {/* Value Props */}
      <section className="bg-zinc-50 px-6 py-16">
        <div className="max-w-5xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
          {VALUE_PROPS.map((v) => (
            <Card key={v.title}>
              <CardContent className="pt-6 space-y-2">
                <div className="text-3xl">{v.icon}</div>
                <h3 className="font-semibold text-zinc-900">{v.title}</h3>
                <p className="text-sm text-zinc-500">{v.desc}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="px-6 py-16 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center text-zinc-900 mb-10">
          Comment ça marche ?
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {HOW_IT_WORKS.map((s) => (
            <div key={s.step} className="text-center space-y-2">
              <div className="text-4xl font-black text-primary">{s.step}</div>
              <h3 className="font-semibold text-zinc-900">{s.title}</h3>
              <p className="text-sm text-zinc-500">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Carrier strip */}
      <section className="bg-zinc-50 px-6 py-12">
        <p className="text-center text-sm text-zinc-400 mb-6 uppercase tracking-widest">
          Transporteurs partenaires
        </p>
        <div className="flex flex-wrap justify-center gap-8 max-w-3xl mx-auto">
          {CARRIERS.map((c) => (
            <span key={c} className="text-lg font-semibold text-zinc-600">
              {c}
            </span>
          ))}
        </div>
      </section>

      {/* FAQ */}
      <section className="px-6 py-16 max-w-2xl mx-auto">
        <h2 className="text-2xl font-bold text-center text-zinc-900 mb-8">
          Questions fréquentes
        </h2>
        <Accordion type="single" collapsible className="space-y-2">
          {FAQ.map((item, i) => (
            <AccordionItem key={i} value={`faq-${i}`}>
              <AccordionTrigger className="text-left">{item.q}</AccordionTrigger>
              <AccordionContent className="text-zinc-500">{item.a}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      {/* CTA Footer */}
      <section className="bg-primary text-primary-foreground px-6 py-16 text-center">
        <h2 className="text-3xl font-bold mb-3">Prêt à démarrer ?</h2>
        <p className="text-primary-foreground/80 mb-8">
          Rejoignez les commerçants marocains qui optimisent leurs livraisons COD.
        </p>
        <Button size="lg" variant="secondary" asChild>
          <Link href="/sign-up">Commencer gratuitement</Link>
        </Button>
        <p className="mt-6 text-sm text-primary-foreground/60">
          Des questions ? Écrivez-nous à{" "}
          <a href="mailto:contact@wassalha.ma" className="underline">
            contact@wassalha.ma
          </a>
        </p>
      </section>
    </main>
  );
}
