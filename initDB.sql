CREATE SCHEMA auth;
CREATE EXTENSION pgcrypto;

CREATE TABLE auth.user
(
    id                          UUID      DEFAULT gen_random_uuid() PRIMARY KEY,
    first_name                  TEXT,
    last_name                   TEXT,
    source_id                   TEXT,
    email                       TEXT UNIQUE NOT NULL,
    password_hash               TEXT        NOT NULL,
    is_reset_password_initiated BOOLEAN   DEFAULT false,
    is_deleted                  BOOLEAN   DEFAULT false,
    deleted_at                  TIMESTAMP,
    updated_at                  TIMESTAMP,
    created_at                  TIMESTAMP DEFAULT now()
);

CREATE TABLE auth.user_otp_map
(
    id              UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
    fk_user_id      UUID NOT NULL,
    otp             INT  NOT NULL DEFAULT floor(random() * (900000 + 1) + 99999)::int,
    type            TEXT NOT NULL,
    expiration_time TIMESTAMP     DEFAULT now() + '5 minutes'
);
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS uniq_user_otp_user_id_type_idx ON auth.user_otp_map (fk_user_id, type);

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
    ON CONFLICT (fk_user_id, type) DO UPDATE SET otp             = floor(random() * (900000 + 1) + 99999)::int,
                                          expiration_time = now() + '5 minutes'
                                          RETURNING otp INTO return_otp;

IF trigger_type = 'UPDATE_PASSWORD' THEN
UPDATE auth.user SET is_reset_password_initiated = true WHERE email = user_email;
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
                       uu.is_reset_password_initiated = true AND upro.type = 'UPDATE_PASSWORD'
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
SET password_hash               = new_password,
    is_reset_password_initiated = false,
    updated_at                  = now()
WHERE u.id = user_id;
DELETE FROM auth.user_otp_map WHERE id = otp_id;
END IF;

RETURN is_success;
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