// src/components/chat/ChatVoiceRecorder.tsx
// WhatsApp-style voice message recorder
// Uses MediaRecorder API (browser native — no external deps)
import { useState, useRef, useEffect } from "react";
import { Mic, Square, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

type Props = {
  onSend: (blob: Blob, durationSec: number) => Promise<void>;
  disabled?: boolean;
};

const MAX_DURATION_SEC = 120; // 2 minutes max
const MIN_DURATION_SEC = 1;   // at least 1 second

export function ChatVoiceRecorder({ onSend, disabled = false }: Props) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [busy, setBusy] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const startTimeRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const cancelledRef = useRef<boolean>(false);

  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  function cleanup() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      try { mediaRecorderRef.current.stop(); } catch { /* ignore */ }
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : MediaRecorder.isTypeSupported("audio/mp4")
            ? "audio/mp4"
            : "";

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      cancelledRef.current = false;
      startTimeRef.current = Date.now();
      setElapsed(0);
      setRecording(true);

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });

        cleanup();
        setRecording(false);
        setElapsed(0);

        if (cancelledRef.current) return;

        if (duration < MIN_DURATION_SEC) {
          toast.error("খুব ছোট — কমপক্ষে ১ সেকেন্ড বলুন");
          return;
        }
        if (blob.size < 1000) {
          toast.error("কিছু রেকর্ড হয়নি — আবার চেষ্টা করুন");
          return;
        }

        setBusy(true);
        try {
          await onSend(blob, duration);
        } catch (e) {
          toast.error((e as Error).message);
        } finally {
          setBusy(false);
        }
      };

      recorder.start();

      timerRef.current = setInterval(() => {
        const sec = Math.round((Date.now() - startTimeRef.current) / 1000);
        setElapsed(sec);
        if (sec >= MAX_DURATION_SEC) stopRecording();
      }, 250);
    } catch (e) {
      toast.error("মাইক্রোফোন access করা যায়নি: " + (e as Error).message);
      cleanup();
      setRecording(false);
    }
  }

  function stopRecording() {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
  }

  function cancelRecording() {
    cancelledRef.current = true;
    stopRecording();
  }

  function fmt(sec: number): string {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }

  if (recording) {
    return (
      <div
        className="flex items-center gap-2 rounded-xl border-2 p-2"
        style={{ borderColor: "#a83e2c", backgroundColor: "#fef2f2" }}
      >
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: "#a83e2c" }}
        >
          <Mic className="h-4 w-4 animate-pulse" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold" style={{ color: "#a83e2c" }}>
            রেকর্ডিং চলছে…
          </p>
          <p className="font-mono text-sm tabular-nums" style={{ color: "#a83e2c" }}>
            {fmt(elapsed)} / {fmt(MAX_DURATION_SEC)}
          </p>
        </div>
        <button
          type="button"
          onClick={cancelRecording}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground hover:bg-accent"
          title="বাতিল"
        >
          <X className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={stopRecording}
          className="flex h-9 shrink-0 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-white hover:brightness-110"
          style={{ backgroundColor: "#a83e2c" }}
        >
          <Square className="h-3.5 w-3.5" /> পাঠান
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={startRecording}
      disabled={disabled || busy}
      className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border transition disabled:opacity-40"
      style={{ borderColor: "#dbcbb2", backgroundColor: "#fdfaf5", color: "#8a6a45" }}
      title="Voice message রেকর্ড করুন"
    >
      {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mic className="h-4 w-4" />}
    </button>
  );
}