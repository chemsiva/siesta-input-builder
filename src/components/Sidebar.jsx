import { useFDFStore } from '../store/fdfStore';

const SECTIONS = [
  { id: 'system',    label: '① System',         icon: '🖥️' },
  { id: 'structure', label: '② Structure',       icon: '🔷' },
  { id: 'species',   label: '③ Species & Basis', icon: '⚛️' },
  { id: 'dft',       label: '④ DFT / XC',        icon: '⚡' },
  { id: 'scf',       label: '⑤ SCF Control',     icon: '🔄' },
  { id: 'kpoints',   label: '⑥ K-Points',        icon: '🔵' },
  { id: 'dos',       label: '⑦ Bands & DOS / PDOS', icon: '📶' },
  { id: 'output',    label: '⑧ Output Flags',    icon: '📄' },
  { id: 'md',        label: '⑨ MD / Relax',      icon: '🏃' },
  { id: 'neb',       label: '⑩ CI-NEB',          icon: '⛰️' },
  { id: 'phonon',    label: '⑪ Phonons',         icon: '〰️' },
  { id: 'adsorption', label: '⑫ Surface & Work Function', icon: '🌊' },
  { id: 'vasp',       label: '⑬ VASP to FDF Converter',   icon: '🔄' },
];

export function Sidebar() {
  const activeSection = useFDFStore(s => s.activeSection);
  const setActiveSection = useFDFStore(s => s.setActiveSection);
  const validationErrors = useFDFStore(s => s.validationErrors);

  return (
    <nav className="sidebar">
      <div className="sidebar-logo">
        <span className="logo-icon">⚗️</span>
        <span className="logo-text">SIESTA<br/><small>Input Builder</small></span>
      </div>
      <div className="sidebar-version">v5.4.2</div>
      <ul className="sidebar-nav">
        {SECTIONS.map(s => (
          <li key={s.id}>
            <button
              className={`nav-item ${activeSection === s.id ? 'active' : ''}`}
              onClick={() => setActiveSection(s.id)}
            >
              <span className="nav-icon">{s.icon}</span>
              <span className="nav-label">{s.label}</span>
            </button>
          </li>
        ))}
      </ul>
      {validationErrors.length > 0 && (
        <div className="sidebar-errors">
          <div className="error-header">⚠️ {validationErrors.length} issue{validationErrors.length > 1 ? 's' : ''}</div>
          {validationErrors.map((e, i) => <div key={i} className="error-item">• {e}</div>)}
        </div>
      )}
    </nav>
  );
}
