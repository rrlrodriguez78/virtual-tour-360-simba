# Guía de Separación de Interfaces Web/Android

Este proyecto implementa un sistema de separación completa entre interfaces Web y Android, manteniendo una única base de código y base de datos compartida.

## 🎯 Conceptos Clave

### Una Sola Base de Datos
- **Lovable Cloud/Supabase compartido**: Todos los datos, autenticación y backend son los mismos
- Las tablas, RLS policies, Edge Functions se comparten entre ambas plataformas
- Los cambios en el backend afectan a ambas interfaces por igual

### Dos Interfaces Independientes
- **Archivos `.tsx`**: Interfaz diseñada para Web (desktop)
- **Archivos `.android.tsx`**: Interfaz diseñada para Android (móvil nativo)
- Puedes modificar una sin afectar la otra

## 📁 Estructura de Archivos

### Páginas con Separación
```
src/pages/
  ├── Dashboard.tsx          → Interfaz Web (desktop)
  ├── Dashboard.android.tsx  → Interfaz Android (móvil)
  ├── Editor.tsx             → Editor de tours Web (desktop)
  └── Editor.android.tsx     → Editor de tours Android (optimizado para táctil)
```

### Código Compartido (Sin Separación)
```
src/
  ├── hooks/                 → Lógica de negocio compartida
  ├── components/ui/         → Componentes UI base
  ├── utils/                 → Utilidades compartidas
  ├── contexts/              → Contextos React compartidos
  └── integrations/          → Conexión a backend (Supabase)
```

## 🛠️ Cómo Trabajar

### 1. Para Cambios Solo en Web
```
"Modifica el Dashboard web para agregar un botón de exportar"
```
→ Solo se modifica `Dashboard.tsx`

### 2. Para Cambios Solo en Android
```
"Agrega un botón flotante FAB en el dashboard Android"
```
→ Solo se modifica `Dashboard.android.tsx`

### 3. Para Cambios en Ambas
```
"Agrega autenticación con Google en el login"
```
→ Se modifica el backend compartido y ambas interfaces se adaptan

### 4. Para Nuevas Páginas
Si necesitas una nueva página con separación:
```
"Crea una página de perfil con versiones web y android"
```
Se crearán:
- `pages/Profile.tsx` (versión web)
- `pages/Profile.android.tsx` (versión Android)

## 🔍 Vista Previa en Lovable

### Sin Capacitor (Modo Desarrollo)
En la esquina inferior izquierda verás el **PlatformPreviewSwitcher**:
- Botón **Web**: Muestra la interfaz desktop
- Botón **Android**: Muestra la interfaz móvil

También puedes agregar `?platform=android` o `?platform=web` a la URL manualmente.

### Con Capacitor Instalado
El selector se oculta automáticamente y la detección usa el platform real de Capacitor.

## 🚀 Deployment

### Desarrollo en Lovable
1. Trabaja normalmente en el editor
2. Usa el PlatformPreviewSwitcher para ver cada versión
3. Todos los cambios se guardan en el mismo proyecto

### Compilación Android Nativa
Cuando estés listo para crear la app Android real:

1. **Exportar a GitHub**
   ```bash
   # Desde Lovable: Botón de GitHub → Export to GitHub
   ```

2. **Clonar y preparar**
   ```bash
   git clone tu-repo
   cd tu-repo
   npm install
   ```

3. **Instalar Capacitor**
   ```bash
   npm install @capacitor/core @capacitor/cli @capacitor/android
   npx cap init
   ```

4. **Configurar capacitor.config.ts**
   ```typescript
   {
     appId: 'app.lovable.090a7828d3d34f3091e7e22507021ad8',
     appName: 'virtual-tour-360-simba',
     webDir: 'dist',
     server: {
       url: 'https://090a7828-d3d3-4f30-91e7-e22507021ad8.lovableproject.com?forceHideBadge=true',
       cleartext: true
     }
   }
   ```

5. **Agregar Android**
   ```bash
   npx cap add android
   npm run build
   npx cap sync
   npx cap run android
   ```

## 🎨 Ventajas del Sistema

### ✅ Lo Bueno
- **Un solo proyecto en Lovable**: No pagas por dos proyectos
- **Base de datos compartida**: Los datos se sincronizan automáticamente
- **Backend único**: Edge Functions, Auth, Storage compartidos
- **Flexibilidad total**: Cada UI puede ser completamente diferente
- **Preview fácil**: Cambias entre vistas con un clic

### ⚠️ Consideraciones
- **Lógica compartida**: Los hooks y utils afectan ambas plataformas
- **Testing**: Debes probar ambas interfaces cuando cambies código compartido
- **Naming**: Sé claro cuando pidas cambios: "web", "android" o "ambos"

## 📝 Ejemplos de Prompts

### ✅ Prompts Claros
```
"Agrega un gráfico de estadísticas al dashboard WEB"
"Modifica el botón de crear tour en la versión ANDROID"
"Cambia el color primario del tema (esto afecta AMBAS versiones)"
"Agrega una tabla de usuarios al backend (compartido)"
```

### ❌ Prompts Ambiguos
```
"Agrega un botón" ← ¿En cuál interfaz?
"Cambia el dashboard" ← ¿Web, Android o ambos?
```

## 🔧 Detección de Plataforma en Código

Si necesitas crear componentes que se adapten:

```tsx
import { usePlatform } from '@/hooks/usePlatform';

export const MyComponent = () => {
  const { platform } = usePlatform();
  
  if (platform === 'android') {
    return <MobileLayout />;
  }
  
  return <DesktopLayout />;
};
```

Pero es mejor usar archivos separados (`.tsx` y `.android.tsx`) para páginas completas.

## 📚 Archivos Clave

- `src/hooks/usePlatform.ts`: Detecta la plataforma actual
- `src/components/PlatformRoute.tsx`: Enruta a la UI correcta
- `src/components/dev/PlatformPreviewSwitcher.tsx`: Selector para desarrollo
- `src/App.tsx`: Configuración de rutas con `PlatformRouteElement`

## 🆘 Troubleshooting

### No veo el selector de plataforma
- El selector solo aparece en modo desarrollo (sin Capacitor)
- Si Capacitor está instalado, usa el device selector de Lovable (iconos de dispositivo)

### Los cambios afectan ambas plataformas
- Verifica que estés modificando el archivo correcto (`.tsx` vs `.android.tsx`)
- Los hooks, utils y contextos son compartidos por diseño

### La versión Android no se carga
- Revisa que exista el archivo `.android.tsx`
- Verifica que la ruta en `App.tsx` tenga configurado `androidComponent`
- Checa la consola del navegador por errores de importación

## 🎓 Siguientes Pasos

1. **Crea más páginas con separación** según las necesites
2. **Personaliza cada interfaz** para su plataforma
3. **Comparte lógica** en hooks para evitar duplicación
4. **Prueba en ambas vistas** antes de publicar cambios importantes

---

**Recuerda**: Cuando pidas cambios al AI, especifica siempre si es para "web", "android" o "ambas plataformas".
