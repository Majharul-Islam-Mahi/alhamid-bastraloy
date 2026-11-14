// src/hooks/use-chat-notification.ts
// নতুন chat message এলে sound + toast notification

// FIX: toastAction object identity change → useEffect প্রতি render এ re-fire
// FIX: throttle — rapid message flow এ toast spam prevent (5s window)
// FIX: initial mount এ lastCountRef properly initialized
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Simple notification sound — Web Audio API
 * Browser কে external file লাগে না
 */
function playNotificationSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const playNote = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0, now + start);
      gain.gain.linearRampToValueAtTime(0.15, now + start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + duration);
    };

    playNote(523.25, 0, 0.15); // C5
    playNote(659.25, 0.1, 0.2); // E5

    setTimeout(() => {
      ctx.close().catch(() => {});
    }, 500);
  } catch {
    // Silent fail
  }
}

type Options = {
  /** New messages count / unread count */
  unreadCount: number;
  /** Sound enable / disable */
  enabled?: boolean;
  /** Toast on new message */
  toastOnNew?: boolean;
  /** Action on toast click (e.g., navigate to chat) */
  toastAction?: { label: string; onClick: () => void };
};

const TOAST_THROTTLE_MS = 5000;

/**
 * নতুন message এলে sound + toast দেখায়
 * আগের count track করে — শুধু নতুন বাড়লে trigger হয়
 */
export function useChatNotification({
  unreadCount,
  enabled = true,
  toastOnNew = true,
  toastAction,
}: Options) {
  const lastCountRef = useRef<number>(-1);
  const lastToastAtRef = useRef<number>(0);

  // toastAction কে ref এ রাখি — object identity change effect trigger করবে না
  const toastActionRef = useRef(toastAction);
  useEffect(() => {
    toastActionRef.current = toastAction;
  }, [toastAction]);

  useEffect(() => {
    // First render এ skip — previous value সেট করি
    if (lastCountRef.current === -1) {
      lastCountRef.current = unreadCount;
      return;
    }

    const prev = lastCountRef.current;

    // নতুন message আসলো (count বাড়ল)
    if (unreadCount > prev && enabled) {
      const newMessages = unreadCount - prev;

      // Sound — all new messages এ
      playNotificationSound();

      // Toast — throttle (5s window)
      const now = Date.now();
      const canShowToast = toastOnNew && now - lastToastAtRef.current >= TOAST_THROTTLE_MS;

      if (canShowToast) {
        lastToastAtRef.current = now;

        const message =
          newMessages === 1 ? "নতুন ১টি message এসেছে" : `নতুন ${newMessages}টি message এসেছে`;

        const action = toastActionRef.current;

        toast.info(message, {
          duration: 6000,
          action: action
            ? {
                label: action.label,
                onClick: action.onClick,
              }
            : undefined,
        });
      }
    }

    lastCountRef.current = unreadCount;
  }, [unreadCount, enabled, toastOnNew]);
}