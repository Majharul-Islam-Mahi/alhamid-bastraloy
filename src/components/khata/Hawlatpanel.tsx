// src/components/khata/HawlatPanel.tsx
// হাওলাত হিসাব — নাম/সিরিয়াল সার্চ, আগের বাকি carry forward
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, UserPlus, Plus, Minus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { taka, num, toBnDigits } from "@/lib/shop";

type H = {
  id: string;
  party_id: string;
  kind: string;
  amount: number;
  entry_date: string;
};

type PartyLite = {
  id: string;
  serial: string;
  shop_name: string;
  mobile: string | null;
};

export function HawlatPanel({
  date,
  canEdit,
  onChanged,
}: {
  date: string;
  canEdit: boolean;
  onChanged: () => void;
}) {
  const [q, setQ] = useState("");
  const [applied, setApplied] = useState("");
  const [adding, setAdding] = useState(false);
  const [newP, setNewP] = useState({ shop_name: "", mobile: "" });
  const [entry, setEntry] = useState<{
    party: string;
    kind: "give" | "receive";
  } | null>(null);
  const [amt, setAmt] = useState("");

  const { data, refetch } = useQuery({
    queryKey: ["hawlat", date],
    queryFn: async () => {
      const [{ data: parties }, { data: entries }] = await Promise.all([
        supabase
          .from("parties")
          .select("id,serial,shop_name,mobile")
          .eq("kind", "hawlat")
          .order("serial"),
        supabase
          .from("hawlat_entries")
          .select("id,party_id,kind,amount,entry_date")
          .lte("entry_date", date),
      ]);
      return {
        parties: (parties ?? []) as PartyLite[],
        entries: (entries ?? []) as H[],
      };
    },
  });

  const rows = useMemo(() => {
    if (!data) return [];
    return data.parties.map((p) => {
      const es = data.entries.filter((e) => e.party_id === p.id);
      const sign = (e: H) =>
        (e.kind === "give" ? 1 : -1) * Number(e.amount);
      const prev = es
        .filter((e) => e.entry_date < date)
        .reduce((s, e) => s + sign(e), 0);
      const give = es
        .filter((e) => e.entry_date === date && e.kind === "give")
        .reduce((s, e) => s + Number(e.amount), 0);
      const recv = es
        .filter((e) => e.entry_date === date && e.kind === "receive")
        .reduce((s, e) => s + Number(e.amount), 0);
      return { ...p, prev, give, recv, bal: prev + give - recv };
    });
  }, [data, date]);

  const s = applied.trim().toLowerCase();
  const visible = rows.filter((r) =>
    s
      ? r.shop_name.toLowerCase().includes(s) ||
        r.serial.toLowerCase().includes(s) ||
        (r.mobile ?? "").includes(s)
      : r.bal !== 0 || r.give || r.recv,
  );
  const total = rows.reduce((t, r) => t + r.bal, 0);

  async function addParty(e: React.FormEvent) {
    e.preventDefault();
    if (!newP.shop_name.trim()) {
      toast.error("নাম দিন");
      return;
    }
    const serial =
      "H" + String(rows.length + 1).padStart(3, "0") + "-" + Date.now().toString().slice(-3);
    const { error } = await supabase.from("parties").insert({
      kind: "hawlat",
      serial,
      shop_name: newP.shop_name.trim(),
      mobile: newP.mobile.trim() || null,
    });
    if (error) {
      toast.error("যোগ হয়নি: " + error.message);
      return;
    }
    toast.success("যোগ হয়েছে");
    setNewP({ shop_name: "", mobile: "" });
    setAdding(false);
    setQ(newP.shop_name);
    setApplied(newP.shop_name);
    refetch();
  }

  async function addEntry(e: React.FormEvent) {
    e.preventDefault();
    if (!entry) return;
    const amount = num(amt);
    if (amount <= 0) {
      toast.error("টাকার পরিমাণ দিন");
      return;
    }
    const { error } = await supabase.from("hawlat_entries").insert({
      party_id: entry.party,
      kind: entry.kind,
      amount,
      entry_date: date,
    });
    if (error) {
      toast.error("সেভ হয়নি: " + error.message);
      return;
    }
    toast.success(entry.kind === "give" ? "হাওলাত দেওয়া হয়েছে" : "ফেরত পেয়েছি");
    setEntry(null);
    setAmt("");
    refetch();
    onChanged();
  }

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-card">
      <header className="flex flex-wrap items-center justify-between gap-2 bg-secondary px-3 py-2">
        <h2 className="font-display text-lg text-primary">হাওলাত হিসাব</h2>
        <form
          className="no-print flex gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            setApplied(q);
          }}
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                if (!e.target.value) setApplied("");
              }}
              placeholder="নাম / সিরিয়াল"
              className="h-8 w-36 rounded-md border bg-card pl-7 pr-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="flex h-8 items-center rounded-md bg-primary px-2.5 text-xs text-primary-foreground"
          >
            খুঁজুন
          </button>
          {applied && (
            <button
              type="button"
              onClick={() => {
                setQ("");
                setApplied("");
              }}
              className="flex h-8 items-center rounded-md border bg-card px-2"
              title="ক্লিয়ার"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {canEdit && (
            <button
              type="button"
              onClick={() => setAdding((v) => !v)}
              className="flex h-8 items-center rounded-md border bg-card px-2 text-primary"
              title="নতুন নাম"
            >
              <UserPlus className="h-3.5 w-3.5" />
            </button>
          )}
        </form>
      </header>

      {adding && (
        <form
          onSubmit={addParty}
          className="no-print flex flex-wrap gap-2 border-b bg-muted/40 p-2"
        >
          <input
            required
            placeholder="নাম / দোকানের নাম"
            value={newP.shop_name}
            onChange={(e) =>
              setNewP({ ...newP, shop_name: e.target.value })
            }
            className="h-8 flex-1 rounded-md border bg-card px-2 text-sm"
          />
          <input
            placeholder="মোবাইল"
            value={newP.mobile}
            onChange={(e) => setNewP({ ...newP, mobile: e.target.value })}
            className="h-8 w-32 rounded-md border bg-card px-2 text-sm"
          />
          <button className="h-8 rounded-md bg-primary px-3 text-xs text-primary-foreground">
            যোগ
          </button>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[540px] table-fixed text-sm">
          <colgroup>
            <col className="w-10" />
            <col />
            <col className="w-24" />
            <col className="w-20" />
            <col className="w-20" />
            <col className="w-24" />
          </colgroup>
          <thead className="bg-muted/60 text-[11px] text-muted-foreground">
            <tr>
              <th className="px-1.5 py-1.5 text-right">ক্রম</th>
              <th className="px-1.5 py-1.5 text-left">নাম</th>
              <th className="px-1.5 py-1.5 text-right">আগের বাকি</th>
              <th className="px-1.5 py-1.5 text-right">দিলাম</th>
              <th className="px-1.5 py-1.5 text-right">পেলাম</th>
              <th className="px-1.5 py-1.5 text-right">বাকি</th>
            </tr>
          </thead>
          <tbody className="ledger-paper">
            {visible.map((r, i) => (
              <tr
                key={r.id}
                className="border-b border-ledger-line align-middle"
              >
                <td className="px-1.5 py-1.5 text-right text-muted-foreground tabular-nums">
                  {toBnDigits(i + 1)}
                </td>
                <td className="px-1.5 py-1.5">
                  <div className="flex items-center gap-1">
                    <span
                      className="min-w-0 flex-1 truncate font-medium"
                      title={r.shop_name}
                    >
                      {r.shop_name}
                    </span>
                    {canEdit && (
                      <span className="no-print flex shrink-0 gap-0.5">
                        <button
                          onClick={() =>
                            setEntry({ party: r.id, kind: "give" })
                          }
                          className="rounded bg-destructive/10 p-0.5 text-destructive"
                          title="হাওলাত দিলাম"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                        <button
                          onClick={() =>
                            setEntry({ party: r.id, kind: "receive" })
                          }
                          className="rounded bg-success/10 p-0.5 text-success"
                          title="ফেরত পেলাম"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                      </span>
                    )}
                  </div>
                  {entry?.party === r.id && (
                    <form
                      onSubmit={addEntry}
                      className="mt-1 flex gap-1"
                    >
                      <input
                        autoFocus
                        inputMode="decimal"
                        value={amt}
                        onChange={(e) => setAmt(e.target.value)}
                        placeholder={
                          entry.kind === "give"
                            ? "কত দিলাম"
                            : "কত পেলাম"
                        }
                        className="h-7 min-w-0 flex-1 rounded border bg-card px-2 text-right text-xs"
                      />
                      <button className="h-7 rounded bg-primary px-2 text-[11px] text-primary-foreground">
                        সেভ
                      </button>
                      <button
                        type="button"
                        onClick={() => setEntry(null)}
                        className="h-7 px-1"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </form>
                  )}
                </td>
                <td className="truncate px-1.5 py-1.5 text-right tabular-nums">
                  {taka(r.prev)}
                </td>
                <td className="truncate px-1.5 py-1.5 text-right tabular-nums text-destructive">
                  {r.give ? taka(r.give) : "—"}
                </td>
                <td className="truncate px-1.5 py-1.5 text-right tabular-nums text-success">
                  {r.recv ? taka(r.recv) : "—"}
                </td>
                <td className="truncate px-1.5 py-1.5 text-right font-bold tabular-nums">
                  {taka(r.bal)}
                </td>
              </tr>
            ))}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={6}
                  className="py-6 text-center text-xs text-muted-foreground"
                >
                  {s ? "কাউকে পাওয়া যায়নি" : "কোনো হাওলাত বাকি নেই"}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <footer className="mt-auto flex items-center justify-between bg-gradient-coffee px-4 py-2.5 text-primary-foreground">
        <span className="text-sm">সর্বমোট হাওলাতি বাকি</span>
        <span className="text-lg font-bold tabular-nums">{taka(total)}</span>
      </footer>
    </section>
  );
}