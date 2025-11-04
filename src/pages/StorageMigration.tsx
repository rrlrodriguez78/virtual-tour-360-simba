import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Download, Upload, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { useStorageMigration } from '@/hooks/useStorageMigration';

export default function StorageMigration() {
  const {
    isScanning,
    isMigrating,
    scanProgress,
    migrationProgress,
    filesFound,
    filesProcessed,
    filesSucceeded,
    filesFailed,
    currentFile,
    errors,
    startScan,
    startMigration,
    reset
  } = useStorageMigration();

  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Download className="h-6 w-6" />
            Migración de Storage: Lovable Cloud → Tu Supabase
          </CardTitle>
          <CardDescription>
            Migra automáticamente todos los archivos de imágenes (panoramas, floor plans, covers) 
            desde Lovable Cloud Storage a tu Supabase personal
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Status Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{filesFound}</div>
                <p className="text-xs text-muted-foreground">Archivos encontrados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{filesProcessed}</div>
                <p className="text-xs text-muted-foreground">Procesados</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-green-600">{filesSucceeded}</div>
                <p className="text-xs text-muted-foreground">Exitosos</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold text-red-600">{filesFailed}</div>
                <p className="text-xs text-muted-foreground">Fallidos</p>
              </CardContent>
            </Card>
          </div>

          {/* Scan Progress */}
          {isScanning && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Escaneando archivos en Lovable Cloud...</span>
                <span>{scanProgress}%</span>
              </div>
              <Progress value={scanProgress} />
            </div>
          )}

          {/* Migration Progress */}
          {isMigrating && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Migrando archivos...</span>
                <span>{migrationProgress}%</span>
              </div>
              <Progress value={migrationProgress} />
              {currentFile && (
                <p className="text-xs text-muted-foreground truncate">
                  Actual: {currentFile}
                </p>
              )}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-4">
            {!isScanning && !isMigrating && filesFound === 0 && (
              <Button onClick={startScan} size="lg" className="flex-1">
                <Download className="mr-2 h-4 w-4" />
                1. Escanear archivos en Lovable Cloud
              </Button>
            )}
            
            {filesFound > 0 && !isMigrating && filesProcessed === 0 && (
              <Button onClick={startMigration} size="lg" className="flex-1">
                <Upload className="mr-2 h-4 w-4" />
                2. Iniciar migración ({filesFound} archivos)
              </Button>
            )}

            {filesProcessed > 0 && (
              <Button onClick={reset} variant="outline" size="lg" className="flex-1">
                Reiniciar proceso
              </Button>
            )}
          </div>

          {/* Success Message */}
          {filesProcessed > 0 && filesProcessed === filesFound && filesFailed === 0 && (
            <Alert className="border-green-600 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                ✅ ¡Migración completada exitosamente! Todos los {filesSucceeded} archivos 
                fueron migrados y las URLs actualizadas en la base de datos.
              </AlertDescription>
            </Alert>
          )}

          {/* Partial Success */}
          {filesProcessed > 0 && filesProcessed === filesFound && filesFailed > 0 && (
            <Alert className="border-yellow-600 bg-yellow-50">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <AlertDescription className="text-yellow-800">
                ⚠️ Migración completada con errores: {filesSucceeded} exitosos, {filesFailed} fallidos.
              </AlertDescription>
            </Alert>
          )}

          {/* Errors */}
          {errors.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-600" />
                Errores encontrados:
              </h3>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {errors.map((error, index) => (
                  <Alert key={index} variant="destructive" className="py-2">
                    <AlertDescription className="text-xs">{error}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}

          {/* Instructions */}
          <div className="border-t pt-4 space-y-2 text-sm text-muted-foreground">
            <h3 className="font-semibold text-foreground">Proceso de migración:</h3>
            <ol className="list-decimal list-inside space-y-1">
              <li>Escanea todos los buckets de Storage en Lovable Cloud</li>
              <li>Descarga cada archivo temporalmente</li>
              <li>Sube el archivo a tu Supabase personal con el mismo path</li>
              <li>Actualiza las URLs en las tablas de la base de datos</li>
              <li>Limpia archivos temporales</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
