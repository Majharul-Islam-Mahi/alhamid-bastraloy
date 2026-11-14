// src/routes/_authenticated/admin.users.tsx
// ইউজার ও কাস্টমার ব্যবস্থাপনা — Avatar + Auto Serial (server) + Delete
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { UserPlus, KeyRound, Trash2, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { createAccount, resetPasswordWithOtp, deleteAccount } from "@/lib/auth.functions";
import { toBnDigits, roleLabel } from "@/lib/shop";
import { BackButton } from "@/components/shop/BackButton";
import { Button } from "@/components/ui/button";
import { DestructiveOtpDialog } from "@/components/admin/DestructiveOtpDialog";
import { AvatarUploader } from "@/components/shared/AvatarUploader";
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
  avatar_path: string | null;
  last_login_at: string | null;
  roles: string[];
};

function Users() {
  const qc = useQueryClient();
  const createAcc = useServerFn(createAccount);
  const resetPwWithOtp = useServerFn(resetPasswordWithOtp);
  const removeAcc = useServerFn(deleteAccount);

  const [showAdd, setShowAdd] = useState(false);
  const [resetTarget, setResetTarget] = useState<Row | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [otpDialogOpen, setOtpDialogOpen] = useState(false);
  const [pendingReset, setPendingReset] = useState<{ userId: string; password: string } | null>(
    null,
  );
  const [deleteTarget, setDeleteTarget] = useState<Row | null>(null);

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
        .select("id,full_name,mobile,serial,avatar_path,last_login_at");
      const { data: roles } = await supabase.from("user_roles").select("user_id,role");
      const map: Record<string, string[]> = {};
      for (const r of roles ?? []) {
        (map[r.user_id] ??= []).push(r.role);
      }
      return (profiles ?? []).map((p) => ({
        id: p.id,
        full_name: p.full_name ?? "",
        mobile: p.mobile ?? "",
        serial: p.serial,
        avatar_path: (p as { avatar_path?: string | null }).avatar_path ?? null,
        last_login_at: p.last_login_at,
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

  async function submitNew() {
    setBusy(true);
    try {
      await createAcc({ data: f });
      toast.success(
        f.role === "customer"
          ? "কাস্টমার তৈরি হয়েছে — সিরিয়াল সার্ভার থেকে দেওয়া হবে"
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
    setPendingReset({ userId: resetTarget.id, password: newPassword });
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

  async function handleVerifiedDelete(challengeId: string, code: string) {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      await removeAcc({
        data: { targetUserId: deleteTarget.id, challengeId, code },
      });
      toast.success(`${deleteTarget.full_name} — অ্যাকাউন্ট মুছে ফেলা হয়েছে`);
      qc.invalidateQueries({ queryKey: ["users-list"] });
      setDeleteTarget(null);
    } catch (e) {
      toast.error((e as Error).message);
      throw e;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 md:space-y-6 md:px-0">
      <div className="flex flex-wrap items-center gap-3">
        <BackButton fallback="/admin" />
        <h1 className="text-2xl md:text-3xl">ইউজার ও কাস্টমার</h1>
        <Button onClick={() => setShowAdd(!showAdd)} className="ml-auto">
          <UserPlus className="mr-1 h-4 w-4" /> নতুন অ্যাকাউন্ট
        </Button>
      </div>

      {showAdd && (
        <div className="space-y-3 rounded-xl border bg-card p-4">
          <div>
            <label className="text-sm">Role</label>
            <select
              value={f.role}
              onChange={(e) =>
                setF({ ...f, role: e.target.value as "owner" | "moderator" | "customer" })
              }
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
            >
              <option value="customer">কাস্টমার</option>
              <option value="moderator">মডারেটর</option>
              <option value="owner">মালিক</option>
            </select>
          </div>
          <div>
            <label className="text-sm">পূর্ণ নাম</label>
            <input
              value={f.full_name}
              onChange={(e) => setF({ ...f, full_name: e.target.value })}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
              placeholder="মাহমুদুল হক"
            />
          </div>
          <div>
            <label className="text-sm">মোবাইল</label>
            <input
              value={f.mobile}
              onChange={(e) => setF({ ...f, mobile: e.target.value })}
              inputMode="tel"
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
              placeholder="01716782247"
            />
          </div>
          <div>
            <label className="text-sm">পাসওয়ার্ড (৬+)</label>
            <input
              type="password"
              value={f.password}
              onChange={(e) => setF({ ...f, password: e.target.value })}
              className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
              placeholder="••••••"
            />
          </div>

          {f.role === "customer" && (
            <>
              <div className="rounded-md border border-dashed bg-muted/40 p-3 text-sm">
                সিরিয়াল সার্ভার থেকে অটো তৈরি হবে (R001, R002…)
              </div>
              <div>
                <label className="text-sm">দোকানের নাম</label>
                <input
                  value={f.shop_name}
                  onChange={(e) => setF({ ...f, shop_name: e.target.value })}
                  className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
                />
              </div>
              <div>
                <label className="text-sm">ঠিকানা</label>
                <input
                  value={f.address}
                  onChange={(e) => setF({ ...f, address: e.target.value })}
                  className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
                />
              </div>
              <div>
                <label className="text-sm">লোকেশন</label>
                <input
                  value={f.location}
                  onChange={(e) => setF({ ...f, location: e.target.value })}
                  className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
                />
              </div>
              <div>
                <label className="text-sm">এলাকা (কালেকশনের জন্য)</label>
                <select
                  value={f.area_id}
                  onChange={(e) => setF({ ...f, area_id: e.target.value })}
                  className="mt-1 block h-10 w-full rounded-md border bg-background px-3"
                >
                  <option value="">— এলাকা —</option>
                  {areas.map(
                    (a: { id: string; name: string; name_bn: string | null; day_of_week: number }) => (
                      <option key={a.id} value={a.id}>
                        {a.name_bn || a.name} (
                        {["রবি", "সোম", "মঙ্গল", "বুধ", "বৃহঃ", "শুক্র", "শনি"][a.day_of_week]})
                      </option>
                    ),
                  )}
                </select>
              </div>
            </>
          )}

          <Button onClick={submitNew} disabled={busy}>
            {busy ? "তৈরি হচ্ছে…" : "তৈরি করুন"}
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="p-2 text-left">ছবি</th>
              <th className="p-2 text-left">সিরিয়াল</th>
              <th className="p-2 text-left">নাম</th>
              <th className="p-2 text-left">মোবাইল</th>
              <th className="p-2 text-left">রোল</th>
              <th className="p-2 text-left">সর্বশেষ লগইন</th>
              <th className="p-2">—</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-2">
                  <AvatarUploader
                    userId={u.id}
                    currentPath={u.avatar_path}
                    name={u.full_name}
                  />
                </td>
                <td className="p-2 font-mono">{u.serial ? toBnDigits(u.serial) : "—"}</td>
                <td className="p-2">{u.full_name}</td>
                <td className="p-2">{toBnDigits(u.mobile)}</td>
                <td className="p-2">{u.roles.map((r) => roleLabel[r] ?? r).join(", ")}</td>
                <td className="p-2 text-muted-foreground">
                  {u.last_login_at ? new Date(u.last_login_at).toLocaleString("bn-BD") : "—"}
                </td>
                <td className="p-2">
                  <div className="flex justify-end gap-1">
                    <button
                      onClick={() => openReset(u)}
                      className="rounded p-2 text-primary hover:bg-accent"
                      title="পাসওয়ার্ড রিসেট"
                    >
                      <KeyRound className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteTarget(u)}
                      className="rounded p-2 text-destructive hover:bg-destructive/10"
                      title="অ্যাকাউন্ট মুছুন"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-muted-foreground">
                  কোনো ইউজার নেই
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Password Reset Modal */}
      {resetTarget && !otpDialogOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-card p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <h2 className="text-lg">পাসওয়ার্ড রিসেট</h2>
              {!busy && (
                <button
                  onClick={() => setResetTarget(null)}
                  className="rounded p-1 hover:bg-accent"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {resetTarget.full_name} · সিরিয়াল: {resetTarget.serial || "—"} · মোবাইল:{" "}
              {toBnDigits(resetTarget.mobile)}
            </p>
            <label className="mt-3 block text-sm">নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)</label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") doReset();
              }}
              className="mt-1 block h-11 w-full rounded-md border bg-background px-3"
              placeholder="••••••"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setResetTarget(null)} disabled={busy}>
                বাতিল
              </Button>
              <Button onClick={doReset}>পরবর্তী ধাপ</Button>
            </div>
          </div>
        </div>
      )}

      {/* Reset OTP */}
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

      {/* Delete OTP */}
      {deleteTarget && (
        <DestructiveOtpDialog
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onVerified={handleVerifiedDelete}
          title="অ্যাকাউন্ট মুছে ফেলুন"
          description={`${deleteTarget.full_name} — এর সব ডেটা মুছে যাবে। এটি ফেরানো যাবে না।`}
        />
      )}
    </div>
  );
}