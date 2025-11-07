# 🏥 Verificación de Salud del Sistema Multi-Tenant

Usa este checklist para verificar que tu sistema multi-tenant está funcionando correctamente.

---

## ✅ Checklist de Verificación

### 🔐 **1. Base de Datos**

#### Tablas Principales
```sql
-- Verificar que todas las tablas existen
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'tenants',
    'tenant_users',
    'profiles',
    'user_approval_requests',
    'user_roles',
    'virtual_tours'
  )
ORDER BY table_name;
```
- [ ] ✅ Todas las tablas existen

---

#### RLS (Row Level Security)
```sql
-- Verificar que RLS está habilitado
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public'
  AND tablename IN (
    'tenants',
    'tenant_users',
    'profiles',
    'user_approval_requests',
    'virtual_tours'
  );
```
- [ ] ✅ RLS habilitado en todas las tablas críticas

---

#### Funciones Helper
```sql
-- Verificar que las funciones existen
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name IN (
    'is_super_admin',
    'belongs_to_tenant',
    'is_tenant_admin',
    'approve_user',
    'reject_user',
    'get_user_tenants'
  )
ORDER BY routine_name;
```
- [ ] ✅ Todas las funciones helper existen

---

### 👤 **2. Primer Super Admin**

```sql
-- Verificar que existe al menos un Super Admin
SELECT 
  p.email,
  p.full_name,
  p.account_status,
  ur.role
FROM user_roles ur
JOIN profiles p ON ur.user_id = p.id
WHERE ur.role = 'admin';
```

**Resultado esperado:** Al menos 1 fila con role = 'admin'

- [ ] ✅ Existe al menos un Super Admin
- [ ] ✅ Super Admin tiene `account_status = 'approved'`

**Si no existe:**
```sql
-- Crear Super Admin manualmente
INSERT INTO user_roles (user_id, role)
VALUES ('USER_ID_AQUI', 'admin');

UPDATE profiles 
SET account_status = 'approved'
WHERE id = 'USER_ID_AQUI';
```

---

### 🏢 **3. Flujo de Aprobación**

#### Test 1: Registro de Usuario

**Acción:** Registrar un usuario en `/signup`

**Verificar:**
```sql
-- El usuario debe aparecer en profiles con status pending
SELECT 
  email,
  full_name,
  account_status,
  created_at
FROM profiles
WHERE email = 'NUEVO_EMAIL@test.com';

-- Debe existir una solicitud pendiente
SELECT 
  status,
  requested_at
FROM user_approval_requests
WHERE user_id = (SELECT id FROM profiles WHERE email = 'NUEVO_EMAIL@test.com');
```

**Checklist:**
- [ ] ✅ Usuario creado en `profiles`
- [ ] ✅ `account_status = 'pending'`
- [ ] ✅ Existe entrada en `user_approval_requests` con `status = 'pending'`
- [ ] ✅ Super Admin recibió notificación

---

#### Test 2: Aprobación de Usuario

**Acción:** Aprobar usuario desde `/app/user-approvals`

**Verificar:**
```sql
SELECT 
  p.email,
  p.account_status,
  uar.status as approval_status,
  uar.reviewed_at,
  t.name as tenant_name,
  tu.role
FROM profiles p
LEFT JOIN user_approval_requests uar ON p.id = uar.user_id
LEFT JOIN tenant_users tu ON p.id = tu.user_id
LEFT JOIN tenants t ON tu.tenant_id = t.id
WHERE p.email = 'NUEVO_EMAIL@test.com';
```

**Checklist:**
- [ ] ✅ `account_status = 'approved'`
- [ ] ✅ `approval_status = 'approved'`
- [ ] ✅ `reviewed_at` está registrado
- [ ] ✅ Se creó un tenant automáticamente
- [ ] ✅ Usuario es `tenant_admin` del nuevo tenant
- [ ] ✅ Usuario recibió notificación

---

#### Test 3: Login de Usuario Aprobado

**Acción:** Hacer login con el usuario aprobado

**Checklist:**
- [ ] ✅ Login exitoso
- [ ] ✅ Redirige a `/app/tours`
- [ ] ✅ `TenantSwitcher` muestra el tenant
- [ ] ✅ Usuario puede crear tours

---

#### Test 4: Login de Usuario Pendiente

**Acción:** Intentar login con usuario pendiente

**Checklist:**
- [ ] ✅ Login bloqueado
- [ ] ✅ Mensaje: "Cuenta pendiente de aprobación"
- [ ] ❌ No accede al dashboard

---

#### Test 5: Login de Usuario Rechazado

