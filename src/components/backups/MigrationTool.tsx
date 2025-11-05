import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Database, Download, Upload, Loader2, ArrowRight, CheckCircle2, XCircle, AlertTriangle, Info, ShieldCheck, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  details?: any;
}

interface ValidationResult {
  status: 'ready' | 'warning' | 'blocked';
  canMigrate: boolean;
  issues: ValidationIssue[];
  summary: {
    totalIssues: number;
    errors: number;
    warnings: number;
    info: number;
    estimatedRecords: number;
    tablesWithData: number;
  };
}

export const MigrationTool = () => {
  const [step, setStep] = useState<'generate' | 'configure' | 'validate' | 'migrate' | 'complete'>('generate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isMigrating, setIsMigrating] = useState(false);
  const [backupSql, setBackupSql] = useState('');
  const [targetUrl, setTargetUrl] = useState('');
  const [targetServiceKey, setTargetServiceKey] = useState('');
  const [enableRollback, setEnableRollback] = useState(true);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);
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

  const handleValidate = async () => {
    if (!targetUrl || !targetServiceKey) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setIsValidating(true);
    
    try {
      toast.info("Validando compatibilidad...");
      
      const { data, error } = await supabase.functions.invoke('validate-migration-compatibility', {
        body: {
          targetUrl,
          targetServiceKey
        }
      });

      if (error) throw error;

      setValidationResult(data);
      setStep('validate');
      
      if (data.status === 'blocked') {
        toast.error("Validación falló: revisa los errores antes de continuar");
      } else if (data.status === 'warning') {
        toast.warning("Advertencias detectadas - revísalas antes de migrar");
      } else {
        toast.success("✅ Validación exitosa - listo para migrar");
      }
    } catch (error) {
      console.error('Error validating:', error);
      toast.error("Error al validar compatibilidad");
    } finally {
      setIsValidating(false);
    }
  };

  const handleMigrate = async () => {
    if (!targetUrl || !targetServiceKey) {
      toast.error("Por favor completa todos los campos");
      return;
    }

    setIsMigrating(true);
    
    try {
      toast.info(enableRollback 
        ? "Iniciando migración con protección de rollback..." 
        : "Iniciando migración sin rollback..."
      );
      
      const { data, error } = await supabase.functions.invoke(
        enableRollback ? 'safe-migrate-with-rollback' : 'migrate-to-supabase',
        {
          body: {
            targetUrl,
            targetServiceKey,
            sqlBackup: backupSql,
            createBackup: enableRollback
          }
        }
      );

      if (error) throw error;

      setMigrationResult(data);
      setStep('complete');
      
      if (data.success) {
        toast.success(`✅ Migración completada: ${data.stats.successful} exitosos`);
      } else if (data.rollback?.performed) {
        toast.warning("⚠️ Migración falló pero se revirtió automáticamente");
      } else {
        toast.error("❌ Migración falló");
      }
    } catch (error) {
      console.error('Error migrating:', error);
      toast.error("Error durante la migración");
    } finally {
      setIsMigrating(false);
    }
  };

  const getIssueIcon = (level: string) => {
    switch (level) {
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Info className="h-4 w-4 text-blue-500" />;
    }
  };

  const getIssueBadgeVariant = (level: string): "destructive" | "default" | "secondary" => {
    switch (level) {
      case 'error':
        return 'destructive';
      case 'warning':
        return 'default';
      default:
        return 'secondary';
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
        <div className="flex items-center justify-between mb-6 overflow-x-auto">
          <div className={`flex items-center gap-2 ${step === 'generate' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${step !== 'generate' ? 'bg-primary text-primary-foreground' : 'border-2'}`}>
              {step !== 'generate' ? <CheckCircle2 className="h-4 w-4" /> : '1'}
            </div>
            <span className="text-sm font-medium whitespace-nowrap">Generar</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mx-1" />
          <div className={`flex items-center gap-2 ${step === 'configure' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${['validate', 'migrate', 'complete'].includes(step) ? 'bg-primary text-primary-foreground' : step === 'configure' ? 'border-2' : 'bg-muted'}`}>
              {['validate', 'migrate', 'complete'].includes(step) ? <CheckCircle2 className="h-4 w-4" /> : '2'}
            </div>
            <span className="text-sm font-medium whitespace-nowrap">Configurar</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mx-1" />
          <div className={`flex items-center gap-2 ${step === 'validate' ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${['migrate', 'complete'].includes(step) ? 'bg-primary text-primary-foreground' : step === 'validate' ? 'border-2' : 'bg-muted'}`}>
              {['migrate', 'complete'].includes(step) ? <CheckCircle2 className="h-4 w-4" /> : '3'}
            </div>
            <span className="text-sm font-medium whitespace-nowrap">Validar</span>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mx-1" />
          <div className={`flex items-center gap-2 ${['migrate', 'complete'].includes(step) ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${step === 'complete' ? 'bg-primary text-primary-foreground' : step === 'migrate' ? 'border-2' : 'bg-muted'}`}>
              {step === 'complete' ? <CheckCircle2 className="h-4 w-4" /> : '4'}
            </div>
            <span className="text-sm font-medium whitespace-nowrap">Migrar</span>
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
                onClick={handleValidate}
                disabled={isValidating}
                className="flex-1"
              >
                {isValidating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Validando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Validar Compatibilidad
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Validate */}
        {step === 'validate' && validationResult && (
          <div className="space-y-4">
            <Alert className={
              validationResult.status === 'blocked' ? 'border-red-500' :
              validationResult.status === 'warning' ? 'border-yellow-500' :
              'border-green-500'
            }>
              {validationResult.status === 'blocked' ? (
                <XCircle className="h-4 w-4 text-red-500" />
              ) : validationResult.status === 'warning' ? (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              ) : (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              )}
              <AlertDescription>
                {validationResult.status === 'blocked' && 'Migración bloqueada - corrige los errores'}
                {validationResult.status === 'warning' && 'Advertencias detectadas - revisa antes de continuar'}
                {validationResult.status === 'ready' && '✅ Listo para migrar'}
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Registros a migrar:</span>
                <span className="font-medium">{validationResult.summary.estimatedRecords.toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tablas con datos en destino:</span>
                <span className="font-medium">{validationResult.summary.tablesWithData}</span>
              </div>
              <div className="flex gap-2 pt-2">
                <Badge variant="destructive">{validationResult.summary.errors} Errores</Badge>
                <Badge variant="default">{validationResult.summary.warnings} Advertencias</Badge>
                <Badge variant="secondary">{validationResult.summary.info} Info</Badge>
              </div>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              <Label>Detalles de Validación:</Label>
              {validationResult.issues.map((issue, idx) => (
                <div key={idx} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                  {getIssueIcon(issue.level)}
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={getIssueBadgeVariant(issue.level)} className="text-xs">
                        {issue.category}
                      </Badge>
                      <span className="text-sm font-medium">{issue.message}</span>
                    </div>
                    {issue.details && (
                      <pre className="text-xs text-muted-foreground mt-1 overflow-x-auto">
                        {typeof issue.details === 'string' 
                          ? issue.details 
                          : JSON.stringify(issue.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              ))}
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
                onClick={() => setStep('migrate')}
                disabled={!validationResult.canMigrate}
                className="flex-1"
              >
                {validationResult.canMigrate ? (
                  <>
                    Continuar a Migración
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                ) : (
                  <>
                    <XCircle className="mr-2 h-4 w-4" />
                    Bloqueado por Errores
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Migrate */}
        {step === 'migrate' && (
          <div className="space-y-4">
            <Alert>
              <Shield className="h-4 w-4" />
              <AlertDescription>
                <strong>Protección de Rollback:</strong> Si la migración falla, todos los cambios se revertirán automáticamente.
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg space-y-3">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Proyecto Destino:</span>
                <span className="font-mono text-sm">{new URL(targetUrl).hostname}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Tamaño del Backup:</span>
                <span>{(backupSql.length / 1024).toFixed(2)} KB</span>
              </div>
              {validationResult && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Registros estimados:</span>
                  <span>{validationResult.summary.estimatedRecords.toLocaleString()}</span>
                </div>
              )}
              
              <div className="pt-3 border-t border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield className={enableRollback ? "h-4 w-4 text-green-500" : "h-4 w-4 text-muted-foreground"} />
                    <Label htmlFor="rollback-toggle" className="cursor-pointer">
                      Rollback Automático
                    </Label>
                  </div>
                  <Switch
                    id="rollback-toggle"
                    checked={enableRollback}
                    onCheckedChange={setEnableRollback}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  {enableRollback 
                    ? "✅ Si falla, se creará un backup y se revertirán todos los cambios automáticamente"
                    : "⚠️ Sin protección - los cambios no se revertirán si falla"
                  }
                </p>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setStep('validate')}
                className="flex-1"
              >
                Volver
              </Button>
              <Button
                onClick={handleMigrate}
                disabled={isMigrating}
                className="flex-1"
                variant={enableRollback ? "default" : "destructive"}
              >
                {isMigrating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Migrando...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    {enableRollback ? "Migrar con Protección" : "Migrar sin Protección"}
                  </>
                )}
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: Complete */}
        {step === 'complete' && migrationResult && (
          <div className="space-y-4">
            <Alert className={
              migrationResult.success 
                ? 'border-green-500' 
                : migrationResult.rollback?.performed 
                  ? 'border-yellow-500' 
                  : 'border-red-500'
            }>
              {migrationResult.success ? (
                <CheckCircle2 className="h-4 w-4 text-green-500" />
              ) : migrationResult.rollback?.performed ? (
                <AlertTriangle className="h-4 w-4 text-yellow-500" />
              ) : (
                <XCircle className="h-4 w-4 text-red-500" />
              )}
              <AlertDescription>
                {migrationResult.success && 'Migración completada exitosamente'}
                {!migrationResult.success && migrationResult.rollback?.performed && (
                  <>
                    <strong>Migración falló pero se revirtió automáticamente</strong>
                    <br />
                    <span className="text-sm">Todos los cambios fueron deshechos. El proyecto destino está en su estado original.</span>
                  </>
                )}
                {!migrationResult.success && !migrationResult.rollback?.performed && 'Migración falló sin rollback'}
                {migrationResult.criticalFailure && (
                  <>
                    <br />
                    <span className="text-sm font-bold text-red-600">⚠️ ATENCIÓN: Rollback falló - se requiere intervención manual</span>
                  </>
                )}
              </AlertDescription>
            </Alert>

            <div className="bg-muted p-4 rounded-lg space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total de statements:</span>
                <span className="font-medium">{migrationResult.stats?.totalStatements || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-green-600">Exitosos:</span>
                <span className="font-medium text-green-600">{migrationResult.stats?.successful || 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-red-600">Errores:</span>
                <span className="font-medium text-red-600">{migrationResult.stats?.errors || 0}</span>
              </div>
              
              {migrationResult.rollback && (
                <>
                  <div className="pt-2 mt-2 border-t border-border">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4" />
                      <span className="font-medium">Información de Rollback:</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Rollback ejecutado:</span>
                      <Badge variant={migrationResult.rollback.performed ? "default" : "secondary"}>
                        {migrationResult.rollback.performed ? 'Sí' : 'No'}
                      </Badge>
                    </div>
                    {migrationResult.rollback.performed && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Tablas restauradas:</span>
                          <span>{migrationResult.rollback.tablesRestored || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Registros restaurados:</span>
                          <span>{migrationResult.rollback.recordsRestored || 0}</span>
                        </div>
                      </>
                    )}
                    {migrationResult.rollback.reason && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Razón: {migrationResult.rollback.reason}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {migrationResult.log && migrationResult.log.length > 0 && (
              <div className="space-y-2">
                <Label>Log de Migración:</Label>
                <Textarea
                  value={migrationResult.log.join('\n')}
                  readOnly
                  className="font-mono text-xs h-40"
                />
              </div>
            )}

            {migrationResult.stats?.errorDetails && migrationResult.stats.errorDetails.length > 0 && (
              <div className="space-y-2">
                <Label>Detalles de Errores:</Label>
                <Textarea
                  value={migrationResult.stats.errorDetails.join('\n')}
                  readOnly
                  className="font-mono text-xs h-32 text-red-600"
                />
              </div>
            )}

            <Button
              onClick={() => {
                setStep('generate');
                setBackupSql('');
                setTargetUrl('');
                setTargetServiceKey('');
                setValidationResult(null);
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
