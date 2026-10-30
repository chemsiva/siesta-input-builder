import { useFDFStore } from '../store/fdfStore';

const SECTIONS = [
 { id: 'system', num: '1', label: 'System' },
 { id: 'structure', num: '2', label: 'Structure' },
 { id: 'species', num: '3', label: 'Species & Basis' },
 { id: 'dft', num: '4', label: 'DFT / XC' },
 { id: 'scf', num: '5', label: 'SCF Control' },
 { id: 'kpoints', num: '6', label: 'K-Points' },
 { id: 'dos', num: '7', label: 'Bands & DOS' },
 { id: 'output', num: '8', label: 'Output Flags' },
 { id: 'md', num: '9', label: 'MD / Relax' },
 { id: 'neb', num: '10', label: 'CI-NEB' },
 { id: 'phonon', num: '11', label: 'Phonons' },
 { id: 'adsorption', num: '12', label: 'Surface & Work Function' },
 { id: 'vasp', num: '13', label: 'VASP Converter' },
];
export function Sidebar() {
 const activeSection = useFDFStore(s => s.activeSection);
 const setActiveSection = useFDFStore(s => s.setActiveSection);
 const validationErrors = useFDFStore(s => s.validationErrors);

 return (
 <nav className="sidebar">
 <div className="sidebar-logo">
 <span className="logo-badge" style={{
 background: 'var(--accent)',
 color: '#ffffff',
 fontSize: '0.75rem',
 fontWeight: 700,
 padding: '2px 6px',
 borderRadius: '4px',
 fontFamily: 'monospace'
 }}>SIESTA</span>
        <span className="logo-text">Input Builder<br/><small>v5.4.2 Studio</small></span>
      </div>
      <div className="sidebar-version">v5.4.2</div>
 <ul className="sidebar-nav">
 {SECTIONS.map(s => (
 <li key={s.id}>
 <button
 className={`nav-item ${activeSection === s.id ? 'active' : ''}`}
 onClick={() => setActiveSection(s.id)}
 >
 <span className="nav-num" style={{
 display: 'inline-block',
 width: '18px',
 height: '18px',
 lineHeight: '18px',
 textAlign: 'center',
 fontSize: '0.7rem',
 borderRadius: '3px',
 background: activeSection === s.id ? 'var(--accent)' : 'var(--surface2)',
 color: activeSection === s.id ? '#ffffff' : 'var(--muted)',
 fontWeight: 700,
 marginRight: '6px'
 }}>{s.num}</span>
 <span className="nav-label">{s.label}</span>
 </button>
 </li>
 ))}
 </ul>
 {validationErrors.length > 0 && (
 <div className="sidebar-errors">
 <div className="error-header">Validation Notice ({validationErrors.length})</div>
 {validationErrors.map((e, i) => <div key={i} className="error-item">• {e}</div>)}
 </div>
 )}
 </nav>
 );
}
