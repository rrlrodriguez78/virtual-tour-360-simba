import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { supabase } from '@/integrations/supabase/client';
import { NavigationPoint } from '@/types/tour';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { toast } from 'sonner';
import { ImageIcon } from 'lucide-react';
import { ArrowPlacementControls } from './ArrowPlacementControls';
import { useSphericalCoordinates } from '@/hooks/useSphericalCoordinates';

interface NavigationArrowPlacementEditor3DProps {
  hotspotId: string;
  panoramaUrl: string;
  existingPoints: NavigationPoint[];
  availableTargets: Array<{ id: string; title: string }>;
  currentCaptureDate: string | null;
  onSave?: () => void;
  onToggle2D?: () => void;
}

type Mode = 'view' | 'place' | 'drag';

function createArrowMesh(theta: number, phi: number, isSelected: boolean, radius: number = 480): THREE.Mesh {
  const geometry = new THREE.ConeGeometry(20, 40, 8);
  const material = new THREE.MeshBasicMaterial({ 
    color: isSelected ? 0x22c55e : 0x3b82f6,
    transparent: true,
    opacity: 0.9
  });
  const mesh = new THREE.Mesh(geometry, material);
  
  const thetaRad = THREE.MathUtils.degToRad(theta);
  const phiRad = THREE.MathUtils.degToRad(phi);
  
  const x = radius * Math.sin(phiRad) * Math.cos(thetaRad);
  const y = radius * Math.cos(phiRad);
  const z = radius * Math.sin(phiRad) * Math.sin(thetaRad);
  
  mesh.position.set(x, y, z);
  mesh.lookAt(0, 0, 0);
  mesh.rotateX(Math.PI / 2);
  
  return mesh;
}

function createTextSprite(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return new THREE.Sprite();
  
  canvas.width = 256;
  canvas.height = 64;
  
  context.fillStyle = 'rgba(0, 0, 0, 0.8)';
  context.fillRect(0, 0, canvas.width, canvas.height);
  
  context.fillStyle = 'white';
  context.font = 'bold 20px sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(100, 25, 1);
  
  return sprite;
}

function disposeObject(obj: THREE.Object3D) {
  if (obj instanceof THREE.Mesh) {
    obj.geometry?.dispose();
    if (obj.material) {
      if (Array.isArray(obj.material)) {
        obj.material.forEach(m => m.dispose());
      } else {
        obj.material.dispose();
      }
    }
  }
  obj.children.forEach(child => disposeObject(child));
}

