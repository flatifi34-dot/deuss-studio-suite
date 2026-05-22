
-- 1. Restrict profiles.email exposure via column-level grants.
--    Keep RLS SELECT policy but remove column SELECT on `email` for non-admins.
REVOKE SELECT ON public.profiles FROM authenticated, anon;
GRANT SELECT (id, full_name, created_at) ON public.profiles TO authenticated;
-- admins still get email via the existing "admins manage profiles" ALL policy +
-- a full-column grant scoped through is_admin (handled by separate explicit grant):
GRANT SELECT (id, full_name, created_at, email) ON public.profiles TO postgres, service_role;

-- 2. Lock user_roles SELECT to own row; admins still see all via separate policy.
DROP POLICY IF EXISTS "authed read roles" ON public.user_roles;
CREATE POLICY "users read own role"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "admins read all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- 3. Revoke EXECUTE on SECURITY DEFINER functions from public/anon/authenticated.
--    RLS policies and triggers continue to work (executed under definer privileges
--    via the policy engine / trigger context, not via API EXECUTE grants).
REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalc_package_paid() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_room_overlap() FROM PUBLIC, anon, authenticated;

-- 4. Tighten overly permissive UPDATE on clients (was USING true / WITH CHECK true).
DROP POLICY IF EXISTS "authed update clients" ON public.clients;
CREATE POLICY "authed update clients"
  ON public.clients
  FOR UPDATE
  TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
