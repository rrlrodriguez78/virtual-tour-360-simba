import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { format } from 'date-fns';
import { enUS, es } from 'date-fns/locale';
import { useTranslation } from 'react-i18next';

interface DateSelectorProps {
  availableDates: string[];
  currentDate: string | null;
  onDateSelect: (date: string) => void;
}

export const DateSelector = ({ 
  availableDates, 
  currentDate, 
  onDateSelect 
}: DateSelectorProps) => {
  const { i18n, t } = useTranslation();
  
  const formatDate = (dateString: string) => {
    try {
      const locale = i18n.language === 'es' ? es : enUS;
      // Agregar tiempo local para evitar desfase de zona horaria
      const date = new Date(dateString + 'T00:00:00');
      return format(date, "d MMM yyyy", { locale });
    } catch {
      return dateString;
    }
  };
  
  if (availableDates.length <= 1) {
    return null; // No mostrar selector si solo hay una fecha
  }
  
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-white bg-black/60 hover:bg-black/80 backdrop-blur-sm border border-white/20"
        >
          <Calendar className="w-4 h-4 mr-2" />
          {currentDate ? formatDate(currentDate) : t('viewer.selectDate')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent 
        align="end" 
        className="bg-black/95 backdrop-blur-sm border-white/20"
      >
        {availableDates.map((date) => (
          <DropdownMenuItem
            key={date}
            onClick={() => onDateSelect(date)}
            className={`text-white cursor-pointer ${
              date === currentDate ? 'bg-white/20' : 'hover:bg-white/10'
            }`}
          >
            <Calendar className="w-4 h-4 mr-2" />
            {formatDate(date)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
