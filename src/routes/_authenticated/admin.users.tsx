// src/routes/_authenticated/admin.users.tsx
// ইউজার ও কাস্টমার ব্যবস্থাপনা — Auto Serial + Password Reset with 2FA
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, KeyRound, RefreshCw, X, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createAccount, resetPasswordWithOtp } from "@/lib/auth.functions";
import { toBnDigits, roleLabel } from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { DestructiveOtpDialog } from "@/components/admin/DestructiveOtpDialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin/users")({
  head: () => ({ meta: [{ title: "ইউজার — আল হামিদ বস্ত্রালয়" }] }),
  component: Users,
});

type Row = {
  id: string;
  full_name: string;
  mobile: string;
  serial: string | null;
  last_login_at: string | null;
  roles: string[];
};

const SERIAL_MIN = 1;

function suggestNextSerial(existing: string[]): string {
  const nums = existing.map((s) => parseInt(s.replace(/\D/g, ""), 10)).filter((n) => !isNaN(n));
  const max = nums.length ? Math.max(...nums) : 0;
  const next = Math.max(max + 1, SERIAL_MIN);
  return String(next).padStart(3, "0");
}

function Users() {
  const qc = useQueryClient();
  const createAcc = useServerFn(createAccount);
  const resetPwWithOtp = useServerFn(resetPasswordWithOtp);

  const [showAdd, setShowAdd] = useState(false);
  const [resetTarget, setResetTarget] = useState<Row | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [pendingReset, setPendingReset] = useState<{
    userId: string;
    password: string;
  } | null>(null);

  const [f, setF] = useState({
    role: "customer" as "owner" | "moderator" | "customer",
    full_name: "",
    mobile: "",
    password: "",
    serial: "",
    shop_name: "",
    address: "",
    location: "",
    area_id: "",
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["users-list"],
    queryFn: async (): Promise<Row[]> => {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,full_name,mobile,serial,last_login_at");
      const { data: roles } = await supabase.from("user_roles").select("user_id,role");
      const map: Record<string, string[]> = {};
      for (const r of roles ?? []) {
        (map[r.user_id] ??= []).push(r.role);
      }
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: map[p.id] ?? [],
      }));
    },
  });

  const { data: areas = [] } = useQuery({
    queryKey: ["areas-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("areas")
        .select("id,name,name_bn,day_of_week")
        .eq("active", true)
        .order("name");
      return data ?? [];
    },
  });

  const existingSerials = rows.map((r) => r.serial).filter((s): s is string => !!s);

  useEffect(() => {
    if (showAdd && f.role === "customer" && !f.serial) {
      setF((prev) => ({ ...prev, serial: suggestNextSerial(existingSerials) }));
    }
  }, [showAdd, f.role]); // eslint-disable-line react-hooks/exhaustive-deps

  function changeRole(newRole: "owner" | "moderator" | "customer") {
    if (newRole === "customer") {
      setF((prev) => ({
        ...prev,
        role: newRole,
        serial: prev.serial || suggestNextSerial(existingSerials),
      }));
    } else {
      setF((prev) => ({ ...prev, role: newRole, serial: "" }));
    }
  }

  function refreshSerial() {
    setF((prev) => ({ ...prev, serial: suggestNextSerial(existingSerials) }));
  }

  async function submitNew() {
    if (f.role === "customer") {
      if (!f.serial.trim()) {
        toast.error("সিরিয়াল নম্বর দিন");
        return;
      }
      if (existingSerials.includes(f.serial.trim())) {
        toast.error(`সিরিয়াল "${f.serial}" আগেই ব্যবহার হয়েছে`);
        return;
      }
    }
    setBusy(true);
    try {
      await createAcc({ data: f });
      toast.success(
        f.role === "customer"
          ? `কাস্টমার তৈরি হয়েছে — সিরিয়াল ${f.serial}`
          : "অ্যাকাউন্ট তৈরি হয়েছে",
      );
      setShowAdd(false);
      setF({
        role: "customer",
        full_name: "",
        mobile: "",
        password: "",
        serial: "",
        shop_name: "",
        address: "",
        location: "",
        area_id: "",
      });
      qc.invalidateQueries({ queryKey: ["users-list"] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function openReset(u: Row) {
    setResetTarget(u);
    setNewPassword("");
  }

  async function doReset() {
    if (!resetTarget) return;
    if (newPassword.length < 6) {
      toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষর");
      return;
    }
    setPendingReset({
      userId: resetTarget.id,
      password: newPassword,
    });
    setOtpDialogOpen(true);
  }

  async function handleVerifiedReset(challengeId: string, code: string) {
    if (!pendingReset || !resetTarget) return;
    setBusy(true);
    try {
      await resetPwWithOtp({
        data: {
          targetUserId: pendingReset.userId,
          newPassword: pendingReset.password,
          challengeId,
          code,
        },
      });
      toast.success(`${resetTarget.full_name}-এর পাসওয়ার্ড পরিবর্তন হয়েছে`);
      setResetTarget(null);
      setNewPassword("");
      setPendingReset(null);
      setOtpDialogOpen(false);
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  const serialValid =
    f.role !== "customer" || (f.serial.trim() && !existingSerials.includes(f.serial.trim()));

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header with Back */}
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <h1 className="font-display text-3xl text-primary">ইউজার ও কাস্টমার</h1>
        <Button variant="coffee" className="ml-auto" onClick={() => setShowAdd(!showAdd)}>
          <UserPlus /> নতুন অ্যাকাউন্ট
        </Button>
      </div>

      {showAdd && (
        <div className="grid gap-3 rounded-2xl border bg-card p-5 shadow-card sm:grid-cols-2">
          <label className="text-sm">
            <span className="text-xs text-muted-foreground">Role</span>
            <select
              value={f.role}
              onChange={(e) => changeRole(e.target.value as "owner" | "moderator" | "customer")}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
            >
              <option value="customer">কাস্টমার</option>
              <option value="moderator">মডারেটর</option>
              <option value="owner">মালিক</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="text-xs text-muted-foreground">পূর্ণ নাম</span>
            <input
              value={f.full_name}
              onChange={(e) => setF({ ...f, full_name: e.target.value })}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
              placeholder="মাহমুদুল হক"
            />
          </label>

          <label className="text-sm">
            <span className="text-xs text-muted-foreground">মোবাইল</span>
            <input
              value={f.mobile}
              onChange={(e) => setF({ ...f, mobile: e.target.value })}
              inputMode="tel"
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
              placeholder="01716782247"
            />
          </label>

          <label className="text-sm">
            <span className="text-xs text-muted-foreground">পাসওয়ার্ড (৬+)</span>
            <input
              type="password"
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
              placeholder="••••••"
            />
          </label>

          {f.role === "customer" && (
            <>
              <label className="text-sm sm:col-span-2">
                <span className="text-xs text-muted-foreground">সিরিয়াল (Auto)</span>
                <div className="mt-1 flex gap-2">
                  <input
                    value={f.serial}
                    onChange={(e) => setF({ ...f, serial: e.target.value.trim() })}
                    className={`block h-10 flex-1 rounded-md border bg-background px-3 font-mono ${
                      serialValid ? "" : "border-destructive text-destructive"
                    }`}
                    placeholder="001"
                  />
                  <button
                    type="button"
                    onClick={refreshSerial}
                    className="flex h-10 items-center gap-1 rounded-md border bg-card px-3 text-sm hover:bg-accent/10"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
                {!serialValid && f.serial && (
                  <p className="mt-1 text-xs text-destructive">⚠️ "{f.serial}" আগেই ব্যবহৃত</p>
                )}
                {serialValid && f.serial && (
                  <p className="mt-1 text-xs text-success">✅ "{f.serial}" খালি</p>
                )}
              </label>

              <label className="text-sm">
                <span className="text-xs text-muted-foreground">দোকানের নাম</span>
                <input
                  value={f.shop_name}
                  onChange={(e) => setF({ ...f, shop_name: e.target.value })}
                  className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
                />
              </label>
              <label className="text-sm">
                <span className="text-xs text-muted-foreground">ঠিকানা</span>
                <input
                  value={f.address}
                  onChange={(e) => setF({ ...f, address: e.target.value })}
                  className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
                />
              </label>
              <label className="text-sm">
                <span className="text-xs text-muted-foreground">লোকেশন</span>
                <input
                  value={f.location}
                  onChange={(e) => setF({ ...f, location: e.target.value })}
                  className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
                />
              </label>
              <label className="text-sm">
                <span className="text-xs text-muted-foreground">এলাকা (কালেকশনের জন্য)</span>
                <select
                  value={f.area_id}
                  onChange={(e) => setF({ ...f, area_id: e.target.value })}
                  className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
                >
                  <option value="">— এলাকা —</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name_bn || a.name} (
                      {["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"][a.day_of_week]})
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <div className="sm:col-span-2">
            <Button
              variant="coffee"
              onClick={submitNew}
              disabled={busy || !f.full_name.trim() || !f.mobile.trim() || !f.password}
            >
              তৈরি করুন
            </Button>
          </div>
        </div>
      )}

      {/* User Table */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-card">
        <div className="table-scroll">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-secondary text-secondary-foreground">
              <tr>
                <th className="px-4 py-3 text-left">সিরিয়াল</th>
                <th className="px-4 py-3 text-left">নাম</th>
                <th className="px-4 py-3 text-left">মোবাইল</th>
                <th className="px-4 py-3 text-left">রোল</th>
                <th className="px-4 py-3 text-left">সর্বশেষ লগইন</th>
                <th className="px-4 py-3 text-right">—</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.id} className="border-t hover:bg-accent/10">
                  <td className="px-4 py-2 tabular-nums">
                    {u.serial ? toBnDigits(u.serial) : "—"}
                  </td>
                  <td className="px-4 py-2">{u.full_name}</td>
                  <td className="px-4 py-2 tabular-nums">{toBnDigits(u.mobile)}</td>
                  <td className="px-4 py-2">{u.roles.map((r) => roleLabel[r] ?? r).join(", ")}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">
                    {u.last_login_at ? new Date(u.last_login_at).toLocaleString("bn-BD") : "—"}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => openReset(u)}
                      className="rounded p-2 text-primary hover:bg-accent"
                      title="পাসওয়ার্ড রিসেট (OTP সহ)"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                    কোনো ইউজার নেই
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Password Reset Modal */}
      {resetTarget && !otpDialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => !busy && setResetTarget(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-card p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                <h2 className="font-display text-xl text-primary">পাসওয়ার্ড রিসেট</h2>
              </div>
              <button
                onClick={() => !busy && setResetTarget(null)}
                className="rounded p-1 hover:bg-accent"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mb-4 rounded-lg bg-accent/10 p-3 text-sm">
              <strong>{resetTarget.full_name}</strong>
              <span className="block text-xs text-muted-foreground">
                সিরিয়াল: {resetTarget.serial || "—"} · মোবাইল: {toBnDigits(resetTarget.mobile)}
              </span>
            </p>

            <div className="mb-4 rounded-lg border-l-4 border-accent bg-accent/5 p-3 text-xs">
              <p style={{ color: "#4a2f1e" }}>
                <strong>🔐 2-step verification:</strong> পরের ধাপে আপনার মোবাইলে OTP পাঠানো হবে। OTP
                দিলেই পাসওয়ার্ড পরিবর্তন হবে।
              </p>
            </div>

            <label className="block text-sm">
              <span className="text-xs text-muted-foreground">
                নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)
              </span>
              <input
                type="password"
                autoFocus
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") doReset();
                }}
                className="mt-1 block h-11 w-full rounded-md border bg-background px-3"
                placeholder="••••••"
              />
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetTarget(null)} disabled={busy}>
                বাতিল
              </Button>
              <Button variant="coffee" onClick={doReset} disabled={busy || newPassword.length < 6}>
                <Save /> পরবর্তী ধাপ
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 2FA Dialog */}
      <DestructiveOtpDialog
        open={otpDialogOpen}
        onClose={() => {
          setOtpDialogOpen(false);
          setPendingReset(null);
        }}
        onVerified={handleVerifiedReset}
        title="পাসওয়ার্ড রিসেট নিশ্চিত করুন"
        description={
          resetTarget
            ? `${resetTarget.full_name}-এর পাসওয়ার্ড পরিবর্তন করতে আপনার মোবাইলে পাঠানো OTP দিন।`
            : ""
        }
      />
    </div>
  );
}
