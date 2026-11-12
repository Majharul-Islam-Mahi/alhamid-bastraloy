// src/routes/_authenticated/admin.collection.tsx
// এলাকা-ভিত্তিক কালেকশন entry
//
// 🐛 FIX: "হিসাব দেখুন" — Link ব্যবহার (nav এর বদলে, guaranteed navigation)
// 🐛 FIX: Transaction-safe save with rollback
import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect, useMemo } from "react";
import { HandCoins, Save, AlertCircle, ArrowLeft, User, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useMe } from "@/hooks/use-me";
import { taka, toBnDigits, todayISO, englishDateBn, weekdayBn, num } from "@/lib/shop";
import { partyDue } from "@/lib/ledger";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/collection")({
  head: () => ({ meta: [{ title: "কালেকশন — আল হামিদ বস্ত্রালয়" }] }),
  component: CollectionPage,
});

type Area = {
  id: string;
  name: string;
  name_bn: string | null;
  day_of_week: number;
};

type Party = {
  id: string;
  serial: string;
  shop_name: string;
  owner_name: string | null;
  mobile: string | null;
  area_id: string | null;
  kind: string;
};

function CollectionPage() {
  const nav = useNavigate();
  const qc = useQueryClient();
  const { data: me } = useMe();

  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [selectedAreaId, setSelectedAreaId] = useState<string>("");
  const [entries, setEntries] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [dues, setDues] = useState<Record<string, number>>({});

  const dayOfWeek = useMemo(() => {
    const d = new Date(selectedDate + "T00:00:00");
    return d.getDay();
  }, [selectedDate]);

  const { data: allAreas = [] } = useQuery({
    queryKey: ["areas-all"],
    queryFn: async () =>
      (
        await supabase
          .from("areas")
          .select("id,name,name_bn,day_of_week")
          .eq("active", true)
          .order("sort_order")
      ).data ?? ([] as Area[]),
  });

  const todayAreas = useMemo(
    () => allAreas.filter((a) => a.day_of_week === dayOfWeek),
    [allAreas, dayOfWeek],
  );

  useEffect(() => {
    if (todayAreas.length > 0 && !selectedAreaId) {
      setSelectedAreaId(todayAreas[0]?.id ?? "");
    }
  }, [todayAreas, selectedAreaId]);

  const { data: parties = [] } = useQuery({
    queryKey: ["parties-by-area", selectedAreaId],
    enabled: !!selectedAreaId,
    queryFn: async () =>
      (
        await supabase
          .from("parties")
          .select("id,serial,shop_name,owner_name,mobile,area_id,kind")
          .eq("area_id", selectedAreaId)
          .in("kind", ["wholesale", "retail"])
          .order("serial")
      ).data ?? ([] as Party[]),
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Record<string, number> = {};
      for (const p of parties) {
        out[p.id] = await partyDue(p.id);
      }
      if (!cancelled) setDues(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [parties]);

  const totalCollection = useMemo(() => {
    return Object.values(entries).reduce((s, v) => s + num(v), 0);
  }, [entries]);

  const filledCount = Object.values(entries).filter((v) => num(v) > 0).length;
  const currentArea = allAreas.find((a) => a.id === selectedAreaId);

  async function saveCollection() {
    if (!selectedAreaId) {
      toast.error("এলাকা select করুন");
      return;
    }
    if (filledCount === 0) {
      toast.error("কমপক্ষে একটা entry দিন");
      return;
    }
    if (!me?.full_name) {
      toast.error("আপনার profile লোড হয়নি — একটু অপেক্ষা করে আবার চেষ্টা করুন");
      return;
    }

    setBusy(true);
    let collectionId: string | null = null;
    const dayEntryIds: string[] = [];

    try {
      const { data: collection, error: cErr } = await supabase
        .from("collections")
        .insert({
          collection_date: selectedDate,
          area_id: selectedAreaId,
          collected_by: me.id,
          collected_by_name: me.full_name,
          total_amount: totalCollection,
          items_count: filledCount,
          notes: notes.trim() || null,
        })
        .select("id")
        .single();

      if (cErr || !collection) throw new Error("কালেকশন সেভ হয়নি: " + (cErr?.message ?? "unknown"));
      collectionId = collection.id;

      const items = Object.entries(entries)
        .map(([party_id, amount]) => ({ party_id, amount: num(amount) }))
        .filter((i) => i.amount > 0);

      for (const item of items) {
        const party = parties.find((p) => p.id === item.party_id);
        if (!party) continue;

        const { data: dayEntry, error: dErr } = await supabase
          .from("day_entries")
          .insert({
            entry_date: selectedDate,
            kind: "deposit",
            name: party.shop_name,
            amount: item.amount,
            party_id: party.id,
            details: `কালেকশন — ${currentArea?.name_bn || currentArea?.name || ""} — কালেকশনকারী: ${me.full_name}`,
            collection_id: collection.id,
            created_by: me.id,
          })
          .select("id")
          .single();

        if (dErr || !dayEntry) {
          throw new Error(`Entry সেভ হয়নি (${party.shop_name}): ${dErr?.message ?? "unknown"}`);
        }
        dayEntryIds.push(dayEntry.id);

        const { error: ciErr } = await supabase.from("collection_items").insert({
          collection_id: collection.id,
          party_id: party.id,
          party_serial: party.serial,
          party_name: party.shop_name,
          amount: item.amount,
          day_entry_id: dayEntry.id,
        });

        if (ciErr) {
          throw new Error(`Item সেভ হয়নি (${party.shop_name}): ${ciErr.message}`);
        }
      }

      toast.success(
        `✅ কালেকশন সেভ হয়েছে — ${toBnDigits(filledCount)} জন কাস্টমার, মোট ${taka(totalCollection)}`,
      );

      qc.invalidateQueries({ queryKey: ["day-entries"] });
      qc.invalidateQueries({ queryKey: ["day-summary"] });
      qc.invalidateQueries({ queryKey: ["party-due"] });
      qc.invalidateQueries({ queryKey: ["collections-history"] });

      setEntries({});
      setNotes("");
      nav({ to: "/admin/collection/history" });
    } catch (e) {
      const errMsg = (e as Error).message;

      if (dayEntryIds.length > 0) {
        try { await supabase.from("day_entries").delete().in("id", dayEntryIds); } catch { /* ignore */ }
      }
      if (collectionId) {
        try { await supabase.from("collections").delete().eq("id", collectionId); } catch { /* ignore */ }
      }

      toast.error(errMsg + " — কোনো partial data save হয়নি");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div className="no-print flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <h1 className="text-2xl md:text-3xl" style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}>
          কালেকশন
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
            className="h-9 rounded-md border bg-card px-3 text-sm"
          />
          {/* 🐛 FIX: Link ব্যবহার */}
          <Link to="/admin/collection/history">
            <Button variant="outline">
              <ArrowLeft /> হিসাব দেখুন
            </Button>
          </Link>
        </div>
      </div>

      <div
        className="rounded-2xl p-5 shadow-lg"
        style={{ background: "linear-gradient(135deg, #3a2318 0%, #5a3a22 100%)", color: "#f8f3ea" }}
      >
        <p className="text-sm" style={{ color: "#d9a85a" }}>
          <Calendar className="mr-1 inline h-4 w-4" />
          {weekdayBn(selectedDate)} · {englishDateBn(selectedDate)}
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-4">
          <label className="block">
            <span className="text-xs" style={{ color: "#d9a85a" }}>এলাকা select করুন</span>
            <select
              value={selectedAreaId}
              onChange={(e) => { setSelectedAreaId(e.target.value); setEntries({}); }}
              className="mt-1 block h-10 min-w-[220px] rounded-md border-0 bg-[#fdfaf5] px-3 text-sm"
              style={{ color: "#3a2318" }}
            >
              <option value="">— এলাকা —</option>
              {todayAreas.length > 0 && (
                <optgroup label={`আজকের এলাকা (${weekdayBn(selectedDate)})`}>
                  {todayAreas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name_bn || a.name}</option>
                  ))}
                </optgroup>
              )}
              <optgroup label="সব এলাকা">
                {allAreas
                  .filter((a) => a.day_of_week !== dayOfWeek)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name_bn || a.name} ({["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"][a.day_of_week]})
                    </option>
                  ))}
              </optgroup>
            </select>
          </label>

          <div className="ml-auto text-right">
            <p className="text-xs" style={{ color: "#d9a85a" }}>মোট কালেকশন</p>
            <p className="text-2xl font-bold" style={{ color: "#ffffff" }}>{taka(totalCollection)}</p>
            <p className="text-xs" style={{ color: "#e8dcc8" }}>{toBnDigits(filledCount)} জন কাস্টমার</p>
          </div>
        </div>
      </div>

      {!selectedAreaId ? (
        <div className="rounded-2xl border-2 border-dashed bg-card py-16 text-center">
          <AlertCircle className="mx-auto h-10 w-10" style={{ color: "#c9924a" }} />
          <p className="mt-2" style={{ color: "#7a6558" }}>উপরে এলাকা select করুন</p>
        </div>
      ) : parties.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed bg-card py-16 text-center">
          <AlertCircle className="mx-auto h-10 w-10" style={{ color: "#c9924a" }} />
          <p className="mt-2" style={{ color: "#7a6558" }}>এই এলাকায় কোনো কাস্টমার নেই।</p>
          <p className="mt-1 text-xs" style={{ color: "#7a6558" }}>
            /admin/users এ গিয়ে কাস্টমার তৈরি করুন এবং এলাকা select করুন।
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
          <div
            className="border-b px-4 py-3"
            style={{ background: "linear-gradient(90deg, rgba(201,146,74,0.15), rgba(201,146,74,0.05))" }}
          >
            <h2 className="text-lg" style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}>
              {currentArea?.name_bn || currentArea?.name} — {toBnDigits(parties.length)} জন কাস্টমার
            </h2>
          </div>

          <div className="table-scroll">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="text-xs" style={{ backgroundColor: "#e8dcc8", color: "#3a2318" }}>
                <tr>
                  <th className="w-14 px-3 py-2 text-left">ক্রম</th>
                  <th className="px-3 py-2 text-left">সিরিয়াল</th>
                  <th className="px-3 py-2 text-left">দোকানের নাম</th>
                  <th className="px-3 py-2 text-right">মোট বাকি</th>
                  <th className="w-40 px-3 py-2 text-right">আজ কত দিলো (৳)</th>
                </tr>
              </thead>
              <tbody>
                {parties.map((p, i) => {
                  const due = dues[p.id] ?? 0;
                  const val = entries[p.id] ?? "";
                  const amount = num(val);
                  return (
                    <tr key={p.id} className={`border-t transition ${amount > 0 ? "bg-green-50" : ""}`}>
                      <td className="px-3 py-2 tabular-nums" style={{ color: "#7a6558" }}>{toBnDigits(i + 1)}</td>
                      <td className="px-3 py-2 tabular-nums" style={{ color: "#3a2318" }}>{toBnDigits(p.serial)}</td>
                      <td className="px-3 py-2">
                        <p className="font-semibold" style={{ color: "#3a2318" }}>{p.shop_name}</p>
                        {p.owner_name && <p className="text-xs" style={{ color: "#7a6558" }}>{p.owner_name}</p>}
                        {p.mobile && <p className="text-xs tabular-nums" style={{ color: "#7a6558" }}>{toBnDigits(p.mobile)}</p>}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums" style={{ color: due > 0 ? "#a83e2c" : "#2d7a4f" }}>
                        {taka(due)}
                      </td>
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={val}
                          onChange={(e) => setEntries({ ...entries, [p.id]: e.target.value })}
                          placeholder="০"
                          className={`h-10 w-full rounded-md border bg-white px-2 text-right text-base font-semibold tabular-nums outline-none focus:ring-2 ${
                            amount > 0 ? "border-green-500 ring-green-200" : "border-[#dbcbb2]"
                          }`}
                          style={{ color: "#3a2318" }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot style={{ backgroundColor: "#3a2318", color: "#f8f3ea" }}>
                <tr>
                  <td colSpan={4} className="px-4 py-3 text-right text-lg font-semibold">সর্বমোট</td>
                  <td className="px-3 py-3 text-right text-xl font-bold tabular-nums">{taka(totalCollection)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {selectedAreaId && parties.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 shadow-card">
          <label className="block text-sm">
            <span className="text-xs" style={{ color: "#7a6558" }}>নোট (ঐচ্ছিক)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="যেমন: আজ কেউ কেউ বাড়িতে ছিল না।"
              className="mt-1 block w-full rounded-md border bg-background px-3 py-2 text-sm"
              style={{ color: "#3a2318" }}
            />
          </label>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs" style={{ color: "#7a6558" }}>
              <User className="mr-1 inline h-3.5 w-3.5" />
              কালেকশনকারী: <strong style={{ color: "#3a2318" }}>{me?.full_name ?? "—"}</strong>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => { if (confirm("সব entry মুছবেন?")) setEntries({}); }}
                disabled={busy}
              >
                রিসেট
              </Button>
              <Button variant="coffee" onClick={saveCollection} disabled={busy || filledCount === 0}>
                <Save /> {busy ? "সেভ হচ্ছে…" : `সেভ করুন (${toBnDigits(filledCount)} জন)`}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}