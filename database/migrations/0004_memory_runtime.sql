BEGIN;

CREATE TABLE public.memories (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    scope text NOT NULL DEFAULT 'USER',
    type text NOT NULL,
    content text NOT NULL,
    source text NOT NULL,
    confidence double precision NOT NULL,
    importance double precision NOT NULL,
    status text NOT NULL,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamptz,
    supersedes_memory_id uuid,
    CONSTRAINT memories_user_fk
        FOREIGN KEY (user_id) REFERENCES public.users (id) ON DELETE RESTRICT,
    CONSTRAINT memories_id_user_unique UNIQUE (id, user_id),
    CONSTRAINT memories_supersedes_user_fk
        FOREIGN KEY (supersedes_memory_id, user_id)
        REFERENCES public.memories (id, user_id) ON DELETE RESTRICT,
    CONSTRAINT memories_scope_check CHECK (scope = 'USER'),
    CONSTRAINT memories_type_check CHECK (type IN (
        'STABLE_PREFERENCE', 'PERSONAL_FACT', 'GOAL', 'DECISION_COMMITMENT',
        'RELATIONSHIP_CONTEXT', 'INTERACTION_PREFERENCE', 'TEMPORARY_STATE', 'DERIVED_INSIGHT'
    )),
    CONSTRAINT memories_source_check CHECK (source IN (
        'USER_STATED', 'USER_CONFIRMED', 'SYSTEM_DERIVED', 'IMPORTED', 'ADMIN_CONTROLLED'
    )),
    CONSTRAINT memories_status_check CHECK (status IN (
        'ACTIVE', 'SUPERSEDED', 'EXPIRED', 'DELETED', 'DISABLED', 'PENDING_CONFIRMATION'
    )),
    CONSTRAINT memories_content_check CHECK (length(btrim(content)) > 0),
    CONSTRAINT memories_confidence_check CHECK (confidence BETWEEN 0 AND 1),
    CONSTRAINT memories_importance_check CHECK (importance BETWEEN 0 AND 1),
    CONSTRAINT memories_version_check CHECK (version > 0),
    CONSTRAINT memories_expiration_check CHECK (expires_at IS NULL OR expires_at > created_at),
    CONSTRAINT memories_derived_authority_check CHECK (
        source <> 'SYSTEM_DERIVED' OR status <> 'ACTIVE'
    ),
    CONSTRAINT memories_not_self_superseding_check CHECK (supersedes_memory_id IS NULL OR supersedes_memory_id <> id),
    CONSTRAINT memories_one_successor_unique UNIQUE (supersedes_memory_id)
);

CREATE INDEX memories_user_status_idx ON public.memories (user_id, status);
CREATE INDEX memories_user_type_idx ON public.memories (user_id, type);
CREATE INDEX memories_expiration_idx ON public.memories (expires_at) WHERE expires_at IS NOT NULL;

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.memories FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.memories TO authenticated;

CREATE POLICY memories_select_own ON public.memories
    FOR SELECT TO authenticated
    USING (user_id = (SELECT auth.uid()));

CREATE POLICY memories_insert_own ON public.memories
    FOR INSERT TO authenticated
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY memories_update_own ON public.memories
    FOR UPDATE TO authenticated
    USING (user_id = (SELECT auth.uid()))
    WITH CHECK (user_id = (SELECT auth.uid()));

CREATE FUNCTION public.supersede_memory(
    p_old_memory_id uuid,
    p_new_memory_id uuid,
    p_type text,
    p_content text,
    p_source text,
    p_confidence double precision,
    p_importance double precision,
    p_status text,
    p_expires_at timestamptz DEFAULT NULL
) RETURNS SETOF public.memories
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
    old_memory public.memories;
    successor public.memories;
BEGIN
    IF p_old_memory_id = p_new_memory_id THEN
        RAISE EXCEPTION 'A memory cannot supersede itself.' USING ERRCODE = '22023';
    END IF;

    SELECT * INTO old_memory
      FROM public.memories
     WHERE id = p_old_memory_id
       AND user_id = (SELECT auth.uid())
       AND status = 'ACTIVE'
     FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    INSERT INTO public.memories (
        id, user_id, scope, type, content, source, confidence, importance,
        status, version, expires_at, supersedes_memory_id
    ) VALUES (
        p_new_memory_id, old_memory.user_id, old_memory.scope, p_type, p_content,
        p_source, p_confidence, p_importance, p_status, old_memory.version + 1,
        p_expires_at, old_memory.id
    ) RETURNING * INTO successor;

    UPDATE public.memories
       SET status = 'SUPERSEDED', updated_at = CURRENT_TIMESTAMP
     WHERE id = old_memory.id;

    RETURN NEXT successor;
END;
$$;

REVOKE ALL ON FUNCTION public.supersede_memory(uuid, uuid, text, text, text, double precision, double precision, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.supersede_memory(uuid, uuid, text, text, text, double precision, double precision, text, timestamptz) TO authenticated;

COMMIT;
