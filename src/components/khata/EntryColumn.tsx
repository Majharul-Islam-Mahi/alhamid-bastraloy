// src/components/khata/EntryColumn.tsx
// খুচরা খাতার একটি কলাম — নগদ বিক্রি / খরচ / জমা / বাকি
// প্রতিটি লাইন আলাদা, ম্যানুয়ালি টাইপ, নিচে সর্বমোট auto
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { taka, num, toBnDigits } from "@/lib/shop";

export type Entry = {
  id: string;
  kind: string;
  name: string | null;
  amount: number;
  details: string | null;
  memo_id: string | null;
  party_id: string | null;
};
export type PartyLite = {
  id: string;
  serial: string;
  shop_name: string;
  kind: string;
};

type Props = {
  title: string;
  kind: "cash_sale" | "expense" | "deposit" | "credit";
  date: string;
  entries: Entry[];
  parties: PartyLite[];
  withName?: boolean;
  withDetails?: boolean;
  opening?: number;
  canEdit: boolean;
  onChanged: () => void;
  tone: string;
};

const inputCls =
  "h-8 w-full min-w-0 rounded border border-transparent bg-transparent px-1.5 text-sm outline-none focus:border-ring focus:bg-card";

function matchParty(name: string, parties: PartyLite[]) {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  return (
    parties.find(
      (p) =>
        p.serial.toLowerCase() === n || p.shop_name.toLowerCase() === n,
    )?.id ?? null
  );
}

