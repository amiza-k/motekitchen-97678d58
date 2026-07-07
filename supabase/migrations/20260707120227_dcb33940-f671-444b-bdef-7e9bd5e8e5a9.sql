
-- Make profiles.org_id nullable so a user can exist without an organization
ALTER TABLE public.profiles ALTER COLUMN org_id DROP NOT NULL;

-- Add location columns to organizations
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS province text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS address text;

-- Update handle_new_user: only auto-join via invite; otherwise create a profile with no org
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
    insert into public.profiles (id, org_id, email, full_name, department_id, is_owner, is_purchaser)
    values (new.id, inv.org_id, new.email,
            coalesce(new.raw_user_meta_data->>'full_name', new.email),
            inv.department_id, false, inv.is_purchaser);
    delete from public.invitations where id = inv.id;
  else
    insert into public.profiles (id, org_id, email, full_name, is_owner, is_purchaser)
    values (new.id, null, new.email,
            coalesce(new.raw_user_meta_data->>'full_name', new.email),
            false, false);
  end if;
  return new;
end;
$function$;

-- RPC to create an organization for the current user (only if they have none)
CREATE OR REPLACE FUNCTION public.create_my_organization(
  _name text, _province text, _city text, _address text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
declare
  existing uuid;
  new_org uuid;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  select org_id into existing from public.profiles where id = auth.uid();
  if existing is not null then raise exception 'user already belongs to an organization'; end if;
  if _name is null or length(trim(_name)) = 0 then raise exception 'name required'; end if;

  insert into public.organizations (name, owner_id, province, city, address)
  values (trim(_name), auth.uid(), nullif(trim(coalesce(_province,'')),''),
          nullif(trim(coalesce(_city,'')),''), nullif(trim(coalesce(_address,'')),''))
  returning id into new_org;

  update public.profiles
    set org_id = new_org, is_owner = true, is_purchaser = true, department_id = null
    where id = auth.uid();

  return new_org;
end;
$$;

GRANT EXECUTE ON FUNCTION public.create_my_organization(text,text,text,text) TO authenticated;
