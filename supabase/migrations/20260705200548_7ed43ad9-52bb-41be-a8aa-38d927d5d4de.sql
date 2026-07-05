
ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invited_by_name text;

CREATE OR REPLACE FUNCTION public.accept_invitation(_invitation_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
declare
  inv record;
  me_email text;
  old_org uuid;
  remaining int;
begin
  select lower(coalesce(auth.jwt() ->> 'email', '')) into me_email;
  if me_email = '' or auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select * into inv from public.invitations where id = _invitation_id;
  if inv.id is null then raise exception 'invitation not found'; end if;
  if lower(inv.email) <> me_email then raise exception 'this invitation is not for you'; end if;

  select org_id into old_org from public.profiles where id = auth.uid();

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
