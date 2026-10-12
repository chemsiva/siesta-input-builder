# SIESTA Input Builder

A browser-based GUI to create SIESTA 5.x FDF input files — no installation, no backend, no calculations run.

Equivalent to BURAI/pw.gui for Quantum ESPRESSO, but for **SIESTA 5.4.2+**.

---

## Features

| Section | What you get |
|---|---|
| **System** | SystemLabel, SystemName, NumberOfAtoms/Species |
| **Structure** | LatticeVectors or LatticeParameters, atomic coordinates table, format selector |
| **Species & Basis** | ChemicalSpeciesLabel editor, **📁 Global Pseudopotential Directory & Auto-Matcher (Folder Scan, `.psf`/`.psml` auto-assign, status badges)**, PAO.BasisSize/Type/EnergyShift |
| **DFT / XC** | XC.functional+authors (LDA/GGA/VDW/mGGA), MeshCutoff, Spin mode, dipole correction |
| **SCF** | MaxSCFIterations, DM.Tolerance, mixing (Pulay/linear/Broyden), ElectronicTemperature, SolutionMethod, DM.InitSpin block |
| **K-Points** | Monkhorst-Pack grid (3×4 matrix), kgrid_cutoff, BandLines path builder, **⚡ Auto-Generate High-Symmetry Path** |
| **DOS / PDOS** | Total DOS, Projected DOS (`%block ProjectedDensityOfStates`), custom PDOS k-grid (`PDOS.kgrid.MonkhorstPack`), Local DOS (`%block LocalDensityOfStates`), `WriteEigenvalues` |
| **Output Section** | Configure FDF output flags (<code>WriteDM</code>, <code>WriteMDXmol</code> for <code>.ANI</code>, <code>WriteMDhistory</code> for <code>.MDE</code>/<code>.MD</code>, <code>SaveRho</code>, etc.) **PLUS** interactive **Output Visualizer & Analysis**: upload <code>.out</code>, <code>.MDE</code>, and <code>.ANI</code> to extract SCF convergence, plot multi-metric property curves, and play 3D atomic trajectory animations! |
| **Structure** | LatticeVectors or LatticeParameters, atomic coordinates table, format selector, **💎 CIF import**, **🌐 3D Crystal Visualizer (default OFF)**, **🛠️ Slab & Vacuum Tools (Supercells, Padding, Centering)** |
| **DFT & Spin** | XC family/variant, MeshCutoff, Spin modes (collinear, non-collinear, SOC), **🔬 DFT+U (`%block DFTU.Proj`)**, **🧲 Magnetic State Assistant (`%block DM.InitSpin`)** |
| **CI-NEB** | Minimum energy pathways, transition state search, Climbing Image NEB, pathway slider with 3D preview, **📦 Download complete CI-NEB Suite (.zip)** |
| **Phonon Analysis** | Force Constants matrix (`MD.TypeOfRun FC`), atom range (`FC.first`/`FC.last`), displacement amplitude, Born effective charges (`BornCharge`), Hamiltonian derivatives (`FC.Save.dHS`), supercell builder, **📦 Download Phonon Suite (.zip)** |

**Presets:** Bulk SCF · Geometry Relaxation · Variable-Cell Relaxation · Band Structure · Slab/Surface · Density of States (DOS + PDOS)
**Live preview:** every keystroke updates the `.fdf` text in real time with line numbers.

**Import:** load an existing `.fdf` → all fields populate automatically (round-trip).

---

**Import options:**
- **💎 CIF Import:** load `.cif` directly (Materials Project, ICSD, COD, VESTA). Auto-extracts lattice parameters, vectors, elements, atomic numbers $Z$, fractional coordinates, and performs space-group symmetry expansion when needed.
- **📂 FDF Load:** load an existing `.fdf` file → all fields populate automatically (round-trip).
- **🌐 3D Crystal Visualizer:** Interactive WebGL 3D viewer (atoms, bonds, unit cell box, RGB axes $a_1, a_2, a_3$, supercell expansion $2\times 2\times 2$). Default is **OFF** to avoid resource overhead; toggles ON with one click.

