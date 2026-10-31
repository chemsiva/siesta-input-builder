import os
import subprocess
from PIL import Image

BASE_DIR = "/scratch/SIVAKUMAR/Sivakumar_Research_work/siesta-input-builder/docs"
FIG_DIR = os.path.join(BASE_DIR, "figures")
HTML_PATH = os.path.join(BASE_DIR, "linkedin_banner.html")
PNG_RAW = os.path.join(BASE_DIR, "linkedin_banner_raw.png")
FINAL_BANNER = os.path.join(BASE_DIR, "linkedin_post_banner.png")
PUBLIC_BANNER = "/scratch/SIVAKUMAR/Sivakumar_Research_work/siesta-input-builder/public/linkedin_post_banner.png"

html_content = f"""<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{
    width: 1200px;
    height: 675px;
    background: linear-gradient(135deg, #090d16 0%, #0f172a 45%, #111827 100%);
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #f8fafc;
    overflow: hidden;
    position: relative;
    display: flex;
    flex-direction: column;
    justifyContent: space-between;
    padding: 36px 44px 28px 44px;
  }}

  /* Background grid glow */
  body::before {{
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image: 
      radial-gradient(circle at 85% 15%, rgba(56, 189, 248, 0.15) 0%, transparent 45%),
      radial-gradient(circle at 15% 85%, rgba(99, 102, 241, 0.18) 0%, transparent 50%),
      linear-gradient(rgba(255, 255, 255, 0.03) 1px, transparent 1px),
      linear-gradient(90deg, rgba(255, 255, 255, 0.03) 1px, transparent 1px);
    background-size: 100% 100%, 100% 100%, 30px 30px, 30px 30px;
    pointer-events: none;
  }}

  /* Header */
  .header {{
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }}
  .title-group {{
    display: flex;
    flex-direction: column;
    gap: 6px;
  }}
  .badge-row {{
    display: flex;
    align-items: center;
    gap: 10px;
  }}
  .app-badge {{
    background: #2563eb;
    color: #ffffff;
    font-size: 11px;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 4px;
    letter-spacing: 0.05em;
    font-family: monospace;
  }}
  .category-badge {{
    background: rgba(56, 189, 248, 0.15);
    border: 1px solid rgba(56, 189, 248, 0.35);
    color: #38bdf8;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 4px;
  }}
  h1 {{
    font-size: 28px;
    font-weight: 800;
    letter-spacing: -0.02em;
    background: linear-gradient(90deg, #ffffff 0%, #e2e8f0 60%, #38bdf8 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }}
  .tagline {{
    font-size: 13.5px;
    color: #94a3b8;
    font-weight: 500;
  }}

  /* Top right metadata */
  .header-right {{
    text-align: right;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 4px;
  }}
  .pill {{
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.35);
    color: #10b981;
    font-size: 11px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 99px;
  }}
  .version {{
    font-size: 11px;
    color: #64748b;
    font-family: monospace;
  }}

  /* 3 Feature Showcase Cards */
  .cards-grid {{
    position: relative;
    z-index: 2;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 16px;
    margin: 16px 0;
  }}
  .feature-card {{
    background: rgba(30, 41, 59, 0.7);
    border: 1px solid rgba(148, 163, 184, 0.22);
    border-radius: 8px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.4);
    backdrop-filter: blur(8px);
  }}
  .card-header {{
    padding: 8px 12px;
    background: rgba(15, 23, 42, 0.85);
    border-bottom: 1px solid rgba(148, 163, 184, 0.15);
    display: flex;
    align-items: center;
    justify-content: space-between;
  }}
  .card-title {{
    font-size: 12px;
    font-weight: 700;
    color: #e2e8f0;
  }}
  .card-tag {{
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 3px;
  }}
  .tag-blue {{ background: rgba(56, 189, 248, 0.2); color: #38bdf8; }}
  .tag-green {{ background: rgba(16, 185, 129, 0.2); color: #10b981; }}
  .tag-purple {{ background: rgba(168, 85, 247, 0.2); color: #c084fc; }}

  .card-img-wrap {{
    height: 220px;
    overflow: hidden;
    position: relative;
    background: #020617;
  }}
  .card-img-wrap img {{
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: top center;
    display: block;
  }}
  .card-footer {{
    padding: 8px 12px;
    font-size: 11px;
    color: #94a3b8;
    line-height: 1.35;
    background: rgba(15, 23, 42, 0.9);
    border-top: 1px solid rgba(148, 163, 184, 0.1);
  }}

  /* Bottom Ribbon */
  .footer {{
    position: relative;
    z-index: 2;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid rgba(148, 163, 184, 0.18);
    padding-top: 14px;
  }}
  .features-pills {{
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }}
  .feat-chip {{
    background: rgba(255, 255, 255, 0.05);
    border: 1px solid rgba(148, 163, 184, 0.2);
    border-radius: 4px;
    padding: 4px 8px;
    font-size: 11px;
    color: #cbd5e1;
    font-weight: 600;
  }}
  .cta-link {{
    font-family: monospace;
    font-size: 12px;
    color: #38bdf8;
    background: rgba(56, 189, 248, 0.1);
    border: 1px solid rgba(56, 189, 248, 0.3);
    padding: 6px 12px;
    border-radius: 6px;
    font-weight: 700;
  }}
</style>
</head>
<body>
  <!-- Header -->
  <div class="header">
    <div class="title-group">
      <div class="badge-row">
        <span class="app-badge">SIESTA </span>
        <span class="category-badge">First-Principles DFT Studio</span>
        <span style="font-size: 11px; color: #64748b; font-weight: 600;">Open-Source Tool</span>
      </div>
      <h1>SIESTA Input Builder & Post-DFT Analysis Studio</h1>
      <div class="tagline">From CIF & POSCAR to Production FDF in Seconds • 100% In-Browser Privacy • Advanced Surface & Reaction Physics</div>
    </div>
    <div class="header-right">
      <span class="pill">No Backend Required</span>
      <span class="version">v5.4.2 </span>
    </div>
  </div>

  <!-- 3 Showcase Cards -->
  <div class="cards-grid">
    <!-- Card 1 -->
    <div class="feature-card">
      <div class="card-header">
        <span class="card-title">3D Structure & Vacuum Cleaver</span>
        <span class="card-tag tag-blue">3D WebGL</span>
      </div>
      <div class="card-img-wrap">
        <img src="file://{os.path.join(FIG_DIR, 'card01_3d_crop.png')}" />
      </div>
      <div class="card-footer">
        CIF import, vacuum padding (+15Å), auto-centering, dipole correction & real-time zoom tracking.
      </div>
    </div>

    <!-- Card 2 -->
    <div class="feature-card">
      <div class="card-header">
        <span class="card-title">Surface Work Function Studio</span>
        <span class="card-tag tag-green">Post-DFT</span>
      </div>
      <div class="card-img-wrap">
        <img src="file://{os.path.join(FIG_DIR, 'card02_wf_crop.png')}" />
      </div>
      <div class="card-footer">
        Overlaid potential profiles V̄(z), flat vacuum plateau detection, ΔΦ step & interface dipole in Debye.
      </div>
    </div>

    <!-- Card 3 -->
    <div class="feature-card">
      <div class="card-header">
        <span class="card-title">VASP to FDF & Constraints</span>
        <span class="card-tag tag-purple">Section 7.7</span>
      </div>
      <div class="card-img-wrap">
        <img src="file://{os.path.join(FIG_DIR, 'card03_vasp_crop.png')}" />
      </div>
      <div class="card-footer">
        Parses ASE GUI Selective Dynamics into SIESTA Section 7.7 %block Geometry.Constraints with 1-click workspace load.
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="features-pills">
      <span class="feat-chip">CI-NEB & IDPP Pathways</span>
      <span class="feat-chip">Frozen Phonons & Vibra</span>
      <span class="feat-chip">AFLOW Band Paths</span>
      <span class="feat-chip">HPC TIMES Profiler</span>
      <span class="feat-chip">19-Page PDF Guide</span>
    </div>
    <div class="cta-link">
      chemsiva.github.io/siesta-input-builder/
    </div>
  </div>
</body>
</html>
"""

with open(HTML_PATH, "w", encoding="utf-8") as f:
    f.write(html_content)

print(f"Wrote HTML template to {HTML_PATH}")
