import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Database, Download, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const DatabaseBackupButton = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerateBackup = async () => {
    setIsGenerating(true);
    
    try {
      toast.info("Generando backup completo de la base de datos...");
      
      const { data, error } = await supabase.functions.invoke('generate-db-backup', {
        method: 'POST',
      });

      if (error) throw error;

      // Create blob and download
      const blob = new Blob([data], { type: 'application/sql' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `database_backup_${new Date().toISOString().split('T')[0]}.sql`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast.success("Backup generado y descargado exitosamente");
    } catch (error) {
      console.error('Error generating backup:', error);
      toast.error("Error al generar el backup de la base de datos");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Button
      onClick={handleGenerateBackup}
      disabled={isGenerating}
      variant="outline"
      className="w-full"
    >
      {isGenerating ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Generando Backup SQL...
        </>
      ) : (
        <>
          <Database className="mr-2 h-4 w-4" />
          <Download className="mr-2 h-4 w-4" />
          Descargar Backup Completo SQL
        </>
      )}
    </Button>
  );
};
