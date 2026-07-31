'use client';
/**
 * Saguaro Control Systems — real 3D model renderer.
 * three.js WebGL viewer with orbit controls + lighting, loading GLB/glTF/OBJ
 * from a (signed) file URL. All three imports are dynamic so nothing touches
 * the server bundle. Handles load + format errors gracefully.
 */
import React, { useEffect, useRef, useState } from 'react';
import { CircleNotch, WarningCircle } from '@phosphor-icons/react';
// type-only imports are erased at build time — safe, no runtime three on server
import type * as THREE_NS from 'three';
import type { OrbitControls as OrbitControlsType } from 'three/examples/jsm/controls/OrbitControls.js';

const RENDERABLE = ['glb', 'gltf', 'obj'];

interface ModelCanvasProps {
  url: string;
  fileType: string;
  height?: number;
  background?: string;
}

export default function ModelCanvas({
  url,
  fileType,
  height = 340,
  background = '#0A0E14',
}: ModelCanvasProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errMsg, setErrMsg] = useState('');

  useEffect(() => {
    const ext = (fileType || '').toLowerCase();
    if (!RENDERABLE.includes(ext)) {
      setStatus('error');
      setErrMsg(`3D preview is not available for .${ext} files yet.`);
      return;
    }
    if (!url) {
      setStatus('error');
      setErrMsg('No model file is available to render.');
      return;
    }

    const mount = mountRef.current;
    if (!mount) return;

    let disposed = false;
    let raf = 0;
    let renderer: THREE_NS.WebGLRenderer | null = null;
    let controls: OrbitControlsType | null = null;
    let resizeObs: ResizeObserver | null = null;
    let scene: THREE_NS.Scene | null = null;

    setStatus('loading');
    setErrMsg('');

    (async () => {
      try {
        const THREE = await import('three');
        const { OrbitControls } = await import('three/examples/jsm/controls/OrbitControls.js');
        if (disposed) return; // aborted (e.g. StrictMode remount) before we built anything

        const width = mount.clientWidth || 480;

        scene = new THREE.Scene();
        scene.background = new THREE.Color(background);

        const camera = new THREE.PerspectiveCamera(50, width / height, 0.01, 100000);

        renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(width, height);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.domElement.style.display = 'block';
        renderer.domElement.style.touchAction = 'none';
        mount.appendChild(renderer.domElement);

        // Lighting — hemisphere fill + key/back directionals + ambient
        scene.add(new THREE.HemisphereLight(0xffffff, 0x24344a, 1.1));
        const key = new THREE.DirectionalLight(0xffffff, 1.5);
        key.position.set(6, 10, 8);
        scene.add(key);
        const back = new THREE.DirectionalLight(0x9db8ff, 0.5);
        back.position.set(-7, 5, -6);
        scene.add(back);
        scene.add(new THREE.AmbientLight(0xffffff, 0.35));

        const orbit = new OrbitControls(camera, renderer.domElement);
        orbit.enableDamping = true;
        orbit.dampingFactor = 0.08;
        controls = orbit;

        // Load the model by format
        let object: THREE_NS.Object3D;
        if (ext === 'obj') {
          const { OBJLoader } = await import('three/examples/jsm/loaders/OBJLoader.js');
          object = await new OBJLoader().loadAsync(url);
          // OBJ frequently ships without a bundled material — give it a visible default
          object.traverse((child) => {
            const mesh = child as THREE_NS.Mesh;
            if (mesh.isMesh) {
              mesh.material = new THREE.MeshStandardMaterial({
                color: 0xc9d4e3,
                metalness: 0.1,
                roughness: 0.75,
              });
            }
          });
        } else {
          const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
          const gltf = await new GLTFLoader().loadAsync(url);
          object = gltf.scene;
        }

        if (disposed) return;
        scene.add(object);

        // Frame the model: center it and pull the camera back to fit the bounds
        const box = new THREE.Box3().setFromObject(object);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z) || 1;

        const grid = new THREE.GridHelper(maxDim * 4, 24, 0xf59e0b, 0x1b2740);
        const gridMat = grid.material as THREE_NS.Material;
        gridMat.opacity = 0.28;
        gridMat.transparent = true;
        grid.position.set(center.x, box.min.y, center.z);
        scene.add(grid);

        const fov = (camera.fov * Math.PI) / 180;
        const dist = (maxDim / (2 * Math.tan(fov / 2))) * 1.7;
        camera.near = Math.max(dist / 1000, 0.001);
        camera.far = dist * 1000;
        camera.position.set(center.x + dist * 0.8, center.y + dist * 0.55, center.z + dist * 0.9);
        camera.updateProjectionMatrix();
        orbit.target.copy(center);
        orbit.update();

        setStatus('ready');

        const animate = () => {
          raf = requestAnimationFrame(animate);
          orbit.update();
          renderer!.render(scene!, camera);
        };
        animate();

        resizeObs = new ResizeObserver(() => {
          if (!renderer) return;
          const w = mount.clientWidth || width;
          camera.aspect = w / height;
          camera.updateProjectionMatrix();
          renderer.setSize(w, height);
        });
        resizeObs.observe(mount);
      } catch (err) {
        if (disposed) return;
        // eslint-disable-next-line no-console
        console.error('[ModelCanvas] load failed:', err);
        setErrMsg(err instanceof Error ? err.message : 'Failed to load the 3D model.');
        setStatus('error');
      }
    })();

    return () => {
      disposed = true;
      if (raf) cancelAnimationFrame(raf);
      if (resizeObs) resizeObs.disconnect();
      if (controls) controls.dispose();
      if (scene) {
        scene.traverse((obj) => {
          const mesh = obj as THREE_NS.Mesh;
          if (mesh.isMesh) {
            mesh.geometry?.dispose?.();
            const mat = mesh.material;
            if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
            else mat?.dispose?.();
          }
        });
      }
      if (renderer) {
        renderer.dispose();
        const el = renderer.domElement;
        if (el.parentNode) el.parentNode.removeChild(el);
      }
      // Belt-and-suspenders: drop any leftover canvas (e.g. an aborted async
      // mount that appended after this cleanup captured a null renderer).
      mount.querySelectorAll('canvas').forEach((c) => c.remove());
    };
  }, [url, fileType, height, background]);

  return (
    <div style={{ position: 'relative', width: '100%', height, background }}>
      <div ref={mountRef} style={{ width: '100%', height }} />
      {status !== 'ready' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            padding: 16,
            textAlign: 'center',
            pointerEvents: 'none',
          }}
        >
          {status === 'loading' && (
            <>
              <CircleNotch
                size={30}
                color="#F59E0B"
                weight="bold"
                style={{ animation: 'tkspin 0.9s linear infinite' }}
              />
              <span style={{ fontSize: 13, color: '#CBD5E1' }}>Loading 3D model…</span>
            </>
          )}
          {status === 'error' && (
            <>
              <WarningCircle size={30} color="#FF3B30" weight="fill" />
              <span style={{ fontSize: 13, color: '#CBD5E1', maxWidth: 320, lineHeight: 1.4 }}>
                {errMsg}
              </span>
            </>
          )}
        </div>
      )}
      <style>{`@keyframes tkspin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
