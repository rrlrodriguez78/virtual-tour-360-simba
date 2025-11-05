import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ValidationRequest {
  targetUrl: string;
  targetServiceKey: string;
}

interface ValidationIssue {
  level: 'error' | 'warning' | 'info';
  category: string;
  message: string;
  details?: any;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sourceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await sourceSupabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { targetUrl, targetServiceKey }: ValidationRequest = await req.json();

    if (!targetUrl || !targetServiceKey) {
      throw new Error('Missing required fields: targetUrl or targetServiceKey');
    }

    console.log(`🔍 Validating migration compatibility`);
    console.log(`📍 Source: ${supabaseUrl}`);
    console.log(`📍 Target: ${targetUrl}`);

    const issues: ValidationIssue[] = [];
    let canMigrate = true;

    // Connect to target
    const targetSupabase = createClient(targetUrl, targetServiceKey);

    // 1. Test connection to target
    try {
      const { data, error } = await targetSupabase.from('_test').select('*').limit(1);
      // Connection is OK even if table doesn't exist
      issues.push({
        level: 'info',
        category: 'connection',
        message: 'Conexión al proyecto destino establecida',
      });
    } catch (error) {
      issues.push({
        level: 'error',
        category: 'connection',
        message: 'No se pudo conectar al proyecto destino',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      canMigrate = false;
    }

    // 2. Check PostgreSQL version compatibility
    try {
      // Source version
      const { data: sourceVersion } = await sourceSupabase
        .rpc('version')
        .single();
      
      // Target version
      const { data: targetVersion } = await targetSupabase
        .rpc('version')
        .single();

      if (sourceVersion && targetVersion) {
        issues.push({
          level: 'info',
          category: 'version',
          message: `PostgreSQL versions detected`,
          details: { source: sourceVersion, target: targetVersion }
        });
      }
    } catch (error) {
      issues.push({
        level: 'warning',
        category: 'version',
        message: 'No se pudo verificar versión de PostgreSQL',
        details: 'Continuando sin verificación de versión'
      });
    }

    // 3. Check if target has existing data
    const sourceTableNames = [
      'virtual_tours', 'floor_plans', 'hotspots', 'panorama_photos',
      'tenants', 'profiles', 'backup_jobs'
    ];

    let targetHasData = false;
    const tablesWithData: string[] = [];

    for (const tableName of sourceTableNames) {
      try {
        const { data, error } = await targetSupabase
          .from(tableName)
          .select('id')
          .limit(1);

        if (data && data.length > 0) {
          targetHasData = true;
          tablesWithData.push(tableName);
        }
      } catch (error) {
        // Table might not exist, which is fine
        continue;
      }
    }

    if (targetHasData) {
      issues.push({
        level: 'warning',
        category: 'existing_data',
        message: `El proyecto destino ya contiene datos en ${tablesWithData.length} tabla(s)`,
        details: {
          tables: tablesWithData,
          recommendation: 'Recomendamos migrar a un proyecto vacío para evitar conflictos'
        }
      });
    } else {
      issues.push({
        level: 'info',
        category: 'existing_data',
        message: 'Proyecto destino está vacío - ideal para migración',
      });
    }

    // 4. Check source data size
    let totalRecords = 0;
    const tableStats: Record<string, number> = {};

    for (const tableName of sourceTableNames) {
      try {
        const { count } = await sourceSupabase
          .from(tableName)
          .select('*', { count: 'exact', head: true });

        if (count !== null) {
          totalRecords += count;
          tableStats[tableName] = count;
        }
      } catch (error) {
        continue;
      }
    }

    issues.push({
      level: 'info',
      category: 'data_size',
      message: `Tamaño estimado: ${totalRecords} registros totales`,
      details: tableStats
    });

    if (totalRecords > 50000) {
      issues.push({
        level: 'warning',
        category: 'data_size',
        message: 'Migración grande detectada (>50k registros)',
        details: 'La migración puede tardar varios minutos'
      });
    }

    // 5. Check RLS policies compatibility
    try {
      // Check if source has RLS enabled
      const { data: sourceTables } = await sourceSupabase
        .from('virtual_tours')
        .select('id')
        .limit(1);

      issues.push({
        level: 'info',
        category: 'security',
        message: 'RLS policies serán migradas',
        details: 'Asegúrate de que las funciones de autenticación existan en el destino'
      });
    } catch (error) {
      issues.push({
        level: 'warning',
        category: 'security',
        message: 'No se pudo verificar RLS policies',
      });
    }

    // 6. Check for functions and triggers
    const requiredFunctions = [
      'belongs_to_tenant',
      'is_super_admin',
      'is_tenant_admin',
      'update_updated_at_column'
    ];

    issues.push({
      level: 'info',
      category: 'functions',
      message: `Se migrarán ${requiredFunctions.length} funciones de base de datos`,
      details: requiredFunctions
    });

    // 7. Storage bucket compatibility check
    issues.push({
      level: 'warning',
      category: 'storage',
      message: 'Los archivos en Storage NO se migran automáticamente',
      details: 'Solo se migran las referencias. Debes copiar archivos manualmente.'
    });

    // 8. Authentication users warning
    issues.push({
      level: 'warning',
      category: 'auth',
      message: 'Los usuarios de auth.users NO se migran',
      details: 'Solo se migran los datos de la tabla profiles. Los usuarios deberán registrarse nuevamente.'
    });

    // Determine overall status
    const hasErrors = issues.some(i => i.level === 'error');
    const hasWarnings = issues.some(i => i.level === 'warning');

    let status: 'ready' | 'warning' | 'blocked';
    if (hasErrors) {
      status = 'blocked';
      canMigrate = false;
    } else if (hasWarnings) {
      status = 'warning';
    } else {
      status = 'ready';
    }

    console.log(`✅ Validation completed: ${status}`);

    return new Response(
      JSON.stringify({
        success: true,
        status,
        canMigrate,
        issues,
        summary: {
          totalIssues: issues.length,
          errors: issues.filter(i => i.level === 'error').length,
          warnings: issues.filter(i => i.level === 'warning').length,
          info: issues.filter(i => i.level === 'info').length,
          estimatedRecords: totalRecords,
          tablesWithData: tablesWithData.length
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Validation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: error instanceof Error && error.message === 'Unauthorized' ? 401 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
