"use client";

import { Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { Toggle } from "@/components/ui/toggle";
import { useWebPush } from "@/hooks/use-web-push";

export function PushToggle() {
  const { supported, subscribed, subscribe, unsubscribe } = useWebPush();

  if (!supported) return null;

  const handleToggle = async () => {
    if (subscribed) {
      await unsubscribe();
    } else {
      await subscribe();
      toast.success("Vous serez notifié des mises à jour de vos envois");
    }
  };

  return (
    <Toggle
      pressed={subscribed}
      onPressedChange={() => { void handleToggle(); }}
      aria-label="Activer les notifications push"
      size="sm"
      variant="outline"
    >
      {subscribed ? (
        <Bell className="h-4 w-4 text-blue-600" />
      ) : (
        <BellOff className="h-4 w-4 text-muted-foreground" />
      )}
    </Toggle>
  );
}
