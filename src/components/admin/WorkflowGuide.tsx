import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  UserPlus, 
  Bell, 
  CheckCircle, 
  Building2, 
  Users, 
  ArrowRight,
  Info
} from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface WorkflowGuideProps {
  variant: 'approval' | 'tenant-admin' | 'super-admin';
}

export const WorkflowGuide = ({ variant }: WorkflowGuideProps) => {
  const guides = {
    approval: {
      title: '📋 Flujo de Aprobación de Usuarios',
      description: 'Proceso paso a paso para aprobar nuevos registros',
      steps: [
        {
          icon: UserPlus,
          title: 'Usuario se Registra',
          description: 'Un usuario completa el formulario de registro en /signup',
          badge: 'Automático',
          color: 'text-blue-600 dark:text-blue-400',
        },
        {
          icon: Bell,
          title: 'Notificación Recibida',
          description: 'Todos los Super Admins reciben una notificación',
          badge: 'Automático',
          color: 'text-yellow-600 dark:text-yellow-400',
        },
        {
          icon: CheckCircle,
          title: 'Revisar y Aprobar',
          description: 'Revisa la solicitud y aprueba o rechaza al usuario',
          badge: 'Acción Requerida',
          color: 'text-green-600 dark:text-green-400',
        },
        {
          icon: Building2,
          title: 'Tenant Creado',
          description: 'Se crea automáticamente un tenant para el usuario',
          badge: 'Automático',
          color: 'text-purple-600 dark:text-purple-400',
        },
        {
          icon: Users,
          title: 'Usuario Activo',
          description: 'El usuario puede acceder y comenzar a crear tours',
          badge: 'Completado',
          color: 'text-green-600 dark:text-green-400',
        },
      ],
      tips: [
        'Los usuarios aprobados reciben una notificación automática',
        'Puedes agregar notas al aprobar o rechazar',
        'Los usuarios rechazados NO pueden volver a intentar (debes eliminar el perfil)',
      ],
    },
    'tenant-admin': {
      title: '👥 Gestión de Usuarios del Tenant',
      description: 'Cómo agregar y gestionar miembros de tu equipo',
      steps: [
        {
          icon: UserPlus,
          title: 'Usuario Debe Registrarse',
          description: 'El usuario primero debe crear su cuenta en /signup',
          badge: 'Prerequisito',
          color: 'text-blue-600 dark:text-blue-400',
        },
        {
          icon: CheckCircle,
          title: 'Super Admin Aprueba',
          description: 'Un Super Admin debe aprobar la cuenta primero',
          badge: 'Prerequisito',
          color: 'text-yellow-600 dark:text-yellow-400',
        },
        {
          icon: Users,
          title: 'Agregar al Tenant',
          description: 'Busca al usuario por email y agrégalo a tu organización',
          badge: 'Acción Requerida',
          color: 'text-green-600 dark:text-green-400',
        },
        {
          icon: Users,
          title: 'Asignar Rol',
          description: 'Elige si será Usuario básico o Tenant Admin',
          badge: 'Configurable',
          color: 'text-purple-600 dark:text-purple-400',
        },
      ],
      tips: [
        'No puedes invitar usuarios no aprobados',
        'Un usuario puede pertenecer a múltiples tenants',
        'Los Tenant Admins pueden invitar a otros usuarios',
      ],
    },
    'super-admin': {
      title: '🔧 Gestión de Tenants',
      description: 'Administración global de organizaciones',
      steps: [
        {
          icon: Building2,
          title: 'Crear Tenant',
          description: 'Crea una nueva organización manualmente si es necesario',
          badge: 'Opcional',
          color: 'text-blue-600 dark:text-blue-400',
        },
        {
          icon: Users,
          title: 'Configurar Tenant',
          description: 'Establece el plan (free, premium, etc.) y estado',
          badge: 'Configurable',
          color: 'text-yellow-600 dark:text-yellow-400',
        },
        {
          icon: CheckCircle,
          title: 'Monitorear Actividad',
          description: 'Revisa estadísticas y actividad de todos los tenants',
          badge: 'Continuo',
          color: 'text-green-600 dark:text-green-400',
        },
      ],
      tips: [
        'Los tenants se crean automáticamente al aprobar usuarios',
        'Puedes suspender tenants sin eliminarlos',
        'Usa Feature Management para habilitar/deshabilitar funcionalidades',
      ],
    },
  };

  const guide = guides[variant];

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5 text-primary" />
          {guide.title}
        </CardTitle>
        <CardDescription>{guide.description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Steps */}
        <div className="space-y-3">
          {guide.steps.map((step, index) => (
            <div key={index} className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                <div className={`w-8 h-8 rounded-full bg-muted flex items-center justify-center ${step.color}`}>
                  <step.icon className="h-4 w-4" />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm">{step.title}</span>
                  <Badge variant="outline" className="text-xs">
                    {step.badge}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{step.description}</p>
              </div>
              {index < guide.steps.length - 1 && (
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-2" />
              )}
            </div>
          ))}
        </div>

        {/* Tips */}
        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            <div className="font-medium mb-2">💡 Tips Útiles:</div>
            <ul className="space-y-1 text-sm">
              {guide.tips.map((tip, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{tip}</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
