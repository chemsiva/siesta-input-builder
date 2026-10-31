from PIL import Image
import os

FIG_DIR = "/scratch/SIVAKUMAR/Sivakumar_Research_work/siesta-input-builder/docs/figures"

# 1. Crop 3D Structure Viewer
im2 = Image.open(os.path.join(FIG_DIR, "fig02_structure_3d.png"))
# Width: 1024, Height: 576. The 3D viewer canvas is centered around x: 170..750, y: 190..560
crop2 = im2.crop((175, 170, 745, 560))
crop2.save(os.path.join(FIG_DIR, "card01_3d_crop.png"))

# 2. Crop Work Function Chart
im9 = Image.open(os.path.join(FIG_DIR, "fig09_workfunction.png"))
# The work function potential curves are x: 175..745, y: 190..560
crop9 = im9.crop((175, 190, 745, 560))
crop9.save(os.path.join(FIG_DIR, "card02_wf_crop.png"))

# 3. Crop VASP Dual Pane
im10 = Image.open(os.path.join(FIG_DIR, "fig10_vasp_converter.png"))
# The dual pane area is x: 175..745, y: 80..520
crop10 = im10.crop((175, 80, 745, 520))
crop10.save(os.path.join(FIG_DIR, "card03_vasp_crop.png"))

print("Cropped cards successfully!")
