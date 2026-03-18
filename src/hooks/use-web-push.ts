"use client";

import { useState, useEffect, useCallback } from "react";

interface UseWebPush {
  supported:   boolean;
  permission:  NotificationPermission;
  subscribed:  boolean;
  subscribe:   () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export function useWebPush(): UseWebPush {
  const [supported,  setSupported]  = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [subscribed, setSubscribed] = useState(false);
  const [sub,        setSub]        = useState<PushSubscription | null>(null);

  useEffect(() => {
    const ok =
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window;

    setSupported(ok);
    if (!ok) return;

    setPermission(Notification.permission);

    void (async () => {
      const reg      = await navigator.serviceWorker.register("/sw.js");
      const existing = await reg.pushManager.getSubscription();
      if (existing) {
        setSub(existing);
        setSubscribed(true);
      }
    })();
  }, []);

  const subscribe = useCallback(async () => {
    const reg  = await navigator.serviceWorker.register("/sw.js");
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return;

    const res = await fetch("/api/push/vapid-public-key");
    if (!res.ok) return;
    const { key } = (await res.json()) as { key: string };

    const newSub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: key,
    });

    await fetch("/api/push/subscribe", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(newSub.toJSON()),
    });

    setSub(newSub);
    setSubscribed(true);
  }, []);

  const unsubscribe = useCallback(async () => {
    if (!sub) return;

    await fetch("/api/push/subscribe", {
      method:  "DELETE",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ endpoint: sub.endpoint }),
    });

    await sub.unsubscribe();
    setSub(null);
    setSubscribed(false);
  }, [sub]);

  return { supported, permission, subscribed, subscribe, unsubscribe };
}
