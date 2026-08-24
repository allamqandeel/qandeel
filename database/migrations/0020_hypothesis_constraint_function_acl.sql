BEGIN;
REVOKE ALL ON FUNCTION public.bounded_nonempty_text_array(text[],integer,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.bounded_nonempty_text_array(text[],integer,integer) TO authenticated;
COMMIT;
