/**
 * Parser for SIESTA parallel execution timing reports (.times / TIMES file)
 * and Section 6.29 memory & CPU accounting outputs.
 */

export function formatDuration(seconds) {
  if (seconds == null || isNaN(seconds) || seconds < 0) return 'N/A';
  if (seconds < 60) return `${seconds.toFixed(2)}s`;
  const m = Math.floor(seconds / 60);
  const s = (seconds % 60).toFixed(1);
  if (m < 60) return `${m}m ${s}s`;
  const h = Math.floor(m / 60);
  const remM = m % 60;
  if (h < 24) return `${h}h ${remM}m ${Math.floor(seconds % 60)}s`;
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return `${d}d ${remH}h ${remM}m`;
}

export function parseTimesFile(text) {
  if (!text || typeof text !== 'string') {
    throw new Error('Empty or invalid TIMES file content');
  }

  const lines = text.split(/\r?\n/);
  const result = {
    numNodes: null,
    busiestNode: null,
    refNode: null,
    wallTimeSec: null,
    calcTime: null, // { sum, avg, myNode, avgMax }
    commTime: null, // { sum, avg, myNode, avgMax }
    totTime: null,  // { sum, avg, myNode, avgMax }
    thresholdStr: '',
    routines: [],
  };

  let inTable = false;

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('timer: Number of nodes =')) {
      result.numNodes = parseInt(line.split('=')[1], 10);
    } else if (line.startsWith('timer: Busiest calculating node was node =')) {
      result.busiestNode = parseInt(line.split('=')[1], 10);
    } else if (line.startsWith('timer: Times refer to node =')) {
      result.refNode = parseInt(line.split('=')[1], 10);
    } else if (line.startsWith('timer: Total elapsed wall-clock time (sec) =')) {
      result.wallTimeSec = parseFloat(line.split('=')[1]);
    } else if (line.startsWith('Calc: Sum, Avge, myNode, Avg/Max =')) {
      const parts = line.split('=')[1].trim().split(/\s+/).map(Number);
      result.calcTime = { sum: parts[0], avg: parts[1], myNode: parts[2], avgMax: parts[3] };
    } else if (line.startsWith('Comm: Sum, Avge, myNode, Avg/Max =')) {
      const parts = line.split('=')[1].trim().split(/\s+/).map(v => v === 'NaN' ? NaN : Number(v));
      result.commTime = { sum: parts[0], avg: parts[1], myNode: parts[2], avgMax: parts[3] };
    } else if (line.startsWith('Tot:  Sum, Avge, myNode, Avg/Max =')) {
      const parts = line.split('=')[1].trim().split(/\s+/).map(Number);
      result.totTime = { sum: parts[0], avg: parts[1], myNode: parts[2], avgMax: parts[3] };
    } else if (line.startsWith('Program times printed if >')) {
      result.thresholdStr = line;
    } else if (line.startsWith('Program') && line.includes('Calls') && line.includes('Prg.tot')) {
      inTable = true;
    } else if (inTable) {
      if (line.startsWith('/Tot.com') || line.startsWith('/Tot.tot')) {
        continue;
      }
      if (line.startsWith('Definitions:') || line.startsWith('timer:')) {
        inTable = false;
        continue;
      }
      const cols = line.split(/\s+/);
      if (cols.length >= 7) {
        result.routines.push({
          name: cols[0],
          calls: parseInt(cols[1], 10) || 0,
          prgCom: parseFloat(cols[2]) || 0,
          prgComFrac: parseFloat(cols[3]) || 0,
          prgTot: parseFloat(cols[4]) || 0,
          prgTotFrac: parseFloat(cols[5]) || 0,
          nodAvgMax: parseFloat(cols[6]) || 0,
        });
      }
    }
  }

  // Derived metrics
  if (result.wallTimeSec != null) {
    result.wallTimeFormatted = formatDuration(result.wallTimeSec);
  }
  if (result.calcTime?.sum != null) {
    result.cpuTimeSumFormatted = formatDuration(result.calcTime.sum);
  }
  if (result.totTime?.myNode != null) {
    result.cpuTimeNodeFormatted = formatDuration(result.totTime.myNode);
  }

  return result;
}
