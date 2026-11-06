// src/routes/_authenticated/admin.import.tsx
// Historical bulk import — Parties + Memos + Day Entries + Supplier + Hawlat
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useRef } from "react";
import {
  Upload,
  Download,
  Table as TableIcon,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Loader2,
  FileSpreadsheet,
  History,
} from "lucide-react";
import {
  bulkImportParties,
  bulkImportMemos,
  bulkImportDayEntries,
  bulkImportSupplierEntries,
  bulkImportHawlatEntries,
  listImportSessions,
  rollbackImport,
} from "@/lib/import.functions";
import { toBnDigits } from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/import")({
  head: () => ({ meta: [{ title: "Import Tool — আল হামিদ বস্ত্রালয়" }] }),
  component: ImportPage,
});

type ImportType = "parties" | "memos" | "day_entries" | "supplier_entries" | "hawlat_entries";

const TYPES: { key: ImportType; label: string }[] = [
  { key: "parties", label: "পার্টি" },
  { key: "memos", label: "মেমো" },
  { key: "day_entries", label: "খুচরা খাতা" },
  { key: "supplier_entries", label: "দেনা খাতা" },
  { key: "hawlat_entries", label: "হাওলাত" },
];

const TEMPLATES: Record<ImportType, { headers: string[]; sample: string }> = {
  parties: {
    headers: ["serial", "shop_name", "kind", "owner_name", "mobile", "address"],
    sample: `serial,shop_name,kind,owner_name,mobile,address
C001,করিম স্টোর,wholesale,করিম,01700000001,ফেনী
C002,রহিম ট্রেডার্স,wholesale,রহিম,01700000002,দাগনভূঞা
R001,আবুল কাপড়,retail,আবুল,01700000003,ছাগলনাইয়া
001,হক টেক্সটাইল,supplier,,01800000001,ঢাকা
H001,হাওলাত দোকান,hawlat,,01700000004,ফেনী`,
  },
  memos: {
    headers: [
      "memo_no",
      "memo_date",
      "party_serial",
      "shop_name",
      "owner_name",
      "mobile",
      "address",
      "total",
      "paid",
    ],
    sample: `memo_no,memo_date,party_serial,shop_name,owner_name,mobile,address,total,paid
101,2024-01-15,C001,করিম স্টোর,করিম,01700000001,ফেনী,12000,2000
102,2024-01-18,C002,রহিম ট্রেডার্স,রহিম,01700000002,দাগনভূঞা,8500,0`,
  },
  day_entries: {
    headers: ["entry_date", "kind", "amount", "name", "details", "party_serial"],
    sample: `entry_date,kind,amount,name,details,party_serial
2024-01-15,cash_sale,5000,,নগদ বিক্রি,
2024-01-15,expense,500,,চা-নাস্তা,
2024-01-15,deposit,2000,করিম স্টোর,কালেকশন,C001
2024-01-15,credit,8000,রহিম ট্রেডার্স,লুঙ্গি ১০ পিস,C002`,
  },
  supplier_entries: {
    headers: ["party_serial", "entry_date", "kind", "amount", "details"],
    sample: `party_serial,entry_date,kind,amount,details
001,2024-01-15,purchase,50000,লুঙ্গি ৫০০ পিস
001,2024-01-20,payment,30000,বিকাশে
001,2024-02-01,purchase,25000,শার্টিং ১০০ গজ`,
  },
  hawlat_entries: {
    headers: ["party_serial", "entry_date", "kind", "amount", "note"],
    sample: `party_serial,entry_date,kind,amount,note
H001,2024-01-15,give,30000,হাওলাত দিলাম
H001,2024-01-20,receive,5000,ফেরত পেলাম
H001,2024-01-25,give,10000,আবার হাওলাত`,
  },
};

