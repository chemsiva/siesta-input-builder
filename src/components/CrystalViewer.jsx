import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ELEMENT_DATA } from '../utils/elementData.js';
export { ELEMENT_DATA };

function getElementInfo(labelOrZ) {
  if (!labelOrZ) return { color: 0x999999, radius: 1.0, sym: 'X' };
  const clean = String(labelOrZ).replace(/[\d+-_]/g, '').trim();
  if (ELEMENT_DATA[clean]) return { ...ELEMENT_DATA[clean], sym: clean };
  if (clean.length >= 2) {
    const candidate = clean[0].toUpperCase() + clean[1].toLowerCase();
    if (ELEMENT_DATA[candidate]) return { ...ELEMENT_DATA[candidate], sym: candidate };
  }
  if (clean.length >= 1) {
    const candidate = clean[0].toUpperCase();
    if (ELEMENT_DATA[candidate]) return { ...ELEMENT_DATA[candidate], sym: candidate };
  }
  return { color: 0x888888, radius: 1.0, sym: clean || 'X' };
}

export function CrystalViewer({ structure }) {
  const mountRef = useRef(null);
  const canvas2dRef = useRef(null);
  const [engineMode, setEngineMode] = useState('webgl'); // 'webgl' | 'canvas2d'
  const [showBonds, setShowBonds] = useState(true);
  const [showCell, setShowCell] = useState(true);
  const [supercell, setSupercell] = useState(false); // 1x1x1 vs 2x2x2
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);

  // 2D Canvas interactive rotation & zoom state
  const [rotX, setRotX] = useState(0.45);
  const [rotY, setRotY] = useState(0.65);
  const [zoom, setZoom] = useState(1.0);
  const isDraggingRef = useRef(false);
  const lastMouseRef = useRef({ x: 0, y: 0 });

  // Convert atomic coordinates to Cartesian Ångström
  const getCartesianAtoms = () => {
    if (!structure || !structure.atoms || structure.atoms.length === 0) return [];
    const lv = structure.LatticeVectors || [[1,0,0],[0,1,0],[0,0,1]];
    const format = structure.AtomicCoordinatesFormat || 'Fractional';
    const speciesMap = {};
    (structure.species || []).forEach(sp => {
      speciesMap[sp.idx] = sp.label || sp.z;
    });

    const bohrToAng = 0.52917721;
    const [lcVal] = (structure.LatticeConstant || '1.0 Ang').split(' ');
    const scale = parseFloat(lcVal) || 1.0;

    const baseAtoms = structure.atoms.map((a, i) => {
      const x = parseFloat(a.x) || 0;
      const y = parseFloat(a.y) || 0;
      const z = parseFloat(a.z) || 0;
      const spTag = speciesMap[a.species] || a.label || a.species || 'X';
      const el = getElementInfo(spTag);

      let cx = x, cy = y, cz = z;
      if (format === 'Fractional') {
        cx = (x * lv[0][0] + y * lv[1][0] + z * lv[2][0]) * scale;
        cy = (x * lv[0][1] + y * lv[1][1] + z * lv[2][1]) * scale;
        cz = (x * lv[0][2] + y * lv[1][2] + z * lv[2][2]) * scale;
      } else if (format === 'NotScaledCartesianBohr' || format === 'Bohr') {
        cx = x * bohrToAng; cy = y * bohrToAng; cz = z * bohrToAng;
      } else if (format === 'ScaledCartesian') {
        cx = x * scale; cy = y * scale; cz = z * scale;
      }

      return {
        idx: i + 1,
        x: cx,
        y: cy,
        z: cz,
        element: el.sym,
        color: el.color,
        radius: Math.max(0.35, el.radius * 0.45),
        covalentRadius: el.radius * 0.9,
      };
    });

    if (supercell && format === 'Fractional') {
      const rep = [];
      for (let ix = 0; ix < 2; ix++) {
        for (let iy = 0; iy < 2; iy++) {
          for (let iz = 0; iz < 2; iz++) {
            baseAtoms.forEach(a => {
              const dx = (ix * lv[0][0] + iy * lv[1][0] + iz * lv[2][0]) * scale;
              const dy = (ix * lv[0][1] + iy * lv[1][1] + iz * lv[2][1]) * scale;
              const dz = (ix * lv[0][2] + iy * lv[1][2] + iz * lv[2][2]) * scale;
              rep.push({
                ...a,
                x: a.x + dx,
                y: a.y + dy,
                z: a.z + dz,
              });
            });
          }
        }
      }
      return rep;
    }

    return baseAtoms;
  };

  const atoms = useMemo(() => getCartesianAtoms(), [structure, supercell]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ENGINE 1: Three.js WebGL (Hardware Accelerated with Safe Fallback)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (engineMode !== 'webgl') return;
    const container = mountRef.current;
    if (!container) return;

    container.replaceChildren();

    const width = container.clientWidth || 600;
    const height = 400;

    // Safe WebGL initialization with double fallback to prevent context crashes
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        failIfMajorPerformanceCaveat: false,
      });
    } catch {
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: false,
          alpha: false,
          failIfMajorPerformanceCaveat: false,
        });
      } catch (err2) {
        console.warn('WebGL context exhausted in browser. Falling back to 2D Canvas engine:', err2);
        setEngineMode('canvas2d');
        return;
      }
    }

    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x131620);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight1.position.set(20, 40, 30);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x90b0ff, 0.4);
    dirLight2.position.set(-20, -30, -20);
    scene.add(dirLight2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    const lv = structure.LatticeVectors || [[1,0,0],[0,1,0],[0,0,1]];
    const v1 = new THREE.Vector3(...lv[0]);
    const v2 = new THREE.Vector3(...lv[1]);
    const v3 = new THREE.Vector3(...lv[2]);
    const cellCenter = new THREE.Vector3().add(v1).add(v2).add(v3).multiplyScalar(supercell ? 1.0 : 0.5);

    // Unit cell wireframe
    if (showCell) {
      const boxMat = new THREE.LineBasicMaterial({ color: 0x4f6bba, linewidth: 1.5, transparent: true, opacity: 0.8 });
      const nx = supercell ? 2 : 1;
      const ny = supercell ? 2 : 1;
      const nz = supercell ? 2 : 1;

      const p0 = new THREE.Vector3(0, 0, 0);
      const pa = v1.clone().multiplyScalar(nx);
      const pb = v2.clone().multiplyScalar(ny);
      const pc = v3.clone().multiplyScalar(nz);

      const pab = new THREE.Vector3().add(pa).add(pb);
      const pac = new THREE.Vector3().add(pa).add(pc);
      const pbc = new THREE.Vector3().add(pb).add(pc);
      const pabc = new THREE.Vector3().add(pa).add(pb).add(pc);

      const edges = [
        [p0, pa], [p0, pb], [p0, pc],
        [pa, pab], [pa, pac],
        [pb, pab], [pb, pbc],
        [pc, pac], [pc, pbc],
        [pab, pabc], [pac, pabc], [pbc, pabc]
      ];

      const lineGeom = new THREE.BufferGeometry();
      const pts = [];
      edges.forEach(([start, end]) => {
        pts.push(start.x, start.y, start.z, end.x, end.y, end.z);
      });
      lineGeom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      scene.add(new THREE.LineSegments(lineGeom, boxMat));

      const origin = new THREE.Vector3(0, 0, 0);
      scene.add(new THREE.ArrowHelper(v1.clone().normalize(), origin, Math.min(2.5, v1.length()), 0xf87171, 0.4, 0.2));
      scene.add(new THREE.ArrowHelper(v2.clone().normalize(), origin, Math.min(2.5, v2.length()), 0x34d399, 0.4, 0.2));
      scene.add(new THREE.ArrowHelper(v3.clone().normalize(), origin, Math.min(2.5, v3.length()), 0x60a5fa, 0.4, 0.2));
    }

    // Atoms
    const sphereGeomCache = {};
    atoms.forEach(atom => {
      const r = atom.radius;
      if (!sphereGeomCache[r]) {
        sphereGeomCache[r] = new THREE.SphereGeometry(r, 20, 20);
      }
      const mat = new THREE.MeshStandardMaterial({
        color: atom.color,
        roughness: 0.35,
        metalness: 0.15,
      });
      const mesh = new THREE.Mesh(sphereGeomCache[r], mat);
      mesh.position.set(atom.x, atom.y, atom.z);
      scene.add(mesh);
    });

    // Bonds
    if (showBonds && atoms.length > 1 && atoms.length < 500) {
      const bondMat = new THREE.MeshStandardMaterial({ color: 0x71799e, roughness: 0.6 });
      const bondRadius = 0.08;

      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          const a1 = atoms[i];
          const a2 = atoms[j];
          const maxBondDist = (a1.covalentRadius + a2.covalentRadius) * 1.25;
          const dx = a2.x - a1.x;
          const dy = a2.y - a1.y;
          const dz = a2.z - a1.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist > 0.4 && dist <= maxBondDist) {
            const p1 = new THREE.Vector3(a1.x, a1.y, a1.z);
            const p2 = new THREE.Vector3(a2.x, a2.y, a2.z);
            const mid = new THREE.Vector3().addVectors(p1, p2).multiplyScalar(0.5);

            const cylGeom = new THREE.CylinderGeometry(bondRadius, bondRadius, dist, 8);
            const cyl = new THREE.Mesh(cylGeom, bondMat);
            cyl.position.copy(mid);
            cyl.quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              new THREE.Vector3().subVectors(p2, p1).normalize()
            );
            scene.add(cyl);
          }
        }
      }
    }

    const maxDim = Math.max(v1.length(), v2.length(), v3.length(), 10) * (supercell ? 1.6 : 1.2);
    camera.position.set(cellCenter.x + maxDim * 1.2, cellCenter.y + maxDim * 0.9, cellCenter.z + maxDim * 1.4);
    camera.lookAt(cellCenter);
    controls.target.copy(cellCenter);

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth || 600;
      camera.aspect = w / height;
      camera.updateProjectionMatrix();
      renderer.setSize(w, height);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      if (renderer) {
        renderer.dispose();
        renderer.forceContextLoss();
        const gl = renderer.getContext();
        if (gl && gl.getExtension('WEBGL_lose_context')) {
          gl.getExtension('WEBGL_lose_context').loseContext();
        }
      }
      container.replaceChildren();
    };
  }, [structure, showBonds, showCell, supercell, engineMode, atoms]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ENGINE 2: Interactive 2D Canvas Engine (100% immune to WebGL context limits)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (engineMode !== 'canvas2d') return;
    const canvas = canvas2dRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    ctx.fillStyle = '#131620';
    ctx.fillRect(0, 0, w, h);

    if (atoms.length === 0) return;

    // Calculate center of mass
    let cx = 0, cy = 0, cz = 0;
    atoms.forEach(a => { cx += a.x; cy += a.y; cz += a.z; });
    cx /= atoms.length; cy /= atoms.length; cz /= atoms.length;

    let maxDist = 6;
    atoms.forEach(a => {
      const d = Math.sqrt((a.x - cx) ** 2 + (a.y - cy) ** 2 + (a.z - cz) ** 2);
      if (d > maxDist) maxDist = d;
    });

    const baseScale = (Math.min(w, h) * 0.38) / Math.max(8, maxDist);
    const D = 90;

    const project = (x, y, z) => {
      const x0 = x - cx;
      const y0 = y - cy;
      const z0 = z - cz;

      const x1 = x0 * Math.cos(rotY) + z0 * Math.sin(rotY);
      const z1 = -x0 * Math.sin(rotY) + z0 * Math.cos(rotY);

      const y1 = y0 * Math.cos(rotX) - z1 * Math.sin(rotX);
      const z2 = y0 * Math.sin(rotX) + z1 * Math.cos(rotX);

      const pers = D / (D + z2);
      const sc = baseScale * zoom * pers;

      return {
        sx: w / 2 + x1 * sc,
        sy: h / 2 - y1 * sc,
        depth: z2,
        scale: sc,
      };
    };

    // 1. Draw Unit Cell Wireframe
    if (showCell) {
      const lv = structure.LatticeVectors || [[10,0,0],[0,10,0],[0,0,10]];
      const nx = supercell ? 2 : 1;
      const ny = supercell ? 2 : 1;
      const nz = supercell ? 2 : 1;

      const v1 = [lv[0][0] * nx, lv[0][1] * nx, lv[0][2] * nx];
      const v2 = [lv[1][0] * ny, lv[1][1] * ny, lv[1][2] * ny];
      const v3 = [lv[2][0] * nz, lv[2][1] * nz, lv[2][2] * nz];

      const p0   = project(0, 0, 0);
      const pa   = project(v1[0], v1[1], v1[2]);
      const pb   = project(v2[0], v2[1], v2[2]);
      const pc   = project(v3[0], v3[1], v3[2]);
      const pab  = project(v1[0] + v2[0], v1[1] + v2[1], v1[2] + v2[2]);
      const pac  = project(v1[0] + v3[0], v1[1] + v3[1], v1[2] + v3[2]);
      const pbc  = project(v2[0] + v3[0], v2[1] + v3[1], v2[2] + v3[2]);
      const pabc = project(v1[0] + v2[0] + v3[0], v1[1] + v2[1] + v3[1], v1[2] + v2[2] + v3[2]);

      const cellEdges = [
        [p0, pa], [p0, pb], [p0, pc],
        [pa, pab], [pa, pac],
        [pb, pab], [pb, pbc],
        [pc, pac], [pc, pbc],
        [pab, pabc], [pac, pabc], [pbc, pabc]
      ];

      ctx.strokeStyle = 'rgba(79, 107, 186, 0.55)';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      cellEdges.forEach(([s1, s2]) => {
        ctx.moveTo(s1.sx, s1.sy);
        ctx.lineTo(s2.sx, s2.sy);
      });
      ctx.stroke();

      // Axis labels
      const drawAxis = (pEnd, color, label) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.0;
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
    const projected = atoms.map(a => ({
      ...a,
      p: project(a.x, a.y, a.z),
    }));

    // 3. Draw Bonds
    if (showBonds && projected.length > 1 && projected.length < 500) {
      ctx.strokeStyle = 'rgba(113, 121, 158, 0.6)';
      ctx.lineWidth = Math.max(1, 2.0 * zoom);
      ctx.beginPath();
      for (let i = 0; i < projected.length; i++) {
        for (let j = i + 1; j < projected.length; j++) {
          const a1 = projected[i];
          const a2 = projected[j];
          const maxBond = (a1.covalentRadius + a2.covalentRadius) * 1.25;
          const dx = a2.x - a1.x, dy = a2.y - a1.y, dz = a2.z - a1.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (dist > 0.4 && dist <= maxBond) {
            ctx.moveTo(a1.p.sx, a1.p.sy);
            ctx.lineTo(a2.p.sx, a2.p.sy);
          }
        }
      }
      ctx.stroke();
    }

    // 4. Sort atoms back-to-front (depth buffer)
    projected.sort((a, b) => b.p.depth - a.p.depth);

    // 5. Draw Atoms with 3D Spherical Shading Gradient
    projected.forEach(a => {
      const sx = a.p.sx;
      const sy = a.p.sy;
      const r = Math.max(3, a.radius * a.p.scale * 1.2);
      const hex = '#' + a.color.toString(16).padStart(6, '0');

      const grad = ctx.createRadialGradient(
        sx - r * 0.32, sy - r * 0.35, r * 0.08,
        sx, sy, r
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.25, hex);
      grad.addColorStop(1, '#05070c');

      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, 2 * Math.PI);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.4)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });
  }, [engineMode, atoms, showBonds, showCell, supercell, rotX, rotY, zoom, structure]);

  // Mouse handlers for 2D Canvas interaction
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
    setZoom(z => Math.max(0.4, Math.min(3.5, z * (e.deltaY > 0 ? 0.92 : 1.08))));
  };

  // Camera Controls
  const resetCamera = () => {
    setRotX(0.45);
    setRotY(0.65);
    setZoom(1.0);
    if (!controlsRef.current || !cameraRef.current) return;
    const lv = structure.LatticeVectors || [[1,0,0],[0,1,0],[0,0,1]];
    const v1 = new THREE.Vector3(...lv[0]);
    const v2 = new THREE.Vector3(...lv[1]);
    const v3 = new THREE.Vector3(...lv[2]);
    const cellCenter = new THREE.Vector3().add(v1).add(v2).add(v3).multiplyScalar(supercell ? 1.0 : 0.5);
    const maxDim = Math.max(v1.length(), v2.length(), v3.length(), 10) * (supercell ? 1.6 : 1.2);
    cameraRef.current.position.set(cellCenter.x + maxDim * 1.2, cellCenter.y + maxDim * 0.9, cellCenter.z + maxDim * 1.4);
    controlsRef.current.target.copy(cellCenter);
    controlsRef.current.update();
  };

  const viewAlongAxis = (axis) => {
    if (engineMode === 'canvas2d') {
      if (axis === 'a') { setRotX(0); setRotY(Math.PI / 2); }
      else if (axis === 'b') { setRotX(-Math.PI / 2); setRotY(0); }
      else if (axis === 'c') { setRotX(0); setRotY(0); }
      return;
    }
    if (!controlsRef.current || !cameraRef.current) return;
    const lv = structure.LatticeVectors || [[1,0,0],[0,1,0],[0,0,1]];
    const v1 = new THREE.Vector3(...lv[0]);
    const v2 = new THREE.Vector3(...lv[1]);
    const v3 = new THREE.Vector3(...lv[2]);
    const cellCenter = new THREE.Vector3().add(v1).add(v2).add(v3).multiplyScalar(supercell ? 1.0 : 0.5);
    const dist = Math.max(v1.length(), v2.length(), v3.length(), 10) * 2;

    if (axis === 'a') cameraRef.current.position.set(cellCenter.x + dist, cellCenter.y, cellCenter.z);
    else if (axis === 'b') cameraRef.current.position.set(cellCenter.x, cellCenter.y + dist, cellCenter.z);
    else if (axis === 'c') cameraRef.current.position.set(cellCenter.x, cellCenter.y, cellCenter.z + dist);

    controlsRef.current.target.copy(cellCenter);
    controlsRef.current.update();
  };

  const atomsCount = atoms.length;
  const uniqueElements = Array.from(new Set(atoms.map(a => a.element)));

  return (
    <div className="viewer-container">
      {/* Viewer toolbar */}
      <div className="viewer-toolbar">
        <div className="viewer-controls-group">
          <button className="btn btn-secondary btn-sm" onClick={resetCamera} title="Reset camera">↺ Reset</button>
          <button className="btn btn-secondary btn-sm" onClick={() => viewAlongAxis('a')}>View a</button>
          <button className="btn btn-secondary btn-sm" onClick={() => viewAlongAxis('b')}>View b</button>
          <button className="btn btn-secondary btn-sm" onClick={() => viewAlongAxis('c')}>View c</button>
          <button
            className={`btn btn-sm ${supercell ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSupercell(!supercell)}
            title="Toggle 2x2x2 supercell replication">
            {supercell ? '2×2×2 Supercell' : '1×1×1 Cell'}
          </button>
        </div>

        <div className="viewer-controls-group">
          <button
            className="btn btn-secondary btn-xs"
            onClick={() => setEngineMode(m => m === 'webgl' ? 'canvas2d' : 'webgl')}
            title="Switch between WebGL (3D) and Canvas 2D (zero WebGL context limit fallback)">
            🎮 {engineMode === 'webgl' ? 'WebGL' : '2D Canvas'}
          </button>
          <label className="toggle" style={{ fontSize: '0.75rem' }}>
            <input type="checkbox" checked={showBonds} onChange={e => setShowBonds(e.target.checked)} />
            <span>Bonds</span>
          </label>
          <label className="toggle" style={{ fontSize: '0.75rem' }}>
            <input type="checkbox" checked={showCell} onChange={e => setShowCell(e.target.checked)} />
            <span>Unit Cell</span>
          </label>
        </div>
      </div>

      {/* 3D Canvas Mount (WebGL or 2D Fallback) */}
      {engineMode === 'webgl' ? (
        <div ref={mountRef} className="viewer-canvas" style={{ width: '100%', height: '400px' }} />
      ) : (
        <canvas
          ref={canvas2dRef}
          width={860}
          height={400}
          className="viewer-canvas"
          style={{ width: '100%', height: '400px', cursor: 'grab', display: 'block' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />
      )}

      {/* Legend & Stats */}
      <div className="viewer-footer">
        <div className="viewer-stats">
          <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
            {engineMode === 'webgl' ? 'WebGL 3D' : '2D Canvas (Context-Safe)'}
          </span>
          <span>{atomsCount} atoms</span>
          <span>•</span>
          <span style={{ color: '#f87171' }}>a₁ (red)</span>
          <span style={{ color: '#34d399' }}>a₂ (green)</span>
          <span style={{ color: '#60a5fa' }}>a₃ (blue)</span>
        </div>
        <div className="viewer-legend">
          {uniqueElements.map(el => {
            const info = getElementInfo(el);
            const hex = '#' + info.color.toString(16).padStart(6, '0');
            return (
              <span key={el} className="legend-chip">
                <span className="legend-dot" style={{ backgroundColor: hex }} />
                {el}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
