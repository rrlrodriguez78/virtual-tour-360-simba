-- Función para promover usuario a Super Admin (solo Super Admins pueden ejecutarla)
CREATE OR REPLACE FUNCTION public.promote_to_super_admin(
  _user_id uuid,
  _promoted_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_user_email text;
  v_user_name text;
  v_current_super_admin_count integer;
BEGIN
  -- Verificar que quien ejecuta la acción sea Super Admin
  IF NOT is_super_admin(_promoted_by) THEN
    RAISE EXCEPTION 'Only super admins can promote users to super admin role';
  END IF;
  
  -- Verificar que el usuario a promover exista y esté aprobado
  SELECT email, full_name, account_status 
  INTO v_user_email, v_user_name
  FROM public.profiles
  WHERE id = _user_id AND account_status = 'approved';
  
  IF v_user_email IS NULL THEN
    RAISE EXCEPTION 'User not found or not approved';
  END IF;
  
  -- Verificar que el usuario no sea ya Super Admin
  IF is_super_admin(_user_id) THEN
    RAISE EXCEPTION 'User is already a super admin';
  END IF;
  
  -- Contar Super Admins actuales
  SELECT COUNT(*) INTO v_current_super_admin_count
  FROM public.user_roles
  WHERE role = 'admin';
  
  -- Insertar rol de admin en user_roles
  INSERT INTO public.user_roles (user_id, role)
  VALUES (_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  -- Crear notificación para el nuevo Super Admin
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message
  ) VALUES (
    _user_id,
    'role_updated',
    '¡Has sido promovido a Super Admin!',
    'Ahora tienes acceso completo al sistema como Super Admin de respaldo.'
  );
  
  -- Log de auditoría (si existe tabla de auditoría)
  RAISE NOTICE 'User % (%) promoted to Super Admin by %. Total Super Admins: %', 
    v_user_name, v_user_email, _promoted_by, v_current_super_admin_count + 1;
END;
$$;

-- Función para degradar Super Admin (solo para casos extremos)
CREATE OR REPLACE FUNCTION public.revoke_super_admin(
  _user_id uuid,
  _revoked_by uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public', 'pg_temp'
AS $$
DECLARE
  v_remaining_admins integer;
BEGIN
  -- Verificar que quien ejecuta sea Super Admin
  IF NOT is_super_admin(_revoked_by) THEN
    RAISE EXCEPTION 'Only super admins can revoke super admin privileges';
  END IF;
  
  -- No permitir que un Super Admin se remueva a sí mismo
  IF _user_id = _revoked_by THEN
    RAISE EXCEPTION 'Cannot revoke your own super admin privileges';
  END IF;
  
  -- Verificar que quedaría al menos 1 Super Admin
  SELECT COUNT(*) INTO v_remaining_admins
  FROM public.user_roles
  WHERE role = 'admin' AND user_id != _user_id;
  
  IF v_remaining_admins < 1 THEN
    RAISE EXCEPTION 'Cannot revoke last super admin. At least one super admin must remain.';
  END IF;
  
  -- Eliminar rol de admin
  DELETE FROM public.user_roles
  WHERE user_id = _user_id AND role = 'admin';
  
  -- Notificar al usuario
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message
  ) VALUES (
    _user_id,
    'role_updated',
    'Privilegios de Super Admin revocados',
    'Tus privilegios de Super Admin han sido revocados por otro administrador.'
  );
  
  RAISE NOTICE 'Super Admin privileges revoked for user %', _user_id;
END;
$$;