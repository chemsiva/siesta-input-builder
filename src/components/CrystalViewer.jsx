import { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { useFDFStore } from '../store/fdfStore';
import { ELEMENT_DATA } from '../utils/elementData.js';
export { ELEMENT_DATA };

const Z_TO_SYMBOL = {
  1:'H', 2:'He', 3:'Li', 4:'Be', 5:'B', 6:'C', 7:'N', 8:'O', 9:'F', 10:'Ne',
  11:'Na', 12:'Mg', 13:'Al', 14:'Si', 15:'P', 16:'S', 17:'Cl', 18:'Ar',
  19:'K', 20:'Ca', 21:'Sc', 22:'Ti', 23:'V', 24:'Cr', 25:'Mn', 26:'Fe',
  27:'Co', 28:'Ni', 29:'Cu', 30:'Zn', 31:'Ga', 32:'Ge', 33:'As', 34:'Se',
  35:'Br', 36:'Kr', 37:'Rb', 38:'Sr', 39:'Y', 40:'Zr', 41:'Nb', 42:'Mo',
  44:'Ru', 45:'Rh', 46:'Pd', 47:'Ag', 48:'Cd', 49:'In', 50:'Sn', 51:'Sb',
  52:'Te', 53:'I', 55:'Cs', 56:'Ba', 57:'La', 58:'Ce', 72:'Hf', 73:'Ta',
  74:'W', 75:'Re', 76:'Os', 77:'Ir', 78:'Pt', 79:'Au', 80:'Hg', 81:'Tl',
  82:'Pb', 83:'Bi'
};

export const DEMO_STRUCTURES = {
  si: {
    label: 'Bulk Silicon (Diamond)',
    systemLabel: 'silicon',
    LatticeConstant: '5.4300 Ang',
    LatticeVectors: [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ],
    AtomicCoordinatesFormat: 'Fractional',
    species: [{ idx: 1, z: 14, label: 'Si' }],
    atoms: [
      { x: '0.000', y: '0.000', z: '0.000', species: '1', label: 'Si' },
      { x: '0.000', y: '0.500', z: '0.500', species: '1', label: 'Si' },
      { x: '0.500', y: '0.000', z: '0.500', species: '1', label: 'Si' },
      { x: '0.500', y: '0.500', z: '0.000', species: '1', label: 'Si' },
      { x: '0.250', y: '0.250', z: '0.250', species: '1', label: 'Si' },
      { x: '0.250', y: '0.750', z: '0.750', species: '1', label: 'Si' },
      { x: '0.750', y: '0.250', z: '0.750', species: '1', label: 'Si' },
      { x: '0.750', y: '0.750', z: '0.250', species: '1', label: 'Si' },
    ],
  },
  perovskite: {
    label: 'Cubic Perovskite (CsPbI3)',
    systemLabel: 'CsPbI3',
    LatticeConstant: '6.2800 Ang',
    LatticeVectors: [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ],
    AtomicCoordinatesFormat: 'Fractional',
    species: [
      { idx: 1, z: 55, label: 'Cs' },
      { idx: 2, z: 82, label: 'Pb' },
      { idx: 3, z: 53, label: 'I' },
    ],
    atoms: [
      { x: '0.000', y: '0.000', z: '0.000', species: '1', label: 'Cs' },
      { x: '0.500', y: '0.500', z: '0.500', species: '2', label: 'Pb' },
      { x: '0.500', y: '0.500', z: '0.000', species: '3', label: 'I' },
      { x: '0.500', y: '0.000', z: '0.500', species: '3', label: 'I' },
      { x: '0.000', y: '0.500', z: '0.500', species: '3', label: 'I' },
    ],
  },
  h2: {
    label: 'H2 Molecule in 10 Å Box',
    systemLabel: 'h2_mol',
    LatticeConstant: '10.0000 Ang',
    LatticeVectors: [
      [1.0, 0.0, 0.0],
      [0.0, 1.0, 0.0],
      [0.0, 0.0, 1.0],
    ],
    AtomicCoordinatesFormat: 'Ang',
    species: [{ idx: 1, z: 1, label: 'H' }],
    atoms: [
      { x: '4.630', y: '5.000', z: '5.000', species: '1', label: 'H' },
      { x: '5.370', y: '5.000', z: '5.000', species: '1', label: 'H' },
    ],
  },
};

function getElementInfo(labelOrZ) {
  if (!labelOrZ) return { color: 0x9ca3af, radius: 1.0, sym: 'X' };

  const rawStr = String(labelOrZ).trim();
  // 1. Direct match in ELEMENT_DATA (e.g. "C", "Pb", "Si")
  if (ELEMENT_DATA[rawStr]) return { ...ELEMENT_DATA[rawStr], sym: rawStr };

  // 2. Strip digits and punctuation safely (note escaped hyphen \-)
  const clean = rawStr.replace(/[\d+_\-\s]/g, '').trim();
  if (ELEMENT_DATA[clean]) return { ...ELEMENT_DATA[clean], sym: clean };

  // 3. Try standard titlecase (e.g. "pb" -> "Pb", "FE" -> "Fe")
  if (clean.length >= 2) {
    const candidate = clean[0].toUpperCase() + clean[1].toLowerCase();
    if (ELEMENT_DATA[candidate]) return { ...ELEMENT_DATA[candidate], sym: candidate };
  }
  if (clean.length >= 1) {
    const candidate = clean[0].toUpperCase();
    if (ELEMENT_DATA[candidate]) return { ...ELEMENT_DATA[candidate], sym: candidate };
  }

  // 4. Check if numeric atomic number Z (e.g. "82" -> Pb, "53" -> I, "14" -> Si)
  const numericZ = parseInt(rawStr, 10);
  if (!isNaN(numericZ) && String(numericZ) === rawStr && Z_TO_SYMBOL[numericZ]) {
    const sym = Z_TO_SYMBOL[numericZ];
    return { ...(ELEMENT_DATA[sym] || { color: 0x9ca3af, radius: 1.0 }), sym };
  }

  return { color: 0x94a3b8, radius: 1.0, sym: clean || rawStr || 'X' };
}

export function CrystalViewer({ structure }) {
  const setSection = useFDFStore(s => s.setSection);
  const setField = useFDFStore(s => s.setField);
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
  const [pan, setPan] = useState({ x: 0, y: 0 });
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
      // Resolve species by index or label first (canonical source of truth)
      const spObj = (structure.species || []).find(sp =>
        String(sp.idx) === String(a.species) ||
        (sp.label && String(sp.label).toLowerCase() === String(a.label).toLowerCase())
      );
      const spTag = spObj?.label || (spObj?.z ? Z_TO_SYMBOL[spObj.z] : null) || a.label || a.species || 'Si';
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
        // Visual sphere radius in Angstrom (prominent, beautiful CPK spheres)
        radius: Math.max(0.55, (el.radius || 1.0) * 0.70),
        covalentRadius: (el.radius || 1.0) * 1.0,
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

  // Load a demo crystal structure into the application state
  const handleLoadDemo = (key) => {
    const demo = DEMO_STRUCTURES[key];
    if (!demo) return;
    setField('system', 'SystemLabel', demo.systemLabel);
    setField('system', 'SystemName', demo.label);
    setField('system', 'NumberOfAtoms', String(demo.atoms.length));
    setField('system', 'NumberOfSpecies', String(demo.species.length));
    setSection('structure', {
      LatticeConstant: demo.LatticeConstant,
      LatticeVectors: demo.LatticeVectors,
      AtomicCoordinatesFormat: demo.AtomicCoordinatesFormat,
      species: demo.species,
      atoms: demo.atoms,
    });
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // ENGINE 1: Three.js WebGL (Hardware Accelerated with Proper Framing)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (engineMode !== 'webgl') return;
    const container = mountRef.current;
    if (!container) return;
    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }

    const width = container.clientWidth || 600;
    const height = 400;

    let renderer;
    try {
      const testCanvas = document.createElement('canvas');
      const testGL = testCanvas.getContext('webgl2') || testCanvas.getContext('webgl') || testCanvas.getContext('experimental-webgl');
      if (!testGL) {
        throw new Error('WebGL not supported');
      }
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        failIfMajorPerformanceCaveat: false,
      });
    } catch {
      try {
        renderer = new THREE.WebGLRenderer({
          antialias: false,
          alpha: false,
          preserveDrawingBuffer: true,
          failIfMajorPerformanceCaveat: false,
        });
      } catch (err2) {
        console.warn('WebGL context unavailable in browser. Falling back to 2D Canvas engine:', err2);
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

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
    cameraRef.current = camera;

    // Rich lighting for 3D depth
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.85);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.1);
    dirLight1.position.set(30, 45, 35);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x90b0ff, 0.5);
    dirLight2.position.set(-30, -35, -25);
    scene.add(dirLight2);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controlsRef.current = controls;

    const [lcVal] = (structure.LatticeConstant || '1.0 Ang').split(' ');
    const scale = parseFloat(lcVal) || 1.0;
    const lv = structure.LatticeVectors || [[1,0,0],[0,1,0],[0,0,1]];

    // Real Cartesian unit cell vectors (scaled by LatticeConstant!)
    const nx = supercell ? 2 : 1;
    const ny = supercell ? 2 : 1;
    const nz = supercell ? 2 : 1;
    const v1 = new THREE.Vector3(...lv[0]).multiplyScalar(scale * nx);
    const v2 = new THREE.Vector3(...lv[1]).multiplyScalar(scale * ny);
    const v3 = new THREE.Vector3(...lv[2]).multiplyScalar(scale * nz);

    // 1. Draw Unit Cell Wireframe
    if (showCell) {
      const boxMat = new THREE.LineBasicMaterial({ color: 0x4f6bba, linewidth: 1.5, transparent: true, opacity: 0.85 });

      const p0 = new THREE.Vector3(0, 0, 0);
      const pa = v1.clone();
      const pb = v2.clone();
      const pc = v3.clone();
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
      const arrowLen = Math.min(3.5, Math.max(v1.length(), v2.length(), v3.length()) * 0.3);
      scene.add(new THREE.ArrowHelper(v1.clone().normalize(), origin, arrowLen, 0xf87171, 0.45, 0.25));
      scene.add(new THREE.ArrowHelper(v2.clone().normalize(), origin, arrowLen, 0x34d399, 0.45, 0.25));
      scene.add(new THREE.ArrowHelper(v3.clone().normalize(), origin, arrowLen, 0x60a5fa, 0.45, 0.25));
    }

    // 2. Draw Atoms (Solid, prominent, CPK-colored spheres)
    const sphereCache = {};
    atoms.forEach(atom => {
      const r = atom.radius;
      if (!sphereCache[r]) {
        sphereCache[r] = new THREE.SphereGeometry(r, 24, 24);
      }
      const mat = new THREE.MeshStandardMaterial({
        color: atom.color,
        roughness: 0.25,
        metalness: 0.2,
      });
      const mesh = new THREE.Mesh(sphereCache[r], mat);
      mesh.position.set(atom.x, atom.y, atom.z);
      scene.add(mesh);
    });

    // 3. Draw Bonds (Between nearby atoms)
    if (showBonds && atoms.length > 1 && atoms.length < 500) {
      const bondMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 0.45 });
      const bondRadius = 0.12;

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

            const cylGeom = new THREE.CylinderGeometry(bondRadius, bondRadius, dist, 12);
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

    // 4. Bounding Box & Camera Framing (100% guarantees all atoms are visible)
    const box = new THREE.Box3();
    if (atoms.length > 0) {
      atoms.forEach(a => box.expandByPoint(new THREE.Vector3(a.x, a.y, a.z)));
    }
    // Expand by cell corners
    [
      new THREE.Vector3(0, 0, 0),
      v1, v2, v3,
      new THREE.Vector3().add(v1).add(v2),
      new THREE.Vector3().add(v1).add(v3),
      new THREE.Vector3().add(v2).add(v3),
      new THREE.Vector3().add(v1).add(v2).add(v3),
    ].forEach(c => box.expandByPoint(c));

    const center = box.getCenter(new THREE.Vector3());
    const size = box.getSize(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 6);

    camera.position.set(center.x + maxDim * 1.3, center.y + maxDim * 1.0, center.z + maxDim * 1.6);
    camera.lookAt(center);
    controls.target.copy(center);
    controls.update();
    // Immediately render initial frame synchronously
    try {
      renderer.render(scene, camera);
    } catch (e) {
      console.warn('Initial WebGL render failed, switching to 2D canvas:', e);
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
          console.warn('WebGL render issue, auto-switching to 2D Canvas engine:', e);
          cancelAnimationFrame(animId);
          setEngineMode('canvas2d');
        }
      }
    };

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
        if (renderer.domElement && renderer.domElement.parentNode === container) {
          container.removeChild(renderer.domElement);
        }
        renderer.dispose();
      }
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [structure, showBonds, showCell, supercell, engineMode, atoms]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ENGINE 2: Interactive 2D Canvas Engine (Depth-Sorted with Lighting)
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

    const [lcVal] = (structure.LatticeConstant || '1.0 Ang').split(' ');
    const scale = parseFloat(lcVal) || 1.0;
    const lv = structure.LatticeVectors || [[1,0,0],[0,1,0],[0,0,1]];
    const nx = supercell ? 2 : 1;
    const ny = supercell ? 2 : 1;
    const nz = supercell ? 2 : 1;

    const v1 = [lv[0][0] * scale * nx, lv[0][1] * scale * nx, lv[0][2] * scale * nx];
    const v2 = [lv[1][0] * scale * ny, lv[1][1] * scale * ny, lv[1][2] * scale * ny];
    const v3 = [lv[2][0] * scale * nz, lv[2][1] * scale * nz, lv[2][2] * scale * nz];

    // Compute center of unit cell
    const cc = [
      (v1[0] + v2[0] + v3[0]) * 0.5,
      (v1[1] + v2[1] + v3[1]) * 0.5,
      (v1[2] + v2[2] + v3[2]) * 0.5,
    ];

    const len1 = Math.hypot(v1[0], v1[1], v1[2]);
    const len2 = Math.hypot(v2[0], v2[1], v2[2]);
    const len3 = Math.hypot(v3[0], v3[1], v3[2]);
    const maxCellDim = Math.max(len1, len2, len3, 6);

    // Base scale fits entire cell (even 40+ A tall slabs) cleanly into viewport
    const baseScale = (Math.min(w, h) * 0.38) / maxCellDim;
    const D = 120;

    const project = (x, y, z) => {
      const x0 = x - cc[0];
      const y0 = y - cc[1];
      const z0 = z - cc[2];

      const x1 = x0 * Math.cos(rotY) + z0 * Math.sin(rotY);
      const z1 = -x0 * Math.sin(rotY) + z0 * Math.cos(rotY);

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

      ctx.strokeStyle = 'rgba(79, 107, 186, 0.65)';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      cellEdges.forEach(([s1, s2]) => {
        ctx.moveTo(s1.sx, s1.sy);
        ctx.lineTo(s2.sx, s2.sy);
      });
      ctx.stroke();

      // Axis labels
      const drawAxis = (pEnd, color, label) => {
        ctx.strokeStyle = color;
        ctx.lineWidth = 2.2;
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

    if (atoms.length === 0) return;

    // 2. Project Atoms
    const projected = atoms.map(a => ({
      ...a,
      p: project(a.x, a.y, a.z),
    }));

    // 3. Draw Bonds
    if (showBonds && projected.length > 1 && projected.length < 500) {
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.65)';
      ctx.lineWidth = Math.max(1, 2.5 * zoom);
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

    // 4. Sort atoms back-to-front
    projected.sort((a, b) => b.p.depth - a.p.depth);

    // 5. Draw Atoms with 3D Spherical Shading Gradient
    projected.forEach(a => {
      const sx = a.p.sx;
      const sy = a.p.sy;
      const r = Math.max(4, Math.min(22, a.radius * a.p.scale * 1.15));
      const hex = '#' + a.color.toString(16).padStart(6, '0');

      const grad = ctx.createRadialGradient(
        sx - r * 0.32, sy - r * 0.35, r * 0.08,
        sx, sy, r
      );
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.28, hex);
      grad.addColorStop(1, '#05070c');

      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, 2 * Math.PI);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.5)';
      ctx.lineWidth = 0.8;
      ctx.stroke();

      // Atom Symbol — only render text if sphere is large enough to be legible
      if (r >= 7.5) {
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(7, Math.min(10, Math.floor(r * 0.85)))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(a.element, sx, sy);
      }
    });
  }, [engineMode, atoms, showBonds, showCell, supercell, rotX, rotY, zoom, pan, structure]);

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

  const resetCamera = () => {
    setRotX(0.45);
    setRotY(0.65);
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
    if (engineMode === 'webgl' && controlsRef.current && cameraRef.current) {
      controlsRef.current.reset();
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
    } else {
      setZoom(z => Math.max(0.2, Math.min(5.0, z * (factor < 1 ? 1.2 : 0.8))));
    }
  };

  const setViewPlane = (plane) => {
    const [lcVal] = (structure.LatticeConstant || '1.0 Ang').split(' ');
    const scale = parseFloat(lcVal) || 1.0;
    const lv = structure.LatticeVectors || [[1,0,0],[0,1,0],[0,0,1]];
    const maxDim = Math.max(
      Math.hypot(...lv[0]) * scale,
      Math.hypot(...lv[1]) * scale,
      Math.hypot(...lv[2]) * scale,
      8
    );
    const camDist = maxDim * 2.2;

    if (engineMode === 'webgl' && cameraRef.current && controlsRef.current) {
      const camera = cameraRef.current;
      const target = controlsRef.current.target;

      if (plane === 'xy') {
        camera.position.set(target.x, target.y, target.z + camDist);
        camera.up.set(0, 1, 0);
      } else if (plane === 'xz') {
        camera.position.set(target.x, target.y - camDist, target.z + 0.001);
        camera.up.set(0, 0, 1);
      } else if (plane === 'yz') {
        camera.position.set(target.x + camDist, target.y, target.z + 0.001);
        camera.up.set(0, 0, 1);
      }
      camera.lookAt(target);
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

  const atomsCount = atoms.length;
  const uniqueElements = Array.from(new Set(atoms.map(a => a.element)));

  return (
    <div className="viewer-container" style={{ position: 'relative' }}>
      {/* Viewer toolbar */}
      <div className="viewer-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div className="viewer-controls-group" style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button className="btn btn-secondary btn-sm" onClick={resetCamera} title="Reset camera">↺ Reset</button>
          <button
            className={`btn btn-sm ${supercell ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSupercell(!supercell)}
            title="Toggle 2x2x2 supercell replication">
            {supercell ? '2×2×2 Supercell' : '1×1×1 Cell'}
          </button>

          {/* Quick Demo Crystals */}
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', marginLeft: '0.3rem', fontWeight: 600 }}>Load Demo:</span>
          <button className="btn btn-secondary btn-xs" onClick={() => handleLoadDemo('si')} title="Load Diamond Silicon (8 atoms)">
            💎 Si
          </button>
          <button className="btn btn-secondary btn-xs" onClick={() => handleLoadDemo('perovskite')} title="Load Cubic Perovskite CsPbI3">
            ☀️ CsPbI₃
          </button>
          <button className="btn btn-secondary btn-xs" onClick={() => handleLoadDemo('h2')} title="Load H2 molecule">
            🧪 H₂
          </button>
        </div>

        <div className="viewer-controls-group" style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
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
        <div ref={mountRef} className="viewer-canvas" style={{ width: '100%', height: '420px', position: 'relative' }} />
      ) : (
        <canvas
          ref={canvas2dRef}
          width={860}
          height={420}
          className="viewer-canvas"
          style={{ width: '100%', height: '420px', cursor: 'grab', display: 'block' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />
      )}
      {/* Directional Navigation Toolbar (Slide, Rotate, Zoom) */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '0.4rem',
        padding: '0.35rem 0.6rem',
        background: 'var(--surface2)',
        borderBottom: '1px solid var(--border)',
      }}>
        {/* Move / Slide Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>
            ✋ Slide:
          </span>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => panCamera(-1, 0)} title="Slide Left">
            ⬅️ Left
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => panCamera(1, 0)} title="Slide Right">
            ➡️ Right
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => panCamera(0, 1)} title="Move Up">
            ⬆️ Up
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => panCamera(0, -1)} title="Move Down">
            ⬇️ Down
          </button>
        </div>

        {/* Rotate / Tilt Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>
            🔄 Rotate:
          </span>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => rotateCamera(-0.15, 0)} title="Rotate Left">
            ↺ Left
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => rotateCamera(0.15, 0)} title="Rotate Right">
            ↻ Right
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => rotateCamera(0, -0.15)} title="Tilt Up / Top">
            🔼 Top
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => rotateCamera(0, 0.15)} title="Tilt Down">
            🔽 Down
          </button>
        </div>

        {/* Zoom & View Presets */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--muted)', fontWeight: 600 }}>
            🔍 Views:
          </span>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => zoomCamera(0.85)} title="Zoom In">
            ➕
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => zoomCamera(1.18)} title="Zoom Out">
            ➖
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => setViewPlane('xy')} title="Top View (XY Plane)">
            XY
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => setViewPlane('xz')} title="Front View (XZ Plane)">
            XZ
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={() => setViewPlane('yz')} title="Side View (YZ Plane)">
            YZ
          </button>
          <button type="button" className="btn btn-xs btn-secondary" onClick={resetCamera} title="Reset Camera">
            🎯 Reset
          </button>
        </div>
      </div>

      {/* Empty State Overlay when atoms.length === 0 */}
      {atomsCount === 0 && (
        <div style={{
          position: 'absolute',
          top: '55px',
          left: '10px',
          right: '10px',
          bottom: '45px',
          background: 'rgba(15, 23, 42, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '6px',
          border: '1px dashed var(--border)',
          zIndex: 10,
          padding: '1.5rem',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⚛️</div>
          <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--fg)', marginBottom: '0.3rem' }}>
            No atoms defined in unit cell
          </div>
          <p style={{ fontSize: '0.82rem', color: 'var(--muted)', maxWidth: '440px', margin: '0 0 1rem' }}>
            Upload a <strong>CIF file</strong>, add atomic coordinates in the table below, or click a demo crystal to start visualizing:
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button className="btn btn-primary btn-sm" onClick={() => handleLoadDemo('si')}>
              💎 Load Diamond Silicon (8 atoms)
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleLoadDemo('perovskite')}>
              ☀️ Load Cubic CsPbI₃ Perovskite
            </button>
            <button className="btn btn-secondary btn-sm" onClick={() => handleLoadDemo('h2')}>
              🧪 Load H₂ Molecule
            </button>
          </div>
        </div>
      )}

      {/* Legend & Stats */}
      <div className="viewer-footer">
        <div className="viewer-stats">
          <span className="badge badge-accent" style={{ fontSize: '0.7rem' }}>
            {engineMode === 'webgl' ? 'WebGL 3D' : '2D Canvas (Context-Safe)'}
          </span>
          <strong style={{ color: atomsCount > 0 ? '#38bdf8' : 'var(--muted)' }}>{atomsCount} atoms</strong>
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
                <strong>{el}</strong>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default CrystalViewer;
