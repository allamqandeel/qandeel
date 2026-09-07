BEGIN;

REVOKE ALL ON FUNCTION public.qandeel_keepalive() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.qandeel_keepalive() FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.qandeel_keepalive() FROM service_role;
GRANT EXECUTE ON FUNCTION public.qandeel_keepalive() TO anon;

COMMIT;
