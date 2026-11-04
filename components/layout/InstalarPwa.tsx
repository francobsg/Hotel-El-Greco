"use client";
import { useEffect } from "react";
export function InstalarPwa() {
  useEffect(() => {
    if ("serviceWorker" in navigator && window.isSecureContext) void navigator.serviceWorker.register("/sw.js").catch(() => { /* La app funciona incluso si el navegador no admite instalacion. */ });
  }, []);
  return null;
}
