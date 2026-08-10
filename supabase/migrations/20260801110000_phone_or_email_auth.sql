ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS phone text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx
  ON public.profiles (phone) WHERE phone IS NOT NULL;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  inv record;
begin
  select * into inv from public.invitations
    where lower(email) = lower(new.email) limit 1;

  if inv.id is not null then
    insert into public.profiles (id, org_id, email, full_name, department_id, is_owner, is_purchaser, username, phone)
    values (new.id, inv.org_id, new.email,
            coalesce(new.raw_user_meta_data->>'full_name', new.email),
            inv.department_id, false, inv.is_purchaser,
            new.raw_user_meta_data->>'username',
            new.raw_user_meta_data->>'phone');
    delete from public.invitations where id = inv.id;
  else
    insert into public.profiles (id, org_id, email, full_name, is_owner, is_purchaser, username, phone)
    values (new.id, null, new.email,
            coalesce(new.raw_user_meta_data->>'full_name', new.email),
            false, false,
            new.raw_user_meta_data->>'username',
            new.raw_user_meta_data->>'phone');
  end if;
  return new;
end;
$function$;

-- بررسی در دسترس بودن یوزرنیم/شماره؛ phone می‌تواند null باشد (وقتی کاربر با ایمیل ثبت‌نام می‌کند)
CREATE OR REPLACE FUNCTION public.check_signup_availability(_phone text, _username text)
RETURNS TABLE(phone_taken boolean, username_taken boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    (_phone IS NOT NULL AND EXISTS (SELECT 1 FROM public.profiles WHERE phone = _phone)) AS phone_taken,
    EXISTS (SELECT 1 FROM public.profiles WHERE lower(username) = lower(_username)) AS username_taken;
$$;

REVOKE EXECUTE ON FUNCTION public.check_signup_availability(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_signup_availability(text, text) TO anon, authenticated;

-- تبدیل شماره/یوزرنیم به ایمیل داخلی حساب (برای ورود)
CREATE OR REPLACE FUNCTION public.get_login_email(_identifier text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM public.profiles
  WHERE phone = _identifier OR lower(username) = lower(_identifier)
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_login_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_login_email(text) TO anon, authenticated;
