"use client";

import { useState, useEffect, useCallback } from "react";

interface UseWebPush {
  supported:   boolean;
  permission:  NotificationPermission;
  subscribed:  boolean;
  subscribe:   () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)));
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
    await navigator.serviceWorker.register("/sw.js");
    const reg  = await navigator.serviceWorker.ready;
    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return;

    const res = await fetch("/api/push/vapid-public-key");
    if (!res.ok) return;
    const { key } = (await res.json()) as { key: string };

    const newSub = await reg.pushManager.subscribe({
      userVisibleOnly:      true,
      applicationServerKey: urlBase64ToUint8Array(key),
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
