-- drizzle/migrations/0002_full_schema.sql
-- আল হামিদ বস্ত্রালয় — missing schema + RPC + RLS (v2.0)
-- সব statement idempotent — বারবার চালালেও সমস্যা নেই।

-- ============ 1. MISSING TABLES ============

CREATE TABLE IF NOT EXISTS public.areas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_bn text,
  day_of_week integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  description text,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS areas_name_day_idx ON public.areas(name, day_of_week);
CREATE INDEX IF NOT EXISTS areas_day_idx ON public.areas(day_of_week);
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_bn text,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.collections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_date date NOT NULL DEFAULT CURRENT_DATE,
  area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL,
  collected_by uuid,
  collected_by_name text,
  total_amount numeric NOT NULL DEFAULT 0,
  items_count integer NOT NULL DEFAULT 0,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.collections ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.collection_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  collection_id uuid NOT NULL REFERENCES public.collections(id) ON DELETE CASCADE,
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  party_serial text,
  party_name text,
  amount numeric NOT NULL DEFAULT 0,
  day_entry_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS collection_items_collection_idx ON public.collection_items(collection_id);
ALTER TABLE public.collection_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  sender_role text NOT NULL CHECK (sender_role IN ('customer','admin')),
  message_type text NOT NULL DEFAULT 'text' CHECK (message_type IN ('text','image','file','voice')),
  content text,
  file_path text,
  file_name text,
  file_size bigint,
  duration_seconds integer,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','delivered','seen')),
  delivered_at timestamptz,
  seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS chat_messages_user_idx ON public.chat_messages(user_id, created_at DESC);
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.error_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message text NOT NULL,
  stack text,
  url text,
  user_id uuid,
  user_agent text,
  severity text NOT NULL DEFAULT 'error',
  context jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS error_logs_created_idx ON public.error_logs(created_at DESC);
ALTER TABLE public.error_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  target_type text,
  target_id text,
  target_name text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs(created_at DESC);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  event_date date,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.notices ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL DEFAULT CURRENT_DATE,
  title text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.customer_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('nid_front','nid_back','trade_license','tin','other')),
  file_path text NOT NULL,
  file_name text,
  file_size bigint,
  mime_type text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.customer_documents ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.import_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  total_rows integer NOT NULL DEFAULT 0,
  success_rows integer NOT NULL DEFAULT 0,
  failed_rows integer NOT NULL DEFAULT 0,
  inserted_ids jsonb DEFAULT '[]'::jsonb,
  errors jsonb DEFAULT '[]'::jsonb,
  imported_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.import_sessions ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.stock_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  change_qty numeric NOT NULL,
  reason text NOT NULL,
  ref_id text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS stock_movements_product_idx ON public.stock_movements(product_id, created_at DESC);
ALTER TABLE public.stock_movements ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.uptime_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  checked_at timestamptz NOT NULL DEFAULT now(),
  ok boolean NOT NULL DEFAULT true,
  latency_ms integer
);
ALTER TABLE public.uptime_checks ENABLE ROW LEVEL SECURITY;

-- ============ 2. ALTER EXISTING ============
ALTER TABLE public.parties ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS parties_area_idx ON public.parties(area_id);
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_path text;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS duration_seconds integer;

-- ============ 3. SERIAL COUNTER + RPC ============
CREATE TABLE IF NOT EXISTS public.serial_counters (
  kind text PRIMARY KEY,
  last_value integer NOT NULL DEFAULT 0
);
ALTER TABLE public.serial_counters ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.next_serial(_kind text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_prefix text;
  v_next integer;
BEGIN
  v_prefix := CASE _kind
    WHEN 'wholesale' THEN 'C'
    WHEN 'retail'    THEN 'R'
    WHEN 'supplier'  THEN 'S'
    WHEN 'user'      THEN ''
    WHEN 'memo'      THEN 'M'
    ELSE 'X'
  END;

  INSERT INTO public.serial_counters(kind, last_value)
  VALUES (_kind, 0)
  ON CONFLICT (kind) DO NOTHING;

  UPDATE public.serial_counters
     SET last_value = last_value + 1
   WHERE kind = _kind
  RETURNING last_value INTO v_next;

  RETURN v_prefix || lpad(v_next::text, 3, '0');
END;
$$;

-- ============ 4. CONFIRM_MEMO (rewrite — stock + paid split) ============
CREATE OR REPLACE FUNCTION public.confirm_memo(_memo_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_memo  RECORD;
  v_item  RECORD;
  v_next  integer;
BEGIN
  IF NOT public.is_staff(auth.uid()) THEN
    RAISE EXCEPTION 'শুধু স্টাফ মেমো কনফার্ম করতে পারবেন';
  END IF;

  SELECT * INTO v_memo FROM public.memos WHERE id = _memo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'মেমো পাওয়া যায়নি'; END IF;
  IF v_memo.status = 'confirmed' THEN RAISE EXCEPTION 'মেমো আগেই কনফার্ম হয়েছে'; END IF;

  FOR v_item IN SELECT * FROM public.memo_items WHERE memo_id = _memo_id LOOP
    UPDATE public.products
       SET quantity = quantity - COALESCE(v_item.base_quantity, v_item.quantity, 0)
     WHERE id = v_item.product_id;

    INSERT INTO public.stock_movements(product_id, change_qty, reason, ref_id, created_by)
    VALUES (
      v_item.product_id,
      -COALESCE(v_item.base_quantity, v_item.quantity, 0),
      'memo_confirm',
      _memo_id::text,
      auth.uid()
    );
  END LOOP;

  v_next := COALESCE(v_memo.memo_no, (public.next_serial('memo')::text)::integer);

  UPDATE public.memos
     SET status = 'confirmed',
         confirmed_at = now(),
         memo_no = v_next,
         paid = LEAST(COALESCE(paid, 0), total)
   WHERE id = _memo_id;

  RETURN v_next;
END;
$$;

-- ============ 5. RLS POLICIES ============

-- user_roles: নিজের + staff only (আগের খোলা policy বন্ধ)
DROP POLICY IF EXISTS "read_user_roles" ON public.user_roles;
CREATE POLICY "read_user_roles" ON public.user_roles
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));

