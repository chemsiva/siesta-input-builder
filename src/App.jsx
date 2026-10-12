import { Sidebar }   from './components/Sidebar';
import { Toolbar }   from './components/Toolbar';
import { LivePreview } from './components/LivePreview';
import { useFDFStore } from './store/fdfStore';
import { ErrorBoundary } from './components/ErrorBoundary';

import { SystemSection }    from './sections/SystemSection';
import { StructureSection } from './sections/StructureSection';
import { SpeciesSection }   from './sections/SpeciesSection';
import { DFTSection }       from './sections/DFTSection';
import { SCFSection }       from './sections/SCFSection';
import { KPointsSection }   from './sections/KPointsSection';
import { DOSSection }       from './sections/DOSSection';
import { OutputSection }    from './sections/OutputSection';
import { MDSection }        from './sections/MDSection';
import { NEBSection }       from './sections/NEBSection';
import { PhononSection }    from './sections/PhononSection';
import { AdsorptionSection } from './sections/AdsorptionSection';
const SECTION_MAP = {
  system:    <SystemSection />,
  structure: <StructureSection />,
  species:   <SpeciesSection />,
  dft:       <DFTSection />,
  scf:       <SCFSection />,
  kpoints:   <KPointsSection />,
  dos:       <DOSSection />,
  output:    <OutputSection />,
  md:        <MDSection />,
  neb:       <NEBSection />,
  phonon:    <PhononSection />,
  adsorption: <AdsorptionSection />,
};

export default function App() {
  const activeSection = useFDFStore(s => s.activeSection);

  return (
    <div className="app-root">
      <Toolbar />
      <div className="app-body">
        <Sidebar />
        <main className="main-content">
          <ErrorBoundary>
            {SECTION_MAP[activeSection] || <SystemSection />}
          </ErrorBoundary>
        </main>
        <LivePreview />
      </div>
    </div>
  );
}
