
-- ============ TABLES ============

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);
create index on public.departments(org_id);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  org_id uuid not null references public.organizations(id) on delete cascade,
  full_name text,
  email text not null,
  department_id uuid references public.departments(id) on delete set null,
  is_owner boolean not null default false,
  is_purchaser boolean not null default false,
  created_at timestamptz not null default now()
);
create index on public.profiles(org_id);

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  email text not null,
  department_id uuid references public.departments(id) on delete set null,
  is_purchaser boolean not null default false,
  created_at timestamptz not null default now(),
  unique(org_id, email)
);
create index on public.invitations(lower(email));

create table public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  name text not null,
  unit text not null,
  created_at timestamptz not null default now()
);
create index on public.catalog_items(department_id);

create table public.shopping_list_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  catalog_item_id uuid references public.catalog_items(id) on delete set null,
  item_name text not null,
  unit text not null,
  quantity numeric not null check (quantity > 0),
  urgency text not null default 'normal' check (urgency in ('normal','urgent')),
  note text,
  is_custom boolean not null default false,
  added_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index on public.shopping_list_entries(department_id);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations(id) on delete cascade,
  department_id uuid not null references public.departments(id) on delete cascade,
  item_name text not null,
  unit text not null,
  is_custom boolean not null default false,
  requested_quantity numeric not null,
  urgency text not null default 'normal',
  note text,
  status text not null default 'pending' check (status in ('pending','purchased','rejected')),
  purchased_quantity numeric,
  purchased_date timestamptz,
  rejection_note text,
  added_by uuid references auth.users(id) on delete set null,
  order_date timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index on public.tasks(org_id, status);
create index on public.tasks(department_id, status);

-- ============ GRANTS ============
grant select, insert, update, delete on public.organizations to authenticated;
grant all on public.organizations to service_role;
grant select, insert, update, delete on public.departments to authenticated;
grant all on public.departments to service_role;
grant select, insert, update, delete on public.profiles to authenticated;
grant all on public.profiles to service_role;
grant select, insert, update, delete on public.invitations to authenticated;
grant all on public.invitations to service_role;
grant select, insert, update, delete on public.catalog_items to authenticated;
grant all on public.catalog_items to service_role;
grant select, insert, update, delete on public.shopping_list_entries to authenticated;
grant all on public.shopping_list_entries to service_role;
grant select, insert, update, delete on public.tasks to authenticated;
grant all on public.tasks to service_role;

-- ============ HELPER FUNCTIONS (security definer to avoid RLS recursion) ============

create or replace function public.current_org_id()
returns uuid language sql stable security definer set search_path = public as $$
  select org_id from public.profiles where id = auth.uid()
$$;

create or replace function public.current_is_owner()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.current_is_purchaser()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_purchaser from public.profiles where id = auth.uid()), false)
$$;

create or replace function public.current_department_id()
returns uuid language sql stable security definer set search_path = public as $$
  select department_id from public.profiles where id = auth.uid()
$$;

-- ============ ENABLE RLS ============
alter table public.organizations enable row level security;
alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.invitations enable row level security;
alter table public.catalog_items enable row level security;
alter table public.shopping_list_entries enable row level security;
alter table public.tasks enable row level security;

-- ============ POLICIES ============

-- organizations
create policy "org members read own org" on public.organizations
  for select to authenticated using (id = public.current_org_id());
create policy "owner updates org" on public.organizations
  for update to authenticated using (id = public.current_org_id() and public.current_is_owner())
  with check (id = public.current_org_id());
create policy "any authenticated can create org" on public.organizations
  for insert to authenticated with check (owner_id = auth.uid());

-- departments
create policy "org members read departments" on public.departments
  for select to authenticated using (org_id = public.current_org_id());
create policy "owner manages departments insert" on public.departments
  for insert to authenticated with check (org_id = public.current_org_id() and public.current_is_owner());
create policy "owner manages departments update" on public.departments
  for update to authenticated using (org_id = public.current_org_id() and public.current_is_owner());
create policy "owner manages departments delete" on public.departments
  for delete to authenticated using (org_id = public.current_org_id() and public.current_is_owner());

-- profiles
create policy "read own profile" on public.profiles
  for select to authenticated using (id = auth.uid() or org_id = public.current_org_id());
create policy "insert own profile" on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy "self update profile" on public.profiles
  for update to authenticated using (id = auth.uid())
  with check (id = auth.uid() and org_id = public.current_org_id());
