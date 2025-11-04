-- Crear enum tenant_role si no existe
DO $$ BEGIN
  CREATE TYPE public.tenant_role AS ENUM ('tenant_admin', 'editor', 'viewer', 'member');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Actualizar la tabla tenant_users para usar el enum correcto
ALTER TABLE public.tenant_users 
  ALTER COLUMN role TYPE tenant_role 
  USING role::text::tenant_role;