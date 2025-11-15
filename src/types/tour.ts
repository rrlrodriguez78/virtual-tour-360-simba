export interface Tour {
  id?: string;
  title: string;
  description?: string;
  is_published?: boolean;
  is_publicly_listed?: boolean;
  tenant_id?: string;
  created_at?: string;
  updated_at?: string;
  tour_type?: 'tour_360' | 'photo_tour';
  show_3d_navigation?: boolean;
}

export interface FloorPlan {
  id: string;
  name: string;
  image_url: string;
  capture_date?: string;
  height?: number;
  width?: number;
  tour_id?: string;
  created_at?: string;
}

export interface HotspotStyle {
  icon?: string;
  color?: string;
  size?: number;
}

export interface Hotspot {
  id: string;
  title: string;
  description?: string;
  x_position: number;
  y_position: number;
  first_photo_url?: string;
  has_panorama?: boolean;
  panorama_count?: number;
  floor_plan_id?: string;
  created_at?: string;
  style?: HotspotStyle;
  navigation_points?: NavigationPoint[];
}

export interface PanoramaPhoto {
  id: string;
  hotspot_id: string;
  photo_url: string;
  photo_url_mobile?: string;
  photo_url_thumbnail?: string;
  description?: string;
  display_order: number;
  capture_date?: string;
  created_at?: string;
}

export interface NavigationPoint {
  id: string;
  from_hotspot_id: string;
  to_hotspot_id: string;
  theta: number; // -180 a 180 grados
  phi: number;   // 0 a 180 grados
  u?: number;    // 0 a 1 (horizontal UV coordinate)
  v?: number;    // 0 a 1 (vertical UV coordinate)
  height_offset?: number;
  style?: {
    color?: string;
    size?: number;
    icon?: string;
  };
  label?: string;
  is_active: boolean;
  display_order?: number;
  capture_date?: string;
  created_at?: string;
  
  // Datos del hotspot destino (joined data)
  target_hotspot?: Hotspot;
}
