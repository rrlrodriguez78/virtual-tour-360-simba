import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TableInfo {
  table_name: string;
  column_name: string;
  data_type: string;
  is_nullable: string;
  column_default: string | null;
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
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user is authenticated
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log(`🔄 Generating database backup for user: ${user.id}`);

    let sqlDump = `-- PostgreSQL Database Backup
-- Generated: ${new Date().toISOString()}
-- Project: Virtual Tours Application
-- 
-- IMPORTANT: This is a logical backup of the public schema only.
-- Reserved schemas (auth, storage, realtime, etc.) are excluded.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;

-- Start transaction
BEGIN;

`;

    // Get all tables from public schema
    const { data: tables, error: tablesError } = await supabase
      .rpc('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public');

    if (tablesError) {
      // Fallback: get tables using information_schema
      const { data: tablesList, error: infoError } = await supabase
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public')
        .eq('table_type', 'BASE TABLE');

      if (infoError) {
        console.error('Error fetching tables:', infoError);
        
        // Manual list of known tables as fallback
        const knownTables = [
          'virtual_tours', 'floor_plans', 'hotspots', 'panorama_photos',
          'hotspot_navigation_points', 'tenants', 'tenant_users', 'profiles',
          'user_roles', 'tour_views', 'tour_analytics', 'tour_comments',
          'tour_shares', 'notifications', 'notification_settings',
          'backup_jobs', 'backup_queue', 'backup_logs', 'backup_destinations',
          'backup_sync_history', 'cloud_file_mappings', 'tour_backup_config',
          'photo_sync_queue', 'sync_jobs', 'features', 'tenant_features',
          'global_feature_config', 'user_approval_requests', 'email_logs',
          'analytics_summary', 'pages', 'commands', 'golden_rules',
          'oauth_states', 'backup_metrics', 'backup_parts',
          'backup_destination_audit', 'settings_access_logs', 'user_settings'
        ];

        sqlDump += `-- NOTE: Using fallback table list due to query restrictions\n\n`;
        
        for (const tableName of knownTables) {
          try {
            sqlDump += await generateTableBackup(supabase, tableName);
          } catch (err) {
            console.warn(`Skipping table ${tableName}:`, err);
            sqlDump += `-- Skipped table ${tableName}: ${err instanceof Error ? err.message : 'Unknown error'}\n\n`;
          }
        }
      } else {
        for (const table of tablesList || []) {
          try {
            sqlDump += await generateTableBackup(supabase, table.table_name);
          } catch (err) {
            console.warn(`Error backing up table ${table.table_name}:`, err);
            sqlDump += `-- Error backing up table ${table.table_name}\n\n`;
          }
        }
      }
    }

    sqlDump += `
-- Commit transaction
COMMIT;

-- End of backup
`;

    console.log('✅ Database backup generated successfully');

    return new Response(sqlDump, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/sql',
        'Content-Disposition': `attachment; filename="database_backup_${new Date().toISOString().split('T')[0]}.sql"`,
      },
    });

  } catch (error) {
    console.error('❌ Error generating backup:', error);
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

async function generateTableBackup(supabase: any, tableName: string): Promise<string> {
  let sql = `-- Table: ${tableName}\n`;
  
  try {
    // Get table data
    const { data: rows, error: selectError } = await supabase
      .from(tableName)
      .select('*')
      .limit(10000); // Limit to prevent timeout

    if (selectError) {
      throw selectError;
    }

    if (!rows || rows.length === 0) {
      sql += `-- No data in table ${tableName}\n\n`;
      return sql;
    }

    sql += `-- Data for table ${tableName} (${rows.length} rows)\n`;
    
    // Get column names from first row
    const columns = Object.keys(rows[0]);
    
    // Generate INSERT statements
    for (const row of rows) {
      const values = columns.map(col => {
        const value = row[col];
        
        if (value === null) {
          return 'NULL';
        } else if (typeof value === 'string') {
          return `'${value.replace(/'/g, "''")}'`;
        } else if (typeof value === 'boolean') {
          return value ? 'true' : 'false';
        } else if (typeof value === 'object') {
          return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
        } else {
          return value;
        }
      });

      sql += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
    }

    sql += `\n`;
    return sql;

  } catch (error) {
    console.error(`Error processing table ${tableName}:`, error);
    return `-- Error processing table ${tableName}: ${error instanceof Error ? error.message : 'Unknown error'}\n\n`;
  }
}
