import { useFDFStore } from '../store/fdfStore';
import { FieldRow, TextInput, SectionHeader } from '../components/FieldRow';

export function SystemSection() {
 const system = useFDFStore(s => s.system);
 const setField = useFDFStore(s => s.setField);
 const set = (k, v) => setField('system', k, v);

 return (
 <div className="section-pane">
 <SectionHeader title="System" />
 <p className="section-desc">Basic identifiers written to every output file name.</p>

 <FieldRow label="SystemLabel" keyword="SystemLabel">
 <TextInput mono value={system.SystemLabel} onChange={v => set('SystemLabel', v)}
 placeholder="siesta (≤20 chars, no spaces)" />
 </FieldRow>

 <FieldRow label="SystemName" keyword="SystemName">
 <TextInput value={system.SystemName} onChange={v => set('SystemName', v)}
 placeholder="Descriptive name (spaces OK)" />
 </FieldRow>

 <div className="field-row-group">
 <FieldRow label="NumberOfAtoms" keyword="NumberOfAtoms">
 <TextInput mono value={system.NumberOfAtoms} onChange={v => set('NumberOfAtoms', v)}
 placeholder="auto (from coordinates block)" />
 </FieldRow>
 <FieldRow label="NumberOfSpecies" keyword="NumberOfSpecies">
 <TextInput mono value={system.NumberOfSpecies} onChange={v => set('NumberOfSpecies', v)}
 placeholder="auto (from species block)" />
 </FieldRow>
 </div>

 <div className="info-box">
 <strong>Tip:</strong> NumberOfAtoms and NumberOfSpecies are optional in SIESTA 5 — they are auto-detected
 from the coordinate and species blocks. Leave blank to omit from the .fdf.
 </div>
 </div>
 );
}
