BEGIN;

CREATE TABLE users (
    id uuid PRIMARY KEY,
    auth_subject text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE conversation_sessions (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    status text NOT NULL,
    channel text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_activity_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    closed_at timestamptz,
    CONSTRAINT conversation_sessions_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT conversation_sessions_status_check
        CHECK (status IN ('ACTIVE', 'IDLE', 'CLOSED', 'EXPIRED')),
    CONSTRAINT conversation_sessions_channel_check
        CHECK (channel IN ('TEXT', 'VOICE')),
    CONSTRAINT conversation_sessions_id_user_unique UNIQUE (id, user_id)
);

CREATE TABLE conversation_turns (
    id uuid PRIMARY KEY,
    session_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    status text NOT NULL,
    content text NOT NULL,
    processing_path text,
    idempotency_key text,
    created_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
    completed_at timestamptz,
    CONSTRAINT conversation_turns_user_fk
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
    CONSTRAINT conversation_turns_session_user_fk
        FOREIGN KEY (session_id, user_id)
        REFERENCES conversation_sessions (id, user_id) ON DELETE RESTRICT,
    CONSTRAINT conversation_turns_role_check
        CHECK (role IN ('USER', 'ASSISTANT', 'SYSTEM')),
    CONSTRAINT conversation_turns_status_check
        CHECK (status IN (
            'RECEIVED',
            'VALIDATED',
            'CONTEXT_BUILDING',
            'PROCESSING',
            'GENERATING',
            'STREAMING',
            'COMPLETED',
            'CANCELLED',
            'FAILED',
            'SUPERSEDED'
        )),
    CONSTRAINT conversation_turns_processing_path_check
        CHECK (processing_path IS NULL OR processing_path IN ('FAST', 'DEEP')),
    CONSTRAINT conversation_turns_idempotency_unique
        UNIQUE (session_id, user_id, idempotency_key)
);

CREATE INDEX conversation_sessions_user_activity_idx
    ON conversation_sessions (user_id, last_activity_at DESC);

CREATE INDEX conversation_turns_session_order_idx
    ON conversation_turns (session_id, created_at, id);

COMMIT;
