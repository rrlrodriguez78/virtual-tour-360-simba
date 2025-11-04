-- Agregar columna is_published a virtual_tours si no existe
ALTER TABLE public.virtual_tours 
  ADD COLUMN IF NOT EXISTS is_published BOOLEAN DEFAULT false;