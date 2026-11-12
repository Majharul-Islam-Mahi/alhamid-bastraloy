// src/hooks/use-session-timeout.ts
// 8 hours inactivity timeout (was 30 min — too short for shop admin)
//
// 🐛 FIX: 30 min → 8 hours
// 🐛 FIX: mousemove throttle 2s (browser lag prevention)
import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours
const WARNING_MS = 5 * 60 * 1000; // 5 min warning
const THROTTLE_MS = 2000;

const EVENTS: (keyof WindowEventMap)[] = [
  "mousedown",
  "mousemove",
  "keydown",
  "scroll",
  "touchstart",
  "click",
];

export function useSessionTimeout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastResetRef = useRef<number>(0);

  useEffect(() => {
    let warningShown = false;

    async function logout() {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      toast.info("৮ ঘণ্টা নিষ্ক্রিয়তার কারণে লগআউট হয়েছে।");
      navigate({ to: "/", replace: true });
    }

    function reset(force = false) {
      const now = Date.now();
      if (!force && now - lastResetRef.current < THROTTLE_MS) return;
      lastResetRef.current = now;

      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      warningShown = false;

      warningRef.current = setTimeout(() => {
        if (!warningShown) {
          warningShown = true;
          toast.warning("৫ মিনিট পর লগআউট হয়ে যাবে। চালিয়ে যেতে মাউস নাড়ান।", {
            duration: 10000,
          });
        }
      }, TIMEOUT_MS - WARNING_MS);

      timerRef.current = setTimeout(logout, TIMEOUT_MS);
    }

    const handler: EventListener = () => {
      reset(false);
    };

    EVENTS.forEach((e) => window.addEventListener(e, handler, { passive: true }));
    reset(true);

    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, handler));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [navigate, qc]);
}