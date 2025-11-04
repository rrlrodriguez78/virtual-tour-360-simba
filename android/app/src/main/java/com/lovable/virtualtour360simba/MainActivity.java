package com.lovable.virtualtour360simba;

import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.content.Intent;
import android.net.Uri;
import android.provider.Settings;
import android.Manifest;
import android.content.pm.PackageManager;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final int STORAGE_PERMISSION_CODE = 100;
    private static final int MANAGE_EXTERNAL_STORAGE_CODE = 101;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        android.util.Log.d("MainActivity", "🔵 onCreate ejecutado - API " + Build.VERSION.SDK_INT);
        
        // 🆕 Retrasar la solicitud de permisos hasta que Capacitor esté listo
        new android.os.Handler(android.os.Looper.getMainLooper()).postDelayed(new Runnable() {
            @Override
            public void run() {
                requestStoragePermissions();
            }
        }, 500); // 500ms de delay
    }

    private void requestStoragePermissions() {
        android.util.Log.d("MainActivity", "🔵 requestStoragePermissions llamado");
        
        // 🆕 Verificar que la Activity está visible
        if (!isFinishing() && !isDestroyed()) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                // Android 13+ (API 33+) - Permisos de medios específicos
                android.util.Log.d("MainActivity", "🔵 Android 13+ detectado - solicitando READ_MEDIA");
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.READ_MEDIA_IMAGES) 
                    != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(this,
                        new String[]{
                            Manifest.permission.READ_MEDIA_IMAGES,
                            Manifest.permission.READ_MEDIA_VIDEO
                        },
                        STORAGE_PERMISSION_CODE);
                } else {
                    android.util.Log.d("MainActivity", "✅ Permisos READ_MEDIA ya concedidos");
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                // Android 11-12 (API 30-32) - Necesita MANAGE_EXTERNAL_STORAGE
                android.util.Log.d("MainActivity", "🔵 Android 11-12 detectado - solicitando MANAGE_EXTERNAL_STORAGE");
                if (!Environment.isExternalStorageManager()) {
                    try {
                        Intent intent = new Intent(Settings.ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION);
                        Uri uri = Uri.fromParts("package", getPackageName(), null);
                        intent.setData(uri);
                        startActivityForResult(intent, MANAGE_EXTERNAL_STORAGE_CODE);
                    } catch (Exception e) {
                        android.util.Log.w("MainActivity", "⚠️ Error al abrir configuración específica, usando genérica");
                        Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_FILES_ACCESS_PERMISSION);
                        startActivityForResult(intent, MANAGE_EXTERNAL_STORAGE_CODE);
                    }
                } else {
                    android.util.Log.d("MainActivity", "✅ MANAGE_EXTERNAL_STORAGE ya concedido");
                }
            } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                // Android 6-10 (API 23-29) - Permisos estándar
                android.util.Log.d("MainActivity", "🔵 Android 6-10 detectado - solicitando READ/WRITE_EXTERNAL_STORAGE");
                if (ContextCompat.checkSelfPermission(this, Manifest.permission.WRITE_EXTERNAL_STORAGE) 
                    != PackageManager.PERMISSION_GRANTED) {
                    ActivityCompat.requestPermissions(this,
                        new String[]{
                            Manifest.permission.READ_EXTERNAL_STORAGE,
                            Manifest.permission.WRITE_EXTERNAL_STORAGE
                        },
                        STORAGE_PERMISSION_CODE);
                } else {
                    android.util.Log.d("MainActivity", "✅ Permisos READ/WRITE_EXTERNAL_STORAGE ya concedidos");
                }
            }
        } else {
            android.util.Log.w("MainActivity", "⚠️ Activity está finishing/destroyed, no se pueden solicitar permisos");
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        
        if (requestCode == STORAGE_PERMISSION_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                // Permisos concedidos
                android.util.Log.d("MainActivity", "✅ Permisos de almacenamiento concedidos");
            } else {
                // Permisos denegados
                android.util.Log.w("MainActivity", "⚠️ Permisos de almacenamiento denegados");
            }
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        
        if (requestCode == MANAGE_EXTERNAL_STORAGE_CODE) {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                if (Environment.isExternalStorageManager()) {
                    android.util.Log.d("MainActivity", "✅ MANAGE_EXTERNAL_STORAGE concedido");
                } else {
                    android.util.Log.w("MainActivity", "⚠️ MANAGE_EXTERNAL_STORAGE denegado");
                }
            }
        }
    }
}
