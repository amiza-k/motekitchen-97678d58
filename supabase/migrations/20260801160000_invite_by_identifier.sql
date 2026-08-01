ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS identifier_type text NOT NULL DEFAULT 'email'
    CHECK (identifier_type IN ('email', 'phone', 'username'));

UPDATE public.invitations SET identifier_type = 'email' WHERE identifier_type IS NULL;

-- محدودیت یکتای قبلی روی (org_id, email) دیگر کافی نیست چون یک مقدار
-- می‌تواند هم به‌عنوان ایمیل و هم به اشتباه شبیه چیز دیگری باشد؛ یکتایی
-- را بر اساس (org_id, identifier_type, value) بازتعریف می‌کنیم.
ALTER TABLE public.invitations DROP CONSTRAINT IF EXISTS invitations_org_id_email_key;
CREATE UNIQUE INDEX IF NOT EXISTS invitations_org_identifier_unique_idx
  ON public.invitations (org_id, identifier_type, lower(email));

-- خواندن دعوت‌های خودم: بر اساس هرکدام از ایمیل/شماره/یوزرنیمِ واقعی‌ام که در پروفایلم ثبت شده
DROP POLICY IF EXISTS "user can read own invitations by email" ON public.invitations;
CREATE POLICY "user can read own invitations by identifier" ON public.invitations
  FOR SELECT TO authenticated USING (
    (identifier_type = 'email' AND lower(email) = lower(coalesce((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), '')))
    OR (identifier_type = 'phone' AND email = coalesce((SELECT p.phone FROM public.profiles p WHERE p.id = auth.uid()), ''))
    OR (identifier_type = 'username' AND lower(email) = lower(coalesce((SELECT p.username FROM public.profiles p WHERE p.id = auth.uid()), '')))
  );

DROP POLICY IF EXISTS "user can delete own invitation on accept" ON public.invitations;
CREATE POLICY "user can delete own invitation on accept" ON public.invitations
  FOR DELETE TO authenticated USING (
    (identifier_type = 'email' AND lower(email) = lower(coalesce((SELECT p.email FROM public.profiles p WHERE p.id = auth.uid()), '')))
    OR (identifier_type = 'phone' AND email = coalesce((SELECT p.phone FROM public.profiles p WHERE p.id = auth.uid()), ''))
    OR (identifier_type = 'username' AND lower(email) = lower(coalesce((SELECT p.username FROM public.profiles p WHERE p.id = auth.uid()), '')))
  );

-- پذیرش دعوت: بر اساس نوع شناسه، با فیلد واقعی متناظر در profiles مطابقت می‌دهد
CREATE OR REPLACE FUNCTION public.accept_invitation(_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  inv record;
  me record;
  old_org uuid;
  remaining int;
  matches boolean := false;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'profile not found'; end if;

  select * into inv from public.invitations where id = _invitation_id;
  if inv.id is null then raise exception 'invitation not found'; end if;

  if inv.identifier_type = 'email' and me.email is not null and lower(inv.email) = lower(me.email) then
    matches := true;
  elsif inv.identifier_type = 'phone' and me.phone is not null and inv.email = me.phone then
    matches := true;
  elsif inv.identifier_type = 'username' and me.username is not null and lower(inv.email) = lower(me.username) then
    matches := true;
  end if;

  if not matches then
    raise exception 'this invitation is not for you';
  end if;

  old_org := me.org_id;

  update public.profiles
    set org_id = inv.org_id,
        department_id = inv.department_id,
        is_owner = false,
        is_purchaser = inv.is_purchaser
    where id = auth.uid();

  delete from public.invitations where id = inv.id;

  if old_org is not null and old_org <> inv.org_id then
    select count(*) into remaining from public.profiles where org_id = old_org;
    if remaining = 0 then
      delete from public.organizations where id = old_org;
    end if;
  end if;
end;
$$;

REVOKE EXECUTE ON FUNCTION public.accept_invitation(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.accept_invitation(uuid) TO authenticated;

-- اتصال خودکار حین ثبت‌نام: فقط وقتی نوع دعوت ایمیل یا شماره است ممکن است
-- (چون این‌ها در لحظه‌ی ثبت‌نام مشخصند؛ یوزرنیم فقط بعداً در پروفایل تکمیل می‌شود
-- و آن دعوت‌ها باید دستی از صفحه‌ی دعوت‌های من پذیرفته شوند).
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
    where (identifier_type = 'email' and real_email is not null and lower(email) = lower(real_email))
       or (identifier_type = 'phone' and signup_phone is not null and email = signup_phone)
    order by created_at asc
    limit 1;

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