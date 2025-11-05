import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, Download, Upload, Loader2, ArrowRight, CheckCircle2, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

export const MigrationTool = () => {
  const [step, setStep] = useState<'generate' | 'configure' | 'migrate' | 'complete'>('generate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [backupSql, setBackupSql] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [targetServiceKey, setTargetServiceKey] = useState('');
  const [migrationResult, setMigrationResult] = useState<any>(null);

  const handleGenerateBackup = async () => {
    setIsGenerating(true);
    
    try {
      toast.info("Generando backup completo (estructura + datos)...");
      
      const { data, error } = await supabase.functions.invoke('generate-full-backup', {
        method: 'POST',
      });

      if (error) throw error;

      setBackupSql(data);
      setStep('configure');
      toast.success("Backup generado exitosamente");
    } catch (error) {
      console.error('Error generating backup:', error);
      toast.error("Error al generar el backup");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadBackup = () => {
    const blob = new Blob([backupSql], { type: 'application/sql' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `full_backup_${new Date().toISOString().split('T')[0]}.sql`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    toast.success("Backup descargado");
  };

  const handleMigrate = async () => {
    if (!targetUrl || !targetServiceKey) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setIsMigrating(true);
    
    try {
      toast.info("Iniciando migración...");
      
      const { data, error } = await supabase.functions.invoke('migrate-to-supabase', {
        body: {
          targetUrl,
          targetServiceKey,
          sqlBackup: backupSql
        }
      });

      if (error) throw error;

      setMigrationResult(data);
      setStep('complete');
      
      if (data.success) {
        toast.success(`Migración completada: ${data.stats.successful} exitosos`);
      } else {
        toast.error("Migración completada con errores");
      }
    } catch (error) {
      console.error('Error migrating:', error);
      toast.error("Error durante la migración");
    } finally {
      setIsMigrating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          Herramienta de Migración Supabase
        </CardTitle>
        <CardDescription>
          Migra todo tu proyecto (estructura + datos) a otro Supabase automáticamente
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Step Indicator */}
        <div className="flex items-center justify-between mb-6">
          <div className={`flex items-center gap-2 ${step === 'generate' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step !== 'generate' ? 'bg-primary text-primary-foreground' : 'border-2'}`}>
              {step !== 'generate' ? <CheckCircle2 className="h-4 w-4" /> : '1'}
            </div>
            <span className="text-sm font-medium">Generar</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className={`flex items-center gap-2 ${step === 'configure' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step === 'complete' ? 'bg-primary text-primary-foreground' : step === 'configure' || step === 'migrate' ? 'border-2' : 'bg-muted'}`}>
              {step === 'complete' ? <CheckCircle2 className="h-4 w-4" /> : '2'}
            </div>
            <span className="text-sm font-medium">Configurar</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground" />
          <div className={`flex items-center gap-2 ${step === 'migrate' || step === 'complete' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${step === 'complete' ? 'bg-primary text-primary-foreground' : step === 'migrate' ? 'border-2' : 'bg-muted'}`}>
              {step === 'complete' ? <CheckCircle2 className="h-4 w-4" /> : '3'}
            </div>
            <span className="text-sm font-medium">Migrar</span>
          </div>
        </div>

        {/* Step 1: Generate Backup */}
        {step === 'generate' && (
          <div className="space-y-4">
            <Alert>
              <Database className="h-4 w-4" />
              <AlertDescription>
                Este backup incluirá: estructura de tablas, funciones, triggers, RLS policies y todos los datos.
              </AlertDescription>
            </Alert>
            
            <Button
              onClick={handleGenerateBackup}
              disabled={isGenerating}
              className="w-full"
              size="lg"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Generando Backup Completo...
                </>
              ) : (
                <>
                  <Database className="mr-2 h-5 w-5" />
                  Generar Backup Completo
                </>
              )}
            </Button>
          </div>
        )}

        {/* Step 2: Configure Target */}
        {step === 'configure' && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                Ingresa las credenciales del proyecto Supabase de destino. Puedes encontrarlas en Settings → API.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label htmlFor="targetUrl">URL del Proyecto Destino</Label>
              <Input
                id="targetUrl"
                placeholder="https://xxxxx.supabase.co"
                value={targetUrl}
                onChange={(e) => setTargetUrl(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="targetServiceKey">Service Role Key (Destino)</Label>
              <Input
                id="targetServiceKey"
                type="password"
                placeholder="eyJhbGci..."
                value={targetServiceKey}
                onChange={(e) => setTargetServiceKey(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                ⚠️ Nunca compartas esta clave. Se usa solo para la migración.
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={handleDownloadBackup}
                className="flex-1"
              >
                <Download className="mr-2 h-4 w-4" />
                Descargar SQL
              </Button>
              <Button
                onClick={() => setStep('migrate')}
                className="flex-1"
              >
                Continuar
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Migrate */}
        {step === 'migrate' && (
          <div className="space-y-4">
            <Alert>
              <AlertDescription>
                <strong>¿Listo para migrar?</strong> Esto copiará toda la estructura y datos al proyecto destino.
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Proyecto Destino:</span>
                <span className="font-mono">{new URL(targetUrl).hostname}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tamaño del Backup:</span>
                <span>{(backupSql.length / 1024).toFixed(2)} KB</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('configure')}
                className="flex-1"
              >
                Volver
              </Button>
              <Button
                onClick={handleMigrate}
                disabled={isMigrating}
                className="flex-1"
              >
                {isMigrating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Migrando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Iniciar Migración
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Complete */}
        {step === 'complete' && migrationResult && (
          <div className="space-y-4">
            <Alert className={migrationResult.stats.errors > 0 ? 'border-yellow-500' : 'border-green-500'}>
              {migrationResult.stats.errors > 0 ? (
                <XCircle className="h-4 w-4 text-yellow-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              <AlertDescription>
                {migrationResult.stats.errors > 0 
                  ? 'Migración completada con algunos errores'
                  : 'Migración completada exitosamente'}
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total de statements:</span>
                <span className="font-medium">{migrationResult.stats.totalStatements}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600">Exitosos:</span>
                <span className="font-medium text-green-600">{migrationResult.stats.successful}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-600">Errores:</span>
                <span className="font-medium text-red-600">{migrationResult.stats.errors}</span>
              </div>
            </div>

            {migrationResult.stats.errorDetails && migrationResult.stats.errorDetails.length > 0 && (
              <div className="space-y-2">
                <Label>Detalles de Errores (primeros 10):</Label>
                <Textarea
                  value={migrationResult.stats.errorDetails.join('\n')}
                  readOnly
                  className="font-mono text-xs h-32"
                />
              </div>
            )}

            <Button
              onClick={() => {
                setStep('generate');
                setBackupSql('');
                setTargetUrl('');
                setTargetServiceKey('');
                setMigrationResult(null);
              }}
              className="w-full"
            >
              Nueva Migración
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
