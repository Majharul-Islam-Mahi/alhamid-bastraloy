// src/components/chat/ChatBubble.tsx
// WhatsApp-style message bubble with 3-tick status, file/image/voice, call entries
import { Check, CheckCheck, Phone, PhoneMissed, FileText, Download, Play, Pause } from "lucide-react";
import { useRef, useState } from "react";

type Message = {
  id: string;
  message: string;
  sender_role: string;
  status: string;
  created_at: string;
  message_type?: string | null;
  call_status?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  file_url?: string | null;
  duration_seconds?: number | null;
  delivered_at?: string | null;
  seen_at?: string | null;
};

// ─── 3-tick Status ───
function StatusTicks({ status }: { status: string }) {
  if (status === "seen") {
    return (
      <span className="inline-flex items-center" style={{ color: "#53bdeb" }}>
        <CheckCheck className="h-3.5 w-3.5 -mr-2" strokeWidth={2.5} />
        <Check className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    );
  }
  if (status === "delivered") {
    return (
      <span className="inline-flex items-center" style={{ color: "rgba(255,255,255,0.7)" }}>
        <CheckCheck className="h-3.5 w-3.5" strokeWidth={2.5} />
      </span>
    );
  }
  return <Check className="h-3.5 w-3.5" strokeWidth={2.5} style={{ opacity: 0.75 }} />;
}

function fmtTime(iso: string): string {
  return new Date(iso)
    .toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true })
    .replace("AM", "").replace("PM", "").trim();
}

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function fmtDur(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ─── Voice Player ───
function VoicePlayer({ url, duration, isMine }: { url: string; duration: number; isMine: boolean }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);

  function toggle() {
    const a = audioRef.current;
    if (!a) return;
    if (playing) a.pause();
    else a.play();
  }

  const progress = duration > 0 ? current / duration : 0;

  return (
    <div className="flex min-w-[200px] max-w-[280px] items-center gap-3">
      <audio
        ref={audioRef}
        src={url}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => { setPlaying(false); setCurrent(0); }}
        onTimeUpdate={() => setCurrent(audioRef.current?.currentTime ?? 0)}
        preload="metadata"
      />
      <button
        type="button"
        onClick={toggle}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
        style={{
          backgroundColor: isMine ? "rgba(255,255,255,0.25)" : "#d9fdd3",
          color: isMine ? "#f0f2f5" : "#027a52",
        }}
      >
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 30 }).map((_, i) => {
            const active = i / 30 <= progress;
            return (
              <div
                key={i}
                className="w-0.5 rounded-full"
                style={{
                  height: `${6 + (i % 4) * 2}px`,
                  backgroundColor: isMine
                    ? (active ? "#f0f2f5" : "rgba(240,242,245,0.35)")
                    : (active ? "#027a52" : "rgba(2,122,82,0.3)"),
                }}
              />
            );
          })}
        </div>
        <p className="mt-1 text-[10px]" style={{ color: isMine ? "rgba(240,242,245,0.7)" : "#667781" }}>
          {playing || current > 0 ? fmtDur(current) : fmtDur(duration)}
        </p>
      </div>
    </div>
  );
}

