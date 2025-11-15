-- Add show_3d_navigation column to virtual_tours table
ALTER TABLE virtual_tours 
ADD COLUMN show_3d_navigation boolean DEFAULT true;

COMMENT ON COLUMN virtual_tours.show_3d_navigation IS 'Controls whether 3D navigation arrows are displayed in the tour viewer';