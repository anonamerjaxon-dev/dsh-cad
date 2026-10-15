/**
 * Theme bridge for the CAD client plugin.
 *
 * The host palette lives in --dsw-alias-* custom properties and switches to
 * dark by toggling data-ds-dark-theme on <body> (see
 * @deepseek-ai/dsh-client-ui-theme). Most of this plugin already reads those
 * aliases, but a CAD viewport needs surfaces the alias layer does not define: a
 * scene canvas distinct from the chat background, a default 2D stroke, and the
 * feature-edge / ground-grid colors the Three.js scene draws. Those live here as
 * --dsh-cad-* properties, scoped to the host's dark marker so they flip with the
 * palette for free.
 *
 * DOM consumers only reference the variables (the browser repaints on a marker
 * change, no React re-render needed). Three.js cannot read CSS, so it resolves
 * colors with {@link cadThemeColors} and re-applies them from a
 * {@link subscribeCadTheme} callback when the marker flips.
 */

/** Id of the injected stylesheet (idempotent install). */
export const CAD_THEME_STYLE_ID = 'dsh-cad-theme'

/** The subset of the scene palette the Three.js layer needs as numbers. */
export interface CadThemeColors {
  /** Feature-edge line color. */
  edge: number
  /** Primary ground-grid line color. */
  gridMajor: number
  /** Secondary ground-grid line color. */
  gridMinor: number
}

/**
 * Light values match the plugin's historical defaults; the dark block only
 * overrides the properties a dark chrome needs. Kept as a plain string so the
 * client bundle stays dependency-free.
 */
const CAD_THEME_CSS = String.raw`
:root {
  --dsh-cad-bg: linear-gradient(#f5f6f8, #e9ecf0);
  --dsh-cad-surface: #f7f8fa;
  --dsh-cad-stroke: #4c5561;
  --dsh-cad-edge: #33404f;
  --dsh-cad-grid: #8a919c;
  --dsh-cad-grid-sub: #4a4f58;
  --dsh-cad-selected-bg: rgba(77, 107, 254, 0.1);
}
/* The host flips to the dark palette by adding this attribute to <body>. */
body[data-ds-dark-theme] {
  --dsh-cad-bg: linear-gradient(#23262a, #191b1e);
  --dsh-cad-surface: #26292d;
  --dsh-cad-stroke: #c3cad4;
  --dsh-cad-edge: #9aa6b5;
  --dsh-cad-grid: #5f656d;
  --dsh-cad-grid-sub: #33373c;
  --dsh-cad-selected-bg: rgba(122, 145, 255, 0.18);
}
`

/**
 * Inject the CAD theme stylesheet once. Safe to call from every plugin apply
 * and from non-DOM hosts.
 */
export function installCadTheme(): void {
  if (typeof document === 'undefined') return
  if (document.getElementById(CAD_THEME_STYLE_ID) !== null) return
  const head = document.head ?? document.documentElement
  if (head === null) return
  const style = document.createElement('style')
  style.id = CAD_THEME_STYLE_ID
  style.textContent = CAD_THEME_CSS
  head.appendChild(style)
}

/** Resolve one CSS custom property to a 0xRRGGBB number, or the fallback. */
function readColor(style: CSSStyleDeclaration, name: string, fallback: number): number {
  const raw = style.getPropertyValue(name).trim()
  const match = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(raw)
  if (match === null) return fallback
  const short = match[1]!
  const full = short.length === 3 ? short.replace(/./g, (c) => c + c) : short
  const value = Number.parseInt(full, 16)
  return Number.isNaN(value) ? fallback : value
}

/** The Three.js palette, resolved from the effective CSS variables. */
export function cadThemeColors(): CadThemeColors {
  if (typeof document === 'undefined' || document.body === null) {
    return { edge: 0x33404f, gridMajor: 0x8a919c, gridMinor: 0x4a4f58 }
  }
  const style = getComputedStyle(document.body)
  return {
    edge: readColor(style, '--dsh-cad-edge', 0x33404f),
    gridMajor: readColor(style, '--dsh-cad-grid', 0x8a919c),
    gridMinor: readColor(style, '--dsh-cad-grid-sub', 0x4a4f58),
  }
}

/**
 * Subscribe to host palette changes (the data-ds-dark-theme marker on <body>).
 * Returns an unsubscribe function; a no-op outside the browser.
 */
export function subscribeCadTheme(listener: () => void): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {}
  const target = document.body ?? document.documentElement
  if (target === null) return () => {}
  const observer = new MutationObserver(() => listener())
  observer.observe(target, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
  return () => observer.disconnect()
}
