import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Clock, MapPin, Monitor } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface AccessLog {
  id: string;
  user_id: string;
  access_type: 'allowed' | 'denied';
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export const SettingsAccessAudit = () => {
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAccessLogs();
  }, []);

  const loadAccessLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('settings_access_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setLogs((data || []) as AccessLog[]);
    } catch (error) {
      console.error('Error loading access logs:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Registro de Auditoría</CardTitle>
          <CardDescription>Cargando historial de accesos...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          <CardTitle>Registro de Auditoría de Accesos</CardTitle>
        </div>
        <CardDescription>
          Historial de accesos a la página de Settings
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No hay registros de acceso disponibles
            </p>
          ) : (
            <div className="space-y-4">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-3 p-4 rounded-lg border bg-card"
                >
                  <div className={`mt-1 ${log.access_type === 'allowed' ? 'text-green-500' : 'text-red-500'}`}>
                    <Shield className="h-5 w-5" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center justify-between">
                      <Badge variant={log.access_type === 'allowed' ? 'default' : 'destructive'}>
                        {log.access_type === 'allowed' ? 'Acceso Permitido' : 'Acceso Denegado'}
                      </Badge>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(log.created_at).toLocaleString('es-ES')}
                      </div>
                    </div>
                    {log.ip_address && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="h-3 w-3" />
                        IP: {log.ip_address}
                      </div>
                    )}
                    {log.user_agent && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Monitor className="h-3 w-3" />
                        {log.user_agent.substring(0, 60)}...
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};