**Acción:** Intentar login con usuario rechazado

**Checklist:**
- [ ] ✅ Login bloqueado
- [ ] ✅ Mensaje: "Solicitud rechazada"
- [ ] ❌ No accede al dashboard

---

### 👥 **4. Gestión de Tenant**

#### Test 6: Agregar Usuario a Tenant

**Pre-requisitos:**
- Tenant Admin logueado
- Usuario objetivo debe estar aprobado

**Acción:** Ir a `/app/tenant-admin` y agregar usuario por email

**Verificar:**
```sql
SELECT 
  tu.role,
  p.email,
  t.name as tenant_name
FROM tenant_users tu
JOIN profiles p ON tu.user_id = p.id
JOIN tenants t ON tu.tenant_id = t.id
WHERE p.email = 'USUARIO_A_AGREGAR@test.com';
```

**Checklist:**
- [ ] ✅ Usuario agregado a `tenant_users`
- [ ] ✅ Rol asignado correctamente
- [ ] ✅ Usuario recibió notificación
- [ ] ✅ Usuario puede ver tours del tenant

---

#### Test 7: Cambiar Rol de Usuario

**Acción:** Cambiar rol de `member` a `tenant_admin`

**Verificar:**
```sql
SELECT role FROM tenant_users
WHERE user_id = 'USER_ID'
  AND tenant_id = 'TENANT_ID';
```

**Checklist:**
- [ ] ✅ Rol actualizado correctamente
- [ ] ✅ Usuario tiene permisos de Tenant Admin

---

### 🔒 **5. Seguridad (RLS)**

#### Test 8: Aislamiento de Datos

**Setup:** Crear 2 tenants con tours diferentes

**Verificar:**
```sql
-- Usuario A no debe ver tours de Tenant B
-- Ejecutar como Usuario A:
SELECT * FROM virtual_tours
WHERE tenant_id != (
  SELECT tenant_id FROM tenant_users WHERE user_id = auth.uid() LIMIT 1
);
```

**Checklist:**
- [ ] ✅ Usuario NO ve tours de otros tenants
- [ ] ✅ Usuario SÍ ve tours de su tenant
- [ ] ✅ Super Admin ve todos los tours

---

#### Test 9: Protección de Funciones Admin

**Acción:** Usuario normal intenta acceder a `/app/super-admin`

**Checklist:**
- [ ] ✅ Redirige a inicio
- [ ] ❌ No muestra dashboard de Super Admin

**Acción:** Tenant Admin intenta acceder a `/app/user-approvals`

**Checklist:**
- [ ] ✅ Redirige a inicio
- [ ] ❌ No puede aprobar usuarios

---

### 📊 **6. Performance**

#### Test 10: Consultas Optimizadas

```sql
-- Verificar índices importantes
SELECT 
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('tenant_users', 'virtual_tours', 'profiles')
ORDER BY tablename;
```

**Checklist:**
- [ ] ✅ Índice en `tenant_users(tenant_id)`
- [ ] ✅ Índice en `virtual_tours(tenant_id)`
- [ ] ✅ Índice en `profiles(account_status)`

---

#### Test 11: Tiempo de Carga

**Acción:** Cargar `/app/tours` con 50+ tours

**Checklist:**
- [ ] ✅ Carga en < 2 segundos
- [ ] ✅ No hay queries N+1
- [ ] ✅ Lazy loading funciona

---

### 🔔 **7. Notificaciones**

#### Test 12: Notificaciones Automáticas

```sql
-- Verificar notificaciones recientes
SELECT 
  n.type,
  n.title,
  n.message,
  n.created_at,
  p.email as recipient
FROM notifications n
JOIN profiles p ON n.user_id = p.id
ORDER BY n.created_at DESC
LIMIT 10;
```

**Checklist:**
- [ ] ✅ Notificación al registrarse (para Super Admin)
- [ ] ✅ Notificación al ser aprobado (para usuario)
- [ ] ✅ Notificación al agregar a tenant (para usuario)

---

### 🧪 **8. Casos Edge**

#### Test 13: Usuario en Múltiples Tenants

**Setup:** Agregar mismo usuario a 2 tenants diferentes

**Verificar:**
```sql
SELECT 
  t.name as tenant_name,
  tu.role
FROM tenant_users tu
JOIN tenants t ON tu.tenant_id = t.id
WHERE tu.user_id = 'USER_ID';
```

**Checklist:**
- [ ] ✅ Usuario aparece en ambos tenants
- [ ] ✅ `TenantSwitcher` muestra ambos
- [ ] ✅ Puede cambiar entre tenants
- [ ] ✅ Datos están aislados por tenant

