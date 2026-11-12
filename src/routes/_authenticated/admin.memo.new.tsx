// src/routes/_authenticated/admin.memo.new.tsx
// নতুন মেমো
//
// 🐛 FIX: Retail_serial mode এ কোনো customer না থাকলে misleading
// 🐛 FIX: Product name field না দেখলে category+price দিয়ে memo বানানোর চেষ্টা
// 🐛 FIX: Auto-fallback to category name when product name empty
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useRef, useMemo } from "react";
import {
  Plus, Trash2, CheckCircle2, X, FileText, Search, User as UserIcon,
  AlertTriangle, PackagePlus, Store, Users, UserPlus, Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { taka, toBnDigits, num, todayISO, toEnDigits, SHOP } from "@/lib/shop";
import { partyDue } from "@/lib/ledger";
import { productUnits, toBaseQty, conversionHint, type UnitConversions } from "@/lib/units";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/memo/new")({
  head: () => ({ meta: [{ title: "নতুন মেমো — আল হামিদ বস্ত্রালয়" }] }),
  component: NewMemo,
});

type MemoType = "wholesale" | "retail_serial" | "retail_manual";

type Item = {
  key: string;
  catId: string;
  subId: string;
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
  category_id: string | null;
  subcategory_id: string | null;
  base_unit: string;
  unit_conversions: UnitConversions | null;
};

type Category = {
  id: string;
  name: string;
  name_bn: string | null;
  parent_id: string | null;
};

type Party = {
  id: string;
  serial: string;
  shop_name: string;
  owner_name: string | null;
  mobile: string | null;
  address: string | null;
};

