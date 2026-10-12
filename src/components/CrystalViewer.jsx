import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ELEMENT_DATA } from '../utils/elementData.js';
export { ELEMENT_DATA };

function getElementInfo(labelOrZ) {
  if (!labelOrZ) return { color: 0x999999, radius: 1.0, sym: 'X' };
  // Clean string to symbol
  const clean = String(labelOrZ).replace(/[\d\+\-_]/g, '').trim();
  if (ELEMENT_DATA[clean]) return { ...ELEMENT_DATA[clean], sym: clean };
  // Check first 2 letters
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
  const [showBonds, setShowBonds] = useState(true);
  const [showCell, setShowCell] = useState(true);
  const [supercell, setSupercell] = useState(false); // 1x1x1 vs 2x2x2
  const controlsRef = useRef(null);
  const cameraRef = useRef(null);

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
      const spLabel = a.label || speciesMap[a.species] || 'X';
      const info = getElementInfo(spLabel);

      let cx = 0, cy = 0, cz = 0;
      if (format === 'Fractional') {
        cx = x * lv[0][0] + y * lv[1][0] + z * lv[2][0];
        cy = x * lv[0][1] + y * lv[1][1] + z * lv[2][1];
        cz = x * lv[0][2] + y * lv[1][2] + z * lv[2][2];
      } else if (format === 'ScaledCartesian') {
        cx = x * scale; cy = y * scale; cz = z * scale;
      } else if (format === 'NotScaledCartesianBohr') {
        cx = x * bohrToAng; cy = y * bohrToAng; cz = z * bohrToAng;
      } else {
        // NotScaledCartesianAng / Ang
        cx = x; cy = y; cz = z;
      }

      return {
        id: i + 1,
        x: cx, y: cy, z: cz,
        fracX: x, fracY: y, fracZ: z,
        element: info.sym,
        color: info.color,
        radius: Math.min(1.2, Math.max(0.3, info.radius * 0.45)), // scale for visualization
        covalentRadius: info.radius,
      };
    });

    if (!supercell) return baseAtoms;

    // 2x2x2 replication for Fractional coordinates
    if (format === 'Fractional') {
      const rep = [];
      for (let ix = 0; ix < 2; ix++) {
        for (let iy = 0; iy < 2; iy++) {
          for (let iz = 0; iz < 2; iz++) {
            baseAtoms.forEach(a => {
              const fx = a.fracX + ix;
              const fy = a.fracY + iy;
              const fz = a.fracZ + iz;
              rep.push({
                ...a,
                x: fx * lv[0][0] + fy * lv[1][0] + fz * lv[2][0],
                y: fx * lv[0][1] + fy * lv[1][1] + fz * lv[2][1],
                z: fx * lv[0][2] + fy * lv[1][2] + fz * lv[2][2],
              });
            });
          }
        }
      }
      return rep;
    }

    return baseAtoms;
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 600;
    const height = 400;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x131620);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    cameraRef.current = camera;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 2. Lights
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.75);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 0.85);
    dirLight1.position.set(20, 40, 30);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x90b0ff, 0.4);
    dirLight2.position.set(-20, -30, -20);
    scene.add(dirLight2);

    // 3. OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    // 4. Data
    const atoms = getCartesianAtoms();
    const lv = structure.LatticeVectors || [[1,0,0],[0,1,0],[0,0,1]];
    const v1 = new THREE.Vector3(...lv[0]);
    const v2 = new THREE.Vector3(...lv[1]);
    const v3 = new THREE.Vector3(...lv[2]);

    // Center of unit cell
    const cellCenter = new THREE.Vector3()
      .add(v1).add(v2).add(v3).multiplyScalar(supercell ? 1.0 : 0.5);

    // 5. Unit cell wireframe
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

      // Axes arrows (a1 red, a2 green, a3 blue)
      const origin = new THREE.Vector3(0, 0, 0);
      scene.add(new THREE.ArrowHelper(v1.clone().normalize(), origin, Math.min(2.5, v1.length()), 0xf87171, 0.4, 0.2));
      scene.add(new THREE.ArrowHelper(v2.clone().normalize(), origin, Math.min(2.5, v2.length()), 0x34d399, 0.4, 0.2));
      scene.add(new THREE.ArrowHelper(v3.clone().normalize(), origin, Math.min(2.5, v3.length()), 0x60a5fa, 0.4, 0.2));
    }

    // 6. Draw Atoms
    const sphereGeomCache = {};
    atoms.forEach(atom => {
      const r = atom.radius;
      if (!sphereGeomCache[r]) {
        sphereGeomCache[r] = new THREE.SphereGeometry(r, 24, 24);
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

    // 7. Draw Bonds
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

    // 8. Position camera to frame the structure
    const maxDim = Math.max(v1.length(), v2.length(), v3.length(), 10) * (supercell ? 1.6 : 1.2);
    camera.position.set(cellCenter.x + maxDim * 1.2, cellCenter.y + maxDim * 0.9, cellCenter.z + maxDim * 1.4);
    camera.lookAt(cellCenter);
    controls.target.copy(cellCenter);

    // 9. Animation loop
    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // 10. Resize handler
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
      renderer.dispose();
      renderer.forceContextLoss();
      if (container) container.innerHTML = '';
    };
  }, [structure, showBonds, showCell, supercell]);

  const resetCamera = () => {
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

  const atomsCount = (structure.atoms || []).length;
  const uniqueElements = Array.from(new Set((structure.atoms || []).map(a => a.label || a.species)));

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

      {/* 3D Canvas Mount */}
      <div ref={mountRef} className="viewer-canvas" />

      {/* Legend & Stats */}
      <div className="viewer-footer">
        <div className="viewer-stats">
          <span>{atomsCount * (supercell ? 8 : 1)} atoms</span>
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
