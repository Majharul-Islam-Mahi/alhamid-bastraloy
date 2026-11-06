// src/components/chat/ChatInput.tsx
// Message লেখার input box + Send button + File attachment
import { useState, useRef } from "react";
import { Send, Loader2, Paperclip, X, ImageIcon } from "lucide-react";
import { toast } from "sonner";

type Props = {
  onSend: (message: string) => Promise<void>;
  onSendFile?: (file: File, caption?: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
};

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"];

export function ChatInput({
  onSend,
  onSendFile,
  disabled = false,
  placeholder = "Message লিখুন…",
}: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function pickFile() {
    fileRef.current?.click();
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;

    if (f.size > MAX_BYTES) {
      toast.error("১০ MB এর বেশি file পাঠানো যাবে না");
      return;
    }
    if (!ALLOWED_MIME.includes(f.type)) {
      toast.error("শুধু ছবি বা PDF পাঠানো যাবে");
      return;
    }
    setPending(f);
  }

  function cancelFile() {
    setPending(null);
  }

  async function submit(e?: React.FormEvent) {
    e?.preventDefault();
    const msg = text.trim();

    // File attached? → send with caption
    if (pending && onSendFile) {
      if (busy || disabled) return;
      setBusy(true);
      try {
        await onSendFile(pending, msg || undefined);
        setPending(null);
        setText("");
      } finally {
        setBusy(false);
      }
      return;
    }

    // Text only
    if (!msg || busy || disabled) return;
    setBusy(true);
    try {
      await onSend(msg);
      setText("");
    } finally {
      setBusy(false);
    }
  }

  const isImage = pending?.type.startsWith("image/");

  return (
    <form
      onSubmit={submit}
      className="no-print border-t bg-card"
      style={{ borderColor: "#dbcbb2" }}
    >
      {/* Pending file preview */}
      {pending && (
        <div
          className="flex items-center gap-2 border-b px-3 py-2"
          style={{ borderColor: "#dbcbb2", backgroundColor: "#f5efe6" }}
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            style={{ backgroundColor: "rgba(201,146,74,0.15)", color: "#8a6a45" }}
          >
            {isImage ? <ImageIcon className="h-4 w-4" /> : <Paperclip className="h-4 w-4" />}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium" style={{ color: "#3a2318" }}>
              {pending.name}
            </p>
            <p className="text-[10px]" style={{ color: "#7a6558" }}>
              {(pending.size / 1024).toFixed(0)} KB · এখানে টাইপ করলে caption হবে
            </p>
          </div>
          <button
            type="button"
            onClick={cancelFile}
            className="shrink-0 rounded-full p-1 hover:bg-black/5"
            style={{ color: "#7a6558" }}
            aria-label="বাতিল"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2 p-3">
        {onSendFile && (
          <>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,application/pdf"
              className="hidden"
              onChange={onFileChange}
            />
            <button
              type="button"
              onClick={pickFile}
              disabled={disabled || busy || !!pending}
              className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl border transition disabled:opacity-40"
              style={{
                borderColor: "#dbcbb2",
                backgroundColor: "#fdfaf5",
                color: "#8a6a45",
              }}
              title="ছবি বা PDF পাঠান"
              aria-label="File attach"
            >
              <Paperclip className="h-4 w-4" />
            </button>
          </>
        )}

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={pending ? "Caption (ঐচ্ছিক)…" : placeholder}
          rows={1}
          maxLength={2000}
          disabled={disabled || busy}
          className="min-h-[42px] max-h-32 flex-1 resize-none rounded-xl border bg-background px-3 py-2.5 text-sm outline-none focus:border-ring"
          style={{ lineHeight: "1.4" }}
        />

        <button
          type="submit"
          disabled={busy || disabled || (!text.trim() && !pending)}
          className="flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-xl text-primary-foreground transition disabled:opacity-40"
          style={{
            background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)",
          }}
          aria-label="পাঠান"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </button>
      </div>
    </form>
  );
}