function emptyItem(): Item {
  return {
    key: crypto.randomUUID(),
    catId: "",
    subId: "",
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
  const [memoType, setMemoType] = useState<MemoType>("wholesale");

  const [searchQuery, setSearchQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
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

  const [items, setItems] = useState<Item[]>([emptyItem()]);
  const [busy, setBusy] = useState(false);

  const searchWrapRef = useRef<HTMLDivElement>(null);

  const { data: products = [] } = useQuery({
    queryKey: ["products-all"],
    queryFn: async () =>
      ((
        await supabase
          .from("products")
          .select("id,name,quantity,unit,unit_price,category_id,subcategory_id,base_unit,unit_conversions")
          .order("name")
      ).data ?? []) as Product[],
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      ((await supabase.from("categories").select("id,name,name_bn,parent_id").order("sort_order"))
        .data ?? []) as Category[],
  });

  const parents = categories.filter((c) => !c.parent_id);
  const childrenOf = (pid: string) => categories.filter((c) => c.parent_id === pid);

  function catLabel(id: string): string {
    if (!id) return "";
    const c = categories.find((x) => x.id === id);
    return c ? c.name_bn || c.name : "";
  }

  const partyKindFilter: "wholesale" | "retail" | null =
    memoType === "wholesale" ? "wholesale" : memoType === "retail_serial" ? "retail" : null;

  const { data: allParties = [] } = useQuery({
    queryKey: ["parties-search", partyKindFilter],
    enabled: partyKindFilter !== null,
    queryFn: async () => {
      if (!partyKindFilter) return [];
      const { data } = await supabase
        .from("parties")
        .select("id,serial,shop_name,owner_name,mobile,address,kind")
        .eq("kind", partyKindFilter)
        .order("serial")
        .limit(2000);
      return (data ?? []) as Party[];
    },
  });

  const suggestions = useMemo(() => {
    if (!partyKindFilter) return [];
    const q = toEnDigits(searchQuery.trim().toLowerCase());
    if (!q) return [];
    return allParties
      .filter((p) => {
        const shop = p.shop_name.toLowerCase();
        const owner = (p.owner_name ?? "").toLowerCase();
        const serial = p.serial.toLowerCase();
        const mob = (p.mobile ?? "").replace(/\D/g, "");
        const qDigits = q.replace(/\D/g, "");
        return (
          shop.includes(q) || owner.includes(q) || serial.includes(q) ||
          (qDigits && mob.includes(qDigits))
        );
      })
      .slice(0, 8);
  }, [searchQuery, allParties, partyKindFilter]);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    setSearchQuery("");
    setShowSuggestions(false);
    setPartyId(null);
    setShopName("");
    setOwnerName("");
    setMobile("");
    setAddress("");
    setPartySerial("");
    setPreviousDue(0);
  }, [memoType]);

  function selectParty(p: Party) {
    setPartyId(p.id);
    setShopName(p.shop_name ?? "");
    setOwnerName(p.owner_name ?? "");
    setMobile(p.mobile ?? "");
    setAddress(p.address ?? "");
    setPartySerial(p.serial ?? "");
    setSearchQuery(`${p.serial} — ${p.shop_name}`);
    setShowSuggestions(false);
    partyDue(p.id).then(setPreviousDue);
  }

  function clearParty() {
    setPartyId(null);
    setShopName("");
    setOwnerName("");
    setMobile("");
    setAddress("");
    setPartySerial("");
    setPreviousDue(0);
    setSearchQuery("");
  }

  function addItem() {
    setItems((arr) => [...arr, emptyItem()]);
  }
  function removeItem(key: string) {
    setItems((arr) => (arr.length <= 1 ? arr : arr.filter((i) => i.key !== key)));
  }
  function updateItem(key: string, patch: Partial<Item>) {
    setItems((arr) => arr.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function onItemNameChange(key: string, name: string) {
    const match = products.find((p) => p.name.toLowerCase() === name.trim().toLowerCase());
    if (match) {
      const units = productUnits(match.base_unit || match.unit, match.unit_conversions);
      const baseUnit = match.base_unit || match.unit || "পিস";
      const defaultUnit = units.includes(match.unit) ? match.unit : baseUnit;
      updateItem(key, {
        name,
        product_id: match.id,
        unit: defaultUnit,
        price: match.unit_price ? String(match.unit_price) : "",
        catId: match.category_id ?? "",
        subId: match.subcategory_id ?? "",
      });
    } else {
      updateItem(key, { name, product_id: null });
    }
  }

  // 🐛 Category select → auto-fill name if empty (from category label)
  function onCategoryChange(key: string, catId: string) {
    const it = items.find((i) => i.key === key);
    if (!it) return;
    const patch: Partial<Item> = { catId, subId: "" };
    // If name is empty, pre-fill from category
    if (!it.name.trim() && catId) {
      patch.name = catLabel(catId);
    }
    updateItem(key, patch);
  }

  function productForItem(it: Item): Product | undefined {
    if (!it.product_id) return undefined;
    return products.find((p) => p.id === it.product_id);
  }

  const total = items.reduce((s, i) => s + num(i.quantity) * num(i.price), 0);
  const paidNum = num(paid);
  const due = total - paidNum;

  async function saveMemo(confirmIt: boolean) {
    if (memoType === "wholesale" || memoType === "retail_serial") {
      if (!partyId) {
        toast.error(memoType === "wholesale" ? "পাইকারি কাস্টমার select করুন" : "খুচরা কাস্টমার select করুন");
        return;
      }
    }
    if (memoType === "retail_manual") {
      if (!shopName.trim()) {
        toast.error("কাস্টমারের নাম লিখুন");
        return;
      }
      if (!mobile.trim()) {
        toast.error("মোবাইল নম্বর লিখুন");
        return;
      }
    }
    const validItems = items.filter((i) => i.name.trim());
    if (validItems.length === 0) {
      toast.error("অন্তত একটা পণ্য দিন — 'পণ্যের নাম' field এ product টাইপ করুন");
      return;
    }

    setBusy(true);
    const createdProductIds: string[] = [];
    let memoId: string | null = null;
    const newStockItems: string[] = [];

    try {
      const { data: memo, error: e1 } = await supabase
        .from("memos")
        .insert({
          memo_date: memoDate,
          memo_type: memoType,
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

      if (e1 || !memo) throw new Error(e1?.message ?? "মেমো তৈরি হয়নি");
      memoId = memo.id;

      const insertItems: {
        memo_id: string;
        position: number;
        name: string;
        quantity: number;
        unit: string;
        price: number;
        product_id: string | null;
        base_quantity: number;
      }[] = [];

      for (let i = 0; i < validItems.length; i++) {
        const it = validItems[i]!;
        let productId = it.product_id;
        let baseQty: number;
        const prod = products.find((p) => p.id === it.product_id);

        if (confirmIt && !productId) {
          const baseUnit = it.unit || "পিস";
          const { data: newProd, error: eP } = await supabase
            .from("products")
            .insert({
              name: it.name.trim(),
              quantity: num(it.quantity),
              unit: baseUnit,
              base_unit: baseUnit,
              unit_price: num(it.price),
              category_id: it.catId || null,
              subcategory_id: it.subId || null,
            })
            .select("id")
            .single();

          if (eP || !newProd) throw new Error(`"${it.name}" stock এ যোগ হয়নি: ${eP?.message ?? "unknown"}`);
          productId = newProd.id;
          baseQty = num(it.quantity);
          createdProductIds.push(newProd.id);
          newStockItems.push(it.name);

          // Log initial stock movement
          await supabase.from("stock_movements").insert({
            product_id: newProd.id,
            movement_type: "in",
            quantity: num(it.quantity),
            reason: "memo_create",
            note: "মেমো থেকে প্রাথমিক স্টক",
          });
        } else {
          baseQty = prod
            ? toBaseQty(num(it.quantity), it.unit, prod.base_unit || prod.unit || "পিস", prod.unit_conversions)
            : num(it.quantity);
        }

        insertItems.push({
          memo_id: memo.id,
          position: i,
          name: it.name.trim(),
          quantity: num(it.quantity),
          unit: it.unit || "পিস",
          price: num(it.price),
          product_id: productId,
          base_quantity: baseQty,
        });
      }

      const { error: e2 } = await supabase.from("memo_items").insert(insertItems);
      if (e2) throw new Error("আইটেম সেভ হয়নি: " + e2.message);

      if (confirmIt) {
        const { data: memoNo, error: e3 } = await supabase.rpc("confirm_memo", { _memo_id: memoId });
        if (e3) throw new Error("কনফার্ম হয়নি: " + e3.message);
        const memoNoDisplay = `M${String(memoNo).padStart(3, "0")}`;
        if (newStockItems.length > 0) {
          toast.success(`${memoNoDisplay} কনফার্ম — ${toBnDigits(newStockItems.length)} নতুন পণ্য stock এ যোগ + deduct`);
        } else {
          toast.success(`${memoNoDisplay} কনফার্ম হয়েছে — স্টক কমেছে`);
        }
      } else {
        toast.success("মেমো pending হিসেবে সেভ হয়েছে");
      }

      qc.invalidateQueries({ queryKey: ["memos-list"] });
      qc.invalidateQueries({ queryKey: ["memos-pending-count"] });
      qc.invalidateQueries({ queryKey: ["memos-split-view"] });
      qc.invalidateQueries({ queryKey: ["day-entries"] });
      qc.invalidateQueries({ queryKey: ["day-summary"] });
      qc.invalidateQueries({ queryKey: ["products"] });
      qc.invalidateQueries({ queryKey: ["products-all"] });

      if (confirmIt) {
        nav({ to: "/admin/memo/$id", params: { id: memoId } });
      } else {
        nav({ to: "/admin/memo" });
      }
    } catch (e) {
      for (const pid of createdProductIds) {
        try { await supabase.from("products").delete().eq("id", pid); } catch { /* ignore */ }
      }
      if (memoId) {
        try { await supabase.from("memos").delete().eq("id", memoId); } catch { /* ignore */ }
      }
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4 md:space-y-5">
      <div className="no-print flex flex-wrap items-center gap-2 md:gap-3">
        <BackButton fallback="/admin/memo" />
        <h1 className="font-display text-xl text-primary md:text-2xl">নতুন মেমো</h1>
        <div className="ml-auto flex gap-2">
          <Button variant="outline" size="sm" onClick={() => saveMemo(false)} disabled={busy}>
            <FileText className="h-4 w-4" /> Pending
          </Button>
          <Button variant="coffee" size="sm" onClick={() => saveMemo(true)} disabled={busy}>
            <CheckCircle2 className="h-4 w-4" /> {busy ? "সেভ হচ্ছে…" : "কনফার্ম"}
          </Button>
        </div>
      </div>

      <div className="no-print rounded-2xl border-2 border-primary/20 bg-card p-2 shadow-card">
        <div className="grid grid-cols-3 gap-1">
          <TypeBtn
            active={memoType === "wholesale"}
            onClick={() => setMemoType("wholesale")}
            icon={<Store className="h-4 w-4" />}
            label="পাইকারি"
            sub="C001"
          />
          <TypeBtn
            active={memoType === "retail_serial"}
            onClick={() => setMemoType("retail_serial")}
            icon={<Users className="h-4 w-4" />}
            label="খুচরা সিরিয়াল"
            sub="R001"
          />
          <TypeBtn
            active={memoType === "retail_manual"}
            onClick={() => setMemoType("retail_manual")}
            icon={<UserPlus className="h-4 w-4" />}
            label="খুচরা নতুন"
            sub="manual"
          />
        </div>
      </div>

      <div className="print-area rounded-2xl border bg-card p-5 shadow-card md:p-6">
        <div className="text-center">
          <p className="text-sm md:text-base" style={{ fontFamily: "'Tiro Bangla', serif", color: "#8a6a45" }}>
            {SHOP.bismillah}
          </p>
          <h1 className="mt-1 text-2xl text-primary md:text-3xl" style={{ fontFamily: "'Tiro Bangla', serif" }}>
            {SHOP.name}
          </h1>
          <p className="text-xs text-muted-foreground md:text-sm">{SHOP.address}</p>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            তারিখ
            <input
              type="date"
              value={memoDate}
              onChange={(e) => setMemoDate(e.target.value)}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
            />
          </label>

          {/* 🐛 FIX: Empty state for retail_serial */}
          {memoType === "retail_serial" && allParties.length === 0 && (
            <div className="sm:col-span-2 rounded-xl border-2 border-yellow-500 bg-yellow-50 p-3">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 shrink-0 text-yellow-700 mt-0.5" />
                <div className="text-xs text-yellow-800">
                  <p className="font-semibold">কোনো খুচরা কাস্টমার নেই</p>
                  <p className="mt-1">
                    "খুচরা নতুন" tab ব্যবহার করুন (serial ছাড়াই memo করা যাবে), অথবা{" "}
                    <a href="/admin/paona" className="underline">/admin/paona</a> এ গিয়ে খুচরা কাস্টমার যোগ করুন।
                  </p>
                </div>
              </div>
            </div>
          )}

          {(memoType === "wholesale" || memoType === "retail_serial") && (
            <div className="relative sm:col-span-2" ref={searchWrapRef}>
              <label className="text-sm">
                {memoType === "wholesale" ? "পাইকারি কাস্টমার" : "খুচরা কাস্টমার"} (সিরিয়াল / নাম / মোবাইল)
                <div className="relative mt-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    value={searchQuery}
                    onChange={(e) => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder={memoType === "wholesale" ? "C001 / নাম / মোবাইল" : "R001 / নাম / মোবাইল"}
                    className="h-10 w-full rounded-md border bg-background pl-9 pr-9"
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={clearParty}
                      className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground hover:bg-accent"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </label>

              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-y-auto rounded-lg border-2 border-primary/20 bg-card shadow-lg">
                  {suggestions.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => selectParty(p)}
                      className="flex w-full items-center gap-3 border-b p-3 text-left transition last:border-0 hover:bg-accent/10"
                      style={{ borderColor: "#eadfcc" }}
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: "rgba(201,146,74,0.2)", color: "#4a2f1e" }}>
                        <UserIcon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-primary">{p.shop_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {toBnDigits(p.serial)}
                          {p.owner_name && ` · ${p.owner_name}`}
                          {p.mobile && ` · ${toBnDigits(p.mobile)}`}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {(memoType === "wholesale" || memoType === "retail_serial") && partyId && (
            <>
              <label className="text-sm">
                দোকানের নাম
                <input value={shopName} readOnly className="mt-1 block h-10 w-full rounded-md border bg-muted/30 px-3" />
              </label>
              <label className="text-sm">
                মোবাইল
                <input value={mobile} readOnly className="mt-1 block h-10 w-full rounded-md border bg-muted/30 px-3 tabular-nums" />
              </label>
              <p className="text-xs text-muted-foreground sm:col-span-2">
                🎯 সিরিয়াল: <strong className="text-primary">{toBnDigits(partySerial)}</strong>
              </p>
            </>
          )}

          {memoType === "retail_manual" && (
            <>
              <label className="text-sm">
                কাস্টমারের নাম *
                <input
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  placeholder="যেমন: বাবুল / করিম মিয়া"
                  className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
                />
              </label>
              <label className="text-sm">
                মোবাইল নম্বর *
                <input
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="01XXXXXXXXX"
                  inputMode="tel"
                  className="mt-1 block h-10 w-full rounded-md border bg-background px-3 tabular-nums"
                />
              </label>
            </>
          )}
        </div>

        {previousDue !== 0 && (
          <p className="mt-3 rounded-lg bg-accent/15 p-3 text-sm">
            📊 পূর্বের বাকি: <strong>{taka(previousDue)}</strong>
          </p>
        )}
      </div>

      <div className="print-area space-y-3 rounded-2xl border bg-card p-3 shadow-card md:p-4">
        {items.map((it, idx) => {
          const prod = productForItem(it);
          const baseUnit = prod?.base_unit || prod?.unit || "পিস";
          const conversions = prod?.unit_conversions ?? null;
          const availableUnits = prod
            ? productUnits(baseUnit, conversions)
            : ["পিস", "থান", "গজ", "জোড়া", "ডজন", "১/২ ডজন", "সেট", "মিটার"];

          const lineTotal = num(it.quantity) * num(it.price);
          const datalistId = `products-dl-${it.key}`;

          const nameTyped = it.name.trim().length > 0;
          const nameEmptyButCat = !nameTyped && !!it.catId;
          const notInStock = nameTyped && !it.product_id;

          const hint = conversionHint(num(it.quantity), it.unit, baseUnit, conversions);

          return (
            <div key={it.key} className={`rounded-xl border-2 bg-background p-3 ${nameEmptyButCat ? "border-yellow-500" : "border-border"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold" style={{ backgroundColor: "rgba(201,146,74,0.2)", color: "#4a2f1e" }}>
                  {toBnDigits(idx + 1)}
                </span>

                <select
                  value={it.catId}
                  onChange={(e) => onCategoryChange(it.key, e.target.value)}
                  className="h-9 min-w-30 flex-1 rounded-md border bg-card px-2 text-xs sm:text-sm"
                >
                  <option value="">সব ক্যাটাগরি</option>
                  {parents.map((c) => (
                    <option key={c.id} value={c.id}>{c.name_bn || c.name}</option>
                  ))}
                </select>

                <select
                  value={it.subId}
                  onChange={(e) => updateItem(it.key, { subId: e.target.value })}
                  disabled={!it.catId || childrenOf(it.catId).length === 0}
                  className="h-9 min-w-30 flex-1 rounded-md border bg-card px-2 text-xs disabled:opacity-50 sm:text-sm"
                >
                  <option value="">
                    {!it.catId ? "সাব-ক্যাটাগরি" : childrenOf(it.catId).length === 0 ? "সাব নেই" : "সব সাব"}
                  </option>
                  {it.catId && childrenOf(it.catId).map((c) => (
                    <option key={c.id} value={c.id}>{c.name_bn || c.name}</option>
                  ))}
                </select>

                <button
                  onClick={() => removeItem(it.key)}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  title="মুছুন"
                  disabled={items.length <= 1}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-2">
                <input
                  value={it.name}
                  onChange={(e) => onItemNameChange(it.key, e.target.value)}
                  list={datalistId}
                  className={`h-10 w-full rounded-md border bg-card px-3 text-sm outline-none focus:border-primary ${
                    nameEmptyButCat ? "border-yellow-500 bg-yellow-50/40" :
                    notInStock ? "border-yellow-500 bg-yellow-50/40" : ""
                  }`}
                  placeholder="👉 পণ্যের নাম টাইপ করুন (স্টক থেকে suggestion আসবে)"
                />
                <datalist id={datalistId}>
                  {products.map((p) => (
                    <option key={p.id} value={p.name}>
                      স্টক: {toBnDigits(p.quantity)} {p.base_unit || p.unit} — {taka(p.unit_price)}
                    </option>
                  ))}
                </datalist>
              </div>

              {nameEmptyButCat && (
                <div className="mt-1 flex items-start gap-1.5 rounded-md border-l-2 border-yellow-500 bg-yellow-50/60 px-2 py-1 text-[10px] text-yellow-800">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>
                    <strong>পণ্যের নাম লিখুন</strong> — শুধু category select করলে memo save হবে না
                  </span>
                </div>
              )}

              {notInStock && (
                <div className="mt-1 flex items-start gap-1.5 rounded-md border-l-2 border-yellow-500 bg-yellow-50/60 px-2 py-1 text-[10px] text-yellow-800">
                  <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                  <span>
                    <strong>Stock এ নেই</strong> — Confirm করলে{" "}
                    <PackagePlus className="inline h-3 w-3" /> auto stock এ যোগ হবে
                  </span>
                </div>
              )}

              {it.product_id && (
                <p className="mt-1 flex flex-wrap items-center gap-1 text-[10px] text-success">
                  ✓ Stock এ আছে — স্টক: {toBnDigits(prod?.quantity ?? 0)} {baseUnit}
                  {it.catId && catLabel(it.catId) && ` · ${catLabel(it.catId)}`}
                </p>
              )}

              <div className="mt-2 grid grid-cols-[1fr_1fr_1.2fr_auto] gap-2">
                <label className="text-[10px] text-muted-foreground">
                  একক
                  <select
                    value={it.unit}
                    onChange={(e) => updateItem(it.key, { unit: e.target.value })}
                    className="mt-0.5 block h-9 w-full rounded-md border bg-card px-2 text-sm outline-none focus:border-primary"
                  >
                    {availableUnits.map((u) => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </label>
                <label className="text-[10px] text-muted-foreground">
                  পরিমাণ
                  <input
                    value={it.quantity}
                    onChange={(e) => updateItem(it.key, { quantity: e.target.value })}
                    className="mt-0.5 block h-9 w-full rounded-md border bg-card px-2 text-right text-sm tabular-nums outline-none focus:border-primary"
                    inputMode="decimal"
                  />
                </label>
                <label className="text-[10px] text-muted-foreground">
                  দাম (প্রতি {it.unit})
                  <input
                    value={it.price}
                    onChange={(e) => updateItem(it.key, { price: e.target.value })}
                    className="mt-0.5 block h-9 w-full rounded-md border bg-card px-2 text-right text-sm tabular-nums outline-none focus:border-primary"
                    inputMode="decimal"
                  />
                </label>
                <div className="self-end text-right">
                  <p className="text-[10px] text-muted-foreground">মোট</p>
                  <p className="mt-0.5 flex h-9 items-center justify-end whitespace-nowrap rounded-md bg-accent/10 px-3 text-sm font-bold tabular-nums text-primary">
                    {taka(lineTotal)}
                  </p>
                </div>
              </div>

              {hint && (
                <p className="mt-1 rounded-md bg-accent/10 px-2 py-1 text-[10px] text-primary">
                  💡 {hint}
                </p>
              )}
            </div>
          );
        })}

        <div className="flex items-center justify-between rounded-xl bg-gradient-coffee px-4 py-3 text-primary-foreground">
          <span className="text-sm font-semibold">সর্বমোট</span>
          <span className="font-display text-xl font-bold tabular-nums">{taka(total)}</span>
        </div>

        <div className="no-print">
          <Button variant="outline" onClick={addItem} className="w-full">
            <Plus className="h-4 w-4" /> নতুন পণ্য যোগ করুন
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-card md:p-5">
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
          <p>মোট: <strong>{taka(total)}</strong></p>
          <p>জমা: <strong className="text-success">{taka(paidNum)}</strong></p>
          <p>বাকি: <strong className="text-destructive">{taka(due)}</strong></p>
        </div>
      </div>
    </div>
  );
}

function TypeBtn({
  active, onClick, icon, label, sub,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
        active ? "bg-primary text-primary-foreground shadow" : "bg-background text-foreground hover:bg-accent/10"
      }`}
    >
      <span className="flex items-center gap-1.5">{icon}{label}</span>
      <span className={`text-[10px] ${active ? "text-primary-foreground/70" : "text-muted-foreground"}`}>{sub}</span>
    </button>
  );
}