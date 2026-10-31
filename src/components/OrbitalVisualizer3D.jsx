import React, { useState, useRef, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { parseCubeFile, extractIsosurface, generateDemoOrbitalCube } from '../parser/cubeOrbitalParser.js';
import { ELEMENT_DATA } from '../utils/elementData.js';
import { createSafeWebGLRenderer, disposeWebGLRenderer, purgeAllStaleWebGLContexts } from '../utils/webglHelper.js';
export function OrbitalVisualizer3D() {
  const containerRef = useRef(null);
  const mountRef = useRef(null);
  const fileInputRef = useRef(null);

  // Active Cube data
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
  const [webglError, setWebglError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  // Three.js scene references
  const sceneRef = useRef(null);
  const cameraRef = useRef(null);
  const rendererRef = useRef(null);
  const controlsRef = useRef(null);
  const initialDistRef = useRef(1);
  const posMeshRef = useRef(null);
  const negMeshRef = useRef(null);
  const molGroupRef = useRef(null);
  const boxLineRef = useRef(null);

  // Initialize and handle file upload
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

  // Setup WebGL Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 860;
    const height = 450;
    const renderer = createSafeWebGLRenderer({
      antialias: true,
      preserveDrawingBuffer: true,
    });

    if (!renderer) {
      setWebglError(true);
      return;
    }

    setWebglError(false);
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a); // Deep slate background
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

    // Initial Camera target & distance
    const atoms = cubeData.atoms;
    let cx = 0, cy = 0, cz = 0;
    if (atoms.length > 0) {
      atoms.forEach(a => { cx += a.x; cy += a.y; cz += a.z; });
      cx /= atoms.length; cy /= atoms.length; cz /= atoms.length;
    }
    const target = new THREE.Vector3(cx, cy, cz);
    controls.target.copy(target);

    // Compute bounding radius
    let maxDist = 4;
    atoms.forEach(a => {
      const d = Math.sqrt((a.x - cx) ** 2 + (a.y - cy) ** 2 + (a.z - cz) ** 2);
      if (d > maxDist) maxDist = d;
    });

    const camDist = Math.max(14, maxDist * 3.0);
    camera.position.set(cx, cy, cz + camDist);
    camera.lookAt(target);
    controls.update();

    initialDistRef.current = camDist;

    controls.addEventListener('change', () => {
      if (initialDistRef.current > 0 && cameraRef.current && controlsRef.current) {
        const curDist = cameraRef.current.position.distanceTo(controlsRef.current.target);
        if (curDist > 0) {
          setZoom(parseFloat((initialDistRef.current / curDist).toFixed(2)));
        }
      }
    });

    let animId;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (renderer && scene && camera && controls) {
        controls.update();
        renderer.render(scene, camera);
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
        try { controlsRef.current.dispose(); } catch {}
      }
      disposeWebGLRenderer(renderer, container);
    };
  }, [retryCount]);

  // Update Molecular Atoms & Bonds Geometry
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    if (molGroupRef.current) {
      scene.remove(molGroupRef.current);
      molGroupRef.current = null;
    }

    if (!showAtoms && !showBonds) return;

    const group = new THREE.Group();
    const atoms = cubeData.atoms;

    // 1. Atoms (Spheres)
    if (showAtoms) {
      atoms.forEach(atom => {
        const el = ELEMENT_DATA[atom.element] || { color: 0x9ca3af, radius: 0.6 };
        const radius = Math.max(0.3, el.radius * 0.45);
        const geom = new THREE.SphereGeometry(radius, 24, 24);
        const mat = new THREE.MeshStandardMaterial({
          color: el.color,
          roughness: 0.35,
          metalness: 0.15,
        });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(atom.x, atom.y, atom.z);
        group.add(mesh);
      });
    }

    // 2. Chemical Bonds (Cylinders)
    if (showBonds && atoms.length > 1) {
      const bondMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        roughness: 0.4,
        metalness: 0.1,
      });

      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          const a1 = atoms[i];
          const a2 = atoms[j];
          const dx = a2.x - a1.x;
          const dy = a2.y - a1.y;
          const dz = a2.z - a1.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          const r1 = (ELEMENT_DATA[a1.element]?.radius || 0.7);
          const r2 = (ELEMENT_DATA[a2.element]?.radius || 0.7);
          const maxBond = (r1 + r2) * 1.35;

          if (dist > 0.4 && dist < maxBond) {
            const geom = new THREE.CylinderGeometry(0.1, 0.1, dist, 12);
            const mesh = new THREE.Mesh(geom, bondMat);

            const midX = (a1.x + a2.x) / 2;
            const midY = (a1.y + a2.y) / 2;
            const midZ = (a1.z + a2.z) / 2;
            mesh.position.set(midX, midY, midZ);

            const p1 = new THREE.Vector3(a1.x, a1.y, a1.z);
            const p2 = new THREE.Vector3(a2.x, a2.y, a2.z);
            const dir = new THREE.Vector3().subVectors(p2, p1).normalize();
            mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);

            group.add(mesh);
          }
        }
      }
    }

    scene.add(group);
    molGroupRef.current = group;
  }, [cubeData, showAtoms, showBonds]);

  // Update Bounding Grid Box
  useEffect(() => {
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
  }, [cubeData, showBox]);

  // Update Isosurfaces (Positive & Negative Lobes)
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;

    // Remove existing meshes
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

    const iso = parseFloat(isovalue) || 0.02;

    // 1. Positive Lobe (+ phase)
    if (phaseMode === 'both' || phaseMode === 'positive') {
      const posData = extractIsosurface(cubeData, iso, 1);
      if (posData.triangleCount > 0) {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(posData.positions, 3));
        geom.setAttribute('normal', new THREE.BufferAttribute(posData.normals, 3));

        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(posColor),
          roughness: 0.35,
          metalness: 0.1,
          transparent: opacity < 1.0,
          opacity: opacity,
          wireframe: wireframe,
          side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geom, mat);
        scene.add(mesh);
        posMeshRef.current = mesh;
      }
    }

    // 2. Negative Lobe (- phase)
    if (cubeData.isWavefunction && (phaseMode === 'both' || phaseMode === 'negative')) {
      const negData = extractIsosurface(cubeData, iso, -1);
      if (negData.triangleCount > 0) {
        const geom = new THREE.BufferGeometry();
        geom.setAttribute('position', new THREE.BufferAttribute(negData.positions, 3));
        geom.setAttribute('normal', new THREE.BufferAttribute(negData.normals, 3));

        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(negColor),
          roughness: 0.35,
          metalness: 0.1,
          transparent: opacity < 1.0,
          opacity: opacity,
          wireframe: wireframe,
          side: THREE.DoubleSide,
        });

        const mesh = new THREE.Mesh(geom, mat);
        scene.add(mesh);
        negMeshRef.current = mesh;
      }
    }
  }, [cubeData, isovalue, phaseMode, posColor, negColor, opacity, wireframe]);

  // Camera Zoom Controls
  const zoomCamera = (factor) => {
    if (cameraRef.current && controlsRef.current) {
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
    }
  };

  const resetCamera = () => {
    if (cameraRef.current && controlsRef.current) {
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
    }
  };

  const setViewPlane = (plane) => {
    if (cameraRef.current && controlsRef.current) {
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
    }
  };

  // High-Resolution PNG Snapshot Export
  const handleExportPNG = () => {
    const renderer = rendererRef.current;
    if (!renderer) return;
    const url = renderer.domElement.toDataURL('image/png');
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

        {/* Upload & Demo Buttons */}
        <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept=".cube,.cub,.txt"
            style={{ display: 'none' }}
            onChange={handleFileUpload}
          />
          <button
            type="button"
            className="btn btn-primary btn-xs"
            onClick={() => fileInputRef.current?.click()}
            title="Upload a 3D Gaussian Cube file (.cube)">
            Upload .cube File
          </button>
          <span style={{ fontSize: '0.72rem', color: 'var(--muted)', fontWeight: 600 }}>Demos:</span>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={() => handleLoadDemo('benzene_homo')}
            title="Load Benzene (C6H6) HOMO π-orbital benchmark">
            Benzene HOMO
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={() => handleLoadDemo('water_homo')}
            title="Load Water (H2O) 1b1 HOMO lone pair orbital">
            Water HOMO
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-xs"
            onClick={handleExportPNG}
            title="Capture high-resolution 3D orbital snapshot as PNG">
            Snapshot PNG
          </button>
        </div>
      </div>

      {statusMsg && (
        <div style={{ background: 'rgba(16, 185, 129, 0.15)', border: '1px solid rgba(16, 185, 129, 0.3)', color: 'var(--success, #10b981)', padding: '0.35rem 0.6rem', borderRadius: '4px', fontSize: '0.78rem', marginBottom: '0.6rem' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap' }}>Opacity:</span>
          <input
            type="range"
            min="0.1"
            max="1.0"
            step="0.05"
            value={opacity}
            onChange={e => setOpacity(parseFloat(e.target.value))}
            style={{ width: '70px', cursor: 'pointer' }}
          />
          <span style={{ fontFamily: 'monospace', color: 'var(--muted)', minWidth: '32px' }}>
            {Math.round(opacity * 100)}%
          </span>
        </div>

        {/* Wireframe Toggle */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={wireframe} onChange={e => setWireframe(e.target.checked)} />
          <span>Wireframe</span>
        </label>

        {/* Atoms & Bonds Toggles */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={showAtoms} onChange={e => setShowAtoms(e.target.checked)} />
          <span>Atoms</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={showBonds} onChange={e => setShowBonds(e.target.checked)} />
          <span>Bonds</span>
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', cursor: 'pointer' }}>
          <input type="checkbox" checked={showBox} onChange={e => setShowBox(e.target.checked)} />
          <span>Grid Box</span>
        </label>
      </div>

      {/* 3D WebGL Canvas Mount Container */}
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
        {webglError ? (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            textAlign: 'center',
            background: '#090d16',
          }}>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: '#f59e0b', marginBottom: '0.4rem' }}>
              WebGL Context Limit Reached
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', maxWidth: '440px', lineHeight: '1.45', marginBottom: '1.2rem' }}>
              Your browser has temporarily reached its simultaneous WebGL GPU context limit. Click below to reclaim orphaned contexts and re-initialize the 3D orbital.
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                purgeAllStaleWebGLContexts();
                setWebglError(false);
                setRetryCount(c => c + 1);
              }}
              style={{ fontSize: '0.82rem', padding: '0.4rem 1rem' }}>
              Reclaim GPU Contexts &amp; Load 3D Orbital
            </button>
          </div>
        ) : (
          <div ref={mountRef} style={{ width: '100%', height: '100%', display: 'block' }} />
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
