-- New Migration to fix conflict between create_my_organization and prevent_role_self_escalation trigger.
-- We refine the prevent_role_self_escalation function to explicitly permit
-- the legítimate owner-escalation ONLY when the user currently has NO organization (org_id is NULL)
-- and is being assigned as the owner of a newly created organization.

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

  -- EXCEPTION / LOOPHOLE: Permit escalation during the "create_my_organization" flow!
  -- Narrow condition: The user previously had NO organization (OLD.org_id IS NULL)
  -- and is now setting is_owner = true alongside a valid newly assigned organization (NEW.org_id IS NOT NULL).
  IF OLD.org_id IS NULL 
     AND NEW.org_id IS NOT NULL 
     AND NEW.is_owner = true 
     AND NEW.is_purchaser = true THEN
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
