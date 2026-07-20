-- Ensure the shared `set_updated_at()` trigger function exists.
--
-- The base conversations migration defines this function, but on this project's
-- remote database the function was not present when later migrations (which
-- attach `BEFORE UPDATE` triggers using it) tried to apply. This idempotent
-- migration guarantees it exists before any trigger references it.
--
-- `CREATE OR REPLACE FUNCTION` is safe to re-run: if the function already
-- exists with this signature it is a no-op; if it is missing it is created.

CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