- **⚡ High-Symmetry Band Path Generator:** Auto-detects Bravais lattice (Cubic, FCC, BCC, Tetragonal, Hexagonal, Perovskite, Slabs) and populates standard AFLOW / Seekpath paths with 1 click.
- **🛠️ Slab & Vacuum Builder:** Add vacuum along $c$/$z$ (e.g. $+15\text{ \AA}$), auto-center slab inside cell, auto-enable `Slab.DipoleCorrection true`, and build supercells ($N_x \times N_y \times N_z$).
- **⚡ Convergence Suite Generator:** Generates a downloadable `.zip` containing a series of `.fdf` files (sweeping `MeshCutoff` or k-grid) with automated parallel bash runner (`run_mesh_convergence.sh`) and Python energy extraction script.
- **🔬 DFT+U (Hubbard $U$):** Configure on-site Coulomb $U$ and $J$ per species and orbital channel ($d$ or $f$), serializing to `%block DFTU.Proj`.
- **🧲 Magnetic State Assistant:** Presets for Ferromagnetic (FM), Antiferromagnetic (AFM), and Non-collinear spiral spins, auto-formatting `%block DM.InitSpin`.
- **📁 Global Pseudopotential Directory & Auto-Matcher:** Configure your pseudopotential folder once (or click **📂 Scan Folder** to read your local `.psf`/`.psml` library). The builder automatically matches every element to its corresponding pseudopotential file (with exact and prefix detection) and displays real-time `✓ Found` or `⚠️ Missing` badges in the species table.
- **⛰️ CI-NEB (Climbing Image NEB):** Full transition-state & reaction pathway suite with **integrated pseudopotential validation**. Set or scan your pseudopotential directory directly in Section ⑩, auto-match all reaction species, view real-time element status badges (`✓ Found` / `⚠️ Missing`), interpolate $N$ images between Initial and Final CIF/FDF states, scrub the 3D reaction slider, and download all image `.fdf` files + automated ASE CI-NEB driver (`cineb_siesta_driver.py`) with automatic pseudopotential symlinking and barrier plotting (`plot_neb_barrier.py`).
- **〰️ Phonon Analysis & Vibrations:** Complete vibrational analysis workflow. Supports SIESTA native Force Constants (`MD.TypeOfRun FC`, `VIBRA`), Phonopy supercell calculations, and $\Gamma$-point molecular vibrations. Configure atomic displacement ($0.04\text{ Bohr}$), atom range, Born effective charges (`BornCharge true` for LO-TO splitting), and electron-phonon Hamiltonian derivatives (`FC.Save.dHS true`), with 1-click download of the complete Phonon Suite (`supercell_fc.fdf`, `vibra.fdf`, `plot_phonon_dispersion.py`, `run_phonon.sh`).
- **📈 DOS & PDOS Electronic Structure Suite (Eig2DOS):** Complete Density of States and Projected DOS post-processing suite. Auto-detects input file formats upon upload:
  - **SIESTA Eigenvalues (`.EIG`):** Calculates Total DOS using the official `Util/Eig2DOS` algorithm with Gaussian or Lorentzian broadening (`-l`), energy window (`Emin` to `Emax`), energy mesh points (`-n`), smearing width (`-s`), Fermi energy alignment (`-f`/`-F`), band subset window (`-b` / `-B`), and optional k-point weights (`.KP`).
  - **SIESTA Projected DOS (`.PDOS` / `.PDOS.xml`):** Parses orbital-resolved XML data and decomposes curves by chemical species, angular momentum ($s, p, d, f$), and atom indices, with spin-polarization support ($\uparrow$ Spin-Up / $\downarrow$ Spin-Down).
  - **Interactive Scientific Plotter:** Full interactive SVG chart with Fermi level guidelines, interactive mouse crosshair, curve toggle legend, and single-click `.DAT` column export for OriginPro, Gnuplot, or Python/matplotlib.