// ------- একটি লাইন -------
function Row({
  e,
  idx,
  p,
  onChanged,
}: {
  e: Entry;
  idx: number;
  p: Props;
  onChanged: () => void;
}) {
  const [name, setName] = useState(e.name ?? "");
  const [details, setDetails] = useState(e.details ?? "");
  const [amount, setAmount] = useState(String(e.amount ?? ""));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(e.name ?? "");
    setDetails(e.details ?? "");
    setAmount(String(e.amount ?? ""));
  }, [e]);

  async function save() {
    const patch = {
      name: name.trim() || null,
      details: details.trim() || null,
      amount: num(amount),
      party_id: matchParty(name, p.parties),
    };
    if (
      patch.name === (e.name ?? null) &&
      patch.details === (e.details ?? null) &&
      patch.amount === Number(e.amount)
    ) {
      return; // কোনো পরিবর্তন নেই
    }

    setSaving(true);
    const { error } = await supabase
      .from("day_entries")
      .update(patch)
      .eq("id", e.id);
    setSaving(false);

    if (error) {
      toast.error("সেভ হয়নি: " + error.message);
      return;
    }
    onChanged();
  }

  async function del() {
    if (!confirm("এই লাইনটি মুছে ফেলবেন?")) return;
    const { error } = await supabase
      .from("day_entries")
      .delete()
      .eq("id", e.id);
    if (error) {
      toast.error("মুছা যায়নি: " + error.message);
      return;
    }
    toast.success("মুছে ফেলা হয়েছে");
    onChanged();
  }

  return (
    <li className="grid grid-cols-[28px_1fr_auto_auto] items-center gap-1 border-b border-ledger-line py-0.5">
      <span className="text-right text-xs text-muted-foreground tabular-nums">
        {toBnDigits(idx)}
      </span>

      <div className="min-w-0 space-y-0.5">
        {p.withName && (
          <input
            className={inputCls + " font-medium"}
            placeholder="নাম / সিরিয়াল"
            value={name}
            disabled={!p.canEdit || !!e.memo_id}
            onChange={(x) => setName(x.target.value)}
            onBlur={save}
            list={`parties-${p.kind}`}
          />
        )}
        {p.withDetails && (
          <input
            className={inputCls + " text-xs text-muted-foreground"}
            placeholder="কি কি মাল নিলো"
            value={details}
            disabled={!p.canEdit || !!e.memo_id}
            onChange={(x) => setDetails(x.target.value)}
            onBlur={save}
          />
        )}
        {!p.withName && !p.withDetails && (
          <span className="px-1.5 text-sm text-muted-foreground">
            {details || "—"}
          </span>
        )}
      </div>

      {e.memo_id ? (
        <Link
          to="/admin/memo/$id"
          params={{ id: e.memo_id }}
          title="মেমো দেখুন"
          className="flex h-6 w-6 items-center justify-center rounded bg-gradient-brass text-xs font-bold text-accent-foreground"
        >
          M
        </Link>
      ) : (
        <span className="w-6" />
      )}

      <div className="flex items-center gap-0.5">
        <input
          className={
            inputCls +
            " w-24 shrink-0 text-right font-semibold tabular-nums"
          }
          inputMode="decimal"
          value={amount}
          disabled={!p.canEdit || !!e.memo_id}
          onChange={(x) => setAmount(x.target.value)}
          onBlur={save}
        />
        {p.canEdit && !e.memo_id && (
          <button
            onClick={del}
            disabled={saving}
            className="rounded p-1 text-muted-foreground hover:text-destructive"
            title="মুছুন"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </li>
  );
}

// ------- মূল কলাম -------
export function EntryColumn(p: Props) {
  const [newName, setNewName] = useState("");
  const [newDetails, setNewDetails] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [adding, setAdding] = useState(false);

  const entriesTotal = p.entries.reduce((s, e) => s + Number(e.amount), 0);
  const grandTotal = entriesTotal + (p.opening ?? 0);

  async function add(ev: React.FormEvent) {
    ev.preventDefault();
    if (!newAmount && !newName && !newDetails) return;

    setAdding(true);
    const { error } = await supabase.from("day_entries").insert({
      entry_date: p.date,
      kind: p.kind,
      name: newName.trim() || null,
      details: newDetails.trim() || null,
      amount: num(newAmount),
      party_id: matchParty(newName, p.parties),
    });
    setAdding(false);

    if (error) {
      toast.error("যোগ হয়নি: " + error.message);
      return;
    }

    setNewName("");
    setNewDetails("");
    setNewAmount("");
    p.onChanged();
  }

  // শুধু deposit এর জন্য wholesale, expense এর জন্য supplier, বাকির জন্য সব
  const partyOptions = p.parties.filter((x) =>
    p.kind === "deposit"
      ? x.kind === "wholesale"
      : p.kind === "expense"
        ? x.kind === "supplier"
        : true,
  );

  return (
    <section className="flex min-w-0 flex-col overflow-hidden rounded-xl border bg-card shadow-card">
      <header
        className={`px-4 py-2 text-center font-display text-lg ${p.tone}`}
      >
        {p.title}
      </header>

      <datalist id={`parties-${p.kind}`}>
        {partyOptions.map((x) => (
          <option key={x.id} value={x.shop_name}>
            {x.serial}
          </option>
        ))}
      </datalist>

      <ul className="ledger-paper max-h-96 flex-1 overflow-y-auto px-2 py-1">
        {/* গতকালের ইজা — শুধু জমার ১ম লাইনে */}
        {p.opening !== undefined && (
          <li className="grid grid-cols-[28px_1fr_auto_auto] items-center gap-1 border-b border-ledger-line bg-accent/20 py-1.5">
            <span className="text-right text-xs text-muted-foreground tabular-nums">
              {toBnDigits(1)}
            </span>
            <span className="min-w-0 truncate px-1.5 text-sm font-semibold">
              গতকালের ইজা
            </span>
            <span className="w-6" />
            <span className="w-24 px-1.5 text-right text-sm font-bold tabular-nums text-accent-foreground">
              {taka(p.opening)}
            </span>
          </li>
        )}

        {/* এন্ট্রি লাইনগুলো */}
        {p.entries.map((e, i) => (
          <Row
            key={e.id}
            e={e}
            idx={i + (p.opening !== undefined ? 2 : 1)}
            p={p}
            onChanged={p.onChanged}
          />
        ))}

        {p.entries.length === 0 && p.opening === undefined && (
          <li className="py-6 text-center text-xs text-muted-foreground">
            কোনো এন্ট্রি নেই
          </li>
        )}
      </ul>

      {/* ইনপুট ফর্ম */}
      {p.canEdit && (
        <form
          onSubmit={add}
          className="no-print space-y-1 border-t bg-muted/40 p-2"
        >
          {p.withName && (
            <input
              className={inputCls + " h-9 border-input bg-card"}
              placeholder="নাম / সিরিয়াল"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              list={`parties-${p.kind}`}
            />
          )}
          {p.withDetails && (
            <input
              className={inputCls + " h-9 border-input bg-card"}
              placeholder="মালের বিবরণ ও দাম"
              value={newDetails}
              onChange={(e) => setNewDetails(e.target.value)}
            />
          )}
          <div className="flex gap-1">
            <input
              className={
                inputCls +
                " h-9 border-input bg-card text-right tabular-nums"
              }
              inputMode="decimal"
              placeholder="টাকা"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
            />
            <button
              type="submit"
              disabled={adding}
              className="flex h-9 shrink-0 items-center gap-1 rounded-md bg-primary px-3 text-sm text-primary-foreground disabled:opacity-50"
            >
              <Plus className="h-4 w-4" /> যোগ
            </button>
          </div>
        </form>
      )}

      {/* সর্বমোট */}
      <footer className="mt-auto flex items-center justify-between gap-2 bg-gradient-coffee px-4 py-2.5 text-primary-foreground">
        <span className="text-sm">সর্বমোট</span>
        <span className="text-lg font-bold tabular-nums">
          {taka(grandTotal)}
        </span>
      </footer>
    </section>
  );
}