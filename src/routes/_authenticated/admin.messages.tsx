// src/routes/_authenticated/admin.messages.tsx
// Admin chat — voice, file, avatar, message info
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState, useMemo } from "react";
import { MessageCircle, RefreshCw, Search, Plus, X, Bell, BellOff } from "lucide-react";
import { toast } from "sonner";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { ChatBubble, ChatDateDivider, ChatEmpty, MessageInfoDialog } from "@/components/chat/ChatBubble";
import { ChatInput } from "@/components/chat/ChatInput";
import { UserAvatar } from "@/components/shared/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import {
  listConversations,
  getConversation,
  sendAdminMessage,
  sendAdminFile,
  sendAdminVoice,
  markAdminSeen,
  chatUnreadCount,
  listAllCustomers,
} from "@/lib/chat.functions";
import { toBnDigits } from "@/lib/shop";
import { useChatNotification } from "@/hooks/use-chat-notification";

export const Route = createFileRoute("/_authenticated/admin/messages")({
  ssr: false,
  head: () => ({ meta: [{ title: "Messages — আল হামিদ বস্ত্রালয়" }] }),
  component: AdminMessages,
});

type Conversation = {
  customer_id: string;
  last_message: string;
  last_at: string;
  last_from: string;
  last_type: string;
  unread: number;
  full_name: string;
  shop_name: string;
  mobile: string;
  serial: string | null;
  avatar_path: string | null;
};

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

type CustomerLite = {
  id: string;
  serial: string;
  shop_name: string;
  owner_name: string | null;
  mobile: string | null;
  kind: string;
  user_id: string | null;
};