- **📊 Output Visualizer & Dual-Engine 3D Trajectory Player:** Direct inspection of SIESTA `.out` log files (SCF convergence, forces, stress, CPU timing), `.MDE` thermodynamic fluctuations (potential/kinetic/total energy, temperature, volume, pressure), and `.ANI` animated trajectory player with **dual WebGL and Canvas 2D fallback engines** (100% immune to browser WebGL context limits).
- **🌊 Surface, Work Function & Adsorption Analysis (Section ⑫):** Dedicated post-DFT surface science workbench:
  - **Work Function Calculator ($\Phi = V_{\text{vac}} - E_F$):** Upload 1D electrostatic potential profiles (from Macroave or `average_z.m`: `.dat`, `.txt`) or 3D Gaussian Cubes (`.cube` from `grid2cube .VH`). Auto-detects the flat vacuum plateau $V_{\text{vac}}$, extracts Fermi energy $E_F$ from `.out`, handles asymmetric/dipolar slabs ($\Phi_{\text{top}}$ vs $\Phi_{\text{bottom}}$ and dipole step $\Delta V_{\text{dipole}}$), and calculates work function changes ($\Delta\Phi$).
  - **Adsorption Energy Calculator ($E_{\text{ads}}$):** Auto-extracts ground-state total energies from 3 SIESTA `.out` log files (Slab+Adsorbate, Clean Slab, Free Molecule) or manual inputs. Computes $E_{\text{ads}}$ in **eV**, **kcal/mol**, and **kJ/mol**, determines binding regime (Strong Chemisorption / Moderate / Physisorption), and incorporates $\Delta\text{ZPE}$ and temperature $T\Delta S$ for Gibbs free energy of adsorption ($\Delta G_{\text{ads}}$).
  - **Planar Average CDD ($\Delta\bar{\rho}(z)$) & Cumulative Charge Transfer ($\Delta Q(z)$):** Upload 1D planar average profiles (`.dat`, `.csv`) or 3D Gaussian Cube grids (`.cube`). Automatically evaluates charge accumulation zones ($\Delta\bar{\rho} > 0$), depletion zones ($\Delta\bar{\rho} < 0$), interface position $z_{\text{interface}}$, net transferred charge $\Delta q$, interface dipole moment $\Delta\mu$ (Debye), and work function shift $\Delta\Phi$ (eV).
  - **SIESTA Grid Workflow & Script Generator:** 1-click Python script (`calculate_siesta_cdd_planar.py`) using `sisl` to automate grid subtraction ($\Delta\rho = \rho_{\text{total}} - \rho_{\text{slab}} - \rho_{\text{mol}}$), export 3D difference cubes for VESTA, and calculate 1D planar averages.
## Quick Start

```bash
# Development
npm install
npm run dev        # opens http://localhost:5173

# Production build (static files in dist/)
npm run build
```

Serve `dist/` from any static host (GitHub Pages, Netlify, Apache, nginx).

---

## GitHub Pages Deploy

```bash
# One-time: add homepage to package.json if using gh-pages sub-path
npm run build
# Copy dist/ to your gh-pages branch or use the Action below
```

`.github/workflows/deploy.yml`:

```yaml
name: Deploy
on:
  push:
    branches: [main]
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '22' }
      - run: npm ci && npm run build
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

---

## Architecture

```
src/
├── store/fdfStore.js          # Zustand — single flat state mirrors FDF namespace
├── parser/fdfParser.js        # .fdf text → JS object (handles blocks, case-insensitive keys)
├── parser/fdfSerializer.js    # JS object → .fdf string (clean formatted output)
├── sections/                  # One component per FDF section
├── components/                # Sidebar, Toolbar, LivePreview, FieldRow helpers
└── data/
    ├── keywords.json          # 50+ keywords with type, units, help text (from SIESTA 5.4.2 manual)
    └── templates.json         # 5 preset configurations
```

Zero backend. All logic runs in the browser. Output is a plain text `.fdf` file.

---

## Scope

This tool **only builds input files**. It does not:
- Run SIESTA calculations
- Download pseudopotentials
- Visualize crystal structures (planned: 3Dmol.js integration)
- Support TranSIESTA/NEGF options

---

## SIESTA Version

Tested against keyword set from **SIESTA 5.4.2** (December 2025).
Compatible with 4.1+ for all standard keywords.
