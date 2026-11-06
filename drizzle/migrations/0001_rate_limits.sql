-- drizzle/migrations/0001_rate_limits.sql
-- Rate limiting টেবিল — login/OTP brute force আটকানোর জন্য

CREATE TABLE IF NOT EXISTS public.rate_limits (
  key text PRIMARY KEY,
  count integer NOT NULL DEFAULT 0,
  reset_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index: expired entries দ্রুত delete করার জন্য
CREATE INDEX IF NOT EXISTS rate_limits_reset_at_idx ON public.rate_limits(reset_at);

-- RLS enable — শুধু service_role access করবে (server-side)
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- কোনো policy নেই মানে কেউ access করতে পারবে না (শুধু service_role key দিয়ে যাবে)

-- Periodic cleanup function (পুরাতন entries মুছবে)
CREATE OR REPLACE FUNCTION public.cleanup_rate_limits()
RETURNS void
LANGUAGE sql SECURITY DEFINER
AS $$
  DELETE FROM public.rate_limits WHERE reset_at < now();
$$;

-- Comment
COMMENT ON TABLE public.rate_limits IS 'Login/OTP এ brute force আটকানোর জন্য rate limit ট্র্যাকিং';