import { Badge } from '@/components/ui/badge';
import { CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusBadgeProps {
  status: 'pending' | 'approved' | 'rejected' | 'active' | 'inactive' | 'suspended';
  className?: string;
  showIcon?: boolean;
}

export const StatusBadge = ({ status, className, showIcon = true }: StatusBadgeProps) => {
  const config = {
    pending: {
      label: 'Pendiente',
      icon: Clock,
      variant: 'secondary' as const,
      className: 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20',
    },
    approved: {
      label: 'Aprobado',
      icon: CheckCircle,
      variant: 'default' as const,
      className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    },
    rejected: {
      label: 'Rechazado',
      icon: XCircle,
      variant: 'destructive' as const,
      className: 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20',
    },
    active: {
      label: 'Activo',
      icon: CheckCircle,
      variant: 'default' as const,
      className: 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20',
    },
    inactive: {
      label: 'Inactivo',
      icon: AlertCircle,
      variant: 'secondary' as const,
      className: 'bg-gray-500/10 text-gray-600 dark:text-gray-400 border-gray-500/20',
    },
    suspended: {
      label: 'Suspendido',
      icon: XCircle,
      variant: 'destructive' as const,
      className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20',
    },
  };

  const { label, icon: Icon, variant, className: statusClassName } = config[status];

  return (
    <Badge variant={variant} className={cn(statusClassName, 'gap-1.5', className)}>
      {showIcon && <Icon className="h-3 w-3" />}
      {label}
    </Badge>
  );
};
