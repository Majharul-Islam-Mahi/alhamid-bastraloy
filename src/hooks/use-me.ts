// বর্তমান লগইন করা ইউজারের প্রোফাইল ও রোল
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Me = {
  id: string;
  full_name: string;
  mobile: string;
  serial: string | null;
  roles: string[];
  isOwner: boolean;
  isStaff: boolean;
  isCustomer: boolean;
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: async (): Promise<Me | null> => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return null;
      const [{ data: prof }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", data.user.id),
      ]);
      const r = (roles ?? []).map((x) => x.role as string);
      return {
        id: data.user.id,
        full_name: prof?.full_name ?? "",
        mobile: prof?.mobile ?? "",
        serial: prof?.serial ?? null,
        roles: r,
        isOwner: r.includes("owner"),
        isStaff: r.includes("owner") || r.includes("moderator"),
        isCustomer: r.includes("customer"),
      };
    },
  });
}
