// 🎯 Custom Supabase Client - Apunta a TU Supabase Personal
// Este archivo hace que TODA la app use tu Supabase (jlgqaxrgoekggcowsnzj)
// en lugar del Supabase de Lovable Cloud

import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// TU SUPABASE PERSONAL - Todas las operaciones van aquí
const YOUR_SUPABASE_URL = 'https://jlgqaxrgoekggcowsnzj.supabase.co';
const YOUR_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpsZ3FheHJnb2VrZ2djb3dzbnpqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMjA1ODAsImV4cCI6MjA3Nzc5NjU4MH0.09lv45PeQbWEwuGoT9idJ66sCHYIpt-LKpHU9lwPEkI';

// Cliente personalizado con tu Supabase
export const customSupabase = createClient<Database>(YOUR_SUPABASE_URL, YOUR_SUPABASE_ANON_KEY, {
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  }
});

// Re-exportar como 'supabase' para compatibilidad total
// Esto permite que todos los imports existentes funcionen sin cambios
export const supabase = customSupabase;

// ✅ CONFIRMACIÓN: 
// Una vez que actualices los imports para usar este archivo,
// TODAS las operaciones (tours, fotos, floor plans, hotspots, navegación)
// irán DIRECTAMENTE a tu Supabase personal (jlgqaxrgoekggcowsnzj)
// 
// No más dependencia de Lovable Cloud ✨
