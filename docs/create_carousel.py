import os
from PIL import Image

BASE_DIR = "/scratch/SIVAKUMAR/Sivakumar_Research_work/siesta-input-builder/docs"
FIG_DIR = os.path.join(BASE_DIR, "figures")
HTML_PATH = os.path.join(BASE_DIR, "linkedin_carousel.html")
PDF_PATH = os.path.join(BASE_DIR, "SIESTA_LinkedIn_Carousel.pdf")
PUBLIC_PDF = "/scratch/SIVAKUMAR/Sivakumar_Research_work/siesta-input-builder/public/SIESTA_LinkedIn_Carousel.pdf"

slides_html = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  @page {{
    size: 1080px 1080px;
    margin: 0;
  }}
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #f8fafc;
    background: #090d16;
  }}
  .slide {{
    width: 1080px;
    height: 1080px;
    padding: 60px 65px;
    page-break-after: always;
    display: flex;
    flex-direction: column;
    justifyContent: space-between;
    position: relative;
    background: linear-gradient(135deg, #090d16 0%, #0f172a 50%, #1e1b4b 100%);
    overflow: hidden;
  }}
  .slide::before {{
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image: 
      radial-gradient(circle at 85% 15%, rgba(56, 189, 248, 0.12) 0%, transparent 45%),
      linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 100% 100%, 36px 36px, 36px 36px;
    pointer-events: none;
  }}
  .slide-header {{
    position: relative;
    z-index: 2;
  }}
  .badge-row {{
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }}
  .tag {{
    background: #2563eb;
    color: #fff;
    font-size: 14px;
    font-weight: 800;
    padding: 4px 12px;
    border-radius: 4px;
    font-family: monospace;
  }}
  .sub-tag {{
    background: rgba(56, 189, 248, 0.15);
    border: 1px solid rgba(56, 189, 248, 0.35);
    color: #38bdf8;
    font-size: 13px;
    font-weight: 700;
    padding: 4px 10px;
    border-radius: 4px;
  }}
  .slide-num {{
    margin-left: auto;
    font-size: 14px;
    font-family: monospace;
    color: #64748b;
    font-weight: 700;
  }}
  h2 {{
    font-size: 38px;
    font-weight: 800;
    line-height: 1.15;
    background: linear-gradient(90deg, #ffffff 0%, #cbd5e1 50%, #38bdf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-bottom: 8px;
  }}
  p.subtitle {{
    font-size: 18px;
    color: #94a3b8;
    line-height: 1.4;
  }}
  .slide-content {{
    position: relative;
    z-index: 2;
    margin: 20px 0;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }}
  .img-box {{
    border-radius: 10px;
    overflow: hidden;
    border: 1px solid rgba(148, 163, 184, 0.25);
    box-shadow: 0 12px 30px rgba(0,0,0,0.5);
    background: #020617;
  }}
  .img-box img {{
    width: 100%;
    height: auto;
    display: block;
  }}
  .bullets {{
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }}
  .bullet-item {{
    background: rgba(30, 41, 59, 0.6);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 6px;
    padding: 10px 14px;
    font-size: 14px;
    line-height: 1.35;
    color: #cbd5e1;
  }}
  .bullet-item strong {{
    color: #38bdf8;
    display: block;
    margin-bottom: 2px;
  }}
  .slide-footer {{
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid rgba(148, 163, 184, 0.2);
    padding-top: 18px;
  }}
  .footer-left {{
    font-size: 14px;
    color: #64748b;
    font-weight: 600;
  }}
  .footer-url {{
    font-family: monospace;
    font-size: 14px;
    color: #38bdf8;
    font-weight: 700;
    background: rgba(56, 189, 248, 0.1);
    padding: 6px 14px;
    border-radius: 6px;
    border: 1px solid rgba(56, 189, 248, 0.3);
  }}
</style>
</head>
<body>

  <!-- SLIDE 1: Cover & 3D Structure -->
  <div class="slide">
    <div class="slide-header">
      <div class="badge-row">
        <span class="tag">SIESTA 5.x</span>
        <span class="sub-tag">Web Studio Announcement</span>
        <span class="slide-num">01 / 04</span>
      </div>
      <h2>SIESTA Input Builder &amp; Post-DFT Studio</h2>
      <p class="subtitle">Zero-install interactive GUI: from raw CIF/POSCAR to production FDF in seconds with complete client-side privacy.</p>
    </div>
    <div class="slide-content">
      <div class="img-box" style="height: 480px; overflow: hidden;">
        <img src="file://{os.path.join(FIG_DIR, 'fig02_structure_3d.png')}" style="margin-top: -80px;" />
      </div>
      <div class="bullets">
        <div class="bullet-item">
          <strong>1-Click CIF Import</strong>
          Extracts parameters, vectors, elements, and fractional symmetry positions.
        </div>
        <div class="bullet-item">
          <strong>3D WebGL Crystal Viewer</strong>
          Rotate, pan, zoom with real-time magnification scale and high-res PNG snapshot.
        </div>
      </div>
    </div>
    <div class="slide-footer">
      <div class="footer-left">Open Source • 100% In-Browser Privacy</div>
      <div class="footer-url">chemsiva.github.io/siesta-input-builder/</div>
    </div>
  </div>

  <!-- SLIDE 2: VASP to FDF & Section 7.7 Constraints -->
  <div class="slide">
    <div class="slide-header">
      <div class="badge-row">
        <span class="tag">CONVERTER</span>
        <span class="sub-tag">ASE GUI Constraints</span>
        <span class="slide-num">02 / 04</span>
      </div>
      <h2>VASP POSCAR to SIESTA FDF Converter</h2>
      <p class="subtitle">Ingest structures with ASE GUI Selective Dynamics and auto-generate Section 7.7 Geometry.Constraints.</p>
    </div>
    <div class="slide-content">
      <div class="img-box" style="height: 480px; overflow: hidden;">
        <img src="file://{os.path.join(FIG_DIR, 'fig10_vasp_converter.png')}" style="margin-top: -60px;" />
      </div>
      <div class="bullets">
        <div class="bullet-item">
          <strong>Selective Dynamics Parser</strong>
          Translates F F F into atom ranges and T T F into directional Z-only constraints.
        </div>
        <div class="bullet-item">
          <strong>1-Click Workspace Transfer</strong>
          Loads the converted structure straight into Section 2 and the 3D crystal viewer.
        </div>
      </div>
    </div>
    <div class="slide-footer">
      <div class="footer-left">Section 7.7 General Constraints Supported</div>
      <div class="footer-url">chemsiva.github.io/siesta-input-builder/</div>
    </div>
  </div>

  <!-- SLIDE 3: Work Function & CDD Studio -->
  <div class="slide">
    <div class="slide-header">
      <div class="badge-row">
        <span class="tag">SURFACE SCIENCE</span>
        <span class="sub-tag">Work Function Studio</span>
        <span class="slide-num">03 / 04</span>
      </div>
      <h2>Electrostatic Potential &amp; Work Functions</h2>
      <p class="subtitle">Extract asymptotic vacuum plateaus, quantify work function modification, and calculate interface dipoles.</p>
    </div>
    <div class="slide-content">
      <div class="img-box" style="height: 480px; overflow: hidden;">
        <img src="file://{os.path.join(FIG_DIR, 'fig09_workfunction.png')}" style="margin-top: -120px;" />
      </div>
      <div class="bullets">
        <div class="bullet-item">
          <strong>Multi-Surface Comparison</strong>
          Overlay clean vs passivated slabs with automated Delta-Phi work function steps.
        </div>
        <div class="bullet-item">
          <strong>3D Band Alignment Diagrams</strong>
          Construct publication-grade energy band diagrams for perovskites and solar cells.
        </div>
      </div>
    </div>
    <div class="slide-footer">
      <div class="footer-left">Export Vector SVG, 300 DPI PNG, 300 DPI TIFF</div>
      <div class="footer-url">chemsiva.github.io/siesta-input-builder/</div>
    </div>
  </div>

  <!-- SLIDE 4: HPC Profiler & CI-NEB -->
  <div class="slide">
    <div class="slide-header">
      <div class="badge-row">
        <span class="tag">ADVANCED SUITES</span>
        <span class="sub-tag">HPC Optimization</span>
        <span class="slide-num">04 / 04</span>
      </div>
      <h2>HPC TIMES Profiler &amp; Reaction Suites</h2>
      <p class="subtitle">Benchmark parallel scalability, generate CI-NEB reaction packages, and build frozen-phonon matrices.</p>
    </div>
    <div class="slide-content">
      <div class="img-box" style="height: 480px; overflow: hidden;">
        <img src="file://{os.path.join(FIG_DIR, 'fig06_output_times.png')}" style="margin-top: -100px;" />
      </div>
      <div class="bullets">
        <div class="bullet-item">
          <strong>Section 6.29 TIMES Analyzer</strong>
          Inspect node load balancing, total core CPU hours, and routine bottlenecks.
        </div>
        <div class="bullet-item">
          <strong>CI-NEB &amp; Phonons</strong>
          Automate transition state searches, IDPP interpolation, and Vibra dispersion runs.
        </div>
      </div>
    </div>
    <div class="slide-footer">
      <div class="footer-left">Free &amp; Open Source • 19-Page PDF Guide Included</div>
      <div class="footer-url">chemsiva.github.io/siesta-input-builder/</div>
    </div>
  </div>

</body>
</html>
"""

with open(HTML_PATH, "w", encoding="utf-8") as f:
    f.write(slides_html)

print("Wrote carousel HTML!")
