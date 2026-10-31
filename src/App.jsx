import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { LivePreview } from './components/LivePreview';
import { useFDFStore } from './store/fdfStore';
import { ErrorBoundary } from './components/ErrorBoundary';

import { SystemSection } from './sections/SystemSection';
import { StructureSection } from './sections/StructureSection';
import { SpeciesSection } from './sections/SpeciesSection';
import { DFTSection } from './sections/DFTSection';
import { SCFSection } from './sections/SCFSection';
import { KPointsSection } from './sections/KPointsSection';
import { DOSSection } from './sections/DOSSection';
import { OutputSection } from './sections/OutputSection';
import { MDSection } from './sections/MDSection';
import { NEBSection } from './sections/NEBSection';
import { PhononSection } from './sections/PhononSection';
import { AdsorptionSection } from './sections/AdsorptionSection';
import { VaspConverterSection } from './sections/VaspConverterSection';
import { ChargeTransferSection } from './sections/ChargeTransferSection';
import { OpticalSection } from './sections/OpticalSection';

function renderSection(section) {
 switch (section) {
 case 'system': return <SystemSection />;
 case 'structure': return <StructureSection />;
 case 'species': return <SpeciesSection />;
 case 'dft': return <DFTSection />;
 case 'scf': return <SCFSection />;
 case 'kpoints': return <KPointsSection />;
 case 'dos': return <DOSSection />;
 case 'output': return <OutputSection />;
 case 'md': return <MDSection />;
 case 'neb': return <NEBSection />;
 case 'phonon': return <PhononSection />;
 case 'adsorption': return <AdsorptionSection />;
    case 'vasp': return <VaspConverterSection />;
    case 'charge': return <ChargeTransferSection />;
    case 'optical': return <OpticalSection />;
    default: return <SystemSection />;
 }
}
export default function App() {
 const activeSection = useFDFStore(s => s.activeSection);
 const theme = useFDFStore(s => s.theme || 'dark');

 return (
 <div className={`app-root theme-${theme}`} data-theme={theme}>
 <Toolbar />
 <div className="app-body">
 <Sidebar />
 <main className="main-content">
 <ErrorBoundary>
 {renderSection(activeSection)}
 </ErrorBoundary>
 </main>
 <LivePreview />
 </div>
 </div>
 );
}
