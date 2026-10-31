import * as THREE from 'three';

/**
 * Creates a WebGLRenderer safely, catching context creation limits,
 * attempting stale context reclamation, and returning null on failure
 * rather than crashing the component tree.
 */
export function createSafeWebGLRenderer(options = {}) {
  const defaultOpts = {
    antialias: true,
    alpha: false,
    preserveDrawingBuffer: true,
    powerPreference: 'default',
    failIfMajorPerformanceCaveat: false,
    ...options,
  };

  let renderer = null;

  // Attempt 1: Standard requested options
  try {
    renderer = new THREE.WebGLRenderer(defaultOpts);
    return renderer;
  } catch (err1) {
    console.warn('Standard WebGL context creation failed. Attempting cleanup and fallback:', err1);
  }

  // Attempt 2: Reclaim stale contexts and retry with conservative options
  try {
    purgeAllStaleWebGLContexts();
    renderer = new THREE.WebGLRenderer({
      ...defaultOpts,
      antialias: false,
      powerPreference: 'low-power',
    });
    return renderer;
  } catch (err2) {
    console.warn('Fallback WebGL context creation failed:', err2);
  }

  return null;
}

/**
 * Forcefully releases and destroys a WebGLRenderer and its underlying
 * WebGLRenderingContext so the browser does not exhaust its active context limit.
 */
export function disposeWebGLRenderer(renderer, container = null) {
  if (!renderer) return;

  try {
    // 1. Force context loss in Three.js
    if (typeof renderer.forceContextLoss === 'function') {
      renderer.forceContextLoss();
    }

    // 2. Explicitly trigger WEBGL_lose_context extension
    const gl = renderer.getContext?.();
    if (gl) {
      const loseExt = gl.getExtension('WEBGL_lose_context');
      if (loseExt && typeof loseExt.loseContext === 'function') {
        loseExt.loseContext();
      }
    }

    // 3. Free renderer resources
    if (typeof renderer.dispose === 'function') {
      renderer.dispose();
    }

    // 4. Detach canvas from DOM
    if (container && renderer.domElement && renderer.domElement.parentNode === container) {
      container.removeChild(renderer.domElement);
    }
  } catch (err) {
    console.warn('Error during WebGL disposal:', err);
  }
}

/**
 * Scans the DOM for any inactive or orphaned WebGL canvases and calls loseContext()
 * to free up slots in the browser's GPU context pool.
 */
export function purgeAllStaleWebGLContexts() {
  if (typeof document === 'undefined') return;
  try {
    const canvases = document.querySelectorAll('canvas');
    canvases.forEach(canvas => {
      // If canvas is disconnected or hidden
      if (!canvas.isConnected || canvas.style.display === 'none') {
        const gl = canvas.getContext('webgl') || canvas.getContext('webgl2') || canvas.getContext('experimental-webgl');
        if (gl) {
          const ext = gl.getExtension('WEBGL_lose_context');
          if (ext) ext.loseContext();
        }
      }
    });
  } catch {}
}
