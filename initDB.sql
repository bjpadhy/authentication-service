CREATE SCHEMA auth;
CREATE EXTENSION pgcrypto;

-- INIT nanoid(); refer https://github.com/viascom/nanoid-postgres/blob/main/nanoid.sql
CREATE OR REPLACE FUNCTION nanoid(size int DEFAULT 21,
                                  alphabet text DEFAULT '_-0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ')
    RETURNS text
    LANGUAGE plpgsql
    stable
AS
$$
DECLARE
idBuilder     text := '';
    i             int  := 0;
    bytes         bytea;
    alphabetIndex int;
    mask          int;
    step          int;
BEGIN
    mask := (2 << cast(floor(log(length(alphabet) - 1) / log(2)) as int)) - 1;
    step := cast(ceil(1.6 * mask * size / length(alphabet)) AS int);

    while true
        loop
            bytes := gen_random_bytes(size);
            while i < size
                loop
                    alphabetIndex := (get_byte(bytes, i) & mask) + 1;
                    if alphabetIndex <= length(alphabet) then
                        idBuilder := idBuilder || substr(alphabet, alphabetIndex, 1);
                        if length(idBuilder) = size then
                            return idBuilder;
end if;
end if;
                    i = i + 1;
end loop;

            i := 0;
end loop;
END
$$;

CREATE TABLE auth.user
(
    id                          UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name                  TEXT,
    last_name                   TEXT,
    source_id                   TEXT        NOT NULL,
    email                       TEXT UNIQUE NOT NULL,
    profile_image               TEXT,
    password_hash               TEXT        NOT NULL,
    is_password_update_initiated BOOLEAN   DEFAULT false,
    is_deleted                  BOOLEAN   DEFAULT false,
    deleted_at                  TIMESTAMP,
    updated_at                  TIMESTAMP,
    created_at                  TIMESTAMP DEFAULT now()
);

CREATE TABLE auth.user_otp_map
(
    id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    fk_user_id      UUID NOT NULL,
    otp             INT  NOT NULL DEFAULT nanoid(6, '0123456789')::int,
    type            TEXT NOT NULL,
    expiration_time TIMESTAMP     DEFAULT now() + '5 minutes'
);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_user_otp_user_id_type_idx ON auth.user_otp_map (fk_user_id, type);

CREATE TABLE auth.generic_roles
(
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    type        TEXT UNIQUE NOT NULL,
    role        TEXT UNIQUE NOT NULL,
    rank        INT  UNIQUE NOT NULL,
    description TEXT        NOT NULL,
    is_deleted  BOOLEAN     NOT NULL DEFAULT false
);
INSERT INTO auth.generic_roles(type, role, rank, description)
VALUES ('owner', 'super_admin', 1, 'Grants full access to manage all operations across sources'),
       ('administrator', 'admin', 2, 'Grants access to manage operations within a source'),
       ('user', 'user', 3, 'Grants access to use operations within a source'),
       ('reader', 'reader', 4, 'Grants read-only(view) access to operations within a source');

CREATE TABLE auth.user_role_map
(
    id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    fk_user_id  UUID UNIQUE NOT NULL,
    fk_role_id  UUID NOT NULL,
    created_at  TIMESTAMP DEFAULT now(),
    updated_at  TIMESTAMP,
    is_deleted  BOOLEAN NOT NULL DEFAULT false
);

CREATE OR REPLACE FUNCTION auth.generate_otp(user_email text, trigger_type text)
    RETURNS INTEGER
    LANGUAGE plpgsql
AS
$$
DECLARE
return_otp int;
BEGIN
INSERT INTO auth.user_otp_map(fk_user_id, type)
SELECT u.id, trigger_type
FROM auth.user u
WHERE u.email = user_email
    ON CONFLICT (fk_user_id, type) DO UPDATE SET otp             = nanoid(6, '0123456789')::int,
                                          expiration_time = now() + '5 minutes'
                                          RETURNING otp INTO return_otp;

IF trigger_type = 'UPDATE_PASSWORD' THEN
UPDATE auth.user SET is_password_update_initiated = true WHERE email = user_email;
END IF;

RETURN return_otp;
END;
$$;

CREATE OR REPLACE FUNCTION auth.update_password(user_email text, user_otp int, new_password text)
    RETURNS BOOLEAN
    LANGUAGE plpgsql
AS
$$
DECLARE
is_otp_expired BOOLEAN;
    is_success     BOOLEAN;
    user_id        UUID;
    otp_id         UUID;
    otp_val        INTEGER;
BEGIN
SELECT uu.id, upro.expiration_time < now(), upro.otp, upro.id
FROM auth.user_otp_map upro
         INNER JOIN auth.user uu
                    ON uu.id = upro.fk_user_id AND uu.is_deleted = false AND
                       uu.is_password_update_initiated = true AND upro.type = 'UPDATE_PASSWORD'
WHERE uu.email = user_email
    INTO user_id, is_otp_expired, otp_val, otp_id;

is_success = NOT is_otp_expired;

    IF otp_id IS NULL THEN
        RAISE EXCEPTION 'OTP_NOT_FOUND' USING HINT = 'Please generate an OTP first';
END IF;

    IF otp_val != user_otp THEN
        RAISE EXCEPTION 'OTP_INCORRECT' USING HINT = 'OTP entered is incorrect';
END IF;

    IF is_otp_expired = true THEN
        RAISE EXCEPTION 'OTP_EXPIRED' USING HINT = 'Your OTP has expired. Please generate a new OTP';
END IF;

    IF is_otp_expired = false THEN
UPDATE auth.user u
SET password_hash               = crypt(new_password, gen_salt('bf')),
    is_password_update_initiated = false,
    updated_at                  = now()
WHERE u.id = user_id;
DELETE FROM auth.user_otp_map WHERE id = otp_id;
END IF;

RETURN is_success;
END;
$$;