// src/routes/_authenticated/admin.memo.$id.tsx
// মেমো দেখুন, edit, প্রিন্ট, confirm, void, শেয়ার (WhatsApp/SMS) — Unit column + signature
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import {
  Printer,
  CheckCircle2,
  XCircle,
  Pencil,
  Save,
  X,
  Plus,
  Trash2,
  Share2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, englishDateBn, banglaDate, weekdayBn, num, SHOP } from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-provider";
import { MemoShareDialog } from "@/components/admin/MemoShareDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/memo/$id")({
  head: () => ({ meta: [{ title: "মেমো — আল হামিদ বস্ত্রালয়" }] }),
  component: MemoView,
});

type EditItem = {
  key: string;
  id?: string;
  name: string;
  quantity: string;
  unit: string;
  price: string;
};

const UNIT_OPTIONS = ["পিস", "থান", "গজ", "জোড়া", "ডজন", "১/২ ডজন", "সেট", "মিটার"];

function MemoView() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const confirmDialog = useConfirm();
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [paid, setPaid] = useState("");
  const [note, setNote] = useState("");
  const [editItems, setEditItems] = useState<EditItem[]>([]);

  const { data: memo } = useQuery({
    queryKey: ["memo", id],
    queryFn: async () => (await supabase.from("memos").select("*").eq("id", id).single()).data,
  });

  const { data: items = [] } = useQuery({
    queryKey: ["memo-items", id],
    queryFn: async () =>
      (await supabase.from("memo_items").select("*").eq("memo_id", id).order("position")).data ??
      [],
  });

  useEffect(() => {
    if (!memo) return;
    setShopName(memo.shop_name ?? "");
    setOwnerName(memo.owner_name ?? "");
    setMobile(memo.mobile ?? "");
    setAddress(memo.address ?? "");
    setPaid(String(memo.paid ?? "0"));
    setNote(memo.note ?? "");
  }, [memo]);

  useEffect(() => {
    if (items.length === 0) return;
    setEditItems(
      items.map((it) => ({
        key: crypto.randomUUID(),
        id: it.id,
        name: it.name,
        quantity: String(it.quantity),
        unit: it.unit ?? "পিস",
        price: String(it.price),
      })),
    );
  }, [items]);

  const total = editItems.reduce((s, i) => s + num(i.quantity) * num(i.price), 0);
  const paidNum = num(paid);
  const due = total - paidNum;

  const confirmedTotal =
    items.reduce((s, it) => s + Number(it.quantity) * Number(it.price), 0) ||
    Number(memo?.total ?? 0);

  // ---- Confirm ----
  async function confirmMemo() {
    if (!memo) return;
    const ok = await confirmDialog({
      title: "মেমো কনফার্ম করবেন?",
      message: "স্টক কমে যাবে এবং ফেরানো যাবে না।",
      confirmText: "হ্যাঁ, কনফার্ম",
      cancelText: "বাতিল",
      variant: "info",
    });
    if (!ok) return;
    setBusy(true);
    const { data: no, error } = await supabase.rpc("confirm_memo", {
      _memo_id: memo.id,
    });
    setBusy(false);
    if (error) {
      toast.error("কনফার্ম হয়নি: " + error.message);
      return;
    }
    const noDisplay = `M${String(no).padStart(3, "0")}`;
    toast.success(`${noDisplay} কনফার্ম হয়েছে — স্টক কমেছে`);
    qc.invalidateQueries({ queryKey: ["memo", id] });
    qc.invalidateQueries({ queryKey: ["memo-items", id] });
    qc.invalidateQueries({ queryKey: ["memos-list"] });
    qc.invalidateQueries({ queryKey: ["memos-split-view"] });
    qc.invalidateQueries({ queryKey: ["memos-pending-count"] });
    qc.invalidateQueries({ queryKey: ["day-entries"] });
    qc.invalidateQueries({ queryKey: ["day-summary"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["products-all"] });
  }

  // ---- Void ----
  async function voidMemo() {
    if (!memo) return;
    const ok = await confirmDialog({
      title: "মেমো void করবেন?",
      message: "এটা ফেরানো যাবে না। Stock back হবে না।",
      confirmText: "হ্যাঁ, void",
      cancelText: "বাতিল",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.from("memos").update({ status: "void" }).eq("id", memo.id);
    setBusy(false);
    if (error) {
      toast.error("void হয়নি");
      return;
    }
    toast.success("void করা হয়েছে");
    qc.invalidateQueries({ queryKey: ["memo", id] });
    qc.invalidateQueries({ queryKey: ["memos-list"] });
    qc.invalidateQueries({ queryKey: ["memos-split-view"] });
    qc.invalidateQueries({ queryKey: ["memos-pending-count"] });
  }

  // ---- Delete draft ----
  async function deleteDraft() {
    if (!memo) return;
    const ok = await confirmDialog({
      title: "পেন্ডিং মেমো মুছবেন?",
      message: "ডাটা চিরতরে চলে যাবে।",
      confirmText: "হ্যাঁ, মুছুন",
      cancelText: "না",
      variant: "danger",
    });
    if (!ok) return;
    setBusy(true);
    const { error } = await supabase.from("memos").delete().eq("id", memo.id);
    setBusy(false);
    if (error) {
      toast.error("মুছা যায়নি: " + error.message);
      return;
    }
    toast.success("পেন্ডিং মেমো মুছে ফেলা হয়েছে");
    qc.invalidateQueries({ queryKey: ["memos-list"] });
    qc.invalidateQueries({ queryKey: ["memos-split-view"] });
    qc.invalidateQueries({ queryKey: ["memos-pending-count"] });
    navigate({ to: "/admin/memo" });
  }

  // ---- Save edits ----
  async function saveEdits() {
    if (!memo) return;
    setBusy(true);

    const { error: e1 } = await supabase
      .from("memos")
      .update({
        shop_name: shopName.trim(),
        owner_name: ownerName.trim() || null,
        mobile: mobile.trim() || null,
        address: address.trim() || null,
        total,
        paid: paidNum,
        note: note.trim() || null,
      })
      .eq("id", memo.id);

    if (e1) {
      setBusy(false);
      toast.error("মেমো আপডেট হয়নি: " + e1.message);
      return;
    }

    const { error: e2 } = await supabase.from("memo_items").delete().eq("memo_id", memo.id);

    if (e2) {
      setBusy(false);
      toast.error("আইটেম আপডেট হয়নি: " + e2.message);
      return;
    }

    const validItems = editItems.filter((i) => i.name.trim());
    if (validItems.length > 0) {
      const { error: e3 } = await supabase.from("memo_items").insert(
        validItems.map((i, idx) => ({
          memo_id: memo.id,
          position: idx,
          name: i.name.trim(),
          quantity: num(i.quantity),
          unit: i.unit || "পিস",
          price: num(i.price),
          product_id: null,
          base_quantity: num(i.quantity),
        })),
      );
      if (e3) {
        setBusy(false);
        toast.error("আইটেম সেভ হয়নি: " + e3.message);
        return;
      }
    }

    setBusy(false);
    toast.success("মেমো আপডেট হয়েছে");
    setEditing(false);
    qc.invalidateQueries({ queryKey: ["memo", id] });
    qc.invalidateQueries({ queryKey: ["memo-items", id] });
  }

  // ---- Item helpers ----
  function addItem() {
    setEditItems((arr) => [
      ...arr,
      {
        key: crypto.randomUUID(),
        name: "",
        quantity: "1",
        unit: "পিস",
        price: "",
      },
    ]);
  }
  function removeItem(key: string) {
    setEditItems((arr) => arr.filter((i) => i.key !== key));
  }
  function updateItem(key: string, patch: Partial<EditItem>) {
    setEditItems((arr) => arr.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  if (!memo) return <p className="p-8 text-center">লোড হচ্ছে…</p>;

  const canEdit = memo.status === "draft";
  const isDraft = memo.status === "draft";
  const isVoid = memo.status === "void";
  const isConfirmed = memo.status === "confirmed";

  const displayItems = editing
    ? editItems
    : items.map((it) => ({
        key: it.id,
        name: it.name,
        quantity: String(it.quantity),
        unit: it.unit ?? "পিস",
        price: String(it.price),
      }));
  const displayTotal = editing ? total : confirmedTotal;
  const displayPaid = editing ? paidNum : Number(memo.paid);
  const displayDue = displayTotal - displayPaid;

  const memoTypeLabel =
    memo.memo_type === "wholesale"
      ? "পাইকারি"
      : memo.memo_type === "retail_serial"
        ? "খুচরা সিরিয়াল"
        : memo.memo_type === "retail_manual"
          ? "খুচরা নতুন"
          : "পাইকারি";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* ============ Toolbar ============ */}
      <div className="no-print flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin/memo" />
        <h1 className="font-display text-xl text-primary">
          {isDraft ? "পেন্ডিং মেমো" : isVoid ? "বাতিল মেমো" : "মেমো"}
        </h1>
        <span
          className={`rounded-full px-3 py-0.5 text-xs font-semibold ${
            memo.memo_type === "wholesale"
              ? "bg-primary/10 text-primary"
              : "bg-accent/20 text-primary"
          }`}
        >
          {memoTypeLabel}
        </span>
        <div className="ml-auto flex flex-wrap gap-2">
          {editing ? (
            <>
              <Button variant="coffee" onClick={saveEdits} disabled={busy}>
                <Save /> সংরক্ষণ
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditing(false);
                  if (memo) {
                    setShopName(memo.shop_name ?? "");
                    setOwnerName(memo.owner_name ?? "");
                    setMobile(memo.mobile ?? "");
                    setAddress(memo.address ?? "");
                    setPaid(String(memo.paid ?? "0"));
                    setNote(memo.note ?? "");
                  }
                  if (items.length > 0) {
                    setEditItems(
                      items.map((it) => ({
                        key: crypto.randomUUID(),
                        id: it.id,
                        name: it.name,
                        quantity: String(it.quantity),
                        unit: it.unit ?? "পিস",
                        price: String(it.price),
                      })),
                    );
                  }
                }}
                disabled={busy}
              >
                <X /> বাতিল
              </Button>
            </>
          ) : (
            <>
              {canEdit && (
                <>
                  <Button variant="outline" onClick={() => setEditing(true)}>
                    <Pencil /> এডিট
                  </Button>
                  <Button variant="coffee" onClick={confirmMemo} disabled={busy}>
                    <CheckCircle2 /> কনফার্ম
                  </Button>
                  <Button variant="outline" onClick={voidMemo} disabled={busy}>
                    <XCircle /> Void
                  </Button>
                  <Button
                    variant="outline"
                    onClick={deleteDraft}
                    disabled={busy}
                    className="text-destructive"
                  >
                    <Trash2 /> মুছুন
                  </Button>
                </>
              )}
              {isConfirmed && (
                <Button variant="outline" disabled>
                  <CheckCircle2 className="text-success" /> কনফার্মড
                </Button>
              )}
              {isVoid && (
                <Button variant="outline" disabled>
                  <XCircle className="text-destructive" /> বাতিল
                </Button>
              )}
              <Button
                variant="outline"
                onClick={() => setShareOpen(true)}
                title="WhatsApp / SMS এ পাঠান"
              >
                <Share2 /> শেয়ার
              </Button>
              <Button variant="outline" onClick={() => window.print()}>
                <Printer /> প্রিন্ট
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Status banner */}
      {memo.status !== "confirmed" && (
        <div
          className={`no-print rounded-lg p-3 text-sm ${
            isVoid ? "bg-red-50 text-red-800" : "bg-yellow-50 text-yellow-800"
          }`}
        >
          স্ট্যাটাস: <strong>{memo.status}</strong>
          {isDraft && " — এখনো কনফার্ম হয়নি (pending)"}
          {isVoid && " — বাতিল করা হয়েছে"}
        </div>
      )}

      {/* ============ Memo document ============ */}
      <div className="print-area rounded-2xl border bg-white p-6 shadow-card md:p-10">
        {/* Header */}
        <div className="memo-header border-b-2 border-primary pb-4 text-center">
          <p className="bismillah font-display text-accent-foreground/80">{SHOP.bismillah}</p>
          <h1 className="mt-1 font-display text-3xl text-primary md:text-4xl">{SHOP.name}</h1>
          <p className="text-sm text-muted-foreground">{SHOP.address}</p>
          <p className="text-xs text-muted-foreground">মোবাইল: {SHOP.ownerPhones.join(", ")}</p>
        </div>

        {/* Customer info */}
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="space-y-1">
            {editing ? (
              <>
                <label className="block">
                  <span className="text-xs text-muted-foreground">দোকানের নাম</span>
                  <input
                    value={shopName}
                    onChange={(e) => setShopName(e.target.value)}
                    className="mt-0.5 block w-full rounded border bg-background px-2 py-1"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-muted-foreground">মালিকের নাম</span>
                  <input
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="mt-0.5 block w-full rounded border bg-background px-2 py-1"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-muted-foreground">মোবাইল</span>
                  <input
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value)}
                    inputMode="tel"
                    className="mt-0.5 block w-full rounded border bg-background px-2 py-1"
                  />
                </label>
                <label className="block">
                  <span className="text-xs text-muted-foreground">ঠিকানা</span>
                  <input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    className="mt-0.5 block w-full rounded border bg-background px-2 py-1"
                  />
                </label>
              </>
            ) : (
              <>
                <p className="font-bold text-primary">{memo.shop_name}</p>
                {memo.owner_name && <p>মালিক: {memo.owner_name}</p>}
                {memo.mobile && <p>মোবাইল: {toBnDigits(memo.mobile)}</p>}
                {memo.address && <p>ঠিকানা: {memo.address}</p>}
                {memo.party_serial && <p>সিরিয়াল: {toBnDigits(memo.party_serial)}</p>}
              </>
            )}
          </div>
          <div className="sm:text-right">
            <p>
              মেমো নং:{" "}
              <strong className="text-primary">
                {memo.memo_no ? `M${String(memo.memo_no).padStart(3, "0")}` : "pending"}
              </strong>
            </p>
            <p>তারিখ: {englishDateBn(memo.memo_date)}</p>
            <p className="text-xs text-muted-foreground">
              {weekdayBn(memo.memo_date)} · {banglaDate(memo.memo_date)}
            </p>
          </div>
        </div>

        {/* Items table — UNIT COLUMN ADDED */}
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-150 border-collapse text-sm">
            <thead>
              <tr className="border-y border-primary bg-muted/40">
                <th className="py-2 text-left">#</th>
                <th className="py-2 text-left">পণ্যের নাম</th>
                <th className="py-2 text-left">একক</th>
                <th className="py-2 text-right">পরিমাণ</th>
                <th className="py-2 text-right">দাম</th>
                <th className="py-2 text-right">মোট</th>
                {editing && <th className="no-print w-8"></th>}
              </tr>
            </thead>
            <tbody>
              {displayItems.map((it, i) => (
                <tr key={it.key} className="border-b border-muted">
                  <td className="py-2">{toBnDigits(i + 1)}</td>
                  <td className="py-2">
                    {editing ? (
                      <input
                        value={it.name}
                        onChange={(e) => updateItem(it.key, { name: e.target.value })}
                        className="w-full rounded border-transparent bg-transparent px-1 outline-none focus:border-ring focus:bg-card"
                        placeholder="পণ্য"
                      />
                    ) : (
                      it.name
                    )}
                  </td>
                  <td className="py-2">
                    {editing ? (
                      <select
                        value={it.unit}
                        onChange={(e) => updateItem(it.key, { unit: e.target.value })}
                        className="rounded border-transparent bg-transparent px-1 outline-none focus:border-ring focus:bg-card"
                      >
                        {UNIT_OPTIONS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    ) : (
                      it.unit
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {editing ? (
                      <input
                        value={it.quantity}
                        onChange={(e) => updateItem(it.key, { quantity: e.target.value })}
                        inputMode="decimal"
                        className="w-16 rounded border-transparent bg-transparent px-1 text-right outline-none focus:border-ring focus:bg-card"
                      />
                    ) : (
                      toBnDigits(it.quantity)
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {editing ? (
                      <input
                        value={it.price}
                        onChange={(e) => updateItem(it.key, { price: e.target.value })}
                        inputMode="decimal"
                        className="w-24 rounded border-transparent bg-transparent px-1 text-right outline-none focus:border-ring focus:bg-card"
                      />
                    ) : (
                      taka(it.price)
                    )}
                  </td>
                  <td className="py-2 text-right tabular-nums">
                    {taka(num(it.quantity) * num(it.price))}
                  </td>
                  {editing && (
                    <td className="no-print py-2 text-right">
                      <button
                        onClick={() => removeItem(it.key)}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-primary">
                <td colSpan={5} className="py-2 text-right font-display">
                  সর্বমোট
                </td>
                <td className="py-2 text-right font-display text-lg font-bold tabular-nums">
                  {taka(displayTotal)}
                </td>
                {editing && <td className="no-print"></td>}
              </tr>
            </tfoot>
          </table>
        </div>

        {editing && (
          <div className="no-print mt-2">
            <Button variant="outline" onClick={addItem} className="w-full">
              <Plus /> নতুন পণ্য যোগ করুন
            </Button>
          </div>
        )}

        {/* জমা / বাকি */}
        <div className="mt-6 grid grid-cols-3 gap-2 text-sm">
          <div className="rounded border p-2 text-center">
            <p className="text-muted-foreground text-xs">মোট</p>
            <p className="font-bold tabular-nums">{taka(displayTotal)}</p>
          </div>
          <div className="rounded border p-2 text-center">
            <p className="text-muted-foreground text-xs">জমা</p>
            {editing ? (
              <input
                value={paid}
                onChange={(e) => setPaid(e.target.value)}
                inputMode="decimal"
                className="w-full rounded border-transparent bg-transparent text-center font-bold outline-none focus:border-ring focus:bg-card"
              />
            ) : (
              <p className="font-bold text-success tabular-nums">{taka(displayPaid)}</p>
            )}
          </div>
          <div className="rounded border p-2 text-center">
            <p className="text-muted-foreground text-xs">বাকি</p>
            <p className="font-bold text-destructive tabular-nums">{taka(displayDue)}</p>
          </div>
        </div>

        {Number(memo.previous_due) !== 0 && (
          <p className="mt-3 text-sm">
            পূর্বের বাকি: <strong>{taka(memo.previous_due)}</strong>
          </p>
        )}

        {/* Note */}
        <div className="mt-3">
          {editing ? (
            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">নোট</span>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="mt-0.5 block w-full rounded border bg-background px-2 py-1"
              />
            </label>
          ) : (
            memo.note && <p className="text-sm text-muted-foreground">নোট: {memo.note}</p>
          )}
        </div>

        {/* ============ Signature — LEFT shop, RIGHT customer ============ */}
        <div className="mt-16 flex flex-wrap items-end justify-between gap-6">
          <div className="text-center">
            <p className="font-display text-lg text-primary border-t border-primary pt-1">
              {SHOP.name}
            </p>
            <p className="text-[10px] text-muted-foreground">(স্বাক্ষর ও সিল)</p>
          </div>

          <div className="text-center text-xs">
            <div className="mb-1 h-px w-32 bg-black" />
            গ্রাহকের স্বাক্ষর
          </div>
        </div>
      </div>

      {/* ============ Share Dialog ============ */}
      {shareOpen && memo && (
        <MemoShareDialog
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          memo={{
            id: memo.id,
            memo_no: memo.memo_no,
            memo_date: memo.memo_date,
            shop_name: memo.shop_name,
            owner_name: memo.owner_name,
            mobile: memo.mobile,
            address: memo.address,
            party_serial: memo.party_serial,
            total: Number(memo.total),
            paid: Number(memo.paid),
            previous_due: Number(memo.previous_due ?? 0),
            note: memo.note,
          }}
          items={items.map((it) => ({
            name: it.name,
            quantity: it.quantity,
            unit: it.unit,
            price: it.price,
          }))}
        />
      )}
    </div>
  );
}