export function ChatBubble({
  msg,
  isMine,
  onInfoClick,
}: {
  msg: Message;
  isMine: boolean;
  onInfoClick?: (msg: Message) => void;
}) {
  const time = fmtTime(msg.created_at);
  const hasFile = !!msg.file_path;
  const isImage = msg.mime_type?.startsWith("image/");
  const isPdf = msg.mime_type === "application/pdf";
  const isVoice = msg.message_type === "voice";

  // Call entry
  if (msg.message_type === "call") {
    const status = msg.call_status ?? "no_answer";
    const isMissed = status === "no_answer" || status === "missed";
    const Icon = isMissed ? PhoneMissed : Phone;
    const label =
      status === "no_answer" ? "No answer"
        : status === "missed" ? "Missed"
        : status === "outgoing" ? "Outgoing"
        : "Incoming";
    return (
      <div className="my-2 flex justify-center">
        <div
          className="flex items-center gap-2 rounded-full px-4 py-1.5 shadow-sm"
          style={{
            backgroundColor: isMissed ? "#fff5f5" : "#f0f9ff",
            border: `1px solid ${isMissed ? "#fecaca" : "#bae6fd"}`,
          }}
        >
          <Icon className="h-3.5 w-3.5" style={{ color: isMissed ? "#dc2626" : "#0369a1" }} />
          <span className="text-xs font-medium" style={{ color: isMissed ? "#991b1b" : "#075985" }}>
            Voice call
          </span>
          <span className="text-[10px]" style={{ color: "#6b7280" }}>· {label} · {time}</span>
        </div>
      </div>
    );
  }

  // Regular bubble
  const caption = hasFile && !isVoice && msg.message === msg.file_name ? null : msg.message;

  return (
    <div className={`mb-1.5 flex ${isMine ? "justify-end" : "justify-start"}`}>
      <div
        className={`group relative max-w-[78%] shadow-sm ${isMine ? "rounded-2xl rounded-tr-sm" : "rounded-2xl rounded-tl-sm"}`}
        style={{
          backgroundColor: isMine ? "#005c4b" : "#ffffff",
          color: isMine ? "#f0f2f5" : "#111b21",
          border: isMine ? "none" : "1px solid #e9edef",
          overflow: "hidden",
        }}
      >
        {/* 🎤 Voice message */}
        {hasFile && isVoice && msg.file_url && (
          <div className="px-3 pt-2 pb-1">
            <VoicePlayer url={msg.file_url} duration={msg.duration_seconds ?? 0} isMine={isMine} />
          </div>
        )}

        {/* Image */}
        {hasFile && isImage && msg.file_url && (
          <a href={msg.file_url} target="_blank" rel="noreferrer" className="block" title="বড় করে দেখুন">
            <img src={msg.file_url} alt={msg.file_name ?? "image"} loading="lazy" className="max-h-80 w-full object-cover" />
          </a>
        )}

        {/* PDF / other file (not voice) */}
        {hasFile && !isImage && !isVoice && (
          <a
            href={msg.file_url ?? "#"}
            target={msg.file_url ? "_blank" : undefined}
            rel="noreferrer"
            download={msg.file_name ?? undefined}
            className="flex items-center gap-3 px-3 py-3 transition hover:bg-black/5"
            style={{ backgroundColor: isMine ? "rgba(0,0,0,0.15)" : "#f0f2f5" }}
          >
            <span
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{
                backgroundColor: isMine ? "rgba(255,255,255,0.2)" : "#d9fdd3",
                color: isMine ? "#f0f2f5" : "#027a52",
              }}
            >
              <FileText className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{msg.file_name ?? "Document"}</p>
              <p className="text-[11px]" style={{ color: isMine ? "rgba(240,242,245,0.7)" : "#667781" }}>
                {isPdf ? "PDF" : "File"}
                {msg.file_size ? ` · ${fmtSize(msg.file_size)}` : ""}
              </p>
            </div>
            {msg.file_url && (
              <Download className="h-4 w-4 shrink-0" style={{ color: isMine ? "rgba(240,242,245,0.8)" : "#027a52" }} />
            )}
          </a>
        )}

        {/* Text caption */}
        {caption && (
          <p className="whitespace-pre-wrap break-words px-3 pt-2 text-[15px] leading-snug">{caption}</p>
        )}

        {/* Time + ticks */}
        <div
          className={`flex items-center justify-end gap-1 px-3 ${caption || hasFile ? "pb-1.5 pt-1" : "py-2"}`}
        >
          <button
            type="button"
            onClick={() => onInfoClick?.(msg)}
            className="text-[11px] tabular-nums hover:underline"
            style={{ color: isMine ? "rgba(240,242,245,0.75)" : "#667781" }}
            title="Message info"
          >
            {time}
          </button>
          {isMine && <StatusTicks status={msg.status} />}
        </div>
      </div>
    </div>
  );
}

