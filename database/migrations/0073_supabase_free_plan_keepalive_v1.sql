BEGIN;

CREATE FUNCTION public.qandeel_keepalive()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT true;
$$;

REVOKE ALL ON FUNCTION public.qandeel_keepalive() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.qandeel_keepalive() TO anon;

COMMIT;