---

#### Test 14: Eliminar Tenant

**Acción:** Eliminar un tenant desde Super Admin

**Verificar:**
```sql
-- Tours del tenant deben eliminarse (si hay CASCADE)
SELECT COUNT(*) FROM virtual_tours WHERE tenant_id = 'DELETED_TENANT_ID';

-- Usuarios quedan intactos
SELECT COUNT(*) FROM profiles WHERE id IN (
  SELECT user_id FROM tenant_users WHERE tenant_id = 'DELETED_TENANT_ID'
);
```

**Checklist:**
- [ ] ✅ Tenant eliminado
- [ ] ✅ Tours eliminados o huérfanos (según configuración)
- [ ] ✅ Usuarios siguen existiendo

---

## 🚨 Alertas Comunes

### ⚠️ Usuario no puede acceder después de aprobación

**Diagnóstico:**
```sql
SELECT 
  p.account_status,
  uar.status as approval_status,
  COUNT(tu.id) as tenant_count
FROM profiles p
LEFT JOIN user_approval_requests uar ON p.id = uar.user_id
LEFT JOIN tenant_users tu ON p.id = tu.user_id
WHERE p.email = 'USER_EMAIL'
GROUP BY p.id, p.account_status, uar.status;
```

**Problemas posibles:**
- `account_status != 'approved'` → Volver a aprobar
- `tenant_count = 0` → Crear tenant manualmente
- `approval_status != 'approved'` → Función no se ejecutó

---

### ⚠️ Tenant Admin no puede invitar usuarios

**Diagnóstico:**
```sql
-- Verificar permisos
SELECT role FROM tenant_users
WHERE user_id = 'ADMIN_ID' AND tenant_id = 'TENANT_ID';

-- Verificar estado del usuario a invitar
SELECT account_status FROM profiles WHERE email = 'INVITEE_EMAIL';
```

**Problemas posibles:**
- Rol no es `tenant_admin` → Actualizar rol
- Usuario a invitar no está aprobado → Aprobar primero

---

## 📈 Métricas de Salud

```sql
-- Dashboard de salud del sistema
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
  'Approved Users',
  COUNT(*)
FROM profiles WHERE account_status = 'approved'

UNION ALL

SELECT 
  'Total Tours',
  COUNT(*)
FROM virtual_tours

UNION ALL

SELECT 
  'Avg Tours per Tenant',
  AVG(tour_count)::integer
FROM (
  SELECT tenant_id, COUNT(*) as tour_count
  FROM virtual_tours
  GROUP BY tenant_id
) sub;
```

**Valores saludables:**
- ✅ Pending Approvals < 10
- ✅ Active Tenants > 0
- ✅ Approved Users > 0

---

## 🔧 Comandos de Mantenimiento

### Limpiar Solicitudes Antiguas
```sql
DELETE FROM user_approval_requests
WHERE status IN ('approved', 'rejected')
  AND reviewed_at < NOW() - INTERVAL '6 months';
```

### Detectar Tenants Inactivos
```sql
SELECT 
  t.name,
  t.status,
  COUNT(vt.id) as tours,
  MAX(vt.created_at) as last_tour_created
FROM tenants t
LEFT JOIN virtual_tours vt ON t.id = vt.tenant_id
GROUP BY t.id, t.name, t.status
HAVING MAX(vt.created_at) < NOW() - INTERVAL '90 days'
   OR COUNT(vt.id) = 0;
```

### Backup de Configuración
```sql
-- Exportar configuración de tenants
COPY (
  SELECT 
    t.*,
    COUNT(tu.user_id) as user_count,
    COUNT(vt.id) as tour_count
  FROM tenants t
  LEFT JOIN tenant_users tu ON t.id = tu.tenant_id
  LEFT JOIN virtual_tours vt ON t.id = vt.tenant_id
  GROUP BY t.id
) TO '/tmp/tenants_backup.csv' WITH CSV HEADER;
```

---

## ✅ Checklist Final

- [ ] Todas las verificaciones pasaron
- [ ] RLS habilitado en todas las tablas
- [ ] Al menos 1 Super Admin existe
- [ ] Flujo de aprobación funciona correctamente
- [ ] Aislamiento de datos verificado
- [ ] Performance aceptable (< 2s)
- [ ] Notificaciones funcionando
- [ ] Documentación revisada

---

**Última verificación:** [Fecha]  
**Verificado por:** [Nombre]  
**Estado:** ✅ Saludable / ⚠️ Con advertencias / ❌ Crítico
