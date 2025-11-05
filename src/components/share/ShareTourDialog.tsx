import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Copy, Link, Calendar as CalendarIcon, Check, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import SocialShareButtons from "./SocialShareButtons";

interface ShareTourDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tourId: string;
  tourTitle: string;
}

type PermissionLevel = 'view' | 'comment' | 'edit';

export default function ShareTourDialog({ open, onOpenChange, tourId, tourTitle }: ShareTourDialogProps) {
  const [permissionLevel, setPermissionLevel] = useState<PermissionLevel>('view');
  const [expiresAt, setExpiresAt] = useState<Date | undefined>();
  const [maxViews, setMaxViews] = useState<string>("");
  const [shareUrl, setShareUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);

  const generateShareLink = async () => {
    setIsGenerating(true);
    try {
      // Generate signed JWT using edge function
      const { data, error } = await supabase.functions.invoke('generate-tour-jwt', {
        body: {
          tour_id: tourId,
          permission_level: permissionLevel,
          expires_in_days: expiresAt ? Math.ceil((expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : 7,
          max_views: maxViews ? parseInt(maxViews) : null,
        }
      });

      if (error) throw error;

      setShareUrl(data.share_url);
      toast.success("¡Link seguro generado exitosamente!");
    } catch (error) {
      console.error('Error generating share link:', error);
      toast.error("Error al generar el link de compartir");
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setIsCopied(true);
      toast.success("¡Link copiado al portapapeles!");
      setTimeout(() => setIsCopied(false), 2000);
    } catch (error) {
      toast.error("Error al copiar el link");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Compartir Tour</DialogTitle>
          <DialogDescription>
            Genera un link para compartir "{tourTitle}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {!shareUrl ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="permission">Nivel de permiso</Label>
                <Select
                  value={permissionLevel}
                  onValueChange={(value) => setPermissionLevel(value as PermissionLevel)}
                >
                  <SelectTrigger id="permission">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="view">Solo vista</SelectItem>
                    <SelectItem value="comment">Vista + Comentarios</SelectItem>
                    <SelectItem value="edit">Vista + Edición</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fecha de expiración (opcional)</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !expiresAt && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {expiresAt ? format(expiresAt, "PPP") : "Sin expiración"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expiresAt}
                      onSelect={setExpiresAt}
                      disabled={(date) => date < new Date()}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <Label htmlFor="maxViews">Máximo de vistas (opcional)</Label>
                <Input
                  id="maxViews"
                  type="number"
                  placeholder="Ilimitado"
                  value={maxViews}
                  onChange={(e) => setMaxViews(e.target.value)}
                  min="1"
                />
              </div>

              <Button
                onClick={generateShareLink}
                disabled={isGenerating}
                className="w-full"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generando...
                  </>
                ) : (
                  <>
                    <Link className="mr-2 h-4 w-4" />
                    Generar Link
                  </>
                )}
              </Button>
            </>
          ) : (
            <>
              <div className="space-y-2">
                <Label>Link de compartir</Label>
                <div className="flex gap-2">
                  <Input
                    readOnly
                    value={shareUrl}
                    className="flex-1"
                  />
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={copyToClipboard}
                  >
                    {isCopied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <SocialShareButtons
                url={shareUrl}
                title={tourTitle}
                description={`Explora este increíble tour virtual: ${tourTitle}`}
              />

              <Button
                variant="outline"
                onClick={() => {
                  setShareUrl("");
                  setPermissionLevel('view');
                  setExpiresAt(undefined);
                  setMaxViews("");
                }}
                className="w-full"
              >
                Generar otro link
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}