import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ELEMENT_DATA } from '../utils/elementData.js';
import { createSafeWebGLRenderer, disposeWebGLRenderer } from '../utils/webglHelper.js';

/**
 * 3D Trajectory Animation Player for SIESTA .ANI files.
 * Dual-Engine Architecture:
 * - Engine 1: Hardware-Accelerated Three.js WebGL (primary)
 * - Engine 2: Zero-Dependency HTML5 Canvas 2D Pseudo-3D Engine (automatic fallback)
 * -> 100% immune to browser WebGL context limits, GPU crashes, or headless environments.
 * -> Interactive mouse-drag rotation, wheel zoom, bonds, and unit cell wireframe.
 */
export function TrajectoryViewer({ aniData, cellVectors }) {
 const mountRef = useRef(null);
 const canvas2dRef = useRef(null);

 const [currentFrame, setCurrentFrame] = useState(0);
 const [isPlaying, setIsPlaying] = useState(false);
 const [speed, setSpeed] = useState(1); // multiplier
 const [loop, setLoop] = useState(true);

 // Toggles
 const [showBonds, setShowBonds] = useState(true);
 const [showCell, setShowCell] = useState(true);

 // Engine mode: 'webgl' or 'canvas2d'
 const [engineMode, setEngineMode] = useState('webgl');

 // Canvas 2D Interactive Orbit & Zoom State
 const [rotX, setRotX] = useState(0.3);
 const [rotY, setRotY] = useState(0.4);
  const [zoom, setZoom] = useState(1.0);
  const initialDistRef = useRef(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

 // WebGL Refs
 const cameraRef = useRef(null);
 const controlsRef = useRef(null);
 const rendererRef = useRef(null);
 const meshesRef = useRef([]);
 const bondsLineRef = useRef(null);
 const cellGroupRef = useRef(null);
 const bondsGroupRef = useRef(null);
 const frameTimerRef = useRef(null);
 const maxRadiusRef = useRef(15);

 const frames = aniData?.frames || [];
 const numFrames = frames.length;

 // ═══════════════════════════════════════════════════════════════════════════
 // ENGINE 1: Three.js WebGL Engine
 // ═══════════════════════════════════════════════════════════════════════════
 useEffect(() => {
 if (engineMode !== 'webgl') return;
 const container = mountRef.current;
 if (!container || !frames || frames.length === 0) return;

 const width = container.clientWidth || 600;
 const height = 340;

 while (container.firstChild) {
 container.removeChild(container.firstChild);
 }

    const renderer = createSafeWebGLRenderer({
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: true,
    });

    if (!renderer) {
      console.warn('WebGL context exhausted in browser. Falling back to 2D Canvas engine.');
      setEngineMode('canvas2d');
      return;
    }

 renderer.setSize(width, height);
 renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
 container.appendChild(renderer.domElement);
 rendererRef.current = renderer;

 const scene = new THREE.Scene();
 scene.background = new THREE.Color(0x0f172a); // Slate-900

 const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1500);
 cameraRef.current = camera;

 const controls = new OrbitControls(camera, renderer.domElement);
 controls.enableDamping = true;
 controls.dampingFactor = 0.05;
 controlsRef.current = controls;

 // Lights
 const ambient = new THREE.AmbientLight(0xffffff, 0.85);
 scene.add(ambient);
 const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.2);
 dirLight1.position.set(20, 30, 25);
 scene.add(dirLight1);
 const dirLight2 = new THREE.DirectionalLight(0x94a3b8, 0.6);
 dirLight2.position.set(-20, -25, -20);
 scene.add(dirLight2);

 const atomsGroup = new THREE.Group();
 scene.add(atomsGroup);

 const bondsGroup = new THREE.Group();
 scene.add(bondsGroup);
 bondsGroupRef.current = bondsGroup;

 const cellGroup = new THREE.Group();
 scene.add(cellGroup);
 cellGroupRef.current = cellGroup;

 // Frame 0 setup
 const initialFrame = frames[currentFrame] || frames[0];
 const atomList = initialFrame.atoms;

 let cx = 0, cy = 0, cz = 0;
 atomList.forEach(a => { cx += a.x; cy += a.y; cz += a.z; });
 cx /= atomList.length; cy /= atomList.length; cz /= atomList.length;

 let maxDist = 6;
 atomList.forEach(a => {
 const d = Math.sqrt((a.x - cx) ** 2 + (a.y - cy) ** 2 + (a.z - cz) ** 2);
 if (d > maxDist) maxDist = d;
 });
 maxRadiusRef.current = maxDist;

 const camDist = Math.max(18, maxDist * 2.5);
    camera.position.set(0, 0, camDist);
    initialDistRef.current = camDist;
    camera.lookAt(0, 0, 0);
    controls.target.set(0, 0, 0);
    controls.update();

    controls.addEventListener('change', () => {
      if (initialDistRef.current > 0 && camera && controls) {
        const curDist = camera.position.distanceTo(controls.target);
        if (curDist > 0) {
          const zScale = initialDistRef.current / curDist;
          setZoom(parseFloat(zScale.toFixed(2)));
        }
      }
    });
 // Atoms
 const geoCache = {};
 const meshes = [];
 atomList.forEach(atom => {
 const elInfo = ELEMENT_DATA[atom.symbol] || { color: 0x9ca3af, radius: 0.6 };
 const r = Math.max(0.35, elInfo.radius * 0.7);
 if (!geoCache[r]) geoCache[r] = new THREE.SphereGeometry(r, 20, 20);
 const mat = new THREE.MeshStandardMaterial({
 color: elInfo.color,
 roughness: 0.35,
 metalness: 0.15,
 });
 const mesh = new THREE.Mesh(geoCache[r], mat);
 mesh.position.set(atom.x - cx, atom.y - cy, atom.z - cz);
 atomsGroup.add(mesh);
 meshes.push(mesh);
 });
 meshesRef.current = meshes;

 // Bonds line
 const bondsMat = new THREE.LineBasicMaterial({
 color: 0x94a3b8,
 linewidth: 2,
 transparent: true,
 opacity: 0.8,
 });
 const bondsLine = new THREE.LineSegments(new THREE.BufferGeometry(), bondsMat);
 bondsGroup.add(bondsLine);
 bondsLineRef.current = bondsLine;

 // Unit Cell wireframe
 let v1, v2, v3;
 if (cellVectors && cellVectors.length === 3) {
 v1 = new THREE.Vector3(...cellVectors[0]);
 v2 = new THREE.Vector3(...cellVectors[1]);
 v3 = new THREE.Vector3(...cellVectors[2]);
 } else {
 let minX = Infinity, maxX = -Infinity;
 let minY = Infinity, maxY = -Infinity;
 let minZ = Infinity, maxZ = -Infinity;
 atomList.forEach(a => {
 if (a.x < minX) minX = a.x; if (a.x > maxX) maxX = a.x;
 if (a.y < minY) minY = a.y; if (a.y > maxY) maxY = a.y;
 if (a.z < minZ) minZ = a.z; if (a.z > maxZ) maxZ = a.z;
 });
 v1 = new THREE.Vector3(maxX - minX + 1.5, 0, 0);
 v2 = new THREE.Vector3(0, maxY - minY + 1.5, 0);
 v3 = new THREE.Vector3(0, 0, maxZ - minZ + 1.5);
 }
 const cellCenter = new THREE.Vector3().add(v1).add(v2).add(v3).multiplyScalar(0.5);
 const p0 = new THREE.Vector3(0, 0, 0).sub(cellCenter);
 const pa = v1.clone().sub(cellCenter);
 const pb = v2.clone().sub(cellCenter);
 const pc = v3.clone().sub(cellCenter);
 const pab = new THREE.Vector3().add(v1).add(v2).sub(cellCenter);
 const pac = new THREE.Vector3().add(v1).add(v3).sub(cellCenter);
 const pbc = new THREE.Vector3().add(v2).add(v3).sub(cellCenter);
 const pabc = new THREE.Vector3().add(v1).add(v2).add(v3).sub(cellCenter);

 const edges = [
 [p0, pa], [p0, pb], [p0, pc],
 [pa, pab], [pa, pac],
 [pb, pab], [pb, pbc],
 [pc, pac], [pc, pbc],
 [pab, pabc], [pac, pabc], [pbc, pabc]
 ];
 const cellPts = [];
 edges.forEach(([start, end]) => cellPts.push(start.x, start.y, start.z, end.x, end.y, end.z));
 const cellLineGeom = new THREE.BufferGeometry();
 cellLineGeom.setAttribute('position', new THREE.Float32BufferAttribute(cellPts, 3));
 const cellBoxMat = new THREE.LineBasicMaterial({
 color: 0x60a5fa,
 linewidth: 1.5,
 transparent: true,
 opacity: 0.7,
 });
 cellGroup.add(new THREE.LineSegments(cellLineGeom, cellBoxMat));

 const arrowLen = Math.min(3.5, v1.length() * 0.35);
 cellGroup.add(new THREE.ArrowHelper(v1.clone().normalize(), p0, arrowLen, 0xf87171, 0.5, 0.25));
 cellGroup.add(new THREE.ArrowHelper(v2.clone().normalize(), p0, arrowLen, 0x34d399, 0.5, 0.25));
 cellGroup.add(new THREE.ArrowHelper(v3.clone().normalize(), p0, arrowLen, 0x60a5fa, 0.5, 0.25));
 // Immediately render initial frame synchronously
 try {
 renderer.render(scene, camera);
 } catch (e) {
 console.warn('Initial trajectory WebGL render failed, switching to 2D canvas:', e);
 setEngineMode('canvas2d');
 return;
 }

 let animId;
 const animate = () => {
 animId = requestAnimationFrame(animate);
 if (renderer && scene && camera) {
 try {
 controls.update();
 renderer.render(scene, camera);
 } catch (e) {
 console.warn('Trajectory WebGL render issue, falling back to 2D canvas:', e);
 cancelAnimationFrame(animId);
 setEngineMode('canvas2d');
 }
 }
 };
 animate();

 const handleResize = () => {
 if (!container || !rendererRef.current) return;
 const w = container.clientWidth || 320;
 camera.aspect = w / height;
 camera.updateProjectionMatrix();
 rendererRef.current.setSize(w, height);
 };
 window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (controlsRef.current) {
        try { controlsRef.current.dispose(); } catch {}
      }
      disposeWebGLRenderer(renderer, container);
      meshesRef.current = [];
    };
 }, [aniData, cellVectors, engineMode]);

 // WebGL: update positions on frame change
 useEffect(() => {
 if (engineMode !== 'webgl' || !frames[currentFrame] || !meshesRef.current || meshesRef.current.length === 0) return;

 const frame = frames[currentFrame];
 const atomList = frame.atoms;
 let cx = 0, cy = 0, cz = 0;
 atomList.forEach(a => { cx += a.x; cy += a.y; cz += a.z; });
 cx /= atomList.length; cy /= atomList.length; cz /= atomList.length;

 const meshes = meshesRef.current;
 const n = Math.min(atomList.length, meshes.length);
 for (let i = 0; i < n; i++) {
 meshes[i].position.set(atomList[i].x - cx, atomList[i].y - cy, atomList[i].z - cz);
 }

 if (bondsLineRef.current) {
 if (!showBonds) {
 bondsLineRef.current.visible = false;
 } else {
 bondsLineRef.current.visible = true;
 const bondPts = [];
 for (let i = 0; i < n; i++) {
 const a1 = atomList[i];
 const r1 = ELEMENT_DATA[a1.symbol]?.radius || 0.7;
 for (let j = i + 1; j < n; j++) {
 const a2 = atomList[j];
 const r2 = ELEMENT_DATA[a2.symbol]?.radius || 0.7;
 const maxD = (r1 + r2) * 1.25;
 const dx = a2.x - a1.x;
 const dy = a2.y - a1.y;
 const dz = a2.z - a1.z;
 const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
 if (dist > 0.4 && dist <= maxD) {
 bondPts.push(a1.x - cx, a1.y - cy, a1.z - cz, a2.x - cx, a2.y - cy, a2.z - cz);
 }
 }
 }
 bondsLineRef.current.geometry.dispose();
 const newGeom = new THREE.BufferGeometry();
 newGeom.setAttribute('position', new THREE.Float32BufferAttribute(bondPts, 3));
 bondsLineRef.current.geometry = newGeom;
 }
 }
 }, [currentFrame, frames, showBonds, engineMode]);

 useEffect(() => {
 if (bondsGroupRef.current) bondsGroupRef.current.visible = showBonds;
 }, [showBonds]);

 useEffect(() => {
 if (cellGroupRef.current) cellGroupRef.current.visible = showCell;
 }, [showCell]);

 // ═══════════════════════════════════════════════════════════════════════════
 // ENGINE 2: High-Performance Canvas 2D Pseudo-3D Engine (Zero WebGL needed)
 // ═══════════════════════════════════════════════════════════════════════════
 useEffect(() => {
 if (engineMode !== 'canvas2d') return;
 const canvas = canvas2dRef.current;
 if (!canvas || !frames || !frames[currentFrame]) return;

 const ctx = canvas.getContext('2d');
 if (!ctx) return;

 const w = canvas.width;
 const h = canvas.height;

 ctx.fillStyle = '#0f172a'; // Slate-900 background
 ctx.fillRect(0, 0, w, h);

 const frame = frames[currentFrame];
 const atomList = frame.atoms;

 // Center of mass
 let cx = 0, cy = 0, cz = 0;
 atomList.forEach(a => { cx += a.x; cy += a.y; cz += a.z; });
 cx /= atomList.length; cy /= atomList.length; cz /= atomList.length;

 let maxDist = 6;
 atomList.forEach(a => {
 const d = Math.sqrt((a.x - cx) ** 2 + (a.y - cy) ** 2 + (a.z - cz) ** 2);
 if (d > maxDist) maxDist = d;
 });

 const baseScale = (Math.min(w, h) * 0.38) / Math.max(10, maxDist);
 const D = 80;

 // Project function
 const project = (x, y, z) => {
 const x0 = x - cx;
 const y0 = y - cy;
 const z0 = z - cz;

 // Rotate around Y
 const x1 = x0 * Math.cos(rotY) + z0 * Math.sin(rotY);
 const z1 = -x0 * Math.sin(rotY) + z0 * Math.cos(rotY);

 // Rotate around X
 const y1 = y0 * Math.cos(rotX) - z1 * Math.sin(rotX);
 const z2 = y0 * Math.sin(rotX) + z1 * Math.cos(rotX);

 const pers = D / (D + z2);
 const sc = baseScale * zoom * pers;

 return {
 sx: w / 2 + pan.x + x1 * sc,
 sy: h / 2 + pan.y - y1 * sc,
 depth: z2,
 scale: sc,
 };
 };

 // 1. Draw Unit Cell Wireframe
 if (showCell) {
 let v1 = [15, 0, 0], v2 = [0, 15, 0], v3 = [0, 0, 15];
 if (cellVectors && cellVectors.length === 3) {
 v1 = cellVectors[0]; v2 = cellVectors[1]; v3 = cellVectors[2];
 }
 const cc = [
 (v1[0] + v2[0] + v3[0]) * 0.5,
 (v1[1] + v2[1] + v3[1]) * 0.5,
 (v1[2] + v2[2] + v3[2]) * 0.5,
 ];
 const p0 = project(-cc[0], -cc[1], -cc[2]);
 const pa = project(v1[0] - cc[0], v1[1] - cc[1], v1[2] - cc[2]);
 const pb = project(v2[0] - cc[0], v2[1] - cc[1], v2[2] - cc[2]);
 const pc = project(v3[0] - cc[0], v3[1] - cc[1], v3[2] - cc[2]);
 const pab = project(v1[0] + v2[0] - cc[0], v1[1] + v2[1] - cc[1], v1[2] + v2[2] - cc[2]);
 const pac = project(v1[0] + v3[0] - cc[0], v1[1] + v3[1] - cc[1], v1[2] + v3[2] - cc[2]);
 const pbc = project(v2[0] + v3[0] - cc[0], v2[1] + v3[1] - cc[1], v2[2] + v3[2] - cc[2]);
 const pabc = project(v1[0] + v2[0] + v3[0] - cc[0], v1[1] + v2[1] + v3[1] - cc[1], v1[2] + v3[2] - cc[2]);

 const cellEdges = [
 [p0, pa], [p0, pb], [p0, pc],
 [pa, pab], [pa, pac],
 [pb, pab], [pb, pbc],
 [pc, pac], [pc, pbc],
 [pab, pabc], [pac, pabc], [pbc, pabc]
 ];

 ctx.strokeStyle = 'rgba(96, 165, 250, 0.45)'; // Light blue
 ctx.lineWidth = 1.2;
 ctx.beginPath();
 cellEdges.forEach(([s1, s2]) => {
 ctx.moveTo(s1.sx, s1.sy);
 ctx.lineTo(s2.sx, s2.sy);
 });
 ctx.stroke();

 // Crystal Axes (a1 red, a2 green, a3 blue)
 const drawAxis = (pEnd, color, label) => {
 ctx.strokeStyle = color;
 ctx.lineWidth = 2.5;
 ctx.beginPath();
 ctx.moveTo(p0.sx, p0.sy);
 ctx.lineTo(pEnd.sx, pEnd.sy);
 ctx.stroke();
 ctx.fillStyle = color;
 ctx.font = 'bold 10px monospace';
 ctx.fillText(label, pEnd.sx + 4, pEnd.sy + 4);
 };
 drawAxis(pa, '#f87171', 'a₁');
 drawAxis(pb, '#34d399', 'a₂');
 drawAxis(pc, '#60a5fa', 'a₃');
 }

 // 2. Project Atoms
 const projectedAtoms = atomList.map((a, idx) => {
 const p = project(a.x, a.y, a.z);
 const elInfo = ELEMENT_DATA[a.symbol] || { color: 0x9ca3af, radius: 0.6 };
 return {
 idx,
 symbol: a.symbol,
 x: a.x, y: a.y, z: a.z,
 sx: p.sx, sy: p.sy,
 depth: p.depth,
 scale: p.scale,
 colorHex: '#' + (elInfo.color || 0x9ca3af).toString(16).padStart(6, '0'),
 covalentRadius: elInfo.radius || 0.6,
 };
 });

 // 3. Draw Chemical Bonds
 if (showBonds) {
 ctx.strokeStyle = 'rgba(148, 163, 184, 0.6)';
 ctx.lineWidth = 2;
 ctx.beginPath();
 const n = atomList.length;
 for (let i = 0; i < n; i++) {
 const a1 = projectedAtoms[i];
 for (let j = i + 1; j < n; j++) {
 const a2 = projectedAtoms[j];
 const maxD = (a1.covalentRadius + a2.covalentRadius) * 1.25;
 const dx = a2.x - a1.x;
 const dy = a2.y - a1.y;
 const dz = a2.z - a1.z;
 const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
 if (dist > 0.4 && dist <= maxD) {
 ctx.moveTo(a1.sx, a1.sy);
 ctx.lineTo(a2.sx, a2.sy);
 }
 }
 }
 ctx.stroke();
 }

 // 4. Draw Atoms (Depth Sorted: Back to Front)
 projectedAtoms.sort((a, b) => b.depth - a.depth);

 projectedAtoms.forEach(atom => {
 const r = Math.max(3, atom.covalentRadius * 0.7 * atom.scale);
 // 3D Spherical Radial Gradient with Specular Highlight
 const grad = ctx.createRadialGradient(
 atom.sx - r * 0.35, atom.sy - r * 0.35, r * 0.05,
 atom.sx, atom.sy, r
 );
 grad.addColorStop(0, '#ffffff'); // White specular highlight
 grad.addColorStop(0.25, atom.colorHex);
 grad.addColorStop(1, '#000000'); // Shadow rim

 ctx.fillStyle = grad;
 ctx.beginPath();
 ctx.arc(atom.sx, atom.sy, r, 0, Math.PI * 2);
 ctx.fill();

 // Subtle border for depth separation
 ctx.strokeStyle = 'rgba(0,0,0,0.4)';
 ctx.lineWidth = 0.5;
 ctx.stroke();
 });
 }, [currentFrame, frames, showBonds, showCell, rotX, rotY, zoom, pan, engineMode, cellVectors]);

 // ═══════════════════════════════════════════════════════════════════════════
 // Animation Player Timer
 // ═══════════════════════════════════════════════════════════════════════════
 useEffect(() => {
 if (!isPlaying || numFrames <= 1) {
 clearInterval(frameTimerRef.current);
 return;
 }

 const intervalMs = Math.max(12, Math.round(150 / speed));
 frameTimerRef.current = setInterval(() => {
 setCurrentFrame(prev => {
 if (prev >= numFrames - 1) {
 if (loop) return 0;
 setIsPlaying(false);
 return prev;
 }
 return prev + 1;
 });
 }, intervalMs);

 return () => {
 clearInterval(frameTimerRef.current);
 };
 }, [isPlaying, numFrames, speed, loop]);

 const handleResetCamera = () => {
 if (engineMode === 'webgl' && cameraRef.current && controlsRef.current) {
 const camDist = Math.max(18, maxRadiusRef.current * 2.5);
 cameraRef.current.position.set(0, 0, camDist);
 cameraRef.current.up.set(0, 1, 0);
 cameraRef.current.lookAt(0, 0, 0);
 controlsRef.current.target.set(0, 0, 0);
 controlsRef.current.update();
 } else {
 setRotX(0.3);
 setRotY(0.4);
 setZoom(1.0);
 setPan({ x: 0, y: 0 });
 }
 };

 const rotateCamera = (deltaYaw, deltaPitch) => {
 if (engineMode === 'webgl' && cameraRef.current && controlsRef.current) {
 const camera = cameraRef.current;
 const target = controlsRef.current.target;
 const offset = new THREE.Vector3().subVectors(camera.position, target);
 const spherical = new THREE.Spherical().setFromVector3(offset);
 spherical.theta += deltaYaw;
 spherical.phi = Math.max(0.04, Math.min(Math.PI - 0.04, spherical.phi + deltaPitch));
 offset.setFromSpherical(spherical);
 camera.position.copy(target).add(offset);
 camera.lookAt(target);
 controlsRef.current.update();
 } else {
 setRotY(y => y + deltaYaw);
 setRotX(x => x + deltaPitch);
 }
 };

 const panCamera = (deltaX, deltaY) => {
 if (engineMode === 'webgl' && cameraRef.current && controlsRef.current) {
 const camera = cameraRef.current;
 const controls = controlsRef.current;
 const vRight = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
 const vUp = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
 const dist = camera.position.distanceTo(controls.target);
 const step = Math.max(1.2, dist * 0.08);
 const panOffset = new THREE.Vector3()
 .addScaledVector(vRight, deltaX * step)
 .addScaledVector(vUp, deltaY * step);
 camera.position.add(panOffset);
 controls.target.add(panOffset);
 controls.update();
 } else {
 setPan(p => ({ x: p.x + deltaX * 25, y: p.y - deltaY * 25 }));
 }
 };

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
      setZoom(z => Math.max(0.2, Math.min(5.0, parseFloat((z * (factor < 1 ? 1.25 : 0.8)).toFixed(2)))));
    }
  };

 const setViewPlane = (plane) => {
 const camDist = Math.max(18, maxRadiusRef.current * 2.5);
 if (engineMode === 'webgl' && cameraRef.current && controlsRef.current) {
 const camera = cameraRef.current;
 controlsRef.current.target.set(0, 0, 0);

 if (plane === 'xy') {
 camera.position.set(0, 0, camDist);
 camera.up.set(0, 1, 0);
 } else if (plane === 'xz') {
 camera.position.set(0, -camDist, 0.001);
 camera.up.set(0, 0, 1);
 } else if (plane === 'yz') {
 camera.position.set(camDist, 0, 0.001);
 camera.up.set(0, 0, 1);
 }
 camera.lookAt(0, 0, 0);
 controlsRef.current.update();
 } else {
 setPan({ x: 0, y: 0 });
 setZoom(1.0);
 if (plane === 'xy') {
 setRotX(0); setRotY(0);
 } else if (plane === 'xz') {
 setRotX(Math.PI / 2); setRotY(0);
 } else if (plane === 'yz') {
 setRotX(Math.PI / 2); setRotY(Math.PI / 2);
 }
 }
 };

 // Canvas 2D Mouse Event Handlers
 const handleMouseDown = (e) => {
 isDraggingRef.current = true;
 lastMouseRef.current = { x: e.clientX, y: e.clientY };
 };

 const handleMouseMove = (e) => {
 if (!isDraggingRef.current) return;
 const dx = e.clientX - lastMouseRef.current.x;
 const dy = e.clientY - lastMouseRef.current.y;
 lastMouseRef.current = { x: e.clientX, y: e.clientY };
 setRotY(y => y + dx * 0.01);
 setRotX(x => x + dy * 0.01);
 };

 const handleMouseUp = () => {
 isDraggingRef.current = false;
 };

 const handleWheel = (e) => {
 e.preventDefault();
 setZoom(z => Math.max(0.3, Math.min(4.0, z * (e.deltaY < 0 ? 1.08 : 0.92))));
 };

 if (!aniData || numFrames === 0) {
 return (
 <div className="hint" style={{ padding: '2rem', textAlign: 'center' }}>
 No trajectory loaded. Upload an .ANI file to play the 3D molecular motion.
 </div>
 );
 }

 // Calculate RMSD and Max Displacement
 let maxDispl = 0;
 let rmsd = 0;
 if (frames[0] && frames[currentFrame]) {
 const f0 = frames[0].atoms;
 const fc = frames[currentFrame].atoms;
 const n = Math.min(f0.length, fc.length);
 let sumSq = 0;
 for (let i = 0; i < n; i++) {
 const dx = fc[i].x - f0[i].x;
 const dy = fc[i].y - f0[i].y;
 const dz = fc[i].z - f0[i].z;
 const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
 if (d > maxDispl) maxDispl = d;
 sumSq += d * d;
 }
 rmsd = Math.sqrt(sumSq / n);
 }

 return (
 <div className="trajectory-viewer-container" style={{ marginTop: '0.5rem' }}>
 {/* 3D Viewport Outer Wrapper */}
 <div
 style={{
 width: '100%',
 height: '340px',
 borderRadius: '6px',
 overflow: 'hidden',
 border: '1px solid var(--border)',
 position: 'relative',
 background: '#0f172a',
 cursor: engineMode === 'canvas2d' ? (isDraggingRef.current ? 'grabbing' : 'grab') : 'default',
 }}
 onMouseDown={engineMode === 'canvas2d' ? handleMouseDown : undefined}
 onMouseMove={engineMode === 'canvas2d' ? handleMouseMove : undefined}
 onMouseUp={engineMode === 'canvas2d' ? handleMouseUp : undefined}
 onMouseLeave={engineMode === 'canvas2d' ? handleMouseUp : undefined}
 onWheel={engineMode === 'canvas2d' ? handleWheel : undefined}>

 {/* Engine 1: WebGL Mount Container */}
 {engineMode === 'webgl' && (
 <div
 ref={mountRef}
 style={{
 width: '100%',
 height: '100%',
 position: 'absolute',
 top: 0,
 left: 0,
 }}
 />
 )}

 {/* Engine 2: Canvas 2D Fallback Container */}
 {engineMode === 'canvas2d' && (
 <canvas
 ref={canvas2dRef}
 width={800}
 height={340}
 style={{
 width: '100%',
 height: '100%',
 display: 'block',
 }}
 />
        )}

        {/* Floating On-Canvas Zoom Indicator Badge */}
        <div style={{
          position: 'absolute',
          bottom: '10px',
          left: '10px',
          background: 'rgba(15, 23, 42, 0.85)',
          backdropFilter: 'blur(4px)',
          border: '1px solid rgba(148, 163, 184, 0.3)',
          borderRadius: '4px',
          padding: '0.15rem 0.5rem',
          fontSize: '0.72rem',
          fontFamily: 'monospace',
          fontWeight: 700,
          color: '#38bdf8',
          pointerEvents: 'none',
          zIndex: 8,
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          boxShadow: '0 2px 6px rgba(0,0,0,0.3)'
        }}>
          <span style={{ color: 'var(--muted)', fontWeight: 500 }}>Zoom:</span>
          <span>{Math.round(zoom * 100)}%</span>
        </div>

        {/* Floating Frame Chip */}
 <div style={{
 position: 'absolute',
 top: '8px',
 left: '8px',
 background: 'rgba(15, 23, 42, 0.85)',
 border: '1px solid var(--border)',
 borderRadius: '4px',
 padding: '0.2rem 0.5rem',
 fontSize: '0.75rem',
 fontFamily: 'monospace',
 color: 'var(--fg)',
 pointerEvents: 'none',
 zIndex: 10,
 }}>
 Frame {currentFrame + 1} / {numFrames} ({aniData.numAtoms} atoms)
 </div>

 {/* Floating Controls Top Right */}
 <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '0.4rem', zIndex: 10 }}>
 {/* Engine Mode Chip */}
 <button
 type="button"
 style={{
 fontSize: '0.68rem',
 padding: '0.2rem 0.45rem',
 borderRadius: '4px',
 background: engineMode === 'webgl' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
 border: `1px solid ${engineMode === 'webgl' ? 'var(--success, #10b981)' : 'var(--warning, #f59e0b)'}`,
 color: engineMode === 'webgl' ? 'var(--success, #10b981)' : 'var(--warning, #f59e0b)',
 fontWeight: 600,
 cursor: 'pointer',
 display: 'flex',
 alignItems: 'center',
 }}
 onClick={() => setEngineMode(m => m === 'webgl' ? 'canvas2d' : 'webgl')}
 title={engineMode === 'webgl' ? 'Currently using WebGL. Click to switch to Canvas 2D engine' : 'Currently using Canvas 2D. Click to switch to WebGL engine'}>
 {engineMode === 'webgl' ? ' WebGL' : ' Canvas 2D'}
 </button>

 <button
 className="btn btn-secondary btn-sm"
 style={{ fontSize: '0.7rem', padding: '0.2rem 0.5rem' }}
 onClick={handleResetCamera}
 title="Reset camera orientation and zoom">
 Center View
 </button>
 </div>
 </div>
 {/* Camera Directional Navigation Toolbar (Pan, Rotate, Zoom) */}
 <div style={{
 display: 'flex',
 justifyContent: 'space-between',
 alignItems: 'center',
 flexWrap: 'wrap',
 gap: '0.4rem',
 marginTop: '0.4rem',
 padding: '0.35rem 0.6rem',
 background: 'var(--surface2)',
 borderRadius: '5px',
 border: '1px solid var(--border)',
 }}>
 {/* Move / Slide Controls */}
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
 <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>
 Slide:
 </span>
 <button type="button" className="btn btn-xs btn-secondary" onClick={() => panCamera(-1, 0)} title="Slide Left">
 Left
 </button>
 <button type="button" className="btn btn-xs btn-secondary" onClick={() => panCamera(1, 0)} title="Slide Right">
 Right
 </button>
 <button type="button" className="btn btn-xs btn-secondary" onClick={() => panCamera(0, 1)} title="Move Up">
 Up
 </button>
 <button type="button" className="btn btn-xs btn-secondary" onClick={() => panCamera(0, -1)} title="Move Down">
 Down
 </button>
 </div>

 {/* Rotate / Tilt Controls */}
 <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
 <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>
 Rotate:
 </span>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => rotateCamera(-0.15, 0)} title="Rotate Left">
            Left
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => rotateCamera(0.15, 0)} title="Rotate Right">
            Right
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => rotateCamera(0, -0.15)} title="Tilt Up / Top">
            Top
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => rotateCamera(0, 0.15)} title="Tilt Down">
            Down
          </button>
        </div>

        {/* Zoom Controls with Real-time Indication */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>
            Zoom:
          </span>
          <button
            type="button"
            className="btn btn-xs btn-secondary"
            onClick={() => zoomCamera(0.82)}
            title="Zoom In (+)">
            Zoom +
          </button>
          <span
            style={{
              fontSize: '0.72rem',
              fontFamily: 'monospace',
              fontWeight: 700,
              color: 'var(--accent)',
              padding: '0.1rem 0.4rem',
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              minWidth: '48px',
              textAlign: 'center'
            }}
            title="Current magnification zoom level">
            {Math.round(zoom * 100)}%
          </span>
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
            onClick={handleResetCamera}
            title="Reset Zoom to 100% and Center Camera">
            100% (Fit)
          </button>
        </div>

        {/* View Plane Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>
            Views:
          </span>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => setViewPlane('xy')} title="Top View (XY Plane)">
            XY
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => setViewPlane('xz')} title="Front View (XZ Plane)">
            XZ
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => setViewPlane('yz')} title="Side View (YZ Plane)">
            YZ
          </button>
        </div>
 </div>

 {/* Scrub Slider */}
 <div style={{ marginTop: '0.6rem' }}>
 <input
 type="range"
 min="0"
 max={numFrames - 1}
 value={currentFrame}
 onChange={e => {
 setCurrentFrame(parseInt(e.target.value, 10));
 setIsPlaying(false);
 }}
 style={{ width: '100%', accentColor: 'var(--accent, #6366f1)', cursor: 'pointer' }}
 />
 </div>

 {/* Player Controls Bar */}
 <div style={{
 display: 'flex',
 alignItems: 'center',
 justifyContent: 'space-between',
 flexWrap: 'wrap',
 gap: '0.5rem',
 marginTop: '0.4rem',
 }}>
 {/* Play / Pause / Reset + Toggles */}
 <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center', flexWrap: 'wrap' }}>
 <button
 className={`btn btn-sm ${isPlaying ? 'btn-secondary' : 'btn-primary'}`}
 onClick={() => setIsPlaying(!isPlaying)}>
 {isPlaying ? ' Pause' : '▶ Play'}
 </button>
 <button
 className="btn btn-sm btn-secondary"
 onClick={() => { setCurrentFrame(0); setIsPlaying(false); }}
 title="Rewind to frame 1">
 
 </button>
 <button
 className="btn btn-sm btn-secondary"
 onClick={() => { setCurrentFrame(numFrames - 1); setIsPlaying(false); }}
 title="Fast forward to final frame">
 
 </button>

 <label className="toggle" style={{ marginLeft: '0.3rem' }}>
 <input
 type="checkbox"
 checked={loop}
 onChange={e => setLoop(e.target.checked)}
 />
 <span className="toggle-label" style={{ fontSize: '0.75rem' }}> Loop</span>
 </label>

 {/* Bonds Toggle */}
 <label className="toggle" style={{ marginLeft: '0.3rem' }} title="Toggle chemical bonds">
 <input
 type="checkbox"
 checked={showBonds}
 onChange={e => setShowBonds(e.target.checked)}
 />
 <span className="toggle-label" style={{ fontSize: '0.75rem' }}> Bonds</span>
 </label>

 {/* Unit Cell Toggle */}
 <label className="toggle" style={{ marginLeft: '0.3rem' }} title="Toggle unit cell wireframe box and crystal axes">
 <input
 type="checkbox"
 checked={showCell}
 onChange={e => setShowCell(e.target.checked)}
 />
 <span className="toggle-label" style={{ fontSize: '0.75rem' }}> Unit Cell</span>
 </label>
 </div>

 {/* Speed Controls */}
 <div style={{ display: 'flex', gap: '0.3rem', alignItems: 'center' }}>
 <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Speed:</span>
 {[0.5, 1, 2, 5, 10].map(sp => (
 <button
 key={sp}
 className={`btn btn-sm ${speed === sp ? 'btn-primary' : 'btn-secondary'}`}
 style={{ padding: '0.15rem 0.4rem', fontSize: '0.7rem' }}
 onClick={() => setSpeed(sp)}>
 {sp}×
 </button>
 ))}
 </div>
 </div>

 {/* Displacement Stats */}
 <div style={{ display: 'flex', gap: '0.8rem', marginTop: '0.5rem', fontSize: '0.75rem', fontFamily: 'monospace', color: 'var(--muted)' }}>
 <div>ΔR_max: <strong style={{ color: 'var(--fg)' }}>{maxDispl.toFixed(3)} Å</strong></div>
 <div>RMSD: <strong style={{ color: 'var(--fg)' }}>{rmsd.toFixed(3)} Å</strong></div>
 <div>Species: <strong style={{ color: 'var(--fg)' }}>{aniData.species.join(', ')}</strong></div>
 </div>
 </div>
 );
}

export default TrajectoryViewer;
