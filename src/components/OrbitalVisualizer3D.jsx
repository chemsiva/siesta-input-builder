import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { parseCubeFile, extractIsosurface, generateDemoOrbitalCube } from '../parser/cubeOrbitalParser.js';
import { ELEMENT_DATA, getElementInfo } from '../utils/elementData.js';
import { createSafeWebGLRenderer, disposeWebGLRenderer, purgeAllStaleWebGLContexts } from '../utils/webglHelper.js';

function hexToRgba(hex, alpha) {
  let c = (hex || '#38bdf8').replace('#', '');
  if (c.length === 3) c = c.split('').map(x => x + x).join('');
  const num = parseInt(c, 16);
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export function OrbitalVisualizer3D() {
  const mountRef = useRef(null);
  const canvas2dRef = useRef(null);
  const fileInputRef = useRef(null);

  // Active Cube data & Engine Mode
  const [engineMode, setEngineMode] = useState('webgl'); // 'webgl' | 'canvas2d'
  const [webglNotice, setWebglNotice] = useState(false);
  const [cubeData, setCubeData] = useState(() => generateDemoOrbitalCube('benzene_homo'));
  const [isovalue, setIsovalue] = useState(0.025);
  const [phaseMode, setPhaseMode] = useState('both'); // 'both' | 'positive' | 'negative'
  const [posColor, setPosColor] = useState('#38bdf8'); // Sky blue for + phase
  const [negColor, setNegColor] = useState('#f59e0b'); // Amber orange for - phase
  const [opacity, setOpacity] = useState(0.75);
  const [wireframe, setWireframe] = useState(false);
  const [showAtoms, setShowAtoms] = useState(true);
  const [showBonds, setShowBonds] = useState(true);
  const [showLabels, setShowLabels] = useState(false);
  const [showBox, setShowBox] = useState(true);
  const [zoom, setZoom] = useState(1.0);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [retryCount, setRetryCount] = useState(0);

  // 2D Canvas Interactive Rotation & Zoom State
  const [canvasRotX, setCanvasRotX] = useState(0.4);
  const [canvasRotY, setCanvasRotY] = useState(0.5);
  const [canvasZoom, setCanvasZoom] = useState(1.0);
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0, button: 0 });

  // Three.js Scene References
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const initialDistRef = useRef(1);
  const posMeshRef = useRef(null);
  const negMeshRef = useRef(null);
  const molGroupRef = useRef(null);
  const boxLineRef = useRef(null);

  // Memoized Marching Cubes Isosurfaces (shared across WebGL and 2D Canvas)
  const isosurfaceData = useMemo(() => {
    if (!cubeData) return { pos: null, neg: null };
    let pos = null;
    let neg = null;
    if (phaseMode === 'both' || phaseMode === 'positive') {
      pos = extractIsosurface(cubeData, isovalue, true);
    }
    if (phaseMode === 'both' || phaseMode === 'negative') {
      neg = extractIsosurface(cubeData, isovalue, false);
    }
    return { pos, neg };
  }, [cubeData, isovalue, phaseMode]);

  // Handle file upload
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMsg('');
    setStatusMsg(`Parsing ${file.name}...`);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = parseCubeFile(ev.target.result);
        setCubeData(parsed);
        setIsovalue(parsed.defaultIsoval);
        setStatusMsg(`Successfully loaded ${file.name} (${parsed.gridDims.join('×')} grid, ${parsed.atoms.length} atoms).`);
        setTimeout(() => setStatusMsg(''), 4000);
      } catch (err) {
        setErrorMsg(`Failed to parse ${file.name}: ${err.message}`);
        setStatusMsg('');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleLoadDemo = (type) => {
    setErrorMsg('');
    const demo = generateDemoOrbitalCube(type);
    setCubeData(demo);
    setIsovalue(demo.defaultIsoval);
    setStatusMsg(`Loaded ${demo.title}`);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ENGINE 1: Three.js WebGL Hardware-Accelerated Scene
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (engineMode !== 'webgl') return;

    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 860;
    const height = 450;
    const renderer = createSafeWebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });

    if (!renderer) {
      console.warn('WebGL context unavailable or exhausted. Auto-switching to 2D Canvas engine.');
      setEngineMode('canvas2d');
      setWebglNotice(true);
      return;
    }

    setWebglNotice(false);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    sceneRef.current = scene;

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // Lights
    const ambLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight1.position.set(20, 30, 25);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x90b0ff, 0.6);
    dirLight2.position.set(-20, -25, -20);
    scene.add(dirLight2);

    // Initial Camera Target & Distance
    const atoms = cubeData.atoms;
    let cx = 0, cy = 0, cz = 0;
    if (atoms.length > 0) {
      atoms.forEach(a => { cx += a.x; cy += a.y; cz += a.z; });
      cx /= atoms.length; cy /= atoms.length; cz /= atoms.length;
    }
    const target = new THREE.Vector3(cx, cy, cz);
    controls.target.copy(target);

    let maxDist = 4;
    atoms.forEach(a => {
      const d = Math.hypot(a.x - cx, a.y - cy, a.z - cz);
      if (d > maxDist) maxDist = d;
    });

    const camDist = Math.max(14, maxDist * 3.0);
    camera.position.set(cx, cy, cz + camDist);
    camera.lookAt(target);
    controls.update();
    initialDistRef.current = camDist;

    // Track Zoom Changes
    const updateZoom = () => {
      if (initialDistRef.current > 0 && cameraRef.current && controlsRef.current) {
        const curDist = cameraRef.current.position.distanceTo(controlsRef.current.target);
        if (curDist > 0) setZoom(parseFloat((initialDistRef.current / curDist).toFixed(2)));
      }
    };
    controls.addEventListener('change', updateZoom);

    // Animation Loop
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (controlsRef.current && rendererRef.current && cameraRef.current && sceneRef.current) {
        controlsRef.current.update();
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    const handleResize = () => {
      if (!container || !rendererRef.current || !cameraRef.current) return;
      const w = container.clientWidth || 860;
      cameraRef.current.aspect = w / height;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (controlsRef.current) {
        try {
          controlsRef.current.removeEventListener('change', updateZoom);
          controlsRef.current.dispose();
        } catch {}
      }
      disposeWebGLRenderer(renderer, container);
    };
  }, [engineMode, retryCount]);

  // Update Molecular Atoms & Bonds Geometry (WebGL)
  useEffect(() => {
    if (engineMode !== 'webgl') return;
    const scene = sceneRef.current;
    if (!scene) return;

    if (molGroupRef.current) {
      scene.remove(molGroupRef.current);
      molGroupRef.current = null;
    }

    const group = new THREE.Group();
    const atoms = cubeData.atoms;

    // Render Atoms
    if (showAtoms) {
      atoms.forEach(a => {
        const info = getElementInfo(a.symbol || a.label || a.species);
        const radius = (info.radius || 0.6) * 0.45;
        const geom = new THREE.SphereGeometry(radius, 24, 24);
        const mat = new THREE.MeshStandardMaterial({
          color: info.color || 0x94a3b8,
          roughness: 0.35,
          metalness: 0.15,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(a.x, a.y, a.z);
        group.add(mesh);
      });
    }

    // Render Chemical Bonds
    if (showBonds && atoms.length > 1) {
      const bondMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.45,
        metalness: 0.2,
      });

      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          const a1 = atoms[i];
          const a2 = atoms[j];
          const r1 = getElementInfo(a1.symbol || a1.label).radius;
          const r2 = getElementInfo(a2.symbol || a2.label).radius;
          const maxBond = (r1 + r2) * 1.25;

          const v1 = new THREE.Vector3(a1.x, a1.y, a1.z);
          const v2 = new THREE.Vector3(a2.x, a2.y, a2.z);
          const dist = v1.distanceTo(v2);

          if (dist > 0.4 && dist < maxBond) {
            const dir = new THREE.Vector3().subVectors(v2, v1);
            const cylGeom = new THREE.CylinderGeometry(0.08, 0.08, dist, 12);
            cylGeom.translate(0, dist / 2, 0);
            cylGeom.rotateX(Math.PI / 2);

            const mesh = new THREE.Mesh(cylGeom, bondMat);
            mesh.position.copy(v1);
            mesh.lookAt(v2);
            group.add(mesh);
          }
        }
      }
    }

    scene.add(group);
    molGroupRef.current = group;
  }, [engineMode, cubeData, showAtoms, showBonds]);

  // Update Bounding Grid Box (WebGL)
  useEffect(() => {
    if (engineMode !== 'webgl') return;
    const scene = sceneRef.current;
    if (!scene) return;

    if (boxLineRef.current) {
      scene.remove(boxLineRef.current);
      boxLineRef.current = null;
    }

    if (!showBox) return;

    const { origin, gridDims, voxelVectors } = cubeData;
    const [nx, ny, nz] = gridDims;
    const [vX, vY, vZ] = voxelVectors;

    const p0 = new THREE.Vector3(...origin);
    const pX = p0.clone().add(new THREE.Vector3(...vX).multiplyScalar(nx - 1));
    const pY = p0.clone().add(new THREE.Vector3(...vY).multiplyScalar(ny - 1));
    const pZ = p0.clone().add(new THREE.Vector3(...vZ).multiplyScalar(nz - 1));

    const pXY = pX.clone().add(new THREE.Vector3(...vY).multiplyScalar(ny - 1));
    const pXZ = pX.clone().add(new THREE.Vector3(...vZ).multiplyScalar(nz - 1));
    const pYZ = pY.clone().add(new THREE.Vector3(...vZ).multiplyScalar(nz - 1));
    const pXYZ = pXY.clone().add(new THREE.Vector3(...vZ).multiplyScalar(nz - 1));

    const edges = [
      [p0, pX], [p0, pY], [p0, pZ],
      [pX, pXY], [pX, pXZ],
      [pY, pXY], [pY, pYZ],
      [pZ, pXZ], [pZ, pYZ],
      [pXY, pXYZ], [pXZ, pXYZ], [pYZ, pXYZ]
    ];

    const positions = [];
    edges.forEach(([v1, v2]) => {
      positions.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z);
    });

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.LineBasicMaterial({
      color: 0x475569,
      transparent: true,
      opacity: 0.45,
    });
    const line = new THREE.LineSegments(geom, mat);
    scene.add(line);
    boxLineRef.current = line;
  }, [engineMode, cubeData, showBox]);

  // Update Isosurfaces (WebGL)
  useEffect(() => {
    if (engineMode !== 'webgl') return;
    const scene = sceneRef.current;
    if (!scene) return;

    if (posMeshRef.current) {
      scene.remove(posMeshRef.current);
      posMeshRef.current.geometry.dispose();
      posMeshRef.current = null;
    }
    if (negMeshRef.current) {
      scene.remove(negMeshRef.current);
      negMeshRef.current.geometry.dispose();
      negMeshRef.current = null;
    }

    const { pos, neg } = isosurfaceData;

    // Render Positive Lobe (+ψ)
    if (pos && pos.positions.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(pos.positions, 3));
      geom.setAttribute('normal', new THREE.BufferAttribute(pos.normals, 3));

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(posColor),
        roughness: 0.35,
        metalness: 0.1,
        transparent: true,
        opacity: opacity,
        side: THREE.DoubleSide,
        wireframe: wireframe,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geom, mat);
      scene.add(mesh);
      posMeshRef.current = mesh;
    }

    // Render Negative Lobe (-ψ)
    if (neg && neg.positions.length > 0) {
      const geom = new THREE.BufferGeometry();
      geom.setAttribute('position', new THREE.BufferAttribute(neg.positions, 3));
      geom.setAttribute('normal', new THREE.BufferAttribute(neg.normals, 3));

      const mat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(negColor),
        roughness: 0.35,
        metalness: 0.1,
        transparent: true,
        opacity: opacity,
        side: THREE.DoubleSide,
        wireframe: wireframe,
        depthWrite: false,
      });

      const mesh = new THREE.Mesh(geom, mat);
      scene.add(mesh);
      negMeshRef.current = mesh;
    }
  }, [engineMode, isosurfaceData, posColor, negColor, opacity, wireframe]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ENGINE 2: Interactive HTML5 Canvas 2D Pseudo-3D Engine
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (engineMode !== 'canvas2d') return;
    const canvas = canvas2dRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Deep slate background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, w, h);

    const atoms = cubeData.atoms || [];
    let cx = 0, cy = 0, cz = 0;
    if (atoms.length > 0) {
      atoms.forEach(a => { cx += a.x; cy += a.y; cz += a.z; });
      cx /= atoms.length; cy /= atoms.length; cz /= atoms.length;
    }

    let maxDist = 4;
    atoms.forEach(a => {
      const d = Math.hypot(a.x - cx, a.y - cy, a.z - cz);
      if (d > maxDist) maxDist = d;
    });

    const baseScale = (Math.min(w, h) * 0.42) / maxDist;
    const D = 140;

    const project = (x, y, z) => {
      const x0 = x - cx;
      const y0 = y - cy;
      const z0 = z - cz;

      const x1 = x0 * Math.cos(canvasRotY) + z0 * Math.sin(canvasRotY);
      const z1 = -x0 * Math.sin(canvasRotY) + z0 * Math.cos(canvasRotY);

      const y1 = y0 * Math.cos(canvasRotX) - z1 * Math.sin(canvasRotX);
      const z2 = y0 * Math.sin(canvasRotX) + z1 * Math.cos(canvasRotX);

      const pers = D / (D + z2);
      const sc = baseScale * canvasZoom * pers;

      return {
        sx: w / 2 + canvasPan.x + x1 * sc,
        sy: h / 2 + canvasPan.y - y1 * sc,
        depth: z2,
        scale: sc,
      };
    };

    // 1. Draw 3D Grid Box
    if (showBox) {
      const { origin, gridDims, voxelVectors } = cubeData;
      const [nx, ny, nz] = gridDims;
      const [vX, vY, vZ] = voxelVectors;

      const o = origin;
      const p0 = project(o[0], o[1], o[2]);
      const pX = project(o[0] + vX[0] * (nx - 1), o[1] + vX[1] * (nx - 1), o[2] + vX[2] * (nx - 1));
      const pY = project(o[0] + vY[0] * (ny - 1), o[1] + vY[1] * (ny - 1), o[2] + vY[2] * (ny - 1));
      const pZ = project(o[0] + vZ[0] * (nz - 1), o[1] + vZ[1] * (nz - 1), o[2] + vZ[2] * (nz - 1));

      const pXY = project(o[0] + vX[0] * (nx - 1) + vY[0] * (ny - 1), o[1] + vX[1] * (nx - 1) + vY[1] * (ny - 1), o[2] + vX[2] * (nx - 1) + vY[2] * (ny - 1));
      const pXZ = project(o[0] + vX[0] * (nx - 1) + vZ[0] * (nz - 1), o[1] + vX[1] * (nx - 1) + vZ[1] * (nz - 1), o[2] + vX[2] * (nx - 1) + vZ[2] * (nz - 1));
      const pYZ = project(o[0] + vY[0] * (ny - 1) + vZ[0] * (nz - 1), o[1] + vY[1] * (ny - 1) + vZ[1] * (nz - 1), o[2] + vY[2] * (ny - 1) + vZ[2] * (nz - 1));
      const pXYZ = project(o[0] + vX[0] * (nx - 1) + vY[0] * (ny - 1) + vZ[0] * (nz - 1), o[1] + vX[1] * (nx - 1) + vY[1] * (ny - 1) + vZ[1] * (nz - 1), o[2] + vX[2] * (nx - 1) + vY[1] * (ny - 1) + vZ[2] * (nz - 1));

      const edges = [
        [p0, pX], [p0, pY], [p0, pZ],
        [pX, pXY], [pX, pXZ],
        [pY, pXY], [pY, pYZ],
        [pZ, pXZ], [pZ, pYZ],
        [pXY, pXYZ], [pXZ, pXYZ], [pYZ, pXYZ]
      ];

      ctx.strokeStyle = 'rgba(71, 85, 105, 0.45)';
      ctx.lineWidth = 1.0;
      ctx.beginPath();
      edges.forEach(([v1, v2]) => {
        ctx.moveTo(v1.sx, v1.sy);
        ctx.lineTo(v2.sx, v2.sy);
      });
      ctx.stroke();
    }

    // 2. Prepare Draw Items
    const drawItems = [];

    // Chemical Bonds
    if (showBonds && atoms.length > 1) {
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          const a1 = atoms[i];
          const a2 = atoms[j];
          const r1 = getElementInfo(a1.symbol || a1.label).radius;
          const r2 = getElementInfo(a2.symbol || a2.label).radius;
          const maxBond = (r1 + r2) * 1.25;
          const dist = Math.hypot(a2.x - a1.x, a2.y - a1.y, a2.z - a1.z);
          if (dist > 0.4 && dist < maxBond) {
            const p1 = project(a1.x, a1.y, a1.z);
            const p2 = project(a2.x, a2.y, a2.z);
            drawItems.push({
              type: 'bond',
              depth: (p1.depth + p2.depth) / 2,
              p1,
              p2,
            });
          }
        }
      }
    }

    // Atoms
    if (showAtoms) {
      atoms.forEach(a => {
        const p = project(a.x, a.y, a.z);
        drawItems.push({
          type: 'atom',
          depth: p.depth,
          atom: a,
          p,
        });
      });
    }

    // Sampled Isosurface Triangles
    const posIso = (phaseMode === 'both' || phaseMode === 'positive') ? isosurfaceData.pos : null;
    const negIso = (phaseMode === 'both' || phaseMode === 'negative') ? isosurfaceData.neg : null;

    if (posIso && posIso.positions.length > 0) {
      const posArr = posIso.positions;
      const totalTri = posArr.length / 9;
      const sampleStep = Math.max(1, Math.floor(totalTri / 800));
      for (let i = 0; i < totalTri; i += sampleStep) {
        const idx = i * 9;
        const p1 = project(posArr[idx], posArr[idx + 1], posArr[idx + 2]);
        const p2 = project(posArr[idx + 3], posArr[idx + 4], posArr[idx + 5]);
        const p3 = project(posArr[idx + 6], posArr[idx + 7], posArr[idx + 8]);
        drawItems.push({
          type: 'pos_tri',
          depth: (p1.depth + p2.depth + p3.depth) / 3,
          p1, p2, p3,
        });
      }
    }

    if (negIso && negIso.positions.length > 0) {
      const negArr = negIso.positions;
      const totalTri = negArr.length / 9;
      const sampleStep = Math.max(1, Math.floor(totalTri / 800));
      for (let i = 0; i < totalTri; i += sampleStep) {
        const idx = i * 9;
        const p1 = project(negArr[idx], negArr[idx + 1], negArr[idx + 2]);
        const p2 = project(negArr[idx + 3], negArr[idx + 4], negArr[idx + 5]);
        const p3 = project(negArr[idx + 6], negArr[idx + 7], negArr[idx + 8]);
        drawItems.push({
          type: 'neg_tri',
          depth: (p1.depth + p2.depth + p3.depth) / 3,
          p1, p2, p3,
        });
      }
    }

    // 3. Sort back-to-front
    drawItems.sort((a, b) => b.depth - a.depth);

    // 4. Render back-to-front
    const posRgba = hexToRgba(posColor, Math.max(0.18, opacity * 0.75));
    const negRgba = hexToRgba(negColor, Math.max(0.18, opacity * 0.75));

    drawItems.forEach(item => {
      if (item.type === 'bond') {
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
        ctx.lineWidth = Math.max(1.5, 3.5 * canvasZoom * (item.p1.scale / baseScale));
        ctx.beginPath();
        ctx.moveTo(item.p1.sx, item.p1.sy);
        ctx.lineTo(item.p2.sx, item.p2.sy);
        ctx.stroke();
      } else if (item.type === 'atom') {
        const { atom, p } = item;
        const info = getElementInfo(atom.symbol || atom.label);
        const r = Math.max(5, Math.min(26, (info.radius || 0.6) * 18 * (p.scale / baseScale)));
        const hex = '#' + (info.color || 0x94a3b8).toString(16).padStart(6, '0');

        const grad = ctx.createRadialGradient(
          p.sx - r * 0.35, p.sy - r * 0.35, r * 0.1,
          p.sx, p.sy, r
        );
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.35, hex);
        grad.addColorStop(1, '#0f172a');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
        ctx.fill();

        if (showLabels) {
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 10px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(atom.symbol, p.sx, p.sy);
        }
      } else if (item.type === 'pos_tri' || item.type === 'neg_tri') {
        const isPos = item.type === 'pos_tri';
        ctx.fillStyle = isPos ? posRgba : negRgba;
        ctx.beginPath();
        ctx.moveTo(item.p1.sx, item.p1.sy);
        ctx.lineTo(item.p2.sx, item.p2.sy);
        ctx.lineTo(item.p3.sx, item.p3.sy);
        ctx.closePath();
        ctx.fill();

        if (wireframe) {
          ctx.strokeStyle = isPos ? posColor : negColor;
          ctx.lineWidth = 0.7;
          ctx.stroke();
        }
      }
    });

  }, [engineMode, cubeData, isosurfaceData, isovalue, phaseMode, posColor, negColor, opacity, wireframe, showAtoms, showBonds, showLabels, showBox, canvasRotX, canvasRotY, canvasZoom, canvasPan]);

  // 2D Canvas Mouse Handlers
  const handleMouseDown2D = (e) => {
    isDraggingRef.current = true;
    lastMouseRef.current = { x: e.clientX, y: e.clientY, button: e.button };
  };

  const handleMouseMove2D = (e) => {
    if (!isDraggingRef.current) return;
    const dx = e.clientX - lastMouseRef.current.x;
    const dy = e.clientY - lastMouseRef.current.y;
    lastMouseRef.current = { x: e.clientX, y: e.clientY, button: lastMouseRef.current.button };

    if (e.buttons === 2 || lastMouseRef.current.button === 2) {
      setCanvasPan(p => ({ x: p.x + dx, y: p.y + dy }));
    } else {
      setCanvasRotY(r => r + dx * 0.012);
      setCanvasRotX(r => Math.max(-Math.PI / 2, Math.min(Math.PI / 2, r + dy * 0.012)));
    }
  };

  const handleMouseUp2D = () => {
    isDraggingRef.current = false;
  };

  const handleWheel2D = (e) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.92 : 1.08;
    setCanvasZoom(z => {
      const next = Math.max(0.2, Math.min(6.0, z * factor));
      setZoom(parseFloat(next.toFixed(2)));
      return next;
    });
  };

  // Camera Navigation Helpers (Dual Engine)
  const zoomCamera = (factor) => {
    if (engineMode === 'webgl' && cameraRef.current && controlsRef.current) {
      const camera = cameraRef.current;
      const target = controlsRef.current.target;
      const offset = new THREE.Vector3().subVectors(camera.position, target);
      offset.multiplyScalar(factor);
      camera.position.copy(target).add(offset);
      controlsRef.current.update();
      if (initialDistRef.current > 0) {
        const curDist = camera.position.distanceTo(target);
        if (curDist > 0) setZoom(parseFloat((initialDistRef.current / curDist).toFixed(2)));
      }
    } else {
      setCanvasZoom(z => {
        const next = Math.max(0.2, Math.min(6.0, z * (factor < 1 ? 1.25 : 0.8)));
        setZoom(parseFloat(next.toFixed(2)));
        return next;
      });
    }
  };

  const resetCamera = () => {
    if (engineMode === 'webgl' && cameraRef.current && controlsRef.current) {
      const atoms = cubeData.atoms;
      let cx = 0, cy = 0, cz = 0;
      if (atoms.length > 0) {
        atoms.forEach(a => { cx += a.x; cy += a.y; cz += a.z; });
        cx /= atoms.length; cy /= atoms.length; cz /= atoms.length;
      }
      controlsRef.current.target.set(cx, cy, cz);
      const camDist = initialDistRef.current || 20;
      cameraRef.current.position.set(cx, cy, cz + camDist);
      cameraRef.current.lookAt(cx, cy, cz);
      controlsRef.current.update();
      setZoom(1.0);
    } else {
      setCanvasRotX(0.4);
      setCanvasRotY(0.5);
      setCanvasZoom(1.0);
      setCanvasPan({ x: 0, y: 0 });
      setZoom(1.0);
    }
  };

  const setViewPlane = (plane) => {
    if (engineMode === 'webgl' && cameraRef.current && controlsRef.current) {
      const target = controlsRef.current.target;
      const camDist = initialDistRef.current || 20;
      if (plane === 'xy') {
        cameraRef.current.position.set(target.x, target.y, target.z + camDist);
        cameraRef.current.up.set(0, 1, 0);
      } else if (plane === 'xz') {
        cameraRef.current.position.set(target.x, target.y - camDist, target.z + 0.001);
        cameraRef.current.up.set(0, 0, 1);
      } else if (plane === 'yz') {
        cameraRef.current.position.set(target.x + camDist, target.y, target.z + 0.001);
        cameraRef.current.up.set(0, 0, 1);
      }
      cameraRef.current.lookAt(target);
      controlsRef.current.update();
    } else {
      if (plane === 'xy') {
        setCanvasRotX(0); setCanvasRotY(0);
      } else if (plane === 'xz') {
        setCanvasRotX(-Math.PI / 2); setCanvasRotY(0);
      } else if (plane === 'yz') {
        setCanvasRotX(0); setCanvasRotY(Math.PI / 2);
      }
    }
  };

  // High-Resolution PNG Snapshot Export
  const handleExportPNG = () => {
    let url = '';
    if (engineMode === 'webgl' && rendererRef.current) {
      url = rendererRef.current.domElement.toDataURL('image/png');
    } else if (canvas2dRef.current) {
      url = canvas2dRef.current.toDataURL('image/png');
    }
    if (!url) return;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${cubeData.title.toLowerCase().replace(/[^a-z0-9_-]/g, '_')}_3d_orbital.png`;
    a.click();
  };

  return (
    <div className="subsection" style={{ marginTop: '1.2rem' }}>
      {/* Header and Title */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.6rem', marginBottom: '0.6rem' }}>
        <div>
          <div className="subsection-title" style={{ margin: 0 }}>
            3D Molecular Orbital &amp; HOMO / LUMO Isosurface Visualizer (.cube)
          </div>
          <span className="hint" style={{ fontSize: '0.74rem' }}>
            Upload any Gaussian Cube file from SIESTA (<code>denchar</code>, <code>grid2cube</code>), Quantum ESPRESSO (<code>pp.x</code>), ORCA, or Gaussian to render 3D orbital lobes with interactive isovalue thresholds.
          </span>
        </div>

        {/* Action Buttons: Upload, Demos, Snapshot, Engine Switcher */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".cube,.CUBE"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button
            type="button"
            className="btn btn-sm btn-primary"
            onClick={() => fileInputRef.current?.click()}
            title="Upload custom .cube volumetric orbital or density file">
            Upload .cube File
          </button>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', margin: '0 2px' }}>Demos:</span>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => handleLoadDemo('benzene_homo')}
            title="Load Benzene (C6H6) HOMO π-orbital">
            Benzene HOMO
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => handleLoadDemo('water_homo')}
            title="Load Water (H2O) HOMO 1b1 lone pair">
            Water HOMO
          </button>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={handleExportPNG}
            title="Download high-resolution 300 DPI PNG screenshot">
            Snapshot PNG
          </button>

          {/* Engine Mode Toggle */}
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => {
              if (engineMode === 'canvas2d') {
                purgeAllStaleWebGLContexts();
                setEngineMode('webgl');
                setRetryCount(c => c + 1);
              } else {
                setEngineMode('canvas2d');
              }
            }}
            title={engineMode === 'webgl' ? 'Switch to Safe 2D Canvas Engine' : 'Try Hardware-Accelerated 3D WebGL'}>
            {engineMode === 'webgl' ? '🖥️ 2D Canvas Engine' : '⚡ Switch to 3D WebGL'}
          </button>
        </div>
      </div>

      {statusMsg && (
        <div style={{ background: 'rgba(56, 189, 248, 0.15)', border: '1px solid rgba(56, 189, 248, 0.3)', color: '#38bdf8', padding: '0.35rem 0.6rem', borderRadius: '4px', fontSize: '0.78rem', marginBottom: '0.6rem' }}>
          {statusMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ background: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: 'var(--error, #ef4444)', padding: '0.35rem 0.6rem', borderRadius: '4px', fontSize: '0.78rem', marginBottom: '0.6rem' }}>
          {errorMsg}
        </div>
      )}

      {/* Control Ribbon: Isovalue Slider, Phase Modes, Colors, Opacity */}
      <div style={{
        background: 'var(--surface2)',
        border: '1px solid var(--border)',
        borderRadius: '6px',
        padding: '0.6rem 0.8rem',
        marginBottom: '0.8rem',
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: '0.8rem',
        fontSize: '0.75rem',
      }}>
        {/* Isovalue Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: '220px' }}>
          <span style={{ fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap' }}>
            Isovalue (C_iso):
          </span>
          <input
            type="range"
            min="0.005"
            max="0.080"
            step="0.002"
            value={isovalue}
            onChange={e => setIsovalue(parseFloat(e.target.value))}
            style={{ width: '100px', cursor: 'pointer' }}
          />
          <input
            type="number"
            step="0.002"
            className="input mono"
            style={{ width: '65px', fontSize: '0.72rem', padding: '0.1rem 0.3rem', height: '22px' }}
            value={isovalue}
            onChange={e => setIsovalue(parseFloat(e.target.value) || 0.02)}
          />
          <span style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>a.u.</span>
        </div>

        {/* Phase Selector */}
        {cubeData.isWavefunction && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--fg)', marginRight: '2px' }}>Lobe:</span>
            <button
              type="button"
              className={`btn btn-xs ${phaseMode === 'both' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPhaseMode('both')}
              style={{ padding: '0.15rem 0.4rem' }}>
              Both (+ / −)
            </button>
            <button
              type="button"
              className={`btn btn-xs ${phaseMode === 'positive' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPhaseMode('positive')}
              style={{ padding: '0.15rem 0.4rem' }}>
              + Phase
            </button>
            <button
              type="button"
              className={`btn btn-xs ${phaseMode === 'negative' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPhaseMode('negative')}
              style={{ padding: '0.15rem 0.4rem' }}>
              − Phase
            </button>
          </div>
        )}

        {/* Color Pickers */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }} title="Change Positive Phase Color (+ψ)">
            <input
              type="color"
              value={posColor}
              onChange={e => setPosColor(e.target.value)}
              style={{ width: '18px', height: '18px', border: 'none', background: 'none', cursor: 'pointer' }}
            />
            <span style={{ color: posColor, fontWeight: 700 }}>+ Lobe</span>
          </label>
          {cubeData.isWavefunction && (
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }} title="Change Negative Phase Color (-ψ)">
              <input
                type="color"
                value={negColor}
                onChange={e => setNegColor(e.target.value)}
                style={{ width: '18px', height: '18px', border: 'none', background: 'none', cursor: 'pointer' }}
              />
              <span style={{ color: negColor, fontWeight: 700 }}>− Lobe</span>
            </label>
          )}
        </div>

        {/* Opacity Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--fg)' }}>Opacity:</span>
          <input
            type="range"
            min="0.10"
            max="1.00"
            step="0.05"
            value={opacity}
            onChange={e => setOpacity(parseFloat(e.target.value))}
            style={{ width: '80px', cursor: 'pointer' }}
          />
          <span style={{ color: 'var(--muted)', fontSize: '0.7rem', width: '30px' }}>
            {Math.round(opacity * 100)}%
          </span>
        </div>

        {/* Checkbox Toggles: Wireframe, Atoms, Bonds, Box */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={wireframe}
            onChange={e => setWireframe(e.target.checked)}
          />
          <span>Wireframe</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showAtoms}
            onChange={e => setShowAtoms(e.target.checked)}
          />
          <span>Atoms</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showBonds}
            onChange={e => setShowBonds(e.target.checked)}
          />
          <span>Bonds</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={showBox}
            onChange={e => setShowBox(e.target.checked)}
          />
          <span>Grid Box</span>
        </label>
      </div>

      {/* 3D Viewport Canvas Container */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '450px',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '1px solid var(--border)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.4)',
        background: '#0f172a',
      }}>
        {/* Render Engine 1 (Three.js WebGL) or Engine 2 (Canvas 2D) */}
        {engineMode === 'webgl' ? (
          <div ref={mountRef} style={{ width: '100%', height: '100%', display: 'block' }} />
        ) : (
          <canvas
            ref={canvas2dRef}
            width={860}
            height={450}
            style={{
              width: '100%',
              height: '100%',
              display: 'block',
              cursor: isDraggingRef.current ? 'grabbing' : 'grab',
            }}
            onMouseDown={handleMouseDown2D}
            onMouseMove={handleMouseMove2D}
            onMouseUp={handleMouseUp2D}
            onMouseLeave={handleMouseUp2D}
            onWheel={handleWheel2D}
            onContextMenu={e => e.preventDefault()}
          />
        )}

        {/* Floating Top-Left Info Chip */}
        <div style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(148, 163, 184, 0.25)',
          borderRadius: '6px',
          padding: '0.35rem 0.65rem',
          fontSize: '0.72rem',
          fontFamily: 'monospace',
          color: 'var(--fg)',
          pointerEvents: 'none',
          zIndex: 5,
        }}>
          <strong style={{ color: 'var(--accent)' }}>{cubeData.title}</strong>
          <div style={{ color: 'var(--muted)', marginTop: '2px' }}>
            Grid: {cubeData.gridDims.join('×')} | {cubeData.atoms.length} atoms | Isoval: {isovalue.toFixed(3)} a.u.
          </div>
        </div>

        {/* Floating Top-Right Engine Status Badge */}
        {engineMode === 'canvas2d' && (
          <div style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'rgba(15, 23, 42, 0.92)',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '6px',
            padding: '0.3rem 0.6rem',
            fontSize: '0.72rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            zIndex: 10,
          }}>
            <span style={{ color: '#f59e0b', fontWeight: 600 }}>
              {webglNotice ? '⚡ 2D Canvas Safe Engine (WebGL GPU Unavailable)' : '⚡ 2D Canvas Engine Active'}
            </span>
            <button
              type="button"
              className="btn btn-xs btn-primary"
              onClick={() => {
                purgeAllStaleWebGLContexts();
                setEngineMode('webgl');
                setRetryCount(c => c + 1);
              }}
              style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
              Try 3D WebGL
            </button>
          </div>
        )}

        {/* Floating Bottom-Left Zoom Indicator Badge */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          left: '12px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          borderRadius: '4px',
          padding: '0.2rem 0.55rem',
          fontSize: '0.72rem',
          fontFamily: 'monospace',
          fontWeight: 700,
          color: '#38bdf8',
          pointerEvents: 'none',
          zIndex: 6,
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
        }}>
          <span style={{ color: 'var(--muted)', fontWeight: 500 }}>Zoom:</span>
          <span>{Math.round(zoom * 100)}%</span>
        </div>

        {/* Floating Bottom-Right Camera Navigation Buttons */}
        <div style={{
          position: 'absolute',
          bottom: '12px',
          right: '12px',
          display: 'flex',
          gap: '0.3rem',
          alignItems: 'center',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(148, 163, 184, 0.25)',
          borderRadius: '6px',
          padding: '0.25rem 0.45rem',
          zIndex: 6,
        }}>
          <button
            type="button"
            className="btn btn-xs btn-secondary"
            onClick={() => zoomCamera(0.82)}
            title="Zoom In (+)">
            Zoom +
          </button>
          <button
            type="button"
            className="btn btn-xs btn-secondary"
            onClick={() => zoomCamera(1.22)}
            title="Zoom Out (-)">
            Zoom -
          </button>
          <button
            type="button"
            className="btn btn-xs btn-secondary"
            onClick={resetCamera}
            title="Reset Zoom to 100% and Center Molecule">
            100% (Fit)
          </button>
          <span style={{ width: '1px', height: '14px', background: 'var(--border)', margin: '0 2px' }} />
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => setViewPlane('xy')} title="Top View (XY)">
            XY
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => setViewPlane('xz')} title="Front View (XZ)">
            XZ
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => setViewPlane('yz')} title="Side View (YZ)">
            YZ
          </button>
        </div>
      </div>
    </div>
  );
}
