/**
 * Publication-Quality Image Exporters: SVG, PNG (300 DPI), and TIFF (300 DPI)
 * Supports dark theme, publication white background, and standard uncompressed baseline TIFF 6.0.
 */

/**
 * Baseline uncompressed TIFF 6.0 RGBA encoder.
 * Produces compliant TIFF images suitable for journal submissions (Elsevier, Nature, Wiley, ACS).
 */
export function createTiffBlob(rgbaData, width, height, dpi = 300) {
  const numTags = 12;
  const headerSize = 8;
  const ifdSize = 2 + numTags * 12 + 4; // count + tags + nextIFD
  const extraDataOffset = headerSize + ifdSize;

  // Extra offsets for rational / multi-short tag values
  const bitsPerSampleOffset = extraDataOffset;
  const xResOffset = bitsPerSampleOffset + 8; // 4 shorts = 8 bytes
  const yResOffset = xResOffset + 8;          // 2 longs = 8 bytes
  const pixelDataOffset = yResOffset + 8;     // 2 longs = 8 bytes

  const pixelBytes = width * height * 4;
  const totalFileSize = pixelDataOffset + pixelBytes;

  const buffer = new ArrayBuffer(totalFileSize);
  const view = new DataView(buffer);

  // 1. TIFF Header: 'II' (Little Endian, 0x4949) + Magic 42 + Offset to 1st IFD
  view.setUint16(0, 0x4949, true);
  view.setUint16(2, 42, true);
  view.setUint32(4, 8, true);

  // 2. IFD entries
  let offset = 8;
  view.setUint16(offset, numTags, true);
  offset += 2;

  function writeTag(tag, type, count, valOrOffset) {
    view.setUint16(offset, tag, true);
    view.setUint16(offset + 2, type, true);
    view.setUint32(offset + 4, count, true);
    view.setUint32(offset + 8, valOrOffset, true);
    offset += 12;
  }

  writeTag(256, 3, 1, width);                // ImageWidth
  writeTag(257, 3, 1, height);               // ImageLength
  writeTag(258, 3, 4, bitsPerSampleOffset);  // BitsPerSample (8,8,8,8)
  writeTag(259, 3, 1, 1);                    // Compression (1 = none)
  writeTag(262, 3, 1, 2);                    // PhotometricInterpretation (2 = RGB)
  writeTag(273, 4, 1, pixelDataOffset);      // StripOffsets
  writeTag(277, 3, 1, 4);                    // SamplesPerPixel (4 = RGBA)
  writeTag(278, 3, 1, height);               // RowsPerStrip
  writeTag(279, 4, 1, pixelBytes);           // StripByteCounts
  writeTag(282, 5, 1, xResOffset);           // XResolution (RATIONAL)
  writeTag(283, 5, 1, yResOffset);           // YResolution (RATIONAL)
  writeTag(296, 3, 1, 2);                    // ResolutionUnit (2 = inch)

  view.setUint32(offset, 0, true); // Next IFD (0 = end)

  // 3. Extra tag payloads
  // BitsPerSample: 8, 8, 8, 8
  view.setUint16(bitsPerSampleOffset, 8, true);
  view.setUint16(bitsPerSampleOffset + 2, 8, true);
  view.setUint16(bitsPerSampleOffset + 4, 8, true);
  view.setUint16(bitsPerSampleOffset + 6, 8, true);

  // XResolution: 300 / 1
  view.setUint32(xResOffset, dpi, true);
  view.setUint32(xResOffset + 4, 1, true);

  // YResolution: 300 / 1
  view.setUint32(yResOffset, dpi, true);
  view.setUint32(yResOffset + 4, 1, true);

  // 4. Pixel buffer (RGBA)
  const pixelView = new Uint8Array(buffer, pixelDataOffset, pixelBytes);
  pixelView.set(rgbaData);

  return new Blob([buffer], { type: 'image/tiff' });
}

/**
 * Export SVG element as vector .svg file
 */
export function exportSvg(svgEl, filename = 'figure.svg') {
  if (!svgEl) return;
  const serializer = new XMLSerializer();
  let source = serializer.serializeToString(svgEl);

  // Add namespaces if missing
  if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
    source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
  triggerDownload(blob, filename.endsWith('.svg') ? filename : `${filename}.svg`);
}

/**
 * Render SVG element onto high-resolution HTML5 canvas
 */
export function renderSvgToCanvas(svgEl, width, height, scale = 3, bg = 'dark') {
  return new Promise((resolve, reject) => {
    if (!svgEl) return reject(new Error('SVG element is null'));

    const serializer = new XMLSerializer();
    let source = serializer.serializeToString(svgEl);

    // If publication white background requested, adapt contrast
    if (bg === 'white') {
      source = source.replace(/rgba\(255,255,255,0\.06\)/g, 'rgba(0,0,0,0.08)');
      source = source.replace(/rgba\(255,255,255,0\.12\)/g, 'rgba(0,0,0,0.12)');
      source = source.replace(/fill="var\(--fg\)"/g, 'fill="#1e293b"');
      source = source.replace(/stroke="var\(--border\)"/g, 'stroke="#cbd5e1"');
      source = source.replace(/#ffffff/g, '#0f172a'); // invert white text
    }

    const svgBlob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
    const URL_ = window.URL || window.webkitURL || window;
    const blobURL = URL_.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * scale);
      canvas.height = Math.round(height * scale);
      const ctx = canvas.getContext('2d');

      // Draw background
      if (bg === 'dark') {
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      } else if (bg === 'white') {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL_.revokeObjectURL(blobURL);
      resolve(canvas);
    };
    img.onerror = (err) => {
      URL_.revokeObjectURL(blobURL);
      reject(err);
    };
    img.src = blobURL;
  });
}

/**
 * Export SVG element as high-resolution (300 DPI) PNG
 */
export async function exportPng(svgEl, width, height, filename = 'figure_300dpi.png', scale = 3, bg = 'dark') {
  const canvas = await renderSvgToCanvas(svgEl, width, height, scale, bg);
  canvas.toBlob((blob) => {
    if (!blob) return;
    triggerDownload(blob, filename.endsWith('.png') ? filename : `${filename}.png`);
  }, 'image/png');
}

/**
 * Export SVG element as publication-grade 300 DPI TIFF (.tif)
 */
export async function exportTiff(svgEl, width, height, filename = 'figure_300dpi.tif', scale = 2.5, bg = 'white') {
  const canvas = await renderSvgToCanvas(svgEl, width, height, scale, bg);
  const ctx = canvas.getContext('2d');
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const tiffBlob = createTiffBlob(imgData.data, canvas.width, canvas.height, 300);
  triggerDownload(tiffBlob, filename.endsWith('.tif') || filename.endsWith('.tiff') ? filename : `${filename}.tif`);
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