// ─── Date Divider ───
export function ChatDateDivider({ date }: { date: string }) {
  const today = new Date();
  const todayISO = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const yestISO = `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, "0")}-${String(yest.getDate()).padStart(2, "0")}`;

  let label: string;
  if (date === todayISO) label = "আজ";
  else if (date === yestISO) label = "গতকাল";
  else {
    const d = new Date(date + "T00:00:00");
    label = d.toLocaleDateString("bn-BD", { day: "numeric", month: "long", year: "numeric" });
  }

  return (
    <div className="my-3 flex items-center justify-center">
      <span className="rounded-lg px-3 py-1 text-[11px] font-medium shadow-sm" style={{ backgroundColor: "#ffffff", color: "#54656f" }}>
        {label}
      </span>
    </div>
  );
}

// ─── Message Info Dialog ───
export function MessageInfoDialog({
  msg,
  isMine,
  onClose,
}: {
  msg: Message;
  isMine: boolean;
  onClose: () => void;
}) {
  const rows: { label: string; value: string; color?: string }[] = [];

  if (msg.message_type === "call") {
    rows.push({
      label: "Call type",
      value: msg.call_status === "no_answer" ? "No answer" : (msg.call_status ?? "—"),
    });
  }

  if (msg.delivered_at) {
    rows.push({
      label: "Delivered",
      value: new Date(msg.delivered_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      color: "#667781",
    });
  } else if (isMine) {
    rows.push({ label: "Delivered", value: "—", color: "#667781" });
  }

  if (msg.seen_at) {
    rows.push({
      label: "Read",
      value: new Date(msg.seen_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
      color: "#53bdeb",
    });
  } else if (isMine) {
    rows.push({ label: "Read", value: "—", color: "#667781" });
  }

  rows.unshift({
    label: "Sent",
    value: new Date(msg.created_at).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }),
  });

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b px-4 py-3" style={{ borderColor: "#e9edef", backgroundColor: "#f0f2f5" }}>
          <p className="text-base font-semibold" style={{ color: "#111b21" }}>Message info</p>
        </div>
        <div className="max-h-40 overflow-y-auto p-4">
          {msg.message_type === "voice" ? (
            <p className="text-sm text-muted-foreground">🎤 Voice message ({fmtDur(msg.duration_seconds ?? 0)})</p>
          ) : msg.file_path ? (
            <p className="text-sm text-muted-foreground">📎 {msg.file_name}</p>
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm" style={{ color: "#111b21" }}>{msg.message}</p>
          )}
        </div>
        <div className="border-t px-4 py-3" style={{ borderColor: "#e9edef" }}>
          <ul className="space-y-2">
            {rows.map((r, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex items-center gap-2" style={{ color: "#54656f" }}>
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color ?? "#027a52" }} />
                  {r.label}
                </span>
                <span className="tabular-nums" style={{ color: r.color ?? "#111b21" }}>{r.value}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="border-t px-4 py-3 text-right" style={{ borderColor: "#e9edef" }}>
          <button onClick={onClose} className="rounded-md px-4 py-1.5 text-sm font-medium" style={{ color: "#027a52" }}>
            বন্ধ করুন
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Empty state ───
export function ChatEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(201,146,74,0.15)" }}>
        <Phone className="h-7 w-7" style={{ color: "#c9924a" }} />
      </div>
      <p className="mt-3 text-sm font-semibold" style={{ color: "#3a2318" }}>এখনো কোনো message নেই</p>
      <p className="mt-1 text-xs" style={{ color: "#7a6558" }}>নিচে টাইপ করে message পাঠান</p>
    </div>
  );
}