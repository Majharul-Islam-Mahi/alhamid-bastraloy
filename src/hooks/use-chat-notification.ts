// src/hooks/use-chat-notification.ts
// নতুন chat message এলে sound + toast notification
import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Simple notification sound — Web Audio API দিয়ে
 * Browser কে external file লাগে না
 */
function playNotificationSound() {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;

    const ctx = new AudioContextClass();

    // Two-tone bell: C5 → E5
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

    // Close context after sound
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

  useEffect(() => {
    // First render এ skip
    if (lastCountRef.current === -1) {
      lastCountRef.current = unreadCount;
      return;
    }

    const prev = lastCountRef.current;

    // নতুন message আসলো (count বাড়ল)
    if (unreadCount > prev && enabled) {
      const newMessages = unreadCount - prev;

      // Sound
      playNotificationSound();

      // Toast
      if (toastOnNew) {
        const message =
          newMessages === 1 ? "নতুন ১টি message এসেছে" : `নতুন ${newMessages}টি message এসেছে`;

        toast.info(message, {
          duration: 6000,
          action: toastAction
            ? {
                label: toastAction.label,
                onClick: toastAction.onClick,
              }
            : undefined,
        });
      }
    }

    lastCountRef.current = unreadCount;
  }, [unreadCount, enabled, toastOnNew, toastAction]);
}
