// src/routes/_authenticated/admin.memo.new.tsx
// নতুন মেমো — কাস্টমার সিরিয়াল দিলে অটো fill, পণ্য যোগ, confirm করলে stock কমে
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Plus, Trash2, ArrowLeft, CheckCircle2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  taka,
  toBnDigits,
  num,
  todayISO,
  englishDateBn,
  SHOP,
} from "@/lib/shop";
import { partyDue } from "@/lib/ledger";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/memo/new")({
  head: () => ({ meta: [{ title: "নতুন মেমো — আল হামিদ বস্ত্রালয়" }] }),
  component: NewMemo,
});

type Item = {
  key: string;
  name: string;
  quantity: string;
  unit: string;
  price: string;
  product_id: string | null;
};

type Product = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  unit_price: number;
};

function emptyItem(): Item {
  return {
    key: crypto.randomUUID(),
    name: "",
    quantity: "1",
    unit: "পিস",
    price: "",
    product_id: null,
  };
}

function NewMemo() {
  const nav = useNavigate();
  const qc = useQueryClient();

  // ---- Memo header ----
  const [searchSerial, setSearchSerial] = useState("");
  const [partyId, setPartyId] = useState<string | null>(null);
  const [shopName, setShopName] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [mobile, setMobile] = useState("");
  const [address, setAddress] = useState("");
  const [partySerial, setPartySerial] = useState("");
  const [previousDue, setPreviousDue] = useState(0);
  const [memoDate, setMemoDate] = useState(todayISO());
  const [paid, setPaid] = useState("");
  const [note, setNote] = useState("");

  // ---- Items ----
  const [items, setItems] = useState<Item[]>([emptyItem()]);

  // ---- Products lookup ----
  const { data: products = [] } = useQuery({
    queryKey: ["products-all"],
    queryFn: async () =>
      ((
        await supabase
          .from("products")
          .select("id,name,quantity,unit,unit_price")
          .order("name")
      ).data ?? []) as Product[],
  });

  // ---- Customer lookup ----
  const { data: party } = useQuery({
    queryKey: ["party-by-serial", searchSerial.trim()],
    enabled: searchSerial.trim().length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("parties")
        .select("id,serial,shop_name,owner_name,mobile,address")
        .eq("serial", searchSerial.trim())
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!party) return;
    setPartyId(party.id);
    setShopName(party.shop_name ?? "");
    setOwnerName(party.owner_name ?? "");
    setMobile(party.mobile ?? "");
    setAddress(party.address ?? "");
    setPartySerial(party.serial ?? "");
    partyDue(party.id).then(setPreviousDue);
  }, [party]);

  function clearParty() {
    setPartyId(null);
    setShopName("");
    setOwnerName("");
    setMobile("");
    setAddress("");
    setPartySerial("");
    setPreviousDue(0);
    setSearchSerial("");
  }

  // ---- Items helpers ----
  function addItem() {
    setItems((arr) => [...arr, emptyItem()]);
  }
  function removeItem(key: string) {
    setItems((arr) =>
      arr.length <= 1 ? arr : arr.filter((i) => i.key !== key),
    );
  }
  function updateItem(key: string, patch: Partial<Item>) {
    setItems((arr) =>
      arr.map((i) => (i.key === key ? { ...i, ...patch } : i)),
    );
  }

  // নাম লিখলে product lookup করে unit/price auto-fill
  function onItemNameChange(key: string, name: string) {
    const match = products.find(
      (p) => p.name.toLowerCase() === name.trim().toLowerCase(),
    );
    if (match) {
      updateItem(key, {
        name,
        product_id: match.id,
        unit: match.unit || "পিস",
        price: match.unit_price ? String(match.unit_price) : "",
      });
    } else {
      updateItem(key, { name, product_id: null });
    }
  }

  const total = items.reduce((s, i) => s + num(i.quantity) * num(i.price), 0);
  const paidNum = num(paid);
  const due = total - paidNum;

  // ---- Save ----
  async function saveMemo(confirmIt: boolean) {
    if (!shopName.trim()) {
      toast.error("দোকানের নাম দিন");
      return;
    }
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      toast.error("অন্তত একটা পণ্য দিন");
      return;
    }

    // ১) memo তৈরি
    const { data: memo, error: e1 } = await supabase
      .from("memos")
      .insert({
        memo_date: memoDate,
        party_id: partyId,
        shop_name: shopName.trim(),
        owner_name: ownerName.trim() || null,
        mobile: mobile.trim() || null,
        address: address.trim() || null,
        party_serial: partySerial || null,
        previous_due: previousDue,
        total,
        paid: paidNum,
        status: "draft",
        note: note.trim() || null,
      })
      .select("id")
      .single();

    if (e1 || !memo) {
      toast.error("মেমো তৈরি হয়নি: " + e1?.message);
      return;
    }

    // ২) memo_items insert (product_id সহ)
    const { error: e2 } = await supabase.from("memo_items").insert(
      validItems.map((i, idx) => ({
        memo_id: memo.id,
        position: idx,
        name: i.name.trim(),
        quantity: num(i.quantity),
        unit: i.unit || "পিস",
        price: num(i.price),
        product_id: i.product_id,
      })),
    );
    if (e2) {
      toast.error("আইটেম সেভ হয়নি: " + e2.message);
      return;
    }

    // ৩) confirm
    if (confirmIt) {
      const { data: memoNo, error: e3 } = await supabase.rpc("confirm_memo", {
        _memo_id: memo.id,
      });
      if (e3) {
        toast.error("কনফার্ম হয়নি: " + e3.message);
        return;
      }
      toast.success(`মেমো #${memoNo} কনফার্ম হয়েছে — স্টক কমেছে`);
    } else {
      toast.success("মেমো pending হিসেবে সেভ হয়েছে");
    }

    qc.invalidateQueries({ queryKey: ["day-entries"] });
    qc.invalidateQueries({ queryKey: ["day-summary"] });
    qc.invalidateQueries({ queryKey: ["party-memos"] });
    qc.invalidateQueries({ queryKey: ["products"] });
    qc.invalidateQueries({ queryKey: ["products-all"] });
    nav({ to: "/admin/memo/$id", params: { id: memo.id } });
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="no-print flex items-center justify-between gap-3">
        <Link
          to="/admin/memo"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> মেমো বই
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => saveMemo(false)}>
            Pending রাখুন
          </Button>
          <Button variant="coffee" onClick={() => saveMemo(true)}>
            <CheckCircle2 /> কনফার্ম
          </Button>
        </div>
      </div>

      {/* হেডার কার্ড */}
      <div className="rounded-2xl border bg-card p-6 shadow-card print-area">
        <div className="text-center">
          <p className="font-display text-accent-foreground/70">
            {SHOP.bismillah}
          </p>
          <h1 className="mt-1 font-display text-3xl text-primary">
            {SHOP.name}
          </h1>
          <p className="text-sm text-muted-foreground">{SHOP.address}</p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            তারিখ
            <input
              type="date"
              value={memoDate}
              onChange={(e) => setMemoDate(e.target.value)}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
            />
          </label>
          <label className="text-sm">
            কাস্টমার সিরিয়াল (দিলে অটো fill হবে)
            <div className="mt-1 flex gap-1">
              <input
                value={searchSerial}
                onChange={(e) => setSearchSerial(e.target.value)}
                placeholder="যেমন: 001 / Customer001"
                className="h-10 flex-1 rounded-md border bg-background px-3"
              />
              {partyId && (
                <button
                  onClick={clearParty}
                  className="rounded bg-muted px-2 text-muted-foreground"
                  title="মুছুন"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </label>
          <label className="text-sm">
            দোকানের নাম *
            <input
              value={shopName}
              onChange={(e) => setShopName(e.target.value)}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
            />
          </label>
          <label className="text-sm">
            মালিকের নাম
            <input
              value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
            />
          </label>
          <label className="text-sm">
            মোবাইল
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
              inputMode="tel"
            />
          </label>
          <label className="text-sm">
            ঠিকানা
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
            />
          </label>
        </div>

        {previousDue !== 0 && (
          <p className="mt-3 rounded-lg bg-accent/15 p-3 text-sm">
            পূর্বের বাকি: <strong>{taka(previousDue)}</strong>
          </p>
        )}
      </div>

      {/* পণ্য টেবিল */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card print-area">
        <table className="w-full text-sm">
          <thead className="bg-secondary text-secondary-foreground">
            <tr>
              <th className="px-2 py-2 text-left">পণ্যের নাম</th>
              <th className="px-2 py-2 text-right w-20">পরিমাণ</th>
              <th className="px-2 py-2 text-left w-24">একক</th>
              <th className="px-2 py-2 text-right w-28">দাম</th>
              <th className="px-2 py-2 text-right w-32">মোট</th>
              <th className="px-2 py-2 w-10 no-print"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.key} className="border-t">
                <td className="px-2 py-1">
                  <input
                    value={it.name}
                    onChange={(e) =>
                      onItemNameChange(it.key, e.target.value)
                    }
                    list="products-datalist"
                    className="h-9 w-full rounded border-transparent bg-transparent px-2 outline-none focus:border-ring focus:bg-card"
                    placeholder="পণ্য (স্টক থেকে অটো)"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    value={it.quantity}
                    onChange={(e) =>
                      updateItem(it.key, { quantity: e.target.value })
                    }
                    className="h-9 w-full rounded border-transparent bg-transparent px-2 text-right tabular-nums outline-none focus:border-ring focus:bg-card"
                    inputMode="decimal"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    value={it.unit}
                    onChange={(e) =>
                      updateItem(it.key, { unit: e.target.value })
                    }
                    className="h-9 w-full rounded border-transparent bg-transparent px-2 outline-none focus:border-ring focus:bg-card"
                  />
                </td>
                <td className="px-2 py-1">
                  <input
                    value={it.price}
                    onChange={(e) =>
                      updateItem(it.key, { price: e.target.value })
                    }
                    className="h-9 w-full rounded border-transparent bg-transparent px-2 text-right tabular-nums outline-none focus:border-ring focus:bg-card"
                    inputMode="decimal"
                  />
                </td>
                <td className="px-2 py-1 text-right tabular-nums">
                  {taka(num(it.quantity) * num(it.price))}
                </td>
                <td className="px-2 py-1 no-print">
                  <button
                    onClick={() => removeItem(it.key)}
                    className="rounded p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-secondary/60">
            <tr>
              <td
                colSpan={4}
                className="px-4 py-3 text-right font-display text-lg"
              >
                সর্বমোট
              </td>
              <td className="px-2 py-3 text-right font-display text-xl font-bold tabular-nums text-primary">
                {taka(total)}
              </td>
              <td className="no-print"></td>
            </tr>
          </tfoot>
        </table>

        {/* products auto-complete */}
        <datalist id="products-datalist">
          {products.map((p) => (
            <option key={p.id} value={p.name}>
              {toBnDigits(p.quantity)} {p.unit} — {taka(p.unit_price)}
            </option>
          ))}
        </datalist>

        <div className="no-print p-2">
          <Button variant="outline" onClick={addItem} className="w-full">
            <Plus /> পণ্য যোগ করুন
          </Button>
        </div>
      </div>

      {/* জমা + নোট */}
      <div className="rounded-2xl border bg-card p-5 shadow-card">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            জমা (এখন কত টাকা দিল)
            <input
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3 text-right tabular-nums"
              inputMode="decimal"
              placeholder="০"
            />
          </label>
          <label className="text-sm">
            নোট (ঐচ্ছিক)
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
            />
          </label>
        </div>
        <div className="mt-4 grid gap-2 rounded-lg bg-accent/10 p-3 text-sm sm:grid-cols-3">
          <p>
            মোট: <strong>{taka(total)}</strong>
          </p>
          <p>
            জমা: <strong>{taka(paidNum)}</strong>
          </p>
          <p>
            বাকি: <strong className="text-destructive">{taka(due)}</strong>
          </p>
        </div>
        <div className="mt-4 rounded-lg border border-dashed border-muted p-3 text-sm">
          <p className="text-muted-foreground">বিক্রেতার স্বাক্ষর ও সিল</p>
          <p className="mt-2 font-display text-lg text-primary">
            {SHOP.name}
          </p>
        </div>
      </div>
    </div>
  );
}