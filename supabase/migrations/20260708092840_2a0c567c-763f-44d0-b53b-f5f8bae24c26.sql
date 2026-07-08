
-- Fix Issue 1: Prevent privilege escalation via profile self-update.
-- WITH CHECK cannot reference OLD row, so enforce via BEFORE UPDATE trigger.
CREATE OR REPLACE FUNCTION public.prevent_role_self_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Allow superuser / service role (auth.uid() is null in trusted server contexts)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- If role flags unchanged, nothing to check
  IF NEW.is_owner IS NOT DISTINCT FROM OLD.is_owner
     AND NEW.is_purchaser IS NOT DISTINCT FROM OLD.is_purchaser THEN
    RETURN NEW;
  END IF;

  -- Role flags changed: only an existing owner in the same org may do this,
  -- and never on their own row (an owner cannot demote/promote themselves here).
  IF public.current_is_owner()
     AND OLD.org_id = public.current_org_id()
     AND OLD.id <> auth.uid() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'not allowed to change is_owner or is_purchaser';
END;
$$;

DROP TRIGGER IF EXISTS profiles_prevent_role_self_escalation ON public.profiles;
CREATE TRIGGER profiles_prevent_role_self_escalation
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.prevent_role_self_escalation();

-- Fix Issue 2: Enforce status='pending' on task inserts by regular members.
DROP POLICY IF EXISTS "dept members insert tasks" ON public.tasks;
CREATE POLICY "dept members insert tasks" ON public.tasks
  FOR INSERT
  TO authenticated
  WITH CHECK (
    org_id = public.current_org_id()
    AND (
      -- Owners/purchasers may insert with any status
      public.current_is_owner() OR public.current_is_purchaser()
      OR (
        -- Regular department members: must be their department AND status must be 'pending'
        department_id = public.current_department_id()
        AND status = 'pending'
      )
    )
  );
