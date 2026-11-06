// src/lib/serial.ts
// Serial generator — Supabase RPC next_serial() call করে
import { supabase } from "@/integrations/supabase/client";

export async function fetchNextSerial(kind: "wholesale" | "retail" | "supplier"): Promise<string> {
  const { data, error } = await supabase.rpc("next_serial", {
    _kind: kind,
  });
  if (error) throw new Error("Serial generate হয়নি: " + error.message);
  return data as string;
}
