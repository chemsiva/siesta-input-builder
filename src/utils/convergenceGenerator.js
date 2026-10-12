import JSZip from 'jszip';
import { serializeFDF } from '../parser/fdfSerializer.js';

/**
 * Generate a ZIP file with a full SIESTA MeshCutoff or K-Grid convergence suite
 */
export async function generateConvergenceSuite(baseState, type = 'mesh', values = [150, 200, 250, 300, 350, 400, 500]) {
  const zip = new JSZip();
  const folder = zip.folder(`siesta_${type}_convergence`);

  const sysLabel = baseState.system.SystemLabel || 'siesta';

  if (type === 'mesh') {
    values.forEach(val => {
      const stateCopy = {
        ...baseState,
        system: { ...baseState.system, SystemLabel: `${sysLabel}_mesh_${val}Ry` },
        dft: { ...baseState.dft, MeshCutoff: `${val} Ry` },
      };
      folder.file(`mesh_${val}Ry.fdf`, serializeFDF(stateCopy));
    });

    // Bash runner script
    const runScript = `#!/usr/bin/env bash
# SIESTA MeshCutoff Convergence Runner
# Usage: ./run_mesh_convergence.sh [number_of_cores]

NPROCS=\${1:-4}
CUTOFFS=(${values.join(' ')})

echo "=========================================================="
echo " Running SIESTA MeshCutoff Convergence on $NPROCS cores"
echo "=========================================================="

printf "%-15s %-20s %-15s\\n" "MeshCutoff(Ry)" "Total_Energy(eV)" "Diff(meV/atom)"
echo "----------------------------------------------------------"

PREV_E=""
NATOMS=$(grep -i "NumberOfAtoms" mesh_${values[0]}Ry.fdf | awk '{print $2}')
if [ -z "$NATOMS" ]; then NATOMS=1; fi

for CUT in "\${CUTOFFS[@]}"; do
  LABEL="${sysLabel}_mesh_\${CUT}Ry"
  FDF="mesh_\${CUT}Ry.fdf"
  OUT="mesh_\${CUT}Ry.out"

  if [ ! -f "$OUT" ]; then
    mpirun -np "$NPROCS" siesta < "$FDF" > "$OUT" 2>&1
  fi

  # Extract total Kohn-Sham energy
  E_TOT=$(grep -i "siesta: E_KS(eV) =" "$OUT" | tail -1 | awk '{print $4}')
  if [ -z "$E_TOT" ]; then
    E_TOT=$(grep -i "Total =" "$OUT" | tail -1 | awk '{print $4}')
  fi

  DIFF="---"
  if [ -n "$PREV_E" ] && [ -n "$E_TOT" ]; then
    DIFF=$(awk -v e1="$E_TOT" -v e2="$PREV_E" -v n="$NATOMS" 'BEGIN { printf "%.2f", (e1 - e2) * 1000.0 / n }')
  fi

  printf "%-15s %-20s %-15s\\n" "\${CUT} Ry" "\${E_TOT:-FAIL}" "$DIFF"
  PREV_E="$E_TOT"
done

echo "=========================================================="
echo " Done! Convergence criteria: |Diff| < 1 meV/atom"
echo "=========================================================="
`;
    folder.file('run_mesh_convergence.sh', runScript);

    // Python plotter
    const pyScript = `#!/usr/bin/env python3
"""Plot SIESTA MeshCutoff Convergence"""
import glob, re
import matplotlib.pyplot as plt

data = []
for f in sorted(glob.glob("mesh_*Ry.out")):
    cut = int(re.search(r"mesh_(\\d+)Ry", f).group(1))
    e_tot = None
    with open(f) as fh:
        for line in fh:
            if "siesta: E_KS(eV) =" in line:
                e_tot = float(line.split()[3])
    if e_tot is not None:
        data.append((cut, e_tot))

if data:
    data.sort()
    cuts, energies = zip(*data)
    plt.figure(figsize=(7, 4.5))
    plt.plot(cuts, energies, 'o-', color='#3b82f6', lw=2)
    plt.xlabel('MeshCutoff (Ry)')
    plt.ylabel('Total Energy (eV)')
    plt.title('SIESTA MeshCutoff Convergence')
    plt.grid(True, alpha=0.3)
    plt.tight_layout()
    plt.savefig('mesh_convergence.png', dpi=200)
    print("Saved plot to mesh_convergence.png")
`;
    folder.file('plot_convergence.py', pyScript);

  } else if (type === 'kgrid') {
    // K-grid sweep: e.g. [[4,4,4],[6,6,6],[8,8,8],[10,10,10],[12,12,12]]
    const kgrids = values; // array of [kx, ky, kz]
    kgrids.forEach(kg => {
      const tag = `${kg[0]}x${kg[1]}x${kg[2]}`;
      const stateCopy = {
        ...baseState,
        system: { ...baseState.system, SystemLabel: `${sysLabel}_k_${tag}` },
        kpoints: {
          ...baseState.kpoints,
          mode: 'mp',
          mp: [
            [kg[0], 0, 0, 0],
            [0, kg[1], 0, 0],
            [0, 0, kg[2], 0]
          ],
        },
      };
      folder.file(`kgrid_${tag}.fdf`, serializeFDF(stateCopy));
    });

    const runScript = `#!/usr/bin/env bash
# SIESTA K-Grid Convergence Runner
NPROCS=\${1:-4}
echo "Running K-grid convergence suite on $NPROCS cores..."
for FDF in kgrid_*.fdf; do
  OUT="\${FDF%.fdf}.out"
  echo "Running $FDF -> $OUT"
  mpirun -np "$NPROCS" siesta < "$FDF" > "$OUT" 2>&1
done
`;
    folder.file('run_kgrid_convergence.sh', runScript);
  }

  const content = await zip.generateAsync({ type: 'blob' });
  return content;
}
