# 🚀 Guía Rápida: Sistema Multi-Tenant

## ⚡ Inicio Rápido (5 minutos)

### **1. Crear el Primer Super Admin**

```sql
-- Ejecutar en SQL Editor de Supabase:

-- Paso 1: Registrar usuario en la app (via /signup)
-- Paso 2: Encontrar el user_id en la tabla profiles
-- Paso 3: Ejecutar:

INSERT INTO user_roles (user_id, role)
VALUES ('TU_USER_ID_AQUI', 'admin');

UPDATE profiles 
SET account_status = 'approved'
WHERE id = 'TU_USER_ID_AQUI';
```

---

### **2. Flujo de Aprobación de Usuarios**

```
👤 Usuario se registra
  ↓
📧 Super Admin recibe notificación
  ↓
✅ Super Admin aprueba en /app/user-approvals
  ↓
🏢 Se crea tenant automáticamente
  ↓
🎉 Usuario puede acceder
```

**URL:** `/app/user-approvals`

---

### **3. Agregar Usuarios a un Tenant**

**Pasos:**
1. El usuario debe registrarse primero en `/signup`
2. Super Admin debe aprobar al usuario
3. Tenant Admin va a `/app/tenant-admin`
4. Busca por email y lo agrega

---

## 📱 Páginas Administrativas

| Página | URL | Acceso | Función |
|--------|-----|--------|---------|
| **Super Admin Dashboard** | `/app/super-admin` | Super Admin | Gestionar todos los tenants |
| **User Approvals** | `/app/user-approvals` | Super Admin | Aprobar/rechazar registros |
| **Tenant Admin** | `/app/tenant-admin` | Tenant Admin | Gestionar usuarios del tenant |
| **Feature Management** | `/app/feature-management` | Super Admin | Gestionar feature flags |

---

## 🔑 Roles Explicados

### Super Admin (`admin`)
- ✅ Aprueba/rechaza nuevos usuarios
- ✅ Crea y gestiona todos los tenants
- ✅ Configura feature flags globales
- ✅ Acceso total al sistema

### Tenant Admin (`tenant_admin`)
- ✅ Invita usuarios a su tenant
- ✅ Gestiona roles de su equipo
- ✅ Administra tours de su organización
- ❌ No puede aprobar registros nuevos
- ❌ No ve otros tenants

### User (`member`)
- ✅ Crea y gestiona sus tours
- ✅ Ve tours de su tenant
- ✅ Colabora con su equipo
- ❌ No puede invitar usuarios
- ❌ No gestiona el tenant

---

## 🛠️ Comandos Útiles

### Ver Usuarios Pendientes
```sql
SELECT p.email, p.full_name, uar.requested_at
FROM user_approval_requests uar
JOIN profiles p ON uar.user_id = p.id
WHERE uar.status = 'pending'
ORDER BY uar.requested_at DESC;
```

### Ver Tenants y sus Usuarios
```sql
SELECT 
  t.name as tenant,
  COUNT(tu.user_id) as users,
  t.status,
  t.subscription_tier
FROM tenants t
LEFT JOIN tenant_users tu ON t.id = tu.tenant_id
GROUP BY t.id, t.name, t.status, t.subscription_tier
ORDER BY users DESC;
```

### Promover Usuario a Tenant Admin
```sql
UPDATE tenant_users
SET role = 'tenant_admin'
WHERE tenant_id = 'TENANT_ID'
  AND user_id = 'USER_ID';
```

---

## ⚠️ Problemas Comunes

### ❌ "Usuario no puede acceder después de registro"
**Solución:** Es normal. Debe ser aprobado por Super Admin en `/app/user-approvals`.

---

### ❌ "No veo el menú de administración"
**Soluciones:**
- Verifica que eres Super Admin: `SELECT * FROM user_roles WHERE user_id = 'TU_ID'`
- O Tenant Admin: Revisa `tenant_users` tabla

---

### ❌ "Usuario aprobado no ve ningún tenant"
**Problema:** La función `approve_user()` no se ejecutó correctamente.

**Solución:**
```sql
-- Crear tenant manualmente:
INSERT INTO tenants (name, owner_id)
VALUES ('Nombre del Tenant', 'USER_ID');

-- Agregar como admin:
INSERT INTO tenant_users (tenant_id, user_id, role)
VALUES ('TENANT_ID', 'USER_ID', 'tenant_admin');
```

---

### ❌ "Tenant Admin no puede agregar usuarios"
**Problema:** El usuario nuevo no está aprobado.

**Solución:** Super Admin debe aprobar primero en `/app/user-approvals`.

---

## 🎨 Personalización

### Cambiar Mensaje de Registro
```typescript
// src/pages/Auth.tsx línea 91-94
toast.success('Tu mensaje personalizado aquí', {
  duration: 6000,
});
```

### Desactivar Aprobación Manual (Auto-Aprobar)
```sql
-- Modificar trigger handle_new_user() para auto-aprobar:
-- NO RECOMENDADO para producción

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Auto-aprobar
  INSERT INTO public.profiles (id, email, full_name, account_status)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name', 'approved');
  
  -- Crear tenant automáticamente
  INSERT INTO tenants (owner_id, name)
  VALUES (NEW.id, NEW.email || '''s Organization')
  RETURNING id INTO new_tenant_id;
  
  -- Asignar como admin
  INSERT INTO tenant_users (tenant_id, user_id, role)
  VALUES (new_tenant_id, NEW.id, 'tenant_admin');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## 📈 Estadísticas Rápidas

### Dashboard de Métricas
```sql
SELECT 
  'Total Tenants' as metric,
  COUNT(*) as value
FROM tenants

UNION ALL

SELECT 
  'Active Tenants',
  COUNT(*)
FROM tenants WHERE status = 'active'

UNION ALL

SELECT 
  'Pending Approvals',
  COUNT(*)
FROM user_approval_requests WHERE status = 'pending'

UNION ALL

SELECT 
  'Total Users',
  COUNT(*)
FROM profiles WHERE account_status = 'approved';
```

---

## 🔐 Seguridad

### ✅ Buenas Prácticas

1. **NUNCA hardcodear roles en el frontend**
   ```typescript
   // ❌ MAL
   if (user.email === 'admin@example.com') { ... }
   
   // ✅ BIEN
   const { isSuperAdmin } = useIsSuperAdmin();
   if (isSuperAdmin) { ... }
   ```

2. **Siempre usar RLS policies**
   - Todas las tablas deben tener RLS habilitado
   - Usar funciones helper: `is_super_admin()`, `belongs_to_tenant()`

3. **Validar tenant_id en el backend**
   ```sql
   -- ✅ BIEN: Función con RLS
   CREATE FUNCTION delete_tour(_tour_id uuid)
   RETURNS void
   SECURITY DEFINER
   AS $$
   BEGIN
     DELETE FROM virtual_tours
     WHERE id = _tour_id
       AND belongs_to_tenant(auth.uid(), tenant_id);
   END;
   $$ LANGUAGE plpgsql;
   ```

---

## 📞 Soporte

- **Documentación completa:** `MULTI-TENANT-SYSTEM.md`
- **Código fuente:** `src/pages/SuperAdminDashboard.tsx`
- **Migraciones:** `supabase/migrations/`

---

**Última actualización:** 2025-01-07  
**Versión:** 2.0