export function NavigationArrowPlacementEditor3D({
  hotspotId,
  panoramaUrl,
  existingPoints,
  availableTargets,
  currentCaptureDate,
  onSave,
  onToggle2D
}: NavigationArrowPlacementEditor3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sphereRef = useRef<THREE.Mesh | null>(null);
  const arrowsGroupRef = useRef<THREE.Group | null>(null);
  const ghostGroupRef = useRef<THREE.Group | null>(null);
  
  const lon = useRef(0);
  const lat = useRef(0);
  const phi = useRef(0);
  const theta = useRef(0);
  const onPointerDownLon = useRef(0);
  const onPointerDownLat = useRef(0);
  const onPointerDownMouseX = useRef(0);
  const onPointerDownMouseY = useRef(0);
  const isUserInteracting = useRef(false);

  const [mode, setMode] = useState<Mode>('view');
  const [targetHotspot, setTargetHotspot] = useState<string>('');
  const [ghostPosition, setGhostPosition] = useState<{
    theta: number;
    phi: number;
    u?: number;
    v?: number;
  } | null>(null);
  const [points, setPoints] = useState<NavigationPoint[]>(existingPoints);
  const [selectedPoint, setSelectedPoint] = useState<NavigationPoint | null>(null);
  const [loading, setLoading] = useState(false);

  const { screenToUV, uvToSpherical } = useSphericalCoordinates();

  useEffect(() => {
    if (!mountRef.current) return;

    const scene = new THREE.Scene();
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 0, 0.1);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    mountRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const geometry = new THREE.SphereGeometry(500, 60, 40);
    geometry.scale(-1, 1, 1);
    
    const textureLoader = new THREE.TextureLoader();
    textureLoader.load(panoramaUrl, (texture) => {
      const material = new THREE.MeshBasicMaterial({ map: texture });
      const sphere = new THREE.Mesh(geometry, material);
      scene.add(sphere);
      sphereRef.current = sphere;
    });

    const arrowsGroup = new THREE.Group();
    scene.add(arrowsGroup);
    arrowsGroupRef.current = arrowsGroup;

    const ghostGroup = new THREE.Group();
    scene.add(ghostGroup);
    ghostGroupRef.current = ghostGroup;

    const animate = () => {
      requestAnimationFrame(animate);
      
      if (!isUserInteracting.current) {
        lon.current += 0.1;
      }

      lat.current = Math.max(-85, Math.min(85, lat.current));
      phi.current = THREE.MathUtils.degToRad(90 - lat.current);
      theta.current = THREE.MathUtils.degToRad(lon.current);

      camera.position.x = 0.1 * Math.sin(phi.current) * Math.cos(theta.current);
      camera.position.y = 0.1 * Math.cos(phi.current);
      camera.position.z = 0.1 * Math.sin(phi.current) * Math.sin(theta.current);

      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [panoramaUrl]);

  useEffect(() => {
    setPoints(existingPoints);
  }, [existingPoints]);

  useEffect(() => {
    if (!arrowsGroupRef.current) return;
    
    while (arrowsGroupRef.current.children.length > 0) {
      const child = arrowsGroupRef.current.children[0];
      arrowsGroupRef.current.remove(child);
      disposeObject(child);
    }
    
    points.forEach(point => {
      // Usar directamente theta y phi de la base de datos (igual que NavigationArrow3D.tsx)
      const theta = point.theta;
      const phi = point.phi;
      
      const arrowMesh = createArrowMesh(theta, phi, point.id === selectedPoint?.id);
      arrowsGroupRef.current?.add(arrowMesh);
      
      if (point.label || point.target_hotspot?.title) {
        const textSprite = createTextSprite(point.label || point.target_hotspot?.title || '');
        const thetaRad = THREE.MathUtils.degToRad(theta);
        const phiRad = THREE.MathUtils.degToRad(phi);
        const x = 480 * Math.sin(phiRad) * Math.cos(thetaRad);
        const y = 480 * Math.cos(phiRad);
        const z = 480 * Math.sin(phiRad) * Math.sin(thetaRad);
        textSprite.position.set(x, y, z);
        arrowsGroupRef.current?.add(textSprite);
      }
    });
  }, [points, selectedPoint, uvToSpherical]);

  useEffect(() => {
    if (!ghostGroupRef.current) return;

    while (ghostGroupRef.current.children.length > 0) {
      const child = ghostGroupRef.current.children[0];
      ghostGroupRef.current.remove(child);
      disposeObject(child);
    }

    if ((mode === 'place' || mode === 'drag') && ghostPosition) {
      const ghostArrow = createArrowMesh(ghostPosition.theta, ghostPosition.phi, true);
      ghostGroupRef.current.add(ghostArrow);
    }
  }, [mode, ghostPosition]);

  const handlePointerDown = (event: React.PointerEvent) => {
    isUserInteracting.current = true;
    onPointerDownMouseX.current = event.clientX;
    onPointerDownMouseY.current = event.clientY;
    onPointerDownLon.current = lon.current;
    onPointerDownLat.current = lat.current;
  };

  const handlePointerMove = (event: React.PointerEvent) => {
    if (isUserInteracting.current) {
      lon.current = (onPointerDownMouseX.current - event.clientX) * 0.1 + onPointerDownLon.current;
      lat.current = (event.clientY - onPointerDownMouseY.current) * 0.1 + onPointerDownLat.current;
    }

    if ((mode === 'place' || mode === 'drag') && mountRef.current && cameraRef.current) {
      const uv = screenToUV(
        event.clientX,
        event.clientY,
        cameraRef.current,
        mountRef.current
      );

      if (uv) {
        const spherical = uvToSpherical(uv);
        setGhostPosition({ ...spherical, u: uv.u, v: uv.v });
      }
    }
  };

  const handlePointerUp = async (event: React.PointerEvent) => {
    isUserInteracting.current = false;

    if (mode === 'place' && ghostPosition && targetHotspot && mountRef.current && cameraRef.current) {
      const uv = screenToUV(
        event.clientX,
        event.clientY,
        cameraRef.current,
        mountRef.current
      );

      if (uv) {
        await placeArrow(uv.u, uv.v, ghostPosition.theta, ghostPosition.phi);
        setGhostPosition(null);
      }
    }
  };

  const placeArrow = async (u: number, v: number, theta: number, phi: number) => {
    if (!targetHotspot) {
      toast.error('Selecciona un destino');
      return;
    }

    if (!currentCaptureDate) {
      toast.error('No hay fecha seleccionada');
      return;
    }

    setLoading(true);
    try {
      const target = availableTargets.find(t => t.id === targetHotspot);
      
      const { error } = await supabase
        .from('hotspot_navigation_points')
        .insert({
          from_hotspot_id: hotspotId,
          to_hotspot_id: targetHotspot,
          u,
          v,
          theta,
          phi,
          capture_date: currentCaptureDate,
          label: target?.title,
          is_active: true
        });

      if (error) throw error;

      toast.success(`✅ Flecha guardada para ${currentCaptureDate}`);
      onSave?.();
      setMode('view');
      setTargetHotspot('');
    } catch (error) {
      console.error('Error placing arrow:', error);
      toast.error('Error al colocar flecha');
    } finally {
      setLoading(false);
    }
  };

  const deleteArrow = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('hotspot_navigation_points')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('Flecha eliminada');
      setSelectedPoint(null);
      onSave?.();
    } catch (error) {
      console.error('Error deleting arrow:', error);
      toast.error('Error al eliminar flecha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr,350px] gap-4">
      <Card className="relative overflow-hidden">
        <div
          ref={mountRef}
          className="w-full h-[600px] cursor-move"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        />
        
        {loading && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-20">
            <div className="text-white">Guardando...</div>
          </div>
        )}
        
        {(mode === 'place' || mode === 'drag') && ghostPosition && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-black/90 text-white px-3 py-2 rounded text-xs z-10 font-mono max-w-[90%]">
            <div className="text-[10px] text-green-400 font-bold mb-1">
              🎯 Sistema UV Activo
            </div>
            
            {ghostPosition.u !== undefined && ghostPosition.v !== undefined && (
              <div className="flex gap-3 mb-1 text-yellow-300">
                <span>u: {ghostPosition.u.toFixed(3)}</span>
                <span>v: {ghostPosition.v.toFixed(3)}</span>
              </div>
            )}
            
            <div className="flex gap-3 text-gray-400 text-[10px]">
              <span>θ: {ghostPosition.theta.toFixed(0)}°</span>
              <span>φ: {ghostPosition.phi.toFixed(0)}°</span>
            </div>
            
            <div className="text-[10px] text-gray-500 mt-1">
              cam: {lon.current.toFixed(0)}°/{lat.current.toFixed(0)}°
            </div>
          </div>
        )}

        {onToggle2D && (
          <div className="absolute top-2 right-2 z-10">
            <Button size="sm" variant="secondary" onClick={onToggle2D}>
              <ImageIcon className="w-4 h-4 mr-1" />
              Editor 2D
            </Button>
          </div>
        )}
      </Card>

      <ArrowPlacementControls
        mode={mode}
        onModeChange={setMode}
        targetHotspot={targetHotspot}
        onTargetChange={setTargetHotspot}
        availableTargets={availableTargets}
        existingPoints={points}
        onDeletePoint={deleteArrow}
        onEditPoint={(point) => {
          setSelectedPoint(point);
          setMode('drag');
        }}
        disabled={loading}
      />
    </div>
  );
}
