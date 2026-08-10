-- اجازه‌ی عدم وجود ایمیل واقعی (برای ثبت‌نام با شماره)
ALTER TABLE public.profiles ALTER COLUMN email DROP NOT NULL;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS phone text;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_unique_idx
  ON public.profiles (lower(username)) WHERE username IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_phone_unique_idx
  ON public.profiles (phone) WHERE phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique_idx
  ON public.profiles (lower(email)) WHERE email IS NOT NULL;

-- فقط وقتی کاربر واقعاً ایمیل تایپ کرده، آن را در profiles.email ذخیره کن.
-- اگر با شماره ثبت‌نام کرده، این ستون خالی می‌ماند — ایمیل مصنوعیِ
-- "<phone>@phone.motekitchen.app" فقط در auth.users می‌ماند و هرگز به
-- profiles کپی یا به کاربر نشان داده نمی‌شود.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
declare
  inv record;
  real_email text := new.raw_user_meta_data->>'real_email';
  signup_phone text := new.raw_user_meta_data->>'phone';
begin
  select * into inv from public.invitations
    where real_email is not null and lower(email) = lower(real_email) limit 1;

  if inv.id is not null then
    insert into public.profiles (id, org_id, email, full_name, department_id, is_owner, is_purchaser, phone)
    values (new.id, inv.org_id, real_email,
            coalesce(new.raw_user_meta_data->>'full_name', real_email, signup_phone),
            inv.department_id, false, inv.is_purchaser, signup_phone);
    delete from public.invitations where id = inv.id;
  else
    insert into public.profiles (id, org_id, email, full_name, is_owner, is_purchaser, phone)
    values (new.id, null, real_email,
            coalesce(new.raw_user_meta_data->>'full_name', real_email, signup_phone),
            false, false, signup_phone);
  end if;
  return new;
end;
$function$;

-- چون یوزرنیم دیگر بخشی از فرم ثبت‌نام نیست، فقط شماره را چک می‌کنیم.
CREATE OR REPLACE FUNCTION public.check_phone_availability(_phone text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE phone = _phone);
$$;

REVOKE EXECUTE ON FUNCTION public.check_phone_availability(text) FROM public;
GRANT EXECUTE ON FUNCTION public.check_phone_availability(text) TO anon, authenticated;

DROP FUNCTION IF EXISTS public.check_signup_availability(text, text);

-- یوزرنیم/شماره/ایمیل را به ایمیل واقعیِ ورود در auth.users تبدیل می‌کند
-- (که ممکن است همان ایمیل مصنوعی باشد). تنها جایی است که به auth.users
-- دسترسی مستقیم دارد؛ به کلاینت فقط یک رشته‌ی ایمیل برمی‌گرداند تا با
-- supabase.auth.signInWithPassword استفاده شود.
CREATE OR REPLACE FUNCTION public.get_login_email(_identifier text)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.email
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE p.phone = _identifier
     OR lower(p.username) = lower(_identifier)
     OR lower(p.email) = lower(_identifier)
  LIMIT 1;
$$;

REVOKE EXECUTE ON FUNCTION public.get_login_email(text) FROM public;
GRANT EXECUTE ON FUNCTION public.get_login_email(text) TO anon, authenticated;