function ImportPage() {
  const qc = useQueryClient();
  const importParties = useServerFn(bulkImportParties);
  const importMemos = useServerFn(bulkImportMemos);
  const importDayEntries = useServerFn(bulkImportDayEntries);
  const importSupplierEntries = useServerFn(bulkImportSupplierEntries);
  const importHawlatEntries = useServerFn(bulkImportHawlatEntries);
  const fetchSessions = useServerFn(listImportSessions);
  const rollbackFn = useServerFn(rollbackImport);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [importType, setImportType] = useState<ImportType>("parties");
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([]);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{
    sessionId?: string;
    total: number;
    success: number;
    failed: number;
    errors: { row: number; error: string }[];
  } | null>(null);

  const { data: sessionsData } = useQuery({
    queryKey: ["import-sessions"],
    queryFn: () => fetchSessions(),
  });
  const sessions = sessionsData?.sessions ?? [];

  // ---- CSV Parser ----
  function parseCSV(text: string): Record<string, string>[] {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headers = parseLine(lines[0]!);
    const rows: Record<string, string>[] = [];
    for (let i = 1; i < lines.length; i++) {
      const vals = parseLine(lines[i]!);
      const obj: Record<string, string> = {};
      headers.forEach((h, idx) => {
        obj[h.trim()] = (vals[idx] ?? "").trim();
      });
      rows.push(obj);
    }
    return rows;
  }

  function parseLine(line: string): string[] {
    const out: string[] = [];
    let cur = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (ch === "," && !inQuote) {
        out.push(cur);
        cur = "";
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out;
  }

  function handleFile(f: File) {
    setFileName(f.name);
    setResult(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = String(e.target?.result ?? "");
        const rows = parseCSV(text);
        setParsedRows(rows);
        toast.success(`${toBnDigits(rows.length)} rows পড়া হয়েছে`);
      } catch {
        toast.error("CSV পড়া যায়নি");
      }
    };
    reader.readAsText(f, "UTF-8");
  }

  function downloadTemplate() {
    const t = TEMPLATES[importType];
    const blob = new Blob(["\uFEFF" + t.sample], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${importType}-template.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Template ডাউনলোড হয়েছে");
  }

  // ---- Prepare typed rows ----
  function prepareRows(): unknown[] {
    if (importType === "parties") {
      return parsedRows
        .filter((r) => r["serial"] && r["shop_name"] && r["kind"])
        .map((r) => ({
          serial: r["serial"]!,
          shop_name: r["shop_name"]!,
          kind: r["kind"] as "wholesale" | "retail" | "supplier" | "hawlat",
          owner_name: r["owner_name"] || null,
          mobile: r["mobile"] || null,
          address: r["address"] || null,
        }));
    }
    if (importType === "memos") {
      return parsedRows
        .filter((r) => r["shop_name"] && r["memo_date"])
        .map((r) => ({
          memo_no: r["memo_no"] ? Number(r["memo_no"]) : null,
          memo_date: r["memo_date"]!,
          party_serial: r["party_serial"] || null,
          shop_name: r["shop_name"]!,
          owner_name: r["owner_name"] || null,
          mobile: r["mobile"] || null,
          address: r["address"] || null,
          total: Number(r["total"]) || 0,
          paid: Number(r["paid"]) || 0,
        }));
    }
    if (importType === "day_entries") {
      return parsedRows
        .filter((r) => r["entry_date"] && r["kind"] && r["amount"])
        .map((r) => ({
          entry_date: r["entry_date"]!,
          kind: r["kind"] as "cash_sale" | "expense" | "deposit" | "credit",
          amount: Number(r["amount"]) || 0,
          name: r["name"] || null,
          details: r["details"] || null,
          party_serial: r["party_serial"] || null,
        }));
    }
    if (importType === "supplier_entries") {
      return parsedRows
        .filter((r) => r["party_serial"] && r["entry_date"] && r["kind"] && r["amount"])
        .map((r) => ({
          party_serial: r["party_serial"]!,
          entry_date: r["entry_date"]!,
          kind: r["kind"] as "purchase" | "payment",
          amount: Number(r["amount"]) || 0,
          details: r["details"] || null,
        }));
    }
    // hawlat_entries
    return parsedRows
      .filter((r) => r["party_serial"] && r["entry_date"] && r["kind"] && r["amount"])
      .map((r) => ({
        party_serial: r["party_serial"]!,
        entry_date: r["entry_date"]!,
        kind: r["kind"] as "give" | "receive",
        amount: Number(r["amount"]) || 0,
        note: r["note"] || null,
      }));
  }

  async function doImport() {
    const rows = prepareRows();
    if (rows.length === 0) {
      toast.error("কোনো valid row নেই");
      return;
    }

    setBusy(true);
    try {
      let res;
      if (importType === "parties") {
        res = await importParties({
          data: { rows: rows as Parameters<typeof importParties>[0]["data"]["rows"] },
        });
      } else if (importType === "memos") {
        res = await importMemos({
          data: { rows: rows as Parameters<typeof importMemos>[0]["data"]["rows"] },
        });
      } else if (importType === "day_entries") {
        res = await importDayEntries({
          data: { rows: rows as Parameters<typeof importDayEntries>[0]["data"]["rows"] },
        });
      } else if (importType === "supplier_entries") {
        res = await importSupplierEntries({
          data: { rows: rows as Parameters<typeof importSupplierEntries>[0]["data"]["rows"] },
        });
      } else {
        res = await importHawlatEntries({
          data: { rows: rows as Parameters<typeof importHawlatEntries>[0]["data"]["rows"] },
        });
      }
      setResult(res);
      toast.success(`সফল: ${toBnDigits(res.success)} টি, ব্যর্থ: ${toBnDigits(res.failed)}`);
      qc.invalidateQueries({ queryKey: ["import-sessions"] });
      qc.invalidateQueries({ queryKey: ["parties"] });
      qc.invalidateQueries({ queryKey: ["memos-list"] });
      qc.invalidateQueries({ queryKey: ["day-entries"] });
      qc.invalidateQueries({ queryKey: ["supplier-entries"] });
      qc.invalidateQueries({ queryKey: ["hawlat"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRollback(sessionId: string) {
    if (!confirm("এই import এর সব ডেটা মুছে ফেলবেন?")) return;
    try {
      const r = await rollbackFn({ data: { sessionId } });
      toast.success(`${toBnDigits(r.deleted)} টি row মুছে ফেলা হয়েছে`);
      qc.invalidateQueries({ queryKey: ["import-sessions"] });
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const t = TEMPLATES[importType];

  return (
    <div className="mx-auto max-w-6xl space-y-5 px-1 md:space-y-6 md:px-0">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <div className="flex items-center gap-2">
          <Upload className="h-6 w-6 md:h-7 md:w-7 text-primary" />
          <h1
            className="text-2xl md:text-3xl"
            style={{ fontFamily: "'Tiro Bangla', serif", color: "#3a2318" }}
          >
            Historical Import
          </h1>
        </div>
      </div>

      {/* Info */}
      <div className="rounded-2xl border-l-4 border-accent bg-accent/5 p-4 text-sm">
        <p className="font-semibold text-primary">📥 ২৬-৩০ বছরের পুরাতন ডেটা import</p>
        <p className="mt-1 text-xs text-muted-foreground">
          <strong>Recommended order:</strong> প্রথমে পার্টি → তারপর মেমো → তারপর খুচরা খাতা → দেনা
          খাতা → হাওলাত। কারণ memo/supplier/hawlat party_serial দিয়ে match হয়।
        </p>
      </div>

      {/* Type selector */}
      <div className="flex flex-wrap gap-2">
        {TYPES.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => {
              setImportType(key);
              setParsedRows([]);
              setFileName("");
              setResult(null);
            }}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition ${
              importType === key
                ? "bg-primary text-primary-foreground shadow"
                : "bg-card text-foreground hover:bg-accent/10"
            } border`}
            style={{ borderColor: "#dbcbb2" }}
          >
            <TableIcon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Upload */}
      <div className="grid gap-4 rounded-2xl border bg-card p-5 shadow-card md:grid-cols-[1fr_auto]">
        <div>
          <p className="mb-2 text-sm font-semibold text-primary">১. Template download করুন</p>
          <p className="mb-3 text-xs text-muted-foreground break-all">
            Columns: {t.headers.join(", ")}
          </p>
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <Download className="h-4 w-4" /> {importType}-template.csv
          </Button>
        </div>
        <div className="text-right">
          <p className="mb-2 text-sm font-semibold text-primary">২. Filled CSV upload করুন</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
              e.target.value = "";
            }}
          />
          <Button variant="coffee" onClick={() => fileInputRef.current?.click()}>
            <FileSpreadsheet className="h-4 w-4" /> CSV বাছুন
          </Button>
          {fileName && (
            <p className="mt-2 text-xs text-muted-foreground">
              {fileName} — {toBnDigits(parsedRows.length)} rows
            </p>
          )}
        </div>
      </div>

      {/* Preview */}
      {parsedRows.length > 0 && !result && (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
          <div className="flex items-center gap-2 border-b bg-secondary px-5 py-3">
            <TableIcon className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg text-primary">Preview (প্রথম ১০ row)</h2>
            <span className="ml-auto rounded-full bg-primary/10 px-3 py-0.5 text-xs font-semibold text-primary">
              মোট {toBnDigits(parsedRows.length)}
            </span>
          </div>
          <div className="table-scroll">
            <table className="w-full min-w-[800px] text-xs">
              <thead className="bg-muted/60">
                <tr>
                  <th className="px-2 py-2 text-left">#</th>
                  {t.headers.map((h) => (
                    <th key={h} className="px-2 py-2 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {parsedRows.slice(0, 10).map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-2 py-1 text-muted-foreground">{toBnDigits(i + 1)}</td>
                    {t.headers.map((h) => (
                      <td key={h} className="px-2 py-1 truncate max-w-[150px]">
                        {r[h] || "—"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t bg-secondary/40 p-3 text-right">
            <Button variant="coffee" onClick={doImport} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {busy ? "Import হচ্ছে…" : `${toBnDigits(prepareRows().length)} rows import করুন`}
            </Button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div
          className={`rounded-2xl border-2 p-5 ${
            result.failed === 0
              ? "border-success/40 bg-success/5"
              : "border-yellow-500/40 bg-yellow-50/30"
          }`}
        >
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-success" />
            <p className="font-semibold text-primary">Import সম্পন্ন</p>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-background p-3">
              <p className="text-xs text-muted-foreground">মোট</p>
              <p className="text-lg font-bold">{toBnDigits(result.total)}</p>
            </div>
            <div className="rounded-lg border bg-success/10 p-3">
              <p className="text-xs text-muted-foreground">সফল</p>
              <p className="text-lg font-bold text-success">{toBnDigits(result.success)}</p>
            </div>
            <div className="rounded-lg border bg-destructive/10 p-3">
              <p className="text-xs text-muted-foreground">ব্যর্থ</p>
              <p className="text-lg font-bold text-destructive">{toBnDigits(result.failed)}</p>
            </div>
          </div>

          {result.errors.length > 0 && (
            <div className="mt-3 rounded-lg border bg-background p-3">
              <p className="mb-2 flex items-center gap-1 text-sm font-semibold text-destructive">
                <AlertCircle className="h-4 w-4" /> Error তালিকা (প্রথম ৫০)
              </p>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-destructive">
                    Row {toBnDigits(e.row)}: {e.error}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setResult(null);
                setParsedRows([]);
                setFileName("");
              }}
            >
              নতুন import
            </Button>
            {result.sessionId && result.success > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="text-destructive"
                onClick={() => handleRollback(result.sessionId!)}
              >
                <RotateCcw className="h-4 w-4" /> Rollback
              </Button>
            )}
          </div>
        </div>
      )}

      {/* History */}
      {sessions.length > 0 && (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
          <div className="flex items-center gap-2 border-b bg-secondary px-5 py-3">
            <History className="h-5 w-5 text-primary" />
            <h2 className="font-display text-lg text-primary">Import History</h2>
          </div>
          <div className="table-scroll">
            <table className="w-full min-w-[600px] text-sm">
              <thead className="bg-muted/60 text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">ধরন</th>
                  <th className="px-3 py-2 text-right">মোট</th>
                  <th className="px-3 py-2 text-right">সফল</th>
                  <th className="px-3 py-2 text-right">ব্যর্থ</th>
                  <th className="px-3 py-2 text-left">সময়</th>
                  <th className="px-3 py-2 text-right">—</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-3 py-2 font-semibold">{s.table_name}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {toBnDigits(s.total_rows)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-success">
                      {toBnDigits(s.success_rows)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-destructive">
                      {toBnDigits(s.failed_rows)}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {new Date(s.created_at).toLocaleString("bn-BD")}
                    </td>
                    <td className="px-3 py-2 text-right">
                      {s.success_rows > 0 && (
                        <button
                          onClick={() => handleRollback(s.id)}
                          className="rounded p-1 text-destructive hover:bg-destructive/10"
                          title="Rollback"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