function AdminMessages() {
  const qc = useQueryClient();
  const fetchConvs = useServerFn(listConversations);
  const fetchConv = useServerFn(getConversation);
  const sendMsg = useServerFn(sendAdminMessage);
  const sendFile = useServerFn(sendAdminFile);
  const sendVoice = useServerFn(sendAdminVoice);
  const markSeen = useServerFn(markAdminSeen);
  const fetchAllCustomers = useServerFn(listAllCustomers);
  const fetchUnread = useServerFn(chatUnreadCount);
  const endRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [infoMsg, setInfoMsg] = useState<Message | null>(null);
  const [signedMap, setSignedMap] = useState<Record<string, string>>({});

  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    const saved = localStorage.getItem("chat_sound_enabled");
    return saved !== "false";
  });

  function toggleSound() {
    const v = !soundEnabled;
    setSoundEnabled(v);
    if (typeof window !== "undefined") localStorage.setItem("chat_sound_enabled", String(v));
    toast.success(v ? "Sound চালু" : "Sound বন্ধ");
  }

  const { data: unreadData } = useQuery({
    queryKey: ["chat-unread-count"],
    queryFn: () => fetchUnread(),
    refetchInterval: 10 * 1000,
  });
  const totalUnread = unreadData?.count ?? 0;

  useChatNotification({
    unreadCount: totalUnread,
    enabled: soundEnabled,
    toastOnNew: true,
    toastAction: {
      label: "দেখুন",
      onClick: () => {
        qc.invalidateQueries({ queryKey: ["admin-conversations"] });
      },
    },
  });

  const { data: convData } = useQuery({
    queryKey: ["admin-conversations"],
    queryFn: () => fetchConvs(),
    refetchInterval: 5000,
  });

  const conversations = useMemo(
    () => (convData?.conversations ?? []) as Conversation[],
    [convData],
  );

  const { data: allCustomersData } = useQuery({
    queryKey: ["all-customers"],
    queryFn: () => fetchAllCustomers(),
    enabled: showNew,
  });
  const allCustomers = useMemo(
    () => (allCustomersData?.customers ?? []) as CustomerLite[],
    [allCustomersData],
  );

  const filteredCustomers = useMemo(() => {
    const s = customerSearch.trim().toLowerCase();
    if (!s) return allCustomers;
    return allCustomers.filter(
      (c) =>
        (c.shop_name ?? "").toLowerCase().includes(s) ||
        (c.owner_name ?? "").toLowerCase().includes(s) ||
        (c.serial ?? "").toLowerCase().includes(s) ||
        (c.mobile ?? "").includes(s),
    );
  }, [allCustomers, customerSearch]);

  const { data: chatData, isLoading: chatLoading } = useQuery({
    queryKey: ["admin-chat", selected],
    enabled: !!selected,
    queryFn: () => fetchConv({ data: { customerId: selected! } }),
    refetchInterval: 5000,
  });

  const messages = useMemo(() => (chatData?.messages ?? []) as Message[], [chatData]);
  const customer = chatData?.customer;
  const party = chatData?.party;

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    if (!selected) return;
    if (messages.some((m) => m.sender_role === "customer" && m.status !== "seen")) {
      markSeen({ data: { customerId: selected } })
        .then(() => {
          qc.invalidateQueries({ queryKey: ["admin-chat", selected] });
          qc.invalidateQueries({ queryKey: ["admin-conversations"] });
          qc.invalidateQueries({ queryKey: ["chat-unread-count"] });
        })
        .catch(() => {});
    }
  }, [messages, selected, markSeen, qc]);

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
    if (!selected) return;
    try {
      await sendMsg({ data: { customerId: selected, message: msg } });
      qc.invalidateQueries({ queryKey: ["admin-chat", selected] });
      qc.invalidateQueries({ queryKey: ["admin-conversations"] });
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    }
  }

  async function handleSendFile(file: File, caption?: string) {
    if (!selected) return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error("লগইন নেই");
    const ext = file.name.split(".").pop() || "bin";
    const path = `admin/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage.from("chat-files").upload(path, file, { upsert: false });
    if (upErr) throw new Error("Upload ব্যর্থ: " + upErr.message);
    try {
      await sendFile({
        data: {
          customerId: selected,
          filePath: path,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          caption: caption ?? "",
        },
      });
      qc.invalidateQueries({ queryKey: ["admin-chat", selected] });
      qc.invalidateQueries({ queryKey: ["admin-conversations"] });
    } catch (e) {
      await supabase.storage.from("chat-files").remove([path]);
      throw e;
    }
  }

  async function handleSendVoice(blob: Blob, durationSec: number) {
    if (!selected) return;
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) throw new Error("লগইন নেই");
    const ext = blob.type.includes("mp4") ? "mp4" : "webm";
    const path = `admin/${userId}/voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error: upErr } = await supabase.storage
      .from("chat-files")
      .upload(path, blob, { upsert: false, contentType: blob.type });
    if (upErr) throw new Error("Voice upload ব্যর্থ: " + upErr.message);
    try {
      await sendVoice({
        data: {
          customerId: selected,
          filePath: path,
          fileSize: blob.size,
          mimeType: blob.type,
          durationSeconds: durationSec,
        },
      });
      qc.invalidateQueries({ queryKey: ["admin-chat", selected] });
      qc.invalidateQueries({ queryKey: ["admin-conversations"] });
      toast.success(`Voice message পাঠানো হয়েছে (${durationSec}s)`);
    } catch (e) {
      await supabase.storage.from("chat-files").remove([path]);
      throw e;
    }
  }

  const filteredConvs = conversations.filter((c) => {
    const s = search.trim().toLowerCase();
    if (!s) return true;
    return (
      c.full_name.toLowerCase().includes(s) ||
      c.shop_name.toLowerCase().includes(s) ||
      c.mobile.includes(s) ||
      (c.serial ?? "").toLowerCase().includes(s)
    );
  });

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

  const selectedConv = conversations.find((c) => c.customer_id === selected);

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-1 md:px-0">
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <div className="flex items-center gap-2">
          <MessageCircle className="h-6 w-6 text-primary md:h-7 md:w-7" />
          <h1 className="font-display text-2xl text-primary md:text-3xl">Messages</h1>
          {totalUnread > 0 && (
            <span className="rounded-full bg-destructive px-2.5 py-0.5 text-xs font-bold text-destructive-foreground">
              {toBnDigits(totalUnread)} নতুন
            </span>
          )}
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={toggleSound} title={soundEnabled ? "Sound বন্ধ" : "Sound চালু"}>
            {soundEnabled ? <Bell className="h-3.5 w-3.5 text-primary" /> : <BellOff className="h-3.5 w-3.5 text-muted-foreground" />}
          </Button>
          <Button
            variant={showNew ? "outline" : "coffee"}
            size="sm"
            onClick={() => { setShowNew((v) => !v); setCustomerSearch(""); }}
          >
            {showNew ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showNew ? "বাতিল" : "নতুন চ্যাট"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => qc.invalidateQueries({ queryKey: ["admin-conversations"] })}>
            <RefreshCw className="h-3.5 w-3.5" /> রিফ্রেশ
          </Button>
        </div>
      </div>

      {showNew && (
        <div className="rounded-2xl border-2 border-primary/30 bg-card p-4 shadow-card">
          <p className="mb-3 text-sm font-semibold text-primary">কার সাথে কথা বলতে চান?</p>
          <input
            autoFocus
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder="সিরিয়াল / দোকান / মোবাইল…"
            className="mb-3 h-10 w-full rounded-lg border bg-background px-3 text-sm"
          />
          {filteredCustomers.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">কোনো কাস্টমার পাওয়া যায়নি</p>
          ) : (
            <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2 md:grid-cols-3">
              {filteredCustomers.slice(0, 40).map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    if (!c.user_id) {
                      toast.error("এই কাস্টমারের login ID নেই");
                      return;
                    }
                    setSelected(c.user_id);
                    setShowNew(false);
                    setCustomerSearch("");
                  }}
                  disabled={!c.user_id}
                  className="flex items-center gap-2 rounded-lg border bg-background p-2 text-left transition hover:border-primary hover:bg-accent/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <UserAvatar path={null} name={c.shop_name || "?"} size={36} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-semibold">{c.shop_name}</p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {toBnDigits(c.serial)}{c.mobile && ` · ${toBnDigits(c.mobile)}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-[320px_1fr]" style={{ minHeight: "70vh" }}>
        {/* LEFT: Conversation list */}
        <div
          className={`overflow-hidden rounded-2xl border bg-card shadow-card ${selected ? "hidden md:block" : ""}`}
          style={{ borderColor: "#dbcbb2" }}
        >
          <div className="border-b p-3" style={{ borderColor: "#dbcbb2" }}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="নাম / সিরিয়াল / মোবাইল…"
                className="h-9 w-full rounded-lg border bg-background pl-9 pr-3 text-sm"
              />
            </div>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {filteredConvs.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">কোনো conversation নেই</p>
            ) : (
              filteredConvs.map((c) => (
                <button
                  key={c.customer_id}
                  onClick={() => setSelected(c.customer_id)}
                  className={`w-full border-b p-3 text-left transition hover:bg-accent/10 ${
                    selected === c.customer_id ? "bg-accent/15" : ""
                  }`}
                  style={{ borderColor: "#eadfcc" }}
                >
                  <div className="flex items-start gap-3">
                    <UserAvatar
                      path={c.avatar_path}
                      name={c.shop_name || c.full_name || "?"}
                      size={40}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold" style={{ color: "#3a2318" }}>
                          {c.shop_name || c.full_name}
                        </p>
                        {c.unread > 0 && (
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                            {toBnDigits(c.unread)}
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 truncate text-xs" style={{ color: "#7a6558" }}>
                        {c.last_type === "call" && " "}
                        {c.last_type === "voice" && " "}
                        {c.last_from === "admin" && "আপনি: "}
                        {c.last_message}
                      </p>
                      <p className="mt-0.5 text-[10px]" style={{ color: "#8a7a6a" }}>
                        {new Date(c.last_at).toLocaleString("bn-BD", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* RIGHT: Chat area */}
        <div
          className={`flex flex-col overflow-hidden rounded-2xl border shadow-card ${!selected ? "hidden md:flex" : ""}`}
          style={{ borderColor: "#dbcbb2", backgroundColor: "#efeae2" }}
        >
          {!selected ? (
            <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(201,146,74,0.15)" }}>
                <MessageCircle className="h-7 w-7" style={{ color: "#c9924a" }} />
              </div>
              <p className="mt-3 text-sm font-semibold" style={{ color: "#3a2318" }}>
                বাম দিক থেকে customer select করুন
              </p>
              <p className="mt-1 text-xs" style={{ color: "#7a6558" }}>অথবা "নতুন চ্যাট" চেপে শুরু করুন</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 border-b bg-card p-3" style={{ borderColor: "#dbcbb2" }}>
                <button onClick={() => setSelected(null)} className="rounded-full p-1 text-muted-foreground hover:bg-accent md:hidden">
                  ←
                </button>
                <UserAvatar
                  path={selectedConv?.avatar_path ?? customer?.avatar_path ?? null}
                  name={party?.shop_name || customer?.full_name || "?"}
                  size={44}
                  borderColor="#c9924a"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold" style={{ color: "#3a2318" }}>
                    {party?.shop_name || customer?.full_name || "Customer"}
                  </p>
                  <p className="truncate text-[11px]" style={{ color: "#2d7a4f" }}>
                    ● অনলাইন{customer?.mobile && ` · ${toBnDigits(customer.mobile)}`}
                  </p>
                </div>
              </div>

              <div
                className="flex-1 overflow-y-auto p-3 md:p-4"
                style={{
                  minHeight: "40vh",
                  maxHeight: "55vh",
                  backgroundColor: "#efeae2",
                  backgroundImage:
                    "radial-gradient(circle at 20% 30%, rgba(201,146,74,0.04) 0%, transparent 40%), radial-gradient(circle at 80% 70%, rgba(201,146,74,0.04) 0%, transparent 40%)",
                }}
              >
                {chatLoading ? (
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
                            isMine={m.sender_role === "admin"}
                            onInfoClick={(mm) => setInfoMsg(mm as Message)}
                            avatarPath={selectedConv?.avatar_path ?? customer?.avatar_path} // Avatar Path
                            senderName={party?.shop_name || customer?.full_name || "Customer"} // Name for fallback avatar
                            onVoicePlay={() => markSeen({ data: { customerId: selected! } })} // Voice Play = Seen
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
                placeholder="উত্তর লিখুন…"
              />
            </>
          )}
        </div>
      </div>

      {infoMsg && (
        <MessageInfoDialog msg={infoMsg as never} isMine={infoMsg.sender_role === "admin"} onClose={() => setInfoMsg(null)} />
      )}
    </div>
  );
}