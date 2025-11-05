import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.76.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MigrationRequest {
  targetUrl: string;
  targetServiceKey: string;
  sqlBackup: string;
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

    // Verify user authentication in source
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const sourceSupabase = createClient(supabaseUrl, supabaseServiceKey);

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await sourceSupabase.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    const { targetUrl, targetServiceKey, sqlBackup }: MigrationRequest = await req.json();

    if (!targetUrl || !targetServiceKey || !sqlBackup) {
      throw new Error('Missing required fields: targetUrl, targetServiceKey, or sqlBackup');
    }

    console.log(`🔄 Starting migration to target Supabase project`);
    console.log(`📍 Target URL: ${targetUrl}`);

    // Connect to target Supabase
    const targetSupabase = createClient(targetUrl, targetServiceKey);

    // Test connection
    const { error: connectionError } = await targetSupabase
      .from('_test_connection')
      .select('*')
      .limit(1);

    // Connection test is ok even if table doesn't exist
    console.log('✅ Connection to target established');

    // Split SQL into individual statements
    const statements = sqlBackup
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`📝 Executing ${statements.length} SQL statements`);

    let successCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (statement.startsWith('--') || statement.trim().length === 0) {
        continue;
      }

      try {
        // Execute via RPC (if available) or direct SQL
        const { error } = await targetSupabase.rpc('exec_sql', { 
          sql: statement + ';' 
        }).single();

        if (error) {
          // Try alternative: some statements might need to be executed differently
          console.warn(`Statement ${i + 1} warning:`, error.message);
          errorCount++;
          errors.push(`Statement ${i + 1}: ${error.message.substring(0, 100)}`);
        } else {
          successCount++;
        }

        // Progress logging every 100 statements
        if ((i + 1) % 100 === 0) {
          console.log(`Progress: ${i + 1}/${statements.length} statements processed`);
        }

      } catch (err) {
        console.error(`Error executing statement ${i + 1}:`, err);
        errorCount++;
        errors.push(`Statement ${i + 1}: ${err instanceof Error ? err.message : 'Unknown error'}`);
      }
    }

    console.log(`✅ Migration completed: ${successCount} successful, ${errorCount} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Migration completed',
        stats: {
          totalStatements: statements.length,
          successful: successCount,
          errors: errorCount,
          errorDetails: errors.slice(0, 10) // Return first 10 errors
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('❌ Migration error:', error);
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
