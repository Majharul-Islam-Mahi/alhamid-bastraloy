-- drizzle/migrations/0000_init.sql
-- সম্পূর্ণ ডাটাবেজ সেটআপ — আল হামিদ বস্ত্রালয়

-- ============= ENUM =============
DO $$ BEGIN
  CREATE TYPE app_role AS ENUM ('owner', 'moderator', 'customer');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============= PROFILES =============
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY,
  full_name text NOT NULL,
  mobile text NOT NULL,
  serial text,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ============= USER ROLES =============
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role app_role NOT NULL
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============= PARTIES =============
CREATE TABLE IF NOT EXISTS public.parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  serial text NOT NULL,
  shop_name text NOT NULL,
  owner_name text,
  mobile text,
  address text,
  location text,
  kind text NOT NULL CHECK (kind IN ('retail','wholesale','supplier','hawlat')),
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS parties_serial_kind_idx ON public.parties(serial, kind);
ALTER TABLE public.parties ENABLE ROW LEVEL SECURITY;

-- ============= PRODUCTS =============
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  quantity numeric NOT NULL DEFAULT 0,
  unit text NOT NULL DEFAULT 'পিস',
  unit_price numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

-- ============= DAY ENTRIES =============
CREATE TABLE IF NOT EXISTS public.day_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  kind text NOT NULL CHECK (kind IN ('cash_sale','expense','deposit','credit')),
  name text,
  details text,
  amount numeric NOT NULL DEFAULT 0,
  party_id uuid REFERENCES public.parties(id) ON DELETE SET NULL,
  memo_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS day_entries_date_idx ON public.day_entries(entry_date);
ALTER TABLE public.day_entries ENABLE ROW LEVEL SECURITY;

-- ============= HAWLAT ENTRIES =============
CREATE TABLE IF NOT EXISTS public.hawlat_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  kind text NOT NULL CHECK (kind IN ('give','receive')),
  amount numeric NOT NULL DEFAULT 0,
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.hawlat_entries ENABLE ROW LEVEL SECURITY;

-- ============= SUPPLIER ENTRIES =============
CREATE TABLE IF NOT EXISTS public.supplier_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  party_id uuid NOT NULL REFERENCES public.parties(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  kind text NOT NULL CHECK (kind IN ('purchase','payment')),
  amount numeric NOT NULL DEFAULT 0,
  details text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.supplier_entries ENABLE ROW LEVEL SECURITY;

-- ============= MEMOS =============
CREATE TABLE IF NOT EXISTS public.memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_no integer,
  memo_date date NOT NULL DEFAULT CURRENT_DATE,
  party_id uuid REFERENCES public.parties(id) ON DELETE SET NULL,
  shop_name text,
  owner_name text,
  mobile text,
  address text,
  party_serial text,
  previous_due numeric NOT NULL DEFAULT 0,
  total numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','confirmed','void')),
  note text,
  confirmed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.memos ENABLE ROW LEVEL SECURITY;

-- ============= MEMO ITEMS =============
CREATE TABLE IF NOT EXISTS public.memo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id uuid NOT NULL REFERENCES public.memos(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  name text NOT NULL DEFAULT '',
  quantity numeric NOT NULL DEFAULT 1,
  unit text,
  price numeric NOT NULL DEFAULT 0,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL
);
ALTER TABLE public.memo_items ENABLE ROW LEVEL SECURITY;

-- ---- memos.memo_id FK যোগ (memo_items পরে তৈরি হয়েছে) ----
DO $$ BEGIN
  ALTER TABLE public.day_entries
    ADD CONSTRAINT day_entries_memo_id_fkey
    FOREIGN KEY (memo_id) REFERENCES public.memos(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- ============= OTP CODES =============
CREATE TABLE IF NOT EXISTS public.otp_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  code text NOT NULL,
  expires_at timestamptz NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.otp_codes ENABLE ROW LEVEL SECURITY;

-- ============= LOGIN LOGS =============
CREATE TABLE IF NOT EXISTS public.login_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  user_agent text,
  logged_in_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.login_logs ENABLE ROW LEVEL SECURITY;

-- ============= SHOP SETTINGS =============
CREATE TABLE IF NOT EXISTS public.shop_settings (
  id integer PRIMARY KEY DEFAULT 1,
  about text,
  owner_photo_path text,
  shop_photo_path text,
  gallery jsonb NOT NULL DEFAULT '[]'::jsonb
);
INSERT INTO public.shop_settings (id, about)
VALUES (1, 'আল হামিদ বস্ত্রালয় — ফেনীর বিশ্বস্ত পাইকারি ও খুচরা কাপড়ের দোকান।')
ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.shop_settings ENABLE ROW LEVEL SECURITY;

-- ============= FUNCTIONS =============

-- has_role: ইউজারের একটি রোল আছে কিনা
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
$$;

-- is_staff: owner বা moderator কিনা
CREATE OR REPLACE FUNCTION public.is_staff(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('owner','moderator')
  );
$$;

-- confirm_memo: মেমো confirm করার সময় সব কাজ একসাথে করে
CREATE OR REPLACE FUNCTION public.confirm_memo(_memo_id uuid)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_memo RECORD;
  v_next_no integer;
BEGIN
  -- memo লক করে নাও
  SELECT * INTO v_memo FROM public.memos WHERE id = _memo_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'মেমো পাওয়া যায়নি'; END IF;
  IF v_memo.status = 'confirmed' THEN
    RETURN COALESCE(v_memo.memo_no, 0);
  END IF;

  -- পরবর্তী memo_no বের করো
  SELECT COALESCE(MAX(memo_no), 0) + 1 INTO v_next_no FROM public.memos;

  -- confirm করো
  UPDATE public.memos
  SET status = 'confirmed',
      memo_no = v_next_no,
      confirmed_at = now()
  WHERE id = _memo_id;

  -- খুচরা খাতায় নগদ বিক্রি যোগ করো
  INSERT INTO public.day_entries (entry_date, kind, amount, memo_id, name, details)
  VALUES (v_memo.memo_date, 'cash_sale', v_memo.total, _memo_id,
          v_memo.shop_name, 'মেমো ' || v_next_no);

  -- স্টক কাটো
  UPDATE public.products p
  SET quantity = p.quantity - mi.quantity
  FROM public.memo_items mi
  WHERE mi.memo_id = _memo_id AND mi.product_id = p.id;

  RETURN v_next_no;
END;
$$;

-- day_summary: একটি দিনের সারাংশ
CREATE OR REPLACE FUNCTION public.day_summary(_d date)
RETURNS TABLE(
  sales numeric,
  expenses numeric,
  deposits numeric,
  credits numeric,
  opening numeric,
  closing numeric,
  hawlat_due numeric,
  cash numeric
)
LANGUAGE plpgsql STABLE SECURITY DEFINER
AS $$
DECLARE
  v_sales numeric := 0;
  v_expenses numeric := 0;
  v_deposits numeric := 0;
  v_credits numeric := 0;
  v_opening numeric := 0;
  v_hawlat numeric := 0;
BEGIN
  SELECT COALESCE(SUM(amount),0) INTO v_sales
  FROM public.day_entries WHERE entry_date = _d AND kind = 'cash_sale';
  SELECT COALESCE(SUM(amount),0) INTO v_expenses
  FROM public.day_entries WHERE entry_date = _d AND kind = 'expense';
  SELECT COALESCE(SUM(amount),0) INTO v_deposits
  FROM public.day_entries WHERE entry_date = _d AND kind = 'deposit';
  SELECT COALESCE(SUM(amount),0) INTO v_credits
  FROM public.day_entries WHERE entry_date = _d AND kind = 'credit';

  -- গতকালের সর্বশেষ জমা = opening (সব আগের দিনের closing)
  SELECT COALESCE(SUM(CASE
    WHEN kind IN ('cash_sale','deposit') THEN amount
    WHEN kind = 'expense' THEN -amount
    ELSE 0 END), 0)
  INTO v_opening
  FROM public.day_entries WHERE entry_date < _d;

  -- হাওলাতি বাকি
  SELECT COALESCE(SUM(CASE WHEN kind = 'give' THEN amount ELSE -amount END),0)
  INTO v_hawlat
  FROM public.hawlat_entries WHERE entry_date <= _d;

  sales := v_sales;
  expenses := v_expenses;
  deposits := v_deposits;
  credits := v_credits;
  opening := v_opening;
  closing := v_opening + v_sales + v_deposits - v_expenses;
  hawlat_due := v_hawlat;
  cash := closing - v_hawlat;
  RETURN NEXT;
END;
$$;

-- ============= RLS Policies =============

-- staff সব দেখতে পারে
CREATE POLICY "staff_read_parties" ON public.parties
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR user_id = auth.uid());

CREATE POLICY "owner_write_parties" ON public.parties
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'owner'));

