CREATE TABLE public.supplier_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  kind text NOT NULL CHECK (kind IN ('purchase','payment')),
  amount numeric NOT NULL DEFAULT 0,
  details text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.supplier_entries TO authenticated;
GRANT ALL ON public.supplier_entries TO service_role;
ALTER TABLE public.supplier_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staff read supplier_entries" ON public.supplier_entries FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'owner') OR public.has_role(auth.uid(),'moderator'));
CREATE POLICY "owner write supplier_entries" ON public.supplier_entries FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'owner'));
CREATE POLICY "owner update supplier_entries" ON public.supplier_entries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'owner'));
CREATE POLICY "owner delete supplier_entries" ON public.supplier_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'owner'));