// src/hooks/use-session-timeout.ts
// ৩০ মিনিট inactivity হলে auto logout
import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const WARNING_MS = 2 * 60 * 1000; // 2 minutes before timeout

export function useSessionTimeout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warningRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let warningShown = false;

    async function logout() {
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      toast.info("নিষ্ক্রিয়তার কারণে লগআউট হয়েছে।");
      navigate({ to: "/", replace: true });
    }

    function reset() {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
      warningShown = false;

      warningRef.current = setTimeout(() => {
        if (!warningShown) {
          warningShown = true;
          toast.warning("২ মিনিট পর লগআউট হয়ে যাবে। চালিয়ে যেতে মাউস নাড়ান।", {
            duration: 10000,
          });
        }
      }, TIMEOUT_MS - WARNING_MS);

      timerRef.current = setTimeout(logout, TIMEOUT_MS);
    }

    const events = ["mousedown", "mousemove", "keydown", "scroll", "touchstart", "click"];

    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();

    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timerRef.current) clearTimeout(timerRef.current);
      if (warningRef.current) clearTimeout(warningRef.current);
    };
  }, [navigate, qc]);
}
