-- Crear función get_user_tenants
CREATE OR REPLACE FUNCTION public.get_user_tenants(_user_id uuid)
RETURNS TABLE(tenant_id uuid, tenant_name text, user_role text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    tu.role::text as user_role
  FROM public.tenants t
  INNER JOIN public.tenant_users tu ON t.id = tu.tenant_id
  WHERE tu.user_id = _user_id
  ORDER BY t.created_at ASC;
$$;