-- areas
DROP POLICY IF EXISTS "read_areas" ON public.areas;
CREATE POLICY "read_areas" ON public.areas FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "owner_write_areas" ON public.areas;
CREATE POLICY "owner_write_areas" ON public.areas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- categories
DROP POLICY IF EXISTS "staff_read_categories" ON public.categories;
CREATE POLICY "staff_read_categories" ON public.categories FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "owner_write_categories" ON public.categories;
CREATE POLICY "owner_write_categories" ON public.categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'owner')) WITH CHECK (public.has_role(auth.uid(), 'owner'));

-- collections
DROP POLICY IF EXISTS "staff_read_collections" ON public.collections;
CREATE POLICY "staff_read_collections" ON public.collections FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "staff_write_collections" ON public.collections;
CREATE POLICY "staff_write_collections" ON public.collections FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

DROP POLICY IF EXISTS "staff_read_collection_items" ON public.collection_items;
CREATE POLICY "staff_read_collection_items" ON public.collection_items FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "staff_write_collection_items" ON public.collection_items;
CREATE POLICY "staff_write_collection_items" ON public.collection_items FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- chat
DROP POLICY IF EXISTS "customer_own_chat_select" ON public.chat_messages;
CREATE POLICY "customer_own_chat_select" ON public.chat_messages FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "customer_own_chat_insert" ON public.chat_messages;
CREATE POLICY "customer_own_chat_insert" ON public.chat_messages FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND sender_role = 'customer');
DROP POLICY IF EXISTS "admin_chat_select" ON public.chat_messages;
CREATE POLICY "admin_chat_select" ON public.chat_messages FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "admin_chat_write" ON public.chat_messages;
CREATE POLICY "admin_chat_write" ON public.chat_messages FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- staff-only tables
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['error_logs','audit_logs','reports','import_sessions','uptime_checks'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "staff_read_%1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "staff_read_%1$s" ON public.%1$I FOR SELECT TO authenticated USING (public.is_staff(auth.uid()))', t);
    EXECUTE format('DROP POLICY IF EXISTS "staff_write_%1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "staff_write_%1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()))', t);
  END LOOP;
END $$;

-- events / notices: public read, staff write
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['events','notices'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "read_%1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "read_%1$s" ON public.%1$I FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('DROP POLICY IF EXISTS "staff_write_%1$s" ON public.%1$I', t);
    EXECUTE format('CREATE POLICY "staff_write_%1$s" ON public.%1$I FOR ALL TO authenticated USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()))', t);
  END LOOP;
END $$;

-- customer_documents
DROP POLICY IF EXISTS "staff_read_docs" ON public.customer_documents;
CREATE POLICY "staff_read_docs" ON public.customer_documents FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff_write_docs" ON public.customer_documents;
CREATE POLICY "staff_write_docs" ON public.customer_documents FOR ALL TO authenticated
  USING (public.is_staff(auth.uid())) WITH CHECK (public.is_staff(auth.uid()));

-- stock_movements
DROP POLICY IF EXISTS "staff_read_stock_movements" ON public.stock_movements;
CREATE POLICY "staff_read_stock_movements" ON public.stock_movements FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));
DROP POLICY IF EXISTS "staff_write_stock_movements" ON public.stock_movements;
CREATE POLICY "staff_write_stock_movements" ON public.stock_movements FOR INSERT TO authenticated WITH CHECK (public.is_staff(auth.uid()));

-- serial_counters
DROP POLICY IF EXISTS "staff_read_serial_counters" ON public.serial_counters;
CREATE POLICY "staff_read_serial_counters" ON public.serial_counters FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

-- ============ 6. SEED: 16 areas ============
INSERT INTO public.areas (name, name_bn, day_of_week, sort_order) VALUES
  ('J B Road',      'জে বি রোড',      0, 1),
  ('Trunk Road',    'ট্রাংক রোড',      1, 2),
  ('Mizan Road',    'মিজান রোড',       2, 3),
  ('Kazir Bazar',   'কাজীর বাজার',    3, 4),
  ('Feni Sadar',    'ফেনী সদর',        4, 5),
  ('Chhagalnaiya',  'ছাগলনাইয়া',      5, 6),
  ('Daganbhuiyan',  'দাগনভূঞা',        6, 7),
  ('Sonagazi',      'সোনাগাজী',        0, 8),
  ('Fulgazi',       'ফুলগাজী',         1, 9),
  ('Parshuram',     'পরশুরাম',          2, 10),
  ('Companyganj',   'কোম্পানীগঞ্জ',    3, 11),
  ('Mirsharai',     'মীরসরাই',         4, 12),
  ('Chatkhil',      'চাটখিল',          5, 13),
  ('Begumganj',     'বেগমগঞ্জ',        6, 14),
  ('Senbagh',       'সেনবাগ',           0, 15),
  ('Lakshmipur',    'লক্ষ্মীপুর',       1, 16)
ON CONFLICT (name, day_of_week) DO NOTHING;