// প্রথমবার মালিকের অ্যাকাউন্ট তৈরি (মালিক থাকলে বন্ধ)
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";
import { SiteHeader } from "@/components/shop/SiteHeader";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { bootstrapOwner, hasOwner } from "@/lib/auth.functions";
import { SHOP } from "@/lib/shop";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "প্রথম সেটআপ — আল হামিদ বস্ত্রালয়" },
      { name: "description", content: "মালিকের অ্যাকাউন্ট তৈরি" },
      { property: "og:title", content: "প্রথম সেটআপ" },
      { property: "og:description", content: "মালিকের অ্যাকাউন্ট তৈরি" },
    ],
  }),
  component: Setup,
});

function Setup() {
  const check = useServerFn(hasOwner);
  const boot = useServerFn(bootstrapOwner);
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ["has-owner"], queryFn: () => check() });
  const [f, setF] = useState({ full_name: SHOP.owner, mobile: "", password: "" });
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await boot({ data: f });
      toast.success("মালিক অ্যাকাউন্ট তৈরি হয়েছে। এখন লগইন করুন।");
      navigate({ to: "/login/admin" });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="flex items-center justify-center px-4 py-16">
        <div className="w-full max-w-md rounded-2xl bg-card p-8 shadow-soft">
          <h1 className="mb-6 text-center font-display text-3xl text-primary">মালিক অ্যাকাউন্ট সেটআপ</h1>
          {data?.exists ? (
            <p className="text-center text-muted-foreground">সেটআপ আগেই সম্পন্ন হয়েছে।</p>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-1.5"><Label>নাম</Label><Input value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} required /></div>
              <div className="space-y-1.5"><Label>মোবাইল নম্বর</Label><Input value={f.mobile} onChange={(e) => setF({ ...f, mobile: e.target.value })} placeholder="01716782247" required /></div>
              <div className="space-y-1.5"><Label>পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)</Label><Input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} required /></div>
              <Button variant="coffee" size="lg" className="w-full" disabled={busy}>অ্যাকাউন্ট তৈরি করুন</Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
