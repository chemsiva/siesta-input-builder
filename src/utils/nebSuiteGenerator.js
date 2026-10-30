import JSZip from 'jszip';
import { serializeFDF } from '../parser/fdfSerializer.js';

/**
 * Generate a complete, ready-to-run CI-NEB Suite for SIESTA
 */
export async function generateNEBSuite(baseState, nebResult, options = {}) {
 const { climb = true, springK = 0.1, fmax = 0.05, optimizer = 'BFGS', pseudoSettings = {} } = options;
 const pseudoDir = (pseudoSettings.directory || '').trim();
 const pseudoFmt = pseudoSettings.format || 'psf';
 const pseudoMode = pseudoSettings.pathMode || 'filename';
 const detectedFiles = pseudoSettings.detectedFiles || [];
 const zip = new JSZip();
 const folder = zip.folder(`siesta_cineb_${baseState.system.SystemLabel || 'neb'}`);

 const sysLabel = baseState.system.SystemLabel || 'siesta';
 const images = nebResult.images || [];

 // 1. Generate individual image FDF files
 images.forEach((img, idx) => {
 const padIdx = String(idx).padStart(2, '0');
 const isEnd = img.isEndpoint;
 const imgState = {
 ...baseState,
 system: {
 ...baseState.system,
 SystemLabel: `${sysLabel}_image_${padIdx}`,
 },
 structure: {
 ...img.structure,
 species: (img.structure.species || []).map(sp => {
 const cleanSym = String(sp.label || '').replace(/[\d\+\-_]/g, '').trim() || sp.label;
 let matched = '';
 if (detectedFiles.length > 0) {
 const exact = detectedFiles.find(f => f.toLowerCase() === `${cleanSym.toLowerCase()}.${pseudoFmt}`);
 if (exact) matched = exact;
 else {
 const prefix = detectedFiles.find(f => {
 const lower = f.toLowerCase();
 return (lower.startsWith(cleanSym.toLowerCase() + '.') ||
 lower.startsWith(cleanSym.toLowerCase() + '_') ||
 lower.startsWith(cleanSym.toLowerCase() + '-')) && lower.endsWith(`.${pseudoFmt}`);
 });
 if (prefix) matched = prefix;
 }
 }
 if (!matched) matched = `${cleanSym}.${pseudoFmt}`;
 if (pseudoMode === 'full' && pseudoDir) {
 const cleanDir = pseudoDir.replace(/\/+$/, '');
 matched = `${cleanDir}/${matched.split('/').pop()}`;
 }
 return { ...sp, label: cleanSym, psfile: matched };
 }),
 },
 md: {
 ...baseState.md,
 // Endpoints can be relaxed; intermediate images evaluate forces
 'MD.TypeOfRun': isEnd ? 'CG' : 'Forces',
 'MD.NumCGsteps': isEnd ? '100' : '0',
 },
 };
 folder.file(`image_${padIdx}.fdf`, serializeFDF(imgState));
 });

 // 2. Python ASE CI-NEB Driver Script
 const pyDriver = `#!/usr/bin/env python3
"""
SIESTA CI-NEB Runner with ASE (Atomic Simulation Environment)
Climbing Image Nudged Elastic Band Calculation for SIESTA
"""

import os, sys, glob, shutil
import numpy as np
from ase import Atoms
from ase.geometry import cellpar_to_cell
from ase.mep import NEB
from ase.optimize import ${optimizer}
from ase.calculators.siesta import Siesta
from ase.io.siesta import read_fdf

def read_siesta_fdf(fname):
 """Parse SIESTA .fdf input file directly into an ase.Atoms object"""
 d = read_fdf(fname)
 sp_map = {}
 for row in d.get('chemicalspecieslabel', []):
 idx = row[0]
 z = int(row[1])
 sp_map[idx] = z

 lc_tokens = d.get('latticeconstant', ['1.0', 'Ang'])
 lc_val = float(lc_tokens[0])
 lc_unit = lc_tokens[1] if len(lc_tokens) > 1 else 'Ang'
 scale = 0.52917721 if lc_unit.lower().startswith('bohr') else lc_val

 if 'latticevectors' in d:
 lv = np.array(d['latticevectors'], dtype=float) * scale
 elif 'latticeparameters' in d:
 lp_raw = [float(x) for x in d['latticeparameters'][0]]
 lp_scaled = [lp_raw[0] * scale, lp_raw[1] * scale, lp_raw[2] * scale, lp_raw[3], lp_raw[4], lp_raw[5]]
 lv = cellpar_to_cell(lp_scaled)
 else:
 raise ValueError(f"No LatticeVectors or LatticeParameters found in {fname}")
 coord_fmt = d.get('atomiccoordinatesformat', ['Fractional'])[0].lower()
 atoms_data = d['atomiccoordinatesandatomicspecies']

 symbols = []
 positions = []
 for row in atoms_data:
 x, y, z, sp = float(row[0]), float(row[1]), float(row[2]), row[3]
 symbols.append(sp_map.get(sp, int(sp) if sp.isdigit() else sp))
 positions.append([x, y, z])
 positions = np.array(positions)

 if 'fractional' in coord_fmt or 'scaledbylatticevectors' in coord_fmt:
 return Atoms(numbers=symbols, scaled_positions=positions, cell=lv, pbc=True)
 else:
 if 'bohr' in coord_fmt:
 positions *= 0.52917721
 elif 'scaledcartesian' in coord_fmt:
 positions *= lc_val
 return Atoms(numbers=symbols, positions=positions, cell=lv, pbc=True)
def find_and_copy_pseudos(symbols, current_dir, hint_dir="psf_outputs"):
 """Automatically find and copy any missing .psf files into current_dir"""
 unique_symbols = sorted(list(set(symbols)))
 missing = [sym for sym in unique_symbols if not os.path.exists(os.path.join(current_dir, f"{sym}.psf"))]
 if not missing:
 return

 print(f"Finding pseudopotential (.psf) files for: {missing}...")
 search_dirs = [
 os.path.abspath(hint_dir),
 os.path.abspath(os.path.join("..", hint_dir)),
 os.path.abspath(os.path.join("..", "..", hint_dir)),
    os.environ.get("SIESTA_PS_PATH", ""),
    os.environ.get("SIESTA_PP_PATH", ""),
    os.path.abspath("./pseudos"),
    os.path.abspath("../pseudos"),
    os.path.abspath("../../pseudos"),
    os.path.expanduser("~/pseudos"),
  ]

 for sym in missing:
 psf = f"{sym}.psf"
 found = False
 for sdir in search_dirs:
 if not sdir or not os.path.isdir(sdir):
 continue
 cand = os.path.join(sdir, psf)
 if os.path.exists(cand):
 shutil.copy2(cand, os.path.join(current_dir, psf))
 print(f" Copied {psf} from {sdir}")
 found = True
 break
 if not found:
 print(f" ERROR: Could not find {psf}! Please copy {psf} into {current_dir}")
 sys.exit(1)

def main():
 print("=================================================================")
 print(" SIESTA Climbing Image NEB (CI-NEB) Calculation")
 print("=================================================================")

 CLIMB = ${climb ? 'True' : 'False'}
 K_SPRING = ${springK}
 FMAX = ${fmax}

 fdf_files = sorted(glob.glob("image_[0-9][0-9].fdf"))
 if not fdf_files:
 print("Error: No image_XX.fdf files found in current directory!")
 sys.exit(1)

 print(f"Reading {len(fdf_files)} image files...")
 images = [read_siesta_fdf(f) for f in fdf_files]

 # Standardize cell across all images (ASE NEB requirement)
 common_cell = images[0].cell
 for img in images:
 img.cell = common_cell

 print(f"Successfully loaded {len(images)} images.")
 print(f"Formula: {images[0].get_chemical_formula()} ({len(images[0])} atoms per image).")
 current_dir = os.path.abspath(os.getcwd())
 all_symbols = images[0].get_chemical_symbols()
 find_and_copy_pseudos(all_symbols, current_dir, hint_dir="${pseudoDir.replace(/\\/g, '/')}")

 # Clean stale siesta_run folder
 if os.path.exists("siesta_run"):
 shutil.rmtree("siesta_run", ignore_errors=True)


 current_dir = os.path.abspath(os.getcwd())
 configured_pseudo_dir = "${pseudoDir.replace(/\\/g, '/')}"
 target_pseudo = os.path.abspath(configured_pseudo_dir) if (configured_pseudo_dir and os.path.isdir(configured_pseudo_dir)) else current_dir

 os.environ["SIESTA_PS_PATH"] = f"{target_pseudo}:{current_dir}"
 os.environ["SIESTA_PP_PATH"] = f"{target_pseudo}:{current_dir}"

 # Auto-copy pseudopotentials from target directory if missing in current working directory
 if target_pseudo != current_dir and os.path.isdir(target_pseudo):
 for ext in ('*.psf', '*.psml', '*.vps'):
 for src in glob.glob(os.path.join(target_pseudo, ext)):
 dst = os.path.join(current_dir, os.path.basename(src))
 if not os.path.exists(dst):
 try:
 shutil.copy2(src, dst)
 except Exception:
 pass

 siesta_cmd = os.environ.get("SIESTA_COMMAND", "mpirun -np 4 siesta < PREFIX.fdf > PREFIX.out")
 for i, atoms in enumerate(images[1:-1], start=1):
 calc = Siesta(
 label=f"siesta_run/img_{i:02d}",
 command=siesta_cmd,
 pseudo_path=current_dir,
 pseudo_qualifier='', # Use .psf directly without .lda or .psml qualifier!
 symlink_pseudos=True,
 mesh_cutoff=${parseFloat(baseState.dft.MeshCutoff || 300)} * 13.605698,
 basis_set='${baseState.basis['PAO.BasisSize'] || 'DZP'}',
 xc='${baseState.dft['XC.functional'] || 'GGA'}',
 fdf_arguments={
 'DM.Tolerance': '${baseState.scf['DM.Tolerance'] || '1e-4'}',
 'DM.MixingWeight': ${parseFloat(baseState.scf['DM.MixingWeight'] || 0.25)},
 'MaxSCFIterations': ${parseInt(baseState.scf.MaxSCFIterations || 200)},
 }
 )
 atoms.calc = calc

 neb = NEB(images, k=K_SPRING, climb=CLIMB)
 opt = ${optimizer}(neb, trajectory='neb_trajectory.traj', logfile='neb_optimization.log')

 print(f"Starting CI-NEB optimization with ${optimizer} (fmax={FMAX} eV/Å)...")
 opt.run(fmax=FMAX)

 energies = [atoms.get_potential_energy() for atoms in images]
 e_initial = energies[0]
 e_ts = max(energies)
 e_final = energies[-1]

 e_act = e_ts - e_initial
 e_rxn = e_final - e_initial

 print("\\n" + "=" * 65)
 print(f" Forward Activation Barrier (E_act): {e_act:.4f} eV ({e_act * 23.06:.2f} kcal/mol)")
 print(f" Reaction Energy (ΔE): {e_rxn:.4f} eV ({e_rxn * 23.06:.2f} kcal/mol)")
 print("=" * 65)

if __name__ == '__main__':
 main()
`;
 folder.file('cineb_siesta_driver.py', pyDriver);

 // 3. Reaction Profile Plotter
 const pyPlotter = `#!/usr/bin/env python3
"""Plot CI-NEB Energy Barrier Profile"""
import os, glob
import numpy as np
import matplotlib.pyplot as plt

images = sorted(glob.glob("image_*.fdf"))
energies = []

for f in images:
 out = f.replace('.fdf', '.out')
 if os.path.exists(out):
 with open(out) as fh:
 for line in fh:
 if "siesta: E_KS(eV) =" in line:
 energies.append(float(line.split()[3]))
 break

if energies:
 e_rel = np.array(energies) - energies[0]
 rxn_coord = np.linspace(0, 1, len(e_rel))

 plt.figure(figsize=(7, 4.5))
 plt.plot(rxn_coord, e_rel, 'o-', color='#e11d48', lw=2.5, markersize=8)
 plt.title('SIESTA CI-NEB Reaction Pathway Profile')
 plt.xlabel('Reaction Coordinate')
 plt.ylabel('Relative Energy (eV)')
 plt.grid(True, alpha=0.3)

 e_act = np.max(e_rel)
 ts_idx = np.argmax(e_rel)
 plt.annotate(f"TS: +{e_act:.3f} eV", (rxn_coord[ts_idx], e_act),
 xytext=(0, 12), textcoords="offset points", ha='center',
 fontweight='bold', color='#e11d48')

 plt.tight_layout()
 plt.savefig('neb_barrier_profile.png', dpi=200)
 print("Saved barrier plot to neb_barrier_profile.png")
else:
 print("Run the calculations first to generate .out files.")
`;
 folder.file('plot_neb_barrier.py', pyPlotter);

 // 4. Shell runner
 const shRunner = `#!/usr/bin/env bash
# SIESTA CI-NEB Suite Runner
# Usage: ./run_cineb.sh [num_cores]

NPROCS=\${1:-4}
PSEUDO_DIR="${pseudoDir.replace(/\\/g, '/')}"
if [ -n "$PSEUDO_DIR" ] && [ -d "$PSEUDO_DIR" ]; then
 export SIESTA_PS_PATH="$PSEUDO_DIR:$PWD:\$SIESTA_PS_PATH"
 echo "Set SIESTA_PS_PATH to $SIESTA_PS_PATH"
fi

echo "=========================================================="
echo " Running SIESTA CI-NEB suite on $NPROCS cores"
echo "=========================================================="
# Option A: Run via ASE CI-NEB driver (Recommended)
if command -v ase &> /dev/null; then
 echo "Running with ASE CI-NEB driver..."
 export SIESTA_COMMAND="mpirun -np $NPROCS siesta < PREFIX.fdf > PREFIX.out"
 python3 cineb_siesta_driver.py
else
 # Option B: Run each image independently
 echo "Running each image sequentially..."
 for fdf in image_*.fdf; do
 out="\${fdf%.fdf}.out"
 echo "Computing $fdf -> $out"
 mpirun -np "$NPROCS" siesta < "$fdf" > "$out"
 done
 python3 plot_neb_barrier.py
fi
`;
 folder.file('run_cineb.sh', shRunner);

 // 5. Documentation
 const readme = `SIESTA CI-NEB (Climbing Image Nudged Elastic Band) Suite
=========================================================
Total Images: ${images.length}
Climbing Image: ${climb ? 'Enabled' : 'Disabled'}
Spring Constant: ${springK} eV/Å
Max Force Tolerance: ${fmax} eV/Å
Maximum Atomic Displacement: ${nebResult.maxDisplacement} Å

Contents:
- image_00.fdf (Initial state)
- image_01.fdf ... image_${String(images.length - 2).padStart(2, '0')}.fdf (Intermediate images)
- image_${String(images.length - 1).padStart(2, '0')}.fdf (Final state)
- cineb_siesta_driver.py (Full ASE CI-NEB automated runner)
- plot_neb_barrier.py (Barrier plotter)
- run_cineb.sh (Execution script)

How to Run:
1. Make sure SIESTA and ASE are installed.
2. Run: bash run_cineb.sh 4
3. View activation barrier with: python3 plot_neb_barrier.py
`;
 folder.file('README_NEB.txt', readme);

 return await zip.generateAsync({ type: 'blob' });
}
