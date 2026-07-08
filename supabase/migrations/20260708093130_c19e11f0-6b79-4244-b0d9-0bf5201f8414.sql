
REVOKE EXECUTE ON FUNCTION public.current_org_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_is_owner() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_is_purchaser() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.current_department_id() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.prevent_role_self_escalation() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, public, authenticated;
REVOKE EXECUTE ON FUNCTION public.accept_invitation(uuid) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.create_my_organization(text, text, text, text) FROM anon, public;
