-- Crear política RLS para permitir que usuarios anónimos vean navigation points en tours publicados
CREATE POLICY "Public can view navigation points in published tours"
ON hotspot_navigation_points
FOR SELECT
TO public
USING (
  is_active = true 
  AND EXISTS (
    SELECT 1
    FROM hotspots h
    JOIN floor_plans fp ON h.floor_plan_id = fp.id
    JOIN virtual_tours vt ON fp.tour_id = vt.id
    WHERE h.id = hotspot_navigation_points.from_hotspot_id
    AND vt.is_published = true
  )
);