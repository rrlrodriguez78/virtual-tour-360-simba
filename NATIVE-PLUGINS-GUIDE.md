# Guía de Plugins Nativos de Capacitor

## 📱 Plugins Instalados

Tu app ahora tiene los siguientes plugins nativos de Capacitor:

### 1. **Cámara** (`@capacitor/camera`)
- Captura fotos con la cámara nativa
- Selecciona imágenes de la galería
- Control de calidad y formato de imagen

### 2. **Geolocalización** (`@capacitor/geolocation`)
- Obtiene la ubicación actual del dispositivo
- Monitoreo continuo de ubicación (watch position)
- Alta precisión GPS

### 3. **Notificaciones Push** (`@capacitor/push-notifications`)
- Recibe notificaciones push nativas
- Integración con Firebase Cloud Messaging (FCM)
- Manejo de acciones de notificación

### 4. **Almacenamiento Local** (`@capacitor/preferences`)
- Guarda datos persistentes localmente
- API simple key-value
- Reemplazo seguro de localStorage

### 5. **Información del Dispositivo** (`@capacitor/device`)
- Información del dispositivo (modelo, OS, fabricante)
- Estado de batería
- Idioma del sistema

### 6. **Red** (`@capacitor/network`)
- Estado de conexión (online/offline)
- Tipo de conexión (WiFi, Cellular, etc.)
- Listener para cambios de red

### 7. **Vibración Háptica** (`@capacitor/haptics`)
- Feedback háptico (vibración)
- Diferentes intensidades (light, medium, heavy)

---

## 🎯 Hooks Personalizados Creados

### `useNativeCamera()`
```typescript
const { takePicture, pickFromGallery, requestPermissions, loading } = useNativeCamera();

// Tomar foto
const result = await takePicture();
// result.imageUrl, result.format, result.base64

// Seleccionar de galería
const image = await pickFromGallery();
```

### `useNativeGeolocation()`
```typescript
const { getCurrentPosition, watchPosition, clearWatch, position, loading } = useNativeGeolocation();

// Obtener ubicación una vez
const coords = await getCurrentPosition();
// coords.coords.latitude, coords.coords.longitude

// Monitorear ubicación
const watchId = watchPosition((position) => {
  console.log(position.coords);
});
await clearWatch(watchId);
```

### `useNativePushNotifications()`
```typescript
const { initialize, token, notifications } = useNativePushNotifications();

// Inicializar y obtener token
await initialize();
// token contendrá el FCM token para enviar notificaciones
```

### `useNativeStorage()`
```typescript
const { setItem, getItem, removeItem, clear, keys } = useNativeStorage();

// Guardar datos
await setItem('user_preferences', { theme: 'dark', language: 'es' });

// Obtener datos
const prefs = await getItem('user_preferences');

// Eliminar
await removeItem('user_preferences');
```

### `useNativeDevice()`
```typescript
const { 
  deviceInfo, 
  networkStatus, 
  isOnline, 
  vibrateLight,
  vibrateMedium,
  vibrateHeavy 
} = useNativeDevice();

// Información del dispositivo
console.log(deviceInfo.model, deviceInfo.platform);

// Estado de red
console.log(isOnline, networkStatus.connectionType);

// Vibración
await vibrateLight();
```

---

## 🚀 Próximos Pasos

### 1. **Sincronizar el proyecto**
Después de instalar los plugins, debes sincronizar el proyecto:

```bash
# Exporta a Github y clona el repositorio
git pull

# Sincroniza los cambios con las plataformas nativas
npx cap sync
```

### 2. **Configurar Permisos en Android**

Edita `android/app/src/main/AndroidManifest.xml` y agrega los permisos necesarios:

```xml
<!-- Cámara -->
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_MEDIA_IMAGES"/>
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />

<!-- Geolocalización -->
<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />
<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />
<uses-feature android:name="android.hardware.location.gps" />

<!-- Notificaciones Push -->
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>

<!-- Red -->
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />

<!-- Vibración -->
<uses-permission android:name="android.permission.VIBRATE" />
```

### 3. **Configurar Firebase para Push Notifications (Opcional)**

Si quieres usar notificaciones push:

1. Ve a [Firebase Console](https://console.firebase.google.com/)
2. Crea un proyecto o usa uno existente
3. Agrega tu app Android
4. Descarga `google-services.json`
5. Coloca el archivo en `android/app/`
6. En `android/build.gradle`, agrega:
   ```gradle
   classpath 'com.google.gms:google-services:4.3.15'
   ```
7. En `android/app/build.gradle`, al final:
   ```gradle
   apply plugin: 'com.google.gms.google-services'
   ```

### 4. **Configurar Permisos en iOS** (si usas iOS)

Edita `ios/App/App/Info.plist`:

```xml
<!-- Cámara -->
<key>NSCameraUsageDescription</key>
<string>La app necesita acceso a la cámara para capturar fotos</string>

<key>NSPhotoLibraryUsageDescription</key>
<string>La app necesita acceso a tus fotos</string>

<!-- Geolocalización -->
<key>NSLocationWhenInUseUsageDescription</key>
<string>La app necesita tu ubicación para funciones de mapa</string>

<key>NSLocationAlwaysUsageDescription</key>
<string>La app necesita tu ubicación en segundo plano</string>
```

---

## 🧪 Página de Pruebas

Hemos creado una página de pruebas en `/app/native-features` donde puedes probar todos los plugins instalados.

Para acceder:
1. Navega a `/app/native-features` en tu app
2. O agrega un enlace en el menú de navegación

---

## 📚 Recursos Adicionales

- [Documentación oficial de Capacitor](https://capacitorjs.com/docs)
- [Camera Plugin](https://capacitorjs.com/docs/apis/camera)
- [Geolocation Plugin](https://capacitorjs.com/docs/apis/geolocation)
- [Push Notifications Plugin](https://capacitorjs.com/docs/apis/push-notifications)
- [Preferences Plugin](https://capacitorjs.com/docs/apis/preferences)
- [Device Plugin](https://capacitorjs.com/docs/apis/device)
- [Network Plugin](https://capacitorjs.com/docs/apis/network)
- [Haptics Plugin](https://capacitorjs.com/docs/apis/haptics)

---

## ⚠️ Notas Importantes

1. **Permisos**: Los usuarios deben otorgar permisos para usar cámara, ubicación, etc.
2. **Pruebas**: Algunos plugins solo funcionan en dispositivos reales (no en el navegador)
3. **Hot Reload**: Después de cambios en plugins nativos, ejecuta `npx cap sync`
4. **Firebase**: Las notificaciones push requieren configuración adicional de Firebase
5. **iOS**: Para compilar en iOS necesitas una Mac con Xcode instalado
