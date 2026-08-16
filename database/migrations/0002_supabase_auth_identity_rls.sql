BEGIN;

CREATE FUNCTION public.handle_new_auth_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
    INSERT INTO public.users (id, auth_subject)
    VALUES (NEW.id, NEW.id::text);

    RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.handle_new_auth_user() FROM PUBLIC;

CREATE TRIGGER provision_qandeel_user
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_auth_user();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_turns ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.users FROM anon, authenticated;
REVOKE ALL ON TABLE public.conversation_sessions FROM anon, authenticated;
REVOKE ALL ON TABLE public.conversation_turns FROM anon, authenticated;

GRANT SELECT ON TABLE public.users TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.conversation_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.conversation_turns TO authenticated;

CREATE POLICY users_select_own
    ON public.users
    FOR SELECT
    TO authenticated
    USING (id = (SELECT auth.uid()));

CREATE POLICY conversation_sessions_select_own
    ON public.conversation_sessions
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY conversation_sessions_insert_own
    ON public.conversation_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY conversation_sessions_update_own
    ON public.conversation_sessions
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY conversation_turns_select_own
    ON public.conversation_turns
    FOR SELECT
    TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY conversation_turns_insert_own
    ON public.conversation_turns
    FOR INSERT
    TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY conversation_turns_update_own
    ON public.conversation_turns
    FOR UPDATE
    TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

COMMIT;
