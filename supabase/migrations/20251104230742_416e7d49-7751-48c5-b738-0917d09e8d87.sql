-- Eliminar la función anterior si existe
DROP FUNCTION IF EXISTS public.get_user_tenants(UUID);

-- Recrear la función get_user_tenants correctamente
CREATE FUNCTION public.get_user_tenants(_user_id UUID)
RETURNS TABLE (
  tenant_id UUID,
  tenant_name TEXT,
  user_role TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id as tenant_id,
    t.name as tenant_name,
    tu.role::text as user_role
  FROM tenants t
  INNER JOIN tenant_users tu ON t.id = tu.tenant_id
  WHERE tu.user_id = _user_id;
END;
$$;