create policy "owner updates any profile in org" on public.profiles
  for update to authenticated using (org_id = public.current_org_id() and public.current_is_owner());
create policy "owner deletes profile in org" on public.profiles
  for delete to authenticated using (org_id = public.current_org_id() and public.current_is_owner() and id <> auth.uid());

-- invitations
create policy "org owner reads invitations" on public.invitations
  for select to authenticated using (org_id = public.current_org_id() and public.current_is_owner());
create policy "org owner writes invitations" on public.invitations
  for insert to authenticated with check (org_id = public.current_org_id() and public.current_is_owner());
create policy "org owner updates invitations" on public.invitations
  for update to authenticated using (org_id = public.current_org_id() and public.current_is_owner());
create policy "org owner deletes invitations" on public.invitations
  for delete to authenticated using (org_id = public.current_org_id() and public.current_is_owner());
-- allow signup lookup: any authenticated user can read invitations matching their own email
create policy "user can read own invitations by email" on public.invitations
  for select to authenticated using (lower(email) = lower((auth.jwt() ->> 'email')));
create policy "user can delete own invitation on accept" on public.invitations
  for delete to authenticated using (lower(email) = lower((auth.jwt() ->> 'email')));

-- catalog_items
create policy "org members read catalog" on public.catalog_items
  for select to authenticated using (org_id = public.current_org_id());
create policy "owner or purchaser insert catalog" on public.catalog_items
  for insert to authenticated with check (
    org_id = public.current_org_id() and (public.current_is_owner() or public.current_is_purchaser())
  );
create policy "owner or purchaser update catalog" on public.catalog_items
  for update to authenticated using (
    org_id = public.current_org_id() and (public.current_is_owner() or public.current_is_purchaser())
  );
create policy "owner or purchaser delete catalog" on public.catalog_items
  for delete to authenticated using (
    org_id = public.current_org_id() and (public.current_is_owner() or public.current_is_purchaser())
  );

-- shopping_list_entries
create policy "dept members read entries" on public.shopping_list_entries
  for select to authenticated using (
    org_id = public.current_org_id() and (
      department_id = public.current_department_id()
      or public.current_is_owner()
      or public.current_is_purchaser()
    )
  );
create policy "dept members insert entries" on public.shopping_list_entries
  for insert to authenticated with check (
    org_id = public.current_org_id() and department_id = public.current_department_id()
    and added_by = auth.uid()
  );
create policy "dept members update entries" on public.shopping_list_entries
  for update to authenticated using (
    org_id = public.current_org_id() and department_id = public.current_department_id()
  );
create policy "dept members delete entries" on public.shopping_list_entries
  for delete to authenticated using (
    org_id = public.current_org_id() and department_id = public.current_department_id()
  );

-- tasks
create policy "org members read tasks" on public.tasks
  for select to authenticated using (
    org_id = public.current_org_id() and (
      public.current_is_owner()
      or public.current_is_purchaser()
      or department_id = public.current_department_id()
    )
  );
create policy "dept members insert tasks" on public.tasks
  for insert to authenticated with check (
    org_id = public.current_org_id() and department_id = public.current_department_id()
  );
create policy "purchaser or owner update tasks" on public.tasks
  for update to authenticated using (
    org_id = public.current_org_id() and (public.current_is_owner() or public.current_is_purchaser())
  );

-- ============ SIGNUP HANDLER: link invitation OR create new org ============
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  inv record;
  new_org_id uuid;
begin
  -- Look up an invitation for this email
  select * into inv from public.invitations
    where lower(email) = lower(new.email) limit 1;

  if inv.id is not null then
    insert into public.profiles (id, org_id, email, full_name, department_id, is_owner, is_purchaser)
    values (new.id, inv.org_id, new.email,
            coalesce(new.raw_user_meta_data->>'full_name', new.email),
            inv.department_id, false, inv.is_purchaser);
    delete from public.invitations where id = inv.id;
  else
    -- New organization
    insert into public.organizations (name, owner_id)
    values (coalesce(new.raw_user_meta_data->>'org_name', 'رستوران من'), new.id)
    returning id into new_org_id;

    insert into public.profiles (id, org_id, email, full_name, is_owner, is_purchaser)
    values (new.id, new_org_id, new.email,
            coalesce(new.raw_user_meta_data->>'full_name', new.email),
            true, true);
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
