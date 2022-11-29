CREATE SCHEMA auth;
CREATE EXTENSION pgcrypto;

CREATE TABLE auth.user
(
    id                          UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name                  TEXT,
    last_name                   TEXT,
    email                       TEXT UNIQUE NOT NULL,
    password_hash               TEXT        NOT NULL,
    is_reset_password_initiated BOOLEAN   DEFAULT false,
    is_deleted                  BOOLEAN   DEFAULT false,
    deleted_at                  TIMESTAMP,
    updated_at                  TIMESTAMP,
    created_at                  TIMESTAMP DEFAULT now()
);

CREATE TABLE auth.user_info
(
    id              UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
    fk_user_id      UUID NOT NULL,
    source_id       TEXT,
    gender          TEXT,
    nationality     TEXT,
    DOB             DATE,
    fk_user_type_id UUID,
    created_at      timestamp,
    updated_at      timestamp,
    is_deleted      BOOLEAN DEFAULT false
);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_user_info_user_id_idx ON auth.user_info (fk_user_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS user_info_user_type_id_idx ON auth.user_info (fk_user_type_id);

CREATE TABLE auth.generic_user_type
(
    id         UUID            DEFAULT gen_random_uuid() PRIMARY KEY,
    user_type  TEXT   NOT NULL,
    roles      TEXT[] NOT NULL DEFAULT '{}'::text[],
    is_deleted BOOLEAN         DEFAULT false
);

CREATE TABLE auth.user_otp_map
(
    id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    fk_user_id      UUID NOT NULL,
    otp             INT  NOT NULL DEFAULT floor(random() * (900000 + 1) + 99999)::int,
    expiration_time TIMESTAMP     DEFAULT now() + '5 minutes'
);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_user_otp_user_id_idx ON auth.user_otp_map (fk_user_id);

CREATE OR REPLACE FUNCTION auth.initiate_reset_password(user_email text)
    RETURNS INTEGER
    LANGUAGE plpgsql
AS
$$
DECLARE
return_otp int;
BEGIN
INSERT INTO auth.user_otp_map(fk_user_id)
SELECT u.id
FROM auth.user u
WHERE u.email = user_email
    ON CONFLICT (fk_user_id) DO UPDATE SET otp             = floor(random() * (900000 + 1) + 99999)::int,
                                    expiration_time = now() + '5 minutes'
                                    RETURNING otp INTO return_otp;

UPDATE auth.user SET is_reset_password_initiated = true WHERE email = user_email;

RETURN return_otp;
END;
$$;

CREATE OR REPLACE FUNCTION auth.execute_reset_password(user_email text, user_otp int, new_password text)
    RETURNS BOOLEAN
    LANGUAGE plpgsql
AS
$$
DECLARE
is_otp_expired BOOLEAN = false;
    user_id        UUID;
BEGIN
SELECT uu.id, upro.expiration_time < now()
FROM auth.user_otp_map upro
         INNER JOIN auth.user uu
                    ON uu.id = upro.fk_user_id AND uu.is_deleted = false AND uu.is_reset_password_initiated = true
WHERE uu.email = user_email
  AND upro.otp = user_otp
    INTO user_id, is_otp_expired;

IF is_otp_expired = false THEN
UPDATE auth.user u SET password_hash = new_password, is_reset_password_initiated = false WHERE u.id = user_id;
END IF;

RETURN NOT is_otp_expired;
END;
$$;

CREATE OR REPLACE FUNCTION auth.encrypt_password()
    RETURNS TRIGGER
    LANGUAGE plpgsql
AS
$$
BEGIN
    IF NEW.password_hash IS NOT NULL THEN
        NEW.password_hash = crypt(NEW.password_hash, gen_salt('bf'));
END IF;
RETURN NEW;
END;
$$;

CREATE TRIGGER encrypt_password
    BEFORE INSERT OR UPDATE
                         ON auth.user
                         FOR EACH ROW
                         EXECUTE PROCEDURE auth.encrypt_password();