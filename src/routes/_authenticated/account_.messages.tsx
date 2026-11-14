// src/routes/_authenticated/account_.messages.tsx
// Customer chat — voice, file, avatar (Shop's avatar)
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, useMemo } from "react";
import { MessageCircle, RefreshCw, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/shop/SiteHeader";
import { BackButton } from "@/components/shop/BackButton";
import { Footer } from "@/components/shop/Footer";
import { Button } from "@/components/ui/button";
import { ChatBubble, ChatDateDivider, ChatEmpty, MessageInfoDialog } from "@/components/chat/ChatBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { supabase } from "@/integrations/supabase/client";
import {
  myMessages,
  sendCustomerMessage,
  sendCustomerFile,
  sendCustomerVoice,
  markCustomerSeen,
} from "@/lib/chat.functions";
import { useChatNotification } from "@/hooks/use-chat-notification";
import { useShopSettings } from "@/hooks/use-shop-settings"; // 🎯 Import for shop avatar
import { toBnDigits, SHOP } from "@/lib/shop";

export const Route = createFileRoute("/_authenticated/account_/messages")({
  ssr: false,
  head: () => ({ meta: [{ title: "Message — আল হামিদ বস্ত্রালয়" }] }),
  component: CustomerMessages,
});

type Message = {
  id: string;
  customer_id: string;
  sender_id: string;
  sender_role: string;
  message: string;
  status: string;
  created_at: string;
  message_type?: string | null;
  call_status?: string | null;
  file_path?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  mime_type?: string | null;
  duration_seconds?: number | null;
  delivered_at?: string | null;
  seen_at?: string | null;
};

function CustomerMessages() {
  const qc = useQueryClient();
  const { data: shop } = useShopSettings(); // 🎯 Get shop photo
  const fetchMsgs = useServerFn(myMessages);
  const sendMsg = useServerFn(sendCustomerMessage);
  const sendFile = useServerFn(sendCustomerFile);
  const sendVoice = useServerFn(sendCustomerVoice);
  const markSeen = useServerFn(markCustomerSeen);
  const endRef = useRef<HTMLDivElement>(null);

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("chat_sound_enabled");
    return saved !== "false";
  });
  const [infoMsg, setInfoMsg] = useState<Message | null>(null);
  const [signedMap, setSignedMap] = useState<Record<string, string>>({});

  function toggleSound() {
    const v = !soundEnabled;
    setSoundEnabled(v);
    if (typeof window !== "undefined") localStorage.setItem("chat_sound_enabled", String(v));
    toast.success(v ? "Sound চালু হয়েছে" : "Sound বন্ধ হয়েছে");
  }

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["my-chat"],
    queryFn: () => fetchMsgs(),
    refetchInterval: 5000,
  });

  const messages = useMemo(() => (data?.messages ?? []) as Message[], [data]);

  const unreadFromAdmin = messages.filter(
    (m) => m.sender_role === "admin" && m.status !== "seen",
  ).length;

  useChatNotification({ unreadCount: unreadFromAdmin, enabled: soundEnabled, toastOnNew: true });

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (messages.some((m) => m.sender_role === "admin" && m.status !== "seen")) {
      markSeen()
        .then(() => {
          qc.invalidateQueries({ queryKey: ["my-chat"] });
          qc.invalidateQueries({ queryKey: ["chat-unread-count"] });
        })
        .catch(() => {});
    }
  }, [messages, markSeen, qc]);

  useEffect(() => {
    const fileMsgs = messages.filter((m) => m.file_path);
    if (fileMsgs.length === 0) return;
    let cancelled = false;
    (async () => {
      const map: Record<string, string> = {};
      await Promise.all(
        fileMsgs.map(async (m) => {
          if (!m.file_path) return;
          const { data } = await supabase.storage.from("chat-files").createSignedUrl(m.file_path, 3600);
          if (data?.signedUrl) map[m.id] = data.signedUrl;
        }),
      );
      if (!cancelled) setSignedMap(map);
    })();
    return () => { cancelled = true; };
  }, [messages]);

  async function handleSend(msg: string) {
    try {
      await sendMsg({ data: { message: msg } });
      qc.invalidateQueries({ queryKey: ["my-chat"] });
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  }

  async function handleSendFile(file: File, caption?: string) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error("লগইন নেই");
    const ext = file.name.split(".").pop() || "bin";
    const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("chat-files").upload(path, file, { upsert: false });
    if (upErr) throw new Error("Upload ব্যর্থ: " + upErr.message);
    try {
      await sendFile({
        data: {
          filePath: path,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          caption: caption ?? "",
        },
      });
      qc.invalidateQueries({ queryKey: ["my-chat"] });
    } catch (e) {
      await supabase.storage.from("chat-files").remove([path]);
      throw e;
    }
  }

  async function handleSendVoice(blob: Blob, durationSec: number) {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error("লগইন নেই");
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const path = `${userId}/voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("chat-files")
      .upload(path, blob, { upsert: false, contentType: blob.type });
    if (upErr) throw new Error("Voice upload ব্যর্থ: " + upErr.message);
    try {
      await sendVoice({
        data: {
          filePath: path,
          fileSize: blob.size,
          mimeType: blob.type,
          durationSeconds: durationSec,
        },
      });
      qc.invalidateQueries({ queryKey: ["my-chat"] });
      toast.success(`Voice message পাঠানো হয়েছে (${durationSec}s)`);
    } catch (e) {
      await supabase.storage.from("chat-files").remove([path]);
      throw e;
    }
  }

  const groups: { date: string; msgs: Message[] }[] = [];
  let lastDate = "";
  for (const m of messages) {
    const d = m.created_at.slice(0, 10);
    if (d !== lastDate) {
      groups.push({ date: d, msgs: [] });
      lastDate = d;
    }
    groups[groups.length - 1]?.msgs.push(m);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col p-3 md:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <BackButton fallback="/account" label="আমার হিসাব" />
          <div className="flex items-center gap-3">
            {/* Shop photo or fallback */}
            {shop?.shopPhoto ? (
              <img
                src={shop.shopPhoto}
                alt={SHOP.name}
                className="h-10 w-10 shrink-0 rounded-full object-cover"
                style={{ border: "2px solid #c9924a" }}
              />
            ) : (
              <span
                className="flex h-10 w-10 items-center justify-center rounded-full"
                style={{ background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)", color: "#f8f3ea" }}
              >
                <span className="text-lg" style={{ fontFamily: "'Tiro Bangla', serif" }}>আ</span>
              </span>
            )}
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold" style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}>
                {SHOP.name}
              </p>
              <p className="text-[11px]" style={{ color: "#2d7a4f" }}>● অনলাইন</p>
            </div>
            {unreadFromAdmin > 0 && (
              <span className="rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-destructive-foreground">
                {toBnDigits(unreadFromAdmin)} নতুন
              </span>
            )}
          </div>
          <div className="ml-auto flex gap-1">
            <Button variant="outline" size="sm" onClick={toggleSound} title={soundEnabled ? "Sound বন্ধ" : "Sound চালু"}>
              {soundEnabled ? <Bell className="h-3.5 w-3.5 text-primary" /> : <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => refetch()} title="রিফ্রেশ">
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        <div className="flex flex-1 flex-col overflow-hidden rounded-2xl border shadow-card" style={{ borderColor: "#dbcbb2", backgroundColor: "#efeae2" }}>
          <div
            className="flex-1 overflow-y-auto p-3 md:p-4"
            style={{
              minHeight: "50vh",
              maxHeight: "65vh",
              backgroundColor: "#efeae2",
              backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(201,146,74,0.04) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(201,146,74,0.04) 0%, transparent 40%)",
            }}
          >
            {isLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">লোড হচ্ছে…</p>
            ) : messages.length === 0 ? (
              <ChatEmpty />
            ) : (
              <>
                {groups.map((g) => (
                  <div key={g.date}>
                    <ChatDateDivider date={g.date} />
                    {g.msgs.map((m) => (
                      <ChatBubble
                        key={m.id}
                        msg={{ ...m, file_url: signedMap[m.id] ?? null }}
                        isMine={m.sender_role === "customer"}
                        onInfoClick={(mm) => setInfoMsg(mm as Message)}
                        avatarPath={shop?.shopPhoto ?? null} // 🎯 Shop Photo as avatar
                        senderName={SHOP.name}             // 🎯 Shop Name for fallback avatar
                        onVoicePlay={() => markSeen()}      // 🎯 Voice Played = Seen
                      />
                    ))}
                  </div>
                ))}
                <div ref={endRef} />
              </>
            )}
          </div>

          <ChatInput
            onSend={handleSend}
            onSendFile={handleSendFile}
            onSendVoice={handleSendVoice}
          />
        </div>

        <p className="mt-3 text-center text-xs" style={{ color: "#7a6558" }}>
          মালিক/ম্যানেজারের সাথে যোগাযোগ করুন — ২৪ ঘণ্টার মধ্যে উত্তর পাবেন
        </p>
      </main>

      <Footer />

      {infoMsg && (
        <MessageInfoDialog msg={infoMsg as never} isMine={infoMsg.sender_role === "customer"} onClose={() => setInfoMsg(null)} />
      )}
    </div>
  );
}