import React, { useState, useRef } from 'react';
import { SectionHeader } from '../components/FieldRow';
import { parseSiestaOut } from '../parser/outParser.js';
import { parse1DPlanarData, parseCubeAndComputePlanar, generateDemoCDD } from '../parser/cddParser.js';
import { parse1DPotentialData, parsePotentialCube, analyzeWorkFunction, generateDemoPotential } from '../parser/workFunctionParser.js';
import { PlanarCDDChart } from '../components/PlanarCDDChart.jsx';
import { WorkFunctionChart } from '../components/WorkFunctionChart.jsx';
import { BandAlignmentChart, BAND_PRESETS } from '../components/BandAlignmentChart.jsx';

export function AdsorptionSection() {
  const [activeTab, setActiveTab] = useState('bandalignment'); // 'bandalignment', 'workfunction', 'energy', 'cdd', 'workflow'

  // ═══════════════════════════════════════════════════════════════════════════
  // Band Alignment Diagram State
  // ═══════════════════════════════════════════════════════════════════════════
  const [bandLayers, setBandLayers] = useState(() => JSON.parse(JSON.stringify(BAND_PRESETS[0].layers)));
  const [selectedPreset, setSelectedPreset] = useState('user_screenshot');
  const [showCarrierArrows, setShowCarrierArrows] = useState(true);
  const [showRedoxPotentials, setShowRedoxPotentials] = useState(false);
  const [render3D, setRender3D] = useState(true);

  // Form state for adding a new layer
  const [newLayerName, setNewLayerName] = useState('');
  const [newLayerType, setNewLayerType] = useState('absorber');
  const [newLayerCBM, setNewLayerCBM] = useState('-1.60');
  const [newLayerVBM, setNewLayerVBM] = useState('-6.00');
  const [newLayerColor, setNewLayerColor] = useState('#c084fc');

  // Layer operations
  const handleAddLayer = () => {
    if (!newLayerName.trim()) return;
    const layer = {
      name: newLayerName.trim(),
      type: newLayerType,
      cbm: parseFloat(newLayerCBM) || -1.60,
      vbm: parseFloat(newLayerVBM) || -6.00,
      fermi: ((parseFloat(newLayerCBM) || -1.60) + (parseFloat(newLayerVBM) || -6.00)) / 2,
      isMetal: newLayerType === 'metal',
      color: newLayerColor,
    };
    setBandLayers([...bandLayers, layer]);
    setNewLayerName('');
  };

  const handleRemoveLayer = (idx) => {
    setBandLayers(bandLayers.filter((_, i) => i !== idx));
  };

  const handleMoveLayer = (idx, dir) => {
    const target = idx + dir;
    if (target < 0 || target >= bandLayers.length) return;
    const next = [...bandLayers];
    const temp = next[idx];
    next[idx] = next[target];
    next[target] = temp;
    setBandLayers(next);
  };

  const handleUpdateLayer = (idx, field, val) => {
    const next = [...bandLayers];
    next[idx] = { ...next[idx], [field]: val };
    setBandLayers(next);
  };

  const handleSelectPreset = (presetId) => {
    setSelectedPreset(presetId);
    const found = BAND_PRESETS.find(p => p.id === presetId);
    if (found) {
      setBandLayers(JSON.parse(JSON.stringify(found.layers)));
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Work Function (Phi) State
  // ═══════════════════════════════════════════════════════════════════════════
  const potFileInputRef = useRef(null);
  const outEfRef = useRef(null);
  const [potData, setPotData] = useState(() => generateDemoPotential());
  const [efInput, setEfInput] = useState('-4.380');
  const [vacZMinInput, setVacZMinInput] = useState('26.0');
  const [vacZMaxInput, setVacZMaxInput] = useState('34.0');
  const [cleanPhiInput, setCleanPhiInput] = useState('');
  const [potStatus, setPotStatus] = useState('Showing benchmark demo electrostatic potential profile (perovskite slab).');
  const [potError, setPotError] = useState('');

  // Load Fermi energy directly from SIESTA .out file
  const handleLoadEfFromOut = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseSiestaOut(e.target.result);
        if (parsed.fermiEnergy !== null) {
          setEfInput(parsed.fermiEnergy.toFixed(4));
          setPotStatus(`✓ Loaded Fermi energy E_F = ${parsed.fermiEnergy.toFixed(4)} eV from ${file.name}`);
          if (potData && potData.z) {
            const recomputed = analyzeWorkFunction(
              potData.z,
              potData.vPlanar,
              parsed.fermiEnergy,
              [parseFloat(vacZMinInput) || potData.vacZMin, parseFloat(vacZMaxInput) || potData.vacZMax]
            );
            setPotData(recomputed);
          }
        } else {
          setPotError(`⚠️ Could not find Fermi energy in ${file.name}.`);
        }
      } catch (err) {
        setPotError(`⚠️ Error reading ${file.name}: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Load Electrostatic Potential profile file (.dat, .txt, .cube)
  const handlePotFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPotError('');
    setPotStatus(`Parsing ${file.name}...`);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lower = file.name.toLowerCase();
        const efVal = parseFloat(efInput) || 0;

        let analyzed;
        if (lower.endsWith('.cube')) {
          analyzed = parsePotentialCube(text, efVal);
          setPotStatus(`✓ Extracted planar average of potential along z from Gaussian Cube: ${file.name}`);
        } else {
          analyzed = parse1DPotentialData(text, efVal);
          setPotStatus(`✓ Successfully loaded 1D Potential profile: ${file.name} (${analyzed.z.length} points)`);
        }

        setVacZMinInput(analyzed.vacZMin.toFixed(1));
        setVacZMaxInput(analyzed.vacZMax.toFixed(1));
        setPotData(analyzed);
      } catch (err) {
        setPotError(`Failed to process potential file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Recalculate Work Function when EF or vacuum window is modified
  const handleRecomputeWorkFunction = () => {
    if (!potData || !potData.z) return;
    const efVal = parseFloat(efInput) || 0;
    const zMin = parseFloat(vacZMinInput) || potData.vacZMin;
    const zMax = parseFloat(vacZMaxInput) || potData.vacZMax;
    const recomputed = analyzeWorkFunction(potData.z, potData.vPlanar, efVal, [zMin, zMax]);
    setPotData(recomputed);
    setPotStatus(`✓ Updated work function: Φ = ${recomputed.workFunction.toFixed(3)} eV (V_vac = ${recomputed.vVacuum.toFixed(3)} eV, E_F = ${efVal.toFixed(3)} eV)`);
  };

  const handleLoadDemoPot = () => {
    const demo = generateDemoPotential();
    setPotData(demo);
    setEfInput(demo.eFermi.toFixed(3));
    setVacZMinInput(demo.vacZMin.toFixed(1));
    setVacZMaxInput(demo.vacZMax.toFixed(1));
    setPotError('');
    setPotStatus('Reset to benchmark demo electrostatic potential profile (perovskite slab).');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab 1: Adsorption Energy State
  // ═══════════════════════════════════════════════════════════════════════════
  const [eTotal, setETotal] = useState('');
  const [eSlab, setESlab] = useState('');
  const [eMol, setEMol] = useState('');
  const [numMol, setNumMol] = useState(1);
  const [deltaZPE, setDeltaZPE] = useState('0.00');
  const [temperature, setTemperature] = useState('298.15');
  const [deltaS, setDeltaS] = useState('0.00'); // eV / K

  const [labelTotal, setLabelTotal] = useState('');
  const [labelSlab, setLabelSlab] = useState('');
  const [labelMol, setLabelMol] = useState('');

  const [energyStatus, setEnergyStatus] = useState('');

  const outTotalRef = useRef(null);
  const outSlabRef = useRef(null);
  const outMolRef = useRef(null);

  // File parsers for .out files
  const handleLoadOut = (file, setter, labelSetter, roleName) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const parsed = parseSiestaOut(e.target.result);
        if (parsed.finalEnergyTot !== null) {
          setter(parsed.finalEnergyTot.toFixed(5));
          labelSetter(parsed.systemLabel || file.name);
          setEnergyStatus(`✓ Loaded ${roleName} energy: ${parsed.finalEnergyTot.toFixed(4)} eV from ${file.name}`);
        } else {
          setEnergyStatus(`⚠️ Could not locate final total energy in ${file.name}.`);
        }
      } catch (err) {
        setEnergyStatus(`⚠️ Error reading ${file.name}: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  // Compute Adsorption Energy
  const parsedETot = parseFloat(eTotal);
  const parsedESlab = parseFloat(eSlab);
  const parsedEMol = parseFloat(eMol);
  const parsedN = Math.max(1, parseInt(numMol, 10) || 1);
  const parsedZPE = parseFloat(deltaZPE) || 0;
  const parsedTemp = parseFloat(temperature) || 298.15;
  const parsedDeltaS = parseFloat(deltaS) || 0;

  const hasEnergies = !isNaN(parsedETot) && !isNaN(parsedESlab) && !isNaN(parsedEMol);
  const eAdsEV = hasEnergies ? (parsedETot - parsedESlab - parsedN * parsedEMol) / parsedN : null;
  const eAdsKcal = eAdsEV !== null ? eAdsEV * 23.060548 : null;
  const eAdsKJ = eAdsEV !== null ? eAdsEV * 96.4853 : null;

  // Gibbs free energy Delta G = Delta E + Delta ZPE - T * Delta S
  const deltaGEV = eAdsEV !== null ? eAdsEV + parsedZPE - parsedTemp * parsedDeltaS : null;

  // Binding classification
  const getBindingRegime = (val) => {
    if (val === null) return null;
    if (val < -0.8) return { label: 'Strong Chemisorption', color: 'var(--success, #10b981)', desc: 'Covalent / coordinate bonding to surface' };
    if (val < -0.2) return { label: 'Moderate Chemisorption', color: 'var(--accent, #38bdf8)', desc: 'Moderate charge transfer and polar interaction' };
    if (val <= 0.0) return { label: 'Weak Physisorption', color: 'var(--warning, #fbbf24)', desc: 'Van der Waals / dispersion dominated binding' };
    return { label: 'Endothermic / Unfavorable', color: 'var(--error, #ef4444)', desc: 'Adsorption is energetically unfavorable (requires energy)' };
  };

  const bindingRegime = getBindingRegime(eAdsEV);

  // ═══════════════════════════════════════════════════════════════════════════
  // Tab 2: Planar Average CDD State
  // ═══════════════════════════════════════════════════════════════════════════
  const cddFileInputRef = useRef(null);
  const [cddData, setCddData] = useState(() => generateDemoCDD());
  const [cddStatus, setCddStatus] = useState('Showing benchmark demo profile (perovskite surface + molecular adsorbate).');
  const [cddError, setCddError] = useState('');
  const [cellAreaInput, setCellAreaInput] = useState('160.0');

  // Handle CDD file upload
  const handleCDDFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCddError('');
    setCddStatus(`Parsing ${file.name}...`);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const lower = file.name.toLowerCase();

        let analyzed;
        const area = parseFloat(cellAreaInput) || 160.0;

        if (lower.endsWith('.cube')) {
          analyzed = parseCubeAndComputePlanar(text);
          setCddStatus(`✓ Successfully extracted planar average along z from Gaussian Cube: ${file.name}`);
        } else {
          analyzed = parse1DPlanarData(text);
          setCddStatus(`✓ Successfully loaded 1D Planar Average CDD profile: ${file.name} (${analyzed.z.length} points)`);
        }

        setCddData(analyzed);
      } catch (err) {
        setCddError(`Failed to process CDD file: ${err.message}`);
      }
    };
    reader.readAsText(file);
  };

  const handleLoadDemo = () => {
    setCddData(generateDemoCDD());
    setCddError('');
    setCddStatus('Reset to benchmark demo profile (perovskite surface + molecular adsorbate).');
  };

  return (
    <div className="section-pane">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '0.5rem' }}>
        <SectionHeader title="Surface, Work Function & Adsorption Analysis" />
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
          <button
            className={`btn ${activeTab === 'bandalignment' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('bandalignment')}>
            📶 Band Alignment Diagram
          </button>
          <button
            className={`btn ${activeTab === 'workfunction' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('workfunction')}>
            ⚡ Work Function (Φ)
          </button>
          <button
            className={`btn ${activeTab === 'energy' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('energy')}>
            🎯 Adsorption Energy (E_ads)
          </button>
          <button
            className={`btn ${activeTab === 'cdd' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('cdd')}>
            📉 Planar Average CDD (Δρ̄ & ΔQ)
          </button>
          <button
            className={`btn ${activeTab === 'workflow' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setActiveTab('workflow')}>
            🛠️ SIESTA Grid Workflow
          </button>
        </div>
      </div>

      <p className="section-desc">
        Comprehensive post-DFT surface & device physics workspace: construct publication-grade energy band alignment diagrams, 
        calculate work functions (Φ = V_vac − E_F), adsorption energies (E_ads), and planar-averaged charge density differences (CDD).
      </p>

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* Tab: Band Alignment Diagram Suite                                    */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'bandalignment' && (
        <div className="band-alignment-pane">
          {/* Presets & Controls Card */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem', marginBottom: '0.8rem' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>🎨</span> Band Alignment Presets & Display Options
                </h3>
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: 'var(--muted)' }}>
                  Select standard device architectures or build your own custom heterojunction:
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <select
                  className="input-select"
                  style={{ fontSize: '0.82rem', padding: '0.3rem 0.6rem' }}
                  value={selectedPreset}
                  onChange={e => handleSelectPreset(e.target.value)}>
                  {BAND_PRESETS.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Display Toggles */}
            <div style={{
              display: 'flex',
              gap: '1.2rem',
              flexWrap: 'wrap',
              paddingTop: '0.6rem',
              borderTop: '1px solid var(--border)',
              fontSize: '0.8rem',
              alignItems: 'center',
            }}>
              <label className="toggle" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={render3D}
                  onChange={e => setRender3D(e.target.checked)}
                />
                <span className="toggle-label">
                  3D Perspective Bevels (Matches Publication Figure)
                </span>
              </label>

              <label className="toggle" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showCarrierArrows}
                  onChange={e => setShowCarrierArrows(e.target.checked)}
                />
                <span className="toggle-label">
                  Carrier Transport Pathways (<span style={{ color: '#eab308' }}>e⁻</span> & <span style={{ color: '#22c55e' }}>h⁺</span> Extraction Arrows)
                </span>
              </label>

              <label className="toggle" style={{ cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showRedoxPotentials}
                  onChange={e => setShowRedoxPotentials(e.target.checked)}
                />
                <span className="toggle-label">
                  Water Splitting Potentials (H⁺/H₂ & O₂/H₂O)
                </span>
              </label>
            </div>
          </div>

          {/* Interactive Chart Component */}
          <BandAlignmentChart
            layers={bandLayers}
            title="Energy Band Alignment & Heterojunction Diagram"
            showCarrierArrows={showCarrierArrows}
            showRedoxPotentials={showRedoxPotentials}
            render3D={render3D}
          />

          {/* Layer Management Table Card */}
          <div style={{
            marginTop: '1.2rem',
            background: 'rgba(15, 23, 42, 0.75)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.92rem', color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span>📋</span> Manage Device Layers & Energy Levels
              </h4>
              <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                Energy scale: Vacuum level at 0.0 eV (all CBM and VBM values are negative eV)
              </span>
            </div>

            {/* Table of Layers */}
            <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', textAlign: 'left', color: 'var(--muted)' }}>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Order</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Material</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Layer Type</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>CBM / LUMO (eV)</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>VBM / HOMO (eV)</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Bandgap Eg</th>
                    <th style={{ padding: '0.4rem 0.5rem' }}>Color</th>
                    <th style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {bandLayers.map((l, i) => (
                    <tr key={`layer-row-${i}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'monospace', color: 'var(--muted)' }}>
                        {i + 1}
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <input
                          type="text"
                          className="input-text"
                          style={{ width: '110px', padding: '0.2rem 0.4rem', fontSize: '0.78rem', fontWeight: 'bold' }}
                          value={l.name}
                          onChange={e => handleUpdateLayer(i, 'name', e.target.value)}
                        />
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <select
                          className="input-select"
                          style={{ padding: '0.2rem 0.4rem', fontSize: '0.75rem' }}
                          value={l.type || 'absorber'}
                          onChange={e => handleUpdateLayer(i, 'type', e.target.value)}>
                          <option value="electrode">Electrode</option>
                          <option value="etl">ETL</option>
                          <option value="absorber">Absorber</option>
                          <option value="htl">HTL</option>
                          <option value="metal">Metal</option>
                        </select>
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <input
                          type="number"
                          step="0.05"
                          className="input-text"
                          style={{ width: '80px', padding: '0.2rem 0.4rem', fontSize: '0.78rem', fontFamily: 'monospace' }}
                          value={l.cbm}
                          onChange={e => handleUpdateLayer(i, 'cbm', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <input
                          type="number"
                          step="0.05"
                          className="input-text"
                          style={{ width: '80px', padding: '0.2rem 0.4rem', fontSize: '0.78rem', fontFamily: 'monospace' }}
                          value={l.vbm}
                          onChange={e => handleUpdateLayer(i, 'vbm', parseFloat(e.target.value) || 0)}
                        />
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', fontFamily: 'monospace', color: '#38bdf8' }}>
                        {(Math.abs(l.cbm - l.vbm)).toFixed(2)} eV
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem' }}>
                        <input
                          type="color"
                          style={{ width: '32px', height: '22px', border: 'none', borderRadius: '3px', cursor: 'pointer', background: 'transparent' }}
                          value={l.color || '#c084fc'}
                          onChange={e => handleUpdateLayer(i, 'color', e.target.value)}
                        />
                      </td>
                      <td style={{ padding: '0.4rem 0.5rem', textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '0.25rem' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.15rem 0.35rem', fontSize: '0.68rem' }}
                            disabled={i === 0}
                            onClick={() => handleMoveLayer(i, -1)}
                            title="Move left">
                            ◀
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.15rem 0.35rem', fontSize: '0.68rem' }}
                            disabled={i === bandLayers.length - 1}
                            onClick={() => handleMoveLayer(i, 1)}
                            title="Move right">
                            ▶
                          </button>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.15rem 0.35rem', fontSize: '0.68rem', color: 'var(--error, #ef4444)' }}
                            onClick={() => handleRemoveLayer(i)}
                            title="Delete layer">
                            ✕
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Add New Layer Row */}
            <div style={{
              background: 'rgba(255,255,255,0.02)',
              border: '1px dashed var(--border)',
              borderRadius: '6px',
              padding: '0.7rem',
              display: 'flex',
              gap: '0.6rem',
              flexWrap: 'wrap',
              alignItems: 'center',
            }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 'bold', color: 'var(--fg)', marginRight: '0.2rem' }}>
                ➕ Add Layer:
              </span>
              <input
                type="text"
                className="input-text"
                style={{ width: '120px', padding: '0.25rem 0.45rem', fontSize: '0.78rem' }}
                placeholder="e.g. MAPbI3"
                value={newLayerName}
                onChange={e => setNewLayerName(e.target.value)}
              />
              <select
                className="input-select"
                style={{ padding: '0.25rem 0.45rem', fontSize: '0.78rem' }}
                value={newLayerType}
                onChange={e => setNewLayerType(e.target.value)}>
                <option value="electrode">Electrode</option>
                <option value="etl">ETL</option>
                <option value="absorber">Absorber</option>
                <option value="htl">HTL</option>
                <option value="metal">Metal</option>
              </select>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>CBM:</span>
                <input
                  type="number"
                  step="0.05"
                  className="input-text"
                  style={{ width: '75px', padding: '0.25rem 0.45rem', fontSize: '0.78rem', fontFamily: 'monospace' }}
                  value={newLayerCBM}
                  onChange={e => setNewLayerCBM(e.target.value)}
                  placeholder="-1.60"
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>VBM:</span>
                <input
                  type="number"
                  step="0.05"
                  className="input-text"
                  style={{ width: '75px', padding: '0.25rem 0.45rem', fontSize: '0.78rem', fontFamily: 'monospace' }}
                  value={newLayerVBM}
                  onChange={e => setNewLayerVBM(e.target.value)}
                  placeholder="-6.00"
                />
              </div>
              <input
                type="color"
                style={{ width: '32px', height: '24px', border: 'none', borderRadius: '3px', cursor: 'pointer', background: 'transparent' }}
                value={newLayerColor}
                onChange={e => setNewLayerColor(e.target.value)}
              />
              <button
                className="btn btn-primary btn-sm"
                onClick={handleAddLayer}
                style={{ padding: '0.25rem 0.7rem', fontSize: '0.78rem' }}>
                Add to Diagram
              </button>
            </div>
          </div>
        </div>
      )}


      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* Tab 0: Work Function (Phi) Calculator & Potential Profile             */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'workfunction' && (
        <div className="work-function-pane">
          {/* Upload & Controls Card */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📂</span> Upload Electrostatic Potential Profile or Gaussian Cube (.cube)
                </h3>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                  Upload 1D Planar Potential (from Macroave / <code>average_z.m</code>: <code>.dat</code>, <code>.txt</code>) or 3D Gaussian Cube (<code>.cube</code> from <code>grid2cube .VH</code>).
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <input
                  ref={potFileInputRef}
                  type="file"
                  accept=".dat,.txt,.csv,.cube"
                  style={{ display: 'none' }}
                  onChange={handlePotFileUpload}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => potFileInputRef.current?.click()}
                  title="Upload .dat or .cube potential file">
                  📁 Load Potential File
                </button>

                <input
                  ref={outEfRef}
                  type="file"
                  accept=".out,.log,.txt"
                  style={{ display: 'none' }}
                  onChange={e => handleLoadEfFromOut(e.target.files?.[0])}
                />
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => outEfRef.current?.click()}
                  title="Load Fermi energy directly from SIESTA .out file">
                  📄 Load E_F from .out
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleLoadDemoPot}
                  title="Load benchmark perovskite slab potential profile">
                  ✨ Reset to Demo Profile
                </button>
              </div>
            </div>

            {/* Controls for Fermi Energy and Vacuum Window */}
            <div style={{
              marginTop: '1rem',
              paddingTop: '0.8rem',
              borderTop: '1px solid var(--border)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '0.9rem',
              alignItems: 'flex-end',
            }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#fbbf24', display: 'block', marginBottom: '0.25rem' }}>
                  Fermi Energy E_F (eV)
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    step="0.01"
                    className="input-text"
                    style={{ width: '110px', fontFamily: 'monospace', fontSize: '0.82rem' }}
                    value={efInput}
                    onChange={e => setEfInput(e.target.value)}
                    placeholder="-4.38"
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>eV</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#34d399', display: 'block', marginBottom: '0.25rem' }}>
                  Vacuum Window [z_min, z_max] (Å)
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    step="0.5"
                    className="input-text"
                    style={{ width: '75px', fontFamily: 'monospace', fontSize: '0.82rem' }}
                    value={vacZMinInput}
                    onChange={e => setVacZMinInput(e.target.value)}
                    placeholder="26.0"
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>to</span>
                  <input
                    type="number"
                    step="0.5"
                    className="input-text"
                    style={{ width: '75px', fontFamily: 'monospace', fontSize: '0.82rem' }}
                    value={vacZMaxInput}
                    onChange={e => setVacZMaxInput(e.target.value)}
                    placeholder="34.0"
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>Å</span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Clean Slab Ref Φ_clean (optional)
                </label>
                <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                  <input
                    type="number"
                    step="0.05"
                    className="input-text"
                    style={{ width: '90px', fontFamily: 'monospace', fontSize: '0.82rem' }}
                    value={cleanPhiInput}
                    onChange={e => setCleanPhiInput(e.target.value)}
                    placeholder="e.g. 4.90"
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>eV</span>
                </div>
              </div>

              <div>
                <button
                  className="btn btn-primary btn-sm"
                  style={{ padding: '0.35rem 0.8rem', fontSize: '0.8rem', fontWeight: 600 }}
                  onClick={handleRecomputeWorkFunction}>
                  🔄 Recalculate Work Function
                </button>
              </div>
            </div>

            {/* Shift comparison if Clean Slab Ref is given */}
            {cleanPhiInput && !isNaN(parseFloat(cleanPhiInput)) && potData && (
              <div style={{
                marginTop: '0.8rem',
                padding: '0.4rem 0.7rem',
                borderRadius: '6px',
                background: 'rgba(56, 189, 248, 0.1)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                fontSize: '0.8rem',
                display: 'flex',
                gap: '1rem',
                alignItems: 'center',
              }}>
                <span>
                  Work Function Change: <strong>ΔΦ = {(potData.workFunction - parseFloat(cleanPhiInput)).toFixed(3)} eV</strong>
                  {potData.workFunction - parseFloat(cleanPhiInput) < 0 ? ' (Work function decreased / electron donation)' : ' (Work function increased / electron withdrawal)'}
                </span>
              </div>
            )}

            {potStatus && (
              <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: 'var(--success, #10b981)' }}>
                {potStatus}
              </div>
            )}
            {potError && (
              <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: 'var(--error, #ef4444)' }}>
                ⚠️ {potError}
              </div>
            )}
          </div>

          {/* Interactive Chart */}
          {potData && (
            <WorkFunctionChart
              potData={potData}
              title="Electrostatic Potential Profile V̄(z) & Vacuum Barrier (Φ = V_vac − E_F)"
            />
          )}
        </div>
      )}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* Tab 1: Adsorption Energy Calculator                                  */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'energy' && (
        <div className="adsorption-energy-pane">
          {/* File Upload & Input Grid */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1.1rem',
            marginBottom: '1rem',
          }}>
            <h3 style={{ margin: '0 0 0.8rem', fontSize: '0.95rem', color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span>📥</span> Ground-State Total Energies (E_total, E_slab, E_molecule)
            </h3>

            <p style={{ fontSize: '0.8rem', color: 'var(--muted)', margin: '0 0 1rem' }}>
              Upload the 3 SIESTA <code>.out</code> output log files to auto-extract energies, or enter the values directly:
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
              {/* 1. Total System */}
              <div style={{
                background: 'rgba(56, 189, 248, 0.06)',
                border: '1px solid rgba(56, 189, 248, 0.25)',
                borderRadius: '6px',
                padding: '0.8rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <strong style={{ fontSize: '0.82rem', color: '#38bdf8' }}>① Slab + Adsorbate (E_total)</strong>
                  <input
                    ref={outTotalRef}
                    type="file"
                    accept=".out,.log,.txt"
                    style={{ display: 'none' }}
                    onChange={e => handleLoadOut(e.target.files?.[0], setETotal, setLabelTotal, 'Total System')}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}
                    onClick={() => outTotalRef.current?.click()}>
                    📁 Load .out
                  </button>
                </div>
                {labelTotal && <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>Label: {labelTotal}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    type="number"
                    step="0.0001"
                    className="input-text"
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }}
                    value={eTotal}
                    onChange={e => setETotal(e.target.value)}
                    placeholder="e.g. -14256.7891"
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>eV</span>
                </div>
              </div>

              {/* 2. Clean Slab */}
              <div style={{
                background: 'rgba(251, 191, 36, 0.06)',
                border: '1px solid rgba(251, 191, 36, 0.25)',
                borderRadius: '6px',
                padding: '0.8rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <strong style={{ fontSize: '0.82rem', color: '#fbbf24' }}>② Clean Slab (E_slab)</strong>
                  <input
                    ref={outSlabRef}
                    type="file"
                    accept=".out,.log,.txt"
                    style={{ display: 'none' }}
                    onChange={e => handleLoadOut(e.target.files?.[0], setESlab, setLabelSlab, 'Clean Slab')}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}
                    onClick={() => outSlabRef.current?.click()}>
                    📁 Load .out
                  </button>
                </div>
                {labelSlab && <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>Label: {labelSlab}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    type="number"
                    step="0.0001"
                    className="input-text"
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }}
                    value={eSlab}
                    onChange={e => setESlab(e.target.value)}
                    placeholder="e.g. -13850.1234"
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>eV</span>
                </div>
              </div>

              {/* 3. Free Molecule */}
              <div style={{
                background: 'rgba(52, 211, 153, 0.06)',
                border: '1px solid rgba(52, 211, 153, 0.25)',
                borderRadius: '6px',
                padding: '0.8rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <strong style={{ fontSize: '0.82rem', color: '#34d399' }}>③ Free Molecule (E_mol)</strong>
                  <input
                    ref={outMolRef}
                    type="file"
                    accept=".out,.log,.txt"
                    style={{ display: 'none' }}
                    onChange={e => handleLoadOut(e.target.files?.[0], setEMol, setLabelMol, 'Free Molecule')}
                  />
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ fontSize: '0.68rem', padding: '0.15rem 0.4rem' }}
                    onClick={() => outMolRef.current?.click()}>
                    📁 Load .out
                  </button>
                </div>
                {labelMol && <div style={{ fontSize: '0.72rem', color: 'var(--muted)', marginBottom: '0.3rem' }}>Label: {labelMol}</div>}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <input
                    type="number"
                    step="0.0001"
                    className="input-text"
                    style={{ width: '100%', fontFamily: 'monospace', fontSize: '0.85rem' }}
                    value={eMol}
                    onChange={e => setEMol(e.target.value)}
                    placeholder="e.g. -405.8920"
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>eV</span>
                </div>
              </div>
            </div>

            {/* Parameters & Corrections */}
            <div style={{
              marginTop: '1rem',
              paddingTop: '0.9rem',
              borderTop: '1px solid var(--border)',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '0.8rem',
            }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Number of Adsorbates (N)
                </label>
                <input
                  type="number"
                  min="1"
                  className="input-text"
                  style={{ width: '90px', fontFamily: 'monospace', fontSize: '0.82rem' }}
                  value={numMol}
                  onChange={e => setNumMol(e.target.value)}
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Zero-Point Correction ΔZPE (eV)
                </label>
                <input
                  type="number"
                  step="0.01"
                  className="input-text"
                  style={{ width: '110px', fontFamily: 'monospace', fontSize: '0.82rem' }}
                  value={deltaZPE}
                  onChange={e => setDeltaZPE(e.target.value)}
                  placeholder="0.00"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Temperature T (K)
                </label>
                <input
                  type="number"
                  step="1"
                  className="input-text"
                  style={{ width: '90px', fontFamily: 'monospace', fontSize: '0.82rem' }}
                  value={temperature}
                  onChange={e => setTemperature(e.target.value)}
                  placeholder="298.15"
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>
                  Entropy Correction ΔS (eV / K)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  className="input-text"
                  style={{ width: '110px', fontFamily: 'monospace', fontSize: '0.82rem' }}
                  value={deltaS}
                  onChange={e => setDeltaS(e.target.value)}
                  placeholder="0.0000"
                />
              </div>
            </div>

            {energyStatus && (
              <div style={{ marginTop: '0.8rem', fontSize: '0.78rem', color: 'var(--accent)' }}>
                {energyStatus}
              </div>
            )}
          </div>

          {/* Results Summary Card */}
          {hasEnergies && (
            <div style={{
              background: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid var(--accent, #38bdf8)',
              borderRadius: '8px',
              padding: '1.2rem',
              marginBottom: '1rem',
              boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.8rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>⚡</span> Calculated Adsorption Energy & Binding Affinity
                </h3>
                {bindingRegime && (
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    padding: '0.25rem 0.6rem',
                    borderRadius: '4px',
                    background: `${bindingRegime.color}22`,
                    border: `1px solid ${bindingRegime.color}`,
                    color: bindingRegime.color,
                  }}>
                    {bindingRegime.label}
                  </span>
                )}
              </div>

              {/* Energy Values in Multiple Units */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '0.8rem',
                marginBottom: '1rem',
              }}>
                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Adsorption Energy E_ads</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--accent)', fontFamily: 'monospace' }}>
                    {eAdsEV.toFixed(4)} <small style={{ fontSize: '0.8rem' }}>eV</small>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Thermochemical Units</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fbbf24', fontFamily: 'monospace' }}>
                    {eAdsKcal.toFixed(2)} <small style={{ fontSize: '0.8rem' }}>kcal/mol</small>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>SI Metric Units</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#34d399', fontFamily: 'monospace' }}>
                    {eAdsKJ.toFixed(2)} <small style={{ fontSize: '0.8rem' }}>kJ/mol</small>
                  </div>
                </div>

                <div style={{ background: 'rgba(255,255,255,0.03)', padding: '0.8rem', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>Gibbs Free Energy ΔG_ads ({parsedTemp} K)</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#a78bfa', fontFamily: 'monospace' }}>
                    {deltaGEV.toFixed(4)} <small style={{ fontSize: '0.8rem' }}>eV</small>
                  </div>
                </div>
              </div>

              {/* Formula & Regime Note */}
              <div style={{ fontSize: '0.8rem', color: 'var(--muted)', background: 'rgba(15, 23, 42, 0.5)', padding: '0.6rem 0.8rem', borderRadius: '6px' }}>
                <strong>Formula:</strong> <code>E_ads = [E_total - E_slab - ({parsedN} × E_mol)] / {parsedN}</code>
                <div style={{ marginTop: '0.2rem' }}>
                  <strong>Regime:</strong> {bindingRegime?.desc}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* Tab 2: Planar Average Charge Density Difference (CDD)                 */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'cdd' && (
        <div className="planar-cdd-pane">
          {/* File Upload & Settings Card */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.65)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1rem',
            marginBottom: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.8rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', margin: 0, color: 'var(--fg)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span>📂</span> Upload Planar Average Profile or Gaussian Cube
                </h3>
                <p style={{ margin: '0.3rem 0 0', fontSize: '0.8rem', color: 'var(--muted)' }}>
                  Upload a 1D Planar Average file (<code>.dat</code>, <code>.txt</code>, <code>.csv</code>) or a 3D Gaussian Cube file (<code>.cube</code>).
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input
                  ref={cddFileInputRef}
                  type="file"
                  accept=".dat,.txt,.csv,.cube"
                  style={{ display: 'none' }}
                  onChange={handleCDDFileUpload}
                />
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => cddFileInputRef.current?.click()}
                  title="Upload .dat or .cube file">
                  📁 Choose CDD File
                </button>

                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleLoadDemo}
                  title="Load benchmark perovskite adsorption profile">
                  ✨ Reset to Demo Profile
                </button>
              </div>
            </div>

            {/* Surface area input for Work function & dipole calculation */}
            <div style={{ marginTop: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--muted)' }}>
                Surface Area A (Å²):
              </label>
              <input
                type="number"
                step="5"
                className="input-text"
                style={{ width: '90px', padding: '0.25rem 0.45rem', fontSize: '0.8rem', fontFamily: 'monospace' }}
                value={cellAreaInput}
                onChange={e => setCellAreaInput(e.target.value)}
                placeholder="160.0"
              />
              <span style={{ fontSize: '0.72rem', color: 'var(--muted)' }}>
                (Used for interface dipole moment & work function shift ΔΦ calculation)
              </span>
            </div>

            {cddStatus && (
              <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: 'var(--success, #10b981)' }}>
                {cddStatus}
              </div>
            )}
            {cddError && (
              <div style={{ marginTop: '0.6rem', fontSize: '0.78rem', color: 'var(--error, #ef4444)' }}>
                ⚠️ {cddError}
              </div>
            )}
          </div>

          {/* Render Planar CDD Chart */}
          {cddData && (
            <PlanarCDDChart
              cddData={cddData}
              title="Planar Average Charge Density Difference Δρ̄(z) & Cumulative Charge Transfer ΔQ(z)"
            />
          )}
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════ */}
      {/* Tab 3: SIESTA Grid & Workflow Generator                              */}
      {/* ═════════════════════════════════════════════════════════════════════ */}
      {activeTab === 'workflow' && (
        <div className="siesta-workflow-pane">
          <div className="info-box" style={{ marginBottom: '1rem' }}>
            <h4 style={{ margin: '0 0 0.5rem', color: 'var(--accent)' }}>
              📖 How Charge Density Difference (CDD) Works in SIESTA
            </h4>
            <p style={{ margin: '0 0 0.5rem', lineHeight: '1.6' }}>
              To compute the 3D charge density difference in real space:
            </p>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '0.6rem 0.8rem', borderRadius: '4px', fontFamily: 'monospace', marginBottom: '0.6rem' }}>
              Δρ(r) = ρ_total(r) − ρ_slab(r) − ρ_adsorbate(r)
            </div>
            <p style={{ margin: '0 0 0.5rem', lineHeight: '1.6' }}>
              <strong>Important Rule:</strong> All 3 calculations MUST have identical unit cell lattice vectors, origin, and real-space grid cutoff (<code>MeshCutoff</code>) so that the grid points map 1-to-1 without interpolation artifacts.
            </p>
          </div>

          {/* Python automated extraction script */}
          <div style={{
            background: 'rgba(15, 23, 42, 0.7)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1rem',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
              <strong style={{ fontSize: '0.88rem', color: 'var(--fg)' }}>
                🐍 Automated Python Script (calculate_siesta_cdd_planar.py)
              </strong>
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  const script = `#!/usr/bin/env python3
"""
calculate_siesta_cdd_planar.py
Computes 3D Charge Density Difference (CDD) and 1D Planar Average along z from SIESTA grids.
Requires: pip install sisl numpy scipy matplotlib
"""
import numpy as np
import sisl

def compute_cdd_planar(total_file, slab_file, mol_file, out_dat="planar_cdd.dat"):
    print("[*] Reading grids...")
    g_tot = sisl.get_sile(total_file).read_grid()
    g_slab = sisl.get_sile(slab_file).read_grid()
    g_mol = sisl.get_sile(mol_file).read_grid()

    print("[*] Subtracting grids: Delta_rho = rho_tot - rho_slab - rho_mol")
    delta_rho = g_tot.copy()
    delta_rho.grid = g_tot.grid - g_slab.grid - g_mol.grid

    # Save 3D cube for VESTA visualization
    delta_rho.write("cdd_diff.cube")
    print("[+] Wrote 3D CDD grid to cdd_diff.cube")

    # Compute planar average along z (axis 2)
    # Average across x (axis 0) and y (axis 1)
    planar_avg = np.mean(delta_rho.grid, axis=(0, 1))

    # Cell z-length
    c_axis = g_tot.cell[2, 2]
    nz = len(planar_avg)
    z_coords = np.linspace(0, c_axis, nz, endpoint=False)

    # Cumulative charge transfer Delta Q(z) = integral Delta_rho(z') dz'
    dz = z_coords[1] - z_coords[0]
    delta_q = np.cumsum(planar_avg) * dz

    # Save to 3-column .dat file
    data = np.column_stack([z_coords, planar_avg, delta_q])
    np.savetxt(out_dat, data, header="z(Angstrom)\\tDeltaRho(e/A)\\tDeltaQ(e)", fmt="%.6e")
    print(f"[+] Saved 1D Planar Average CDD profile to {out_dat}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 4:
        print("Usage: python calculate_siesta_cdd_planar.py System.RHO Slab.RHO Mol.RHO")
        sys.exit(1)
    compute_cdd_planar(sys.argv[1], sys.argv[2], sys.argv[3])
`;
                  const blob = new Blob([script], { type: 'text/x-python' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = 'calculate_siesta_cdd_planar.py';
                  a.click();
                  URL.revokeObjectURL(url);
                }}>
                💾 Download Python Script
              </button>
            </div>

            <pre style={{
              background: '#0a0f1d',
              padding: '0.8rem',
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: '#94a3b8',
              overflowX: 'auto',
              lineHeight: '1.45',
            }}>
{`# 1. Run the script with your three .RHO or .cube files:
python calculate_siesta_cdd_planar.py Total.RHO Slab.RHO Mol.RHO

# 2. Output files generated:
#   - cdd_diff.cube    -> 3D volumetric difference for VESTA / VMD / OVITO
#   - planar_cdd.dat   -> 1D planar average profile directly uploadable into this GUI!`}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