-- moderate: খুচরা খাতার সব টেবিল edit করতে পারে
CREATE POLICY "staff_read_day_entries" ON public.day_entries
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR party_id IN (
    SELECT id FROM public.parties WHERE user_id = auth.uid()
  ));

CREATE POLICY "staff_write_day_entries" ON public.day_entries
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "staff_read_hawlat" ON public.hawlat_entries
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "staff_write_hawlat" ON public.hawlat_entries
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "staff_read_supplier" ON public.supplier_entries
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "owner_write_supplier" ON public.supplier_entries
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE POLICY "staff_read_products" ON public.products
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "owner_write_products" ON public.products
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'owner'));

CREATE POLICY "staff_read_memos" ON public.memos
  FOR SELECT TO authenticated
  USING (public.is_staff(auth.uid()) OR party_id IN (
    SELECT id FROM public.parties WHERE user_id = auth.uid()
  ));

CREATE POLICY "staff_write_memos" ON public.memos
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "staff_read_memo_items" ON public.memo_items
  FOR SELECT TO authenticated USING (public.is_staff(auth.uid()));

CREATE POLICY "staff_write_memo_items" ON public.memo_items
  FOR ALL TO authenticated
  USING (public.is_staff(auth.uid()))
  WITH CHECK (public.is_staff(auth.uid()));

CREATE POLICY "read_shop_settings" ON public.shop_settings
  FOR SELECT TO authenticated, anon USING (true);

CREATE POLICY "owner_write_shop_settings" ON public.shop_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'owner'))
  WITH CHECK (public.has_role(auth.uid(),'owner'));

-- profiles: নিজের বা owner সব
CREATE POLICY "read_profiles" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_staff(auth.uid()));

CREATE POLICY "update_own_profile" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

CREATE POLICY "read_user_roles" ON public.user_roles
  FOR SELECT TO authenticated USING (true);

-- login_logs: owner সব দেখতে পারে
CREATE POLICY "owner_read_login_logs" ON public.login_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'owner') OR user_id = auth.uid());

-- Storage: shop-images bucket তৈরি করুন Supabase dashboard থেকে