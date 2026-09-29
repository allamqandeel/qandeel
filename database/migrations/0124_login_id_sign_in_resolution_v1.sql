-- W2-01 — Final Account Access Lifecycle: server-only Login ID resolution for sign-in (E2E-A-07).
--
-- P1 §3: one identifier input accepts `Login ID OR Email`, and there is NO client-visible Login-ID →
-- Email directory. Supabase Auth validates a password against an Email, so a Login ID must become the
-- account's Email somewhere — and that somewhere is here, reached ONLY by the QANDEEL API's server
-- channel inside its sign-in exchange. The API never returns the answer to a caller: it spends it at
-- once on the provider's own password grant, and replies with the provider's verdict alone.
--
-- Additive and forward-only. It adds one function and changes no table, row, trigger or grant.
--
-- `auth.users` is read through `to_jsonb(a) ->> 'email'` rather than `a.email`, so the function is
-- total over any `auth.users` shape (the disposable CI bootstrap has only `id`) — the same technique
-- migration 0123 uses for the sign-up metadata.
BEGIN;

-- The Email of the account holding this Login ID, or NULL. A malformed Login ID is NULL without a
-- lookup. The Login ID is compared in its canonical lowercase form, so the lookup is case-insensitive
-- exactly as the unique index `users_login_id_key` (0123) is.
CREATE FUNCTION public.resolve_login_id_sign_in_email_v1(p_login_id text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT to_jsonb(a) ->> 'email'
      FROM public.users u
      JOIN auth.users a ON a.id = u.id
     WHERE p_login_id IS NOT NULL
       AND char_length(p_login_id) BETWEEN 3 AND 30
       AND lower(p_login_id) ~ '^[a-z0-9]+([._-][a-z0-9]+)*$'
       AND u.login_id = lower(p_login_id);
$$;

-- Named explicitly: a hosted project's default privileges can grant EXECUTE on a new public function to
-- `anon` and `authenticated`, and an Email-returning function must be reachable by no client role at all.
REVOKE ALL ON FUNCTION public.resolve_login_id_sign_in_email_v1(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_login_id_sign_in_email_v1(text) TO service_role;

COMMIT;
