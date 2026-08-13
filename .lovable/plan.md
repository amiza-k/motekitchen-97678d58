# Migration plan: Lovable Cloud → your own Supabase project (org "amiza")

Nothing has been changed. This is an inspection report plus the exact steps to move.

## 1. What exists today

**Backend:** Lovable Cloud–managed Supabase project (host `*.lovable.cloud`). Email/password auth only — all 22 accounts use the email provider, no social logins to re-enable.

**Tables (public schema) and current data volume**

| Table | Rows |
| --- | --- |
| organizations | 15 |
| departments | 7 |
| profiles | 22 |
| catalog_items | 23 |
| tasks | 26 |
| invitations | 0 |
| shopping_list_entries | 0 |
| auth.users / auth.identities | 22 / 22 |
| storage objects | 1 (bucket `database_export_12_08_26`, private) |

**Database functions (10):** `accept_invitation`, `check_phone_availability`, `create_my_organization`, `current_department_id`, `current_is_owner`, `current_is_purchaser`, `current_org_id`, `get_login_email`, `handle_new_user`, `prevent_role_self_escalation` — all `SECURITY DEFINER` with `search_path = public`, and EXECUTE revoked from `anon`/`PUBLIC`.

**Triggers (2):** `on_auth_user_created` on `auth.users` (creates the profile / consumes an invitation), and `profiles_prevent_role_self_escalation` on `public.profiles`.

**RLS:** enabled on all 7 tables, ~28 policies, all multi-tenant scoped through the `current_org_id()` / `current_is_owner()` / `current_is_purchaser()` helpers. Plus explicit GRANTs to `authenticated` and `service_role`.

**Migrations:** 14 SQL files already tracked in `supabase/migrations/`, which is the cleanest way to rebuild the schema on the new project.

**Frontend touchpoints:** `src/integrations/supabase/*` (auto-generated client, admin client, auth middleware, types) and 11 app files that import the client. No edge functions — all server logic is TanStack server functions, so nothing to redeploy.

## 2. The one blocker to know up front

`auth.users` cannot be recreated with plain SQL, and Lovable Cloud does not expose the service-role key or database password of the managed project. So the 22 existing accounts (and their password hashes) can only move if the accounts are exported through a path that has privileged access to the managed instance. Two realistic options:

- **A. Fresh start (simplest):** rebuild schema + policies on your project, migrate the business data, and have the 22 users re-register / reset passwords. Profile rows must then be re-linked to the new `auth.users` IDs.
- **B. Full account migration:** requires Lovable support to provide an `auth` schema dump (or a service-role export) of the managed project so users keep their passwords and UUIDs — which also keeps every `user_id` foreign key intact and makes data migration a straight copy.

Option B is strongly preferable because `profiles.id`, `organizations.owner_id`, `tasks.added_by`, and `shopping_list_entries.added_by` all reference `auth.users(id)`.

## 3. Migration steps

**Step 1 — Connect your project.** In the Lovable editor: Project Settings → Integrations → Supabase → run the OAuth flow and pick the target project in "amiza". This repoints `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and the `VITE_*` equivalents. I cannot do this from chat.

**Step 2 — Verify the target project is empty** (or that its `public` schema won't collide). Migrating into a project that already has a `profiles` table needs a rename/merge decision first.

**Step 3 — Rebuild the schema.** Apply the 14 existing migration files in filename order against the new project. They already contain tables, GRANTs, RLS enable, policies, functions, and triggers in the right order. I'll re-verify GRANTs and the `anon`/`PUBLIC` EXECUTE revokes afterwards, since those were applied as later fixes.

**Step 4 — Auth configuration.** On the new project: enable email/password, set auto-confirm to match current behaviour, set Site URL and redirect URLs to `https://motekitchen.lovable.app` and the preview URL. The signup flow uses a synthetic `@phone.motekitchen.app` email for phone registrations, so no SMS provider is needed.

**Step 5 — Users.** Option A: users re-register. Option B: import the `auth` dump before any data copy, so IDs are preserved.

**Step 6 — Business data.** Export the 7 public tables as SQL inserts and load them in dependency order: `organizations` → `departments` → `profiles` → `catalog_items` → `invitations` → `shopping_list_entries` → `tasks`. Important: temporarily disable the `on_auth_user_created` and `profiles_prevent_role_self_escalation` triggers during the load, otherwise they fire and mangle rows; re-enable after.

**Step 7 — Storage.** Recreate the private `database_export_12_08_26` bucket and copy its single object, or skip it if it was only a one-off backup.

**Step 8 — Regenerate types and env.** `src/integrations/supabase/types.ts` and the `.env` values are auto-generated; they refresh once the connection is switched. No app code changes are expected because every import goes through `@/integrations/supabase/client`.

**Step 9 — Verify.** Sign in as an owner, a purchaser, and a department member, and confirm: org isolation holds, department lists load, "send to purchaser" creates pending tasks, history shows past tasks, and role escalation is still blocked.

## 4. Rollback

Nothing is deleted from the Lovable Cloud project during any of this — it stays intact and can be pointed back to if the switch goes wrong. I'd suggest keeping it untouched for at least a week after cutover.

## 5. What I need from you before starting

1. Complete the Supabase OAuth connection in Project Settings (I cannot list or select your projects from chat).
2. Confirm Option A (users re-register) or Option B (request an auth dump from support).
3. Confirm whether the target project's `public` schema is empty.
