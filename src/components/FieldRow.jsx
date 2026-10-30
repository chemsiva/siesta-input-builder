import keywords from '../data/keywords.json';

// Tooltip component
export function Tooltip({ keyword }) {
 const meta = keywords[keyword];
 if (!meta) return null;
 return (
 <span className="tooltip-wrap" title={meta.help}>
 <span className="tooltip-icon">?</span>
 </span>
 );
}

// Generic labeled field row
export function FieldRow({ label, keyword, children }) {
 return (
 <div className="field-row">
 <label className="field-label">
 <code>{label || keyword}</code>
 {keyword && <Tooltip keyword={keyword} />}
 </label>
 <div className="field-input">{children}</div>
 </div>
 );
}

// Text input
export function TextInput({ value, onChange, placeholder, mono }) {
 return (
 <input
 type="text"
 className={`input ${mono ? 'mono' : ''}`}
 value={value ?? ''}
 onChange={e => onChange(e.target.value)}
 placeholder={placeholder || ''}
 />
 );
}

// Select input
export function SelectInput({ value, onChange, options }) {
 return (
 <select className="input select" value={value ?? ''} onChange={e => onChange(e.target.value)}>
 {options.map(o => (
 typeof o === 'string'
 ? <option key={o} value={o}>{o}</option>
 : <option key={o.value} value={o.value}>{o.label}</option>
 ))}
 </select>
 );
}

// Toggle (checkbox as logical T/F)
export function LogicalToggle({ value, onChange, label }) {
 const checked = value === 'true' || value === true || value === 'T';
 return (
 <label className="toggle">
 <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked ? 'true' : 'false')} />
 <span className="toggle-label">{label || (checked ? 'true' : 'false')}</span>
 </label>
 );
}

// Section header
export function SectionHeader({ title }) {
 return <h2 className="section-title">{title}</h2>;
}
