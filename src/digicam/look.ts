/**
 * Digicam looks: the camera recipes, the pixel shader that develops a photo,
 * and the camera-body drawings. Pure TypeScript with no app imports, so the
 * same code runs in the app (React Native Skia) and in a desktop test harness
 * (CanvasKit).
 */

// ---------------------------------------------------------------------------
// Recipes

/** Every number is 0 for "no change", so a recipe can be scaled by intensity. */
export type Recipe = {
  /** Stops of light, about -1..1. */
  exposure: number;
  /** -1 flat .. 1 punchy. */
  contrast: number;
  /** -1 grey .. 1 vivid. */
  saturation: number;
  /** -1 cool .. 1 warm. */
  warmth: number;
  /** -1 magenta .. 1 green. */
  tint: number;
  /** Lifted, milky blacks, 0..1. */
  fade: number;
  /** Black and white, 0..1. */
  mono: number;
  /** Colour pushed into the shadows / highlights (rgb, about -0.2..0.2). */
  shadows: [number, number, number];
  highlights: [number, number, number];
  /** Grain amount 0..1, grain size (1 fine .. 4 coarse), colour grain 0 mono .. 1 colour. */
  grain: number;
  grainSize: number;
  grainColor: number;
  /** Dark corners 0..1. */
  vignette: number;
  /** Colour fringing at the edges (cheap lens), 0..3. */
  fringe: number;
  /** CCD softness / smear, 0..3. */
  soft: number;
  /** Bloom around bright areas, 0..1. */
  glow: number;
  /** Direct flash: bright centre falling off to cool dark edges, 0..1. */
  flash: number;
  /** Light leak colour + strength from one edge. */
  leak: [number, number, number, number];
  leakSide: 0 | 1;
};

const ZERO: Recipe = {
  exposure: 0,
  contrast: 0,
  saturation: 0,
  warmth: 0,
  tint: 0,
  fade: 0,
  mono: 0,
  shadows: [0, 0, 0],
  highlights: [0, 0, 0],
  grain: 0,
  grainSize: 1.5,
  grainColor: 0,
  vignette: 0,
  fringe: 0,
  soft: 0,
  glow: 0,
  flash: 0,
  leak: [0, 0, 0, 0],
  leakSide: 1,
};

export type BodyKind = 'compact' | 'slim' | 'disposable' | 'instant' | 'flip' | 'box' | 'action' | 'zoom';
export type Body = { kind: BodyKind; color: string; accent: string; label: string; dark?: boolean };

export type StampColor = 'amber' | 'white' | 'green' | 'red';
export type StampStyle = 'classic' | 'full' | 'short';
export type FrameKind = 'none' | 'print' | 'instant' | 'film';

export type Camera = {
  id: string;
  name: string;
  blurb: string;
  body: Body;
  recipe: Recipe;
  stamp: { style: StampStyle; color: StampColor };
  frame: FrameKind;
};

const cam = (c: Omit<Camera, 'recipe' | 'stamp' | 'frame'> & {
  recipe: Partial<Recipe>;
  stamp?: Camera['stamp'];
  frame?: FrameKind;
}): Camera => ({
  ...c,
  recipe: { ...ZERO, ...c.recipe },
  stamp: c.stamp ?? { style: 'classic', color: 'amber' },
  frame: c.frame ?? 'none',
});

export const CAMERAS: Camera[] = [
  cam({
    id: 'daily',
    name: 'Daily CCD',
    blurb: 'Bright, clean everyday digicam colour',
    body: { kind: 'compact', color: '#C9CDD3', accent: '#2C6BED', label: 'DAILY' },
    recipe: { saturation: 0.15, contrast: 0.12, warmth: -0.08, soft: 0.8, fringe: 0.5, grain: 0.1, grainSize: 1.2, grainColor: 0.3, flash: 0.12, highlights: [0, 0.02, 0.05] },
  }),
  cam({
    id: 'night',
    name: 'Night Flash',
    blurb: 'Direct flash, cool shadows, party nights',
    body: { kind: 'compact', color: '#2A2A2E', accent: '#E2483D', label: 'NIGHT', dark: true },
    recipe: { flash: 0.65, contrast: 0.25, exposure: 0.1, shadows: [-0.04, 0, 0.12], vignette: 0.45, soft: 0.6, grain: 0.18, saturation: 0.1 },
  }),
  cam({
    id: 'y2k',
    name: 'Y2K',
    blurb: 'Punchy, cool and a little low-res',
    body: { kind: 'slim', color: '#A9BEDF', accent: '#E84FA8', label: 'Y2K' },
    recipe: { saturation: 0.3, contrast: 0.2, warmth: -0.25, grain: 0.35, grainSize: 2.2, grainColor: 0.8, fringe: 1.5, soft: 1.2, flash: 0.25, highlights: [0, 0.04, 0.1] },
    stamp: { style: 'classic', color: 'green' },
  }),
  cam({
    id: 'lofi',
    name: 'Lo-Fi Phone',
    blurb: 'Early camera phone: smeary, green, noisy',
    body: { kind: 'flip', color: '#D9C8D2', accent: '#6A5ACD', label: 'VGA' },
    recipe: { saturation: -0.15, contrast: -0.12, fade: 0.3, tint: 0.12, grain: 0.5, grainSize: 3, grainColor: 1, soft: 2, fringe: 1 },
    stamp: { style: 'full', color: 'white' },
  }),
  cam({
    id: 'dream',
    name: 'Dreamcore',
    blurb: 'Bright, soft and glowing',
    body: { kind: 'slim', color: '#EDEAF4', accent: '#A88BEB', label: 'DREAM' },
    recipe: { exposure: 0.2, contrast: -0.25, fade: 0.35, glow: 0.6, saturation: -0.1, highlights: [0.05, 0, 0.07], soft: 1 },
    stamp: { style: 'classic', color: 'white' },
  }),
  cam({
    id: 'muted',
    name: 'Muted',
    blurb: 'Quiet colour for calm portraits',
    body: { kind: 'zoom', color: '#8F8B80', accent: '#E9E4D6', label: 'MUTED', dark: true },
    recipe: { saturation: -0.35, contrast: -0.05, fade: 0.2, warmth: -0.05, shadows: [0, 0.03, 0.05], grain: 0.1 },
  }),
  cam({
    id: 'print90',
    name: '90s Print',
    blurb: 'Warm yellow, faded drugstore print',
    body: { kind: 'zoom', color: '#D9C9A3', accent: '#B5473A', label: '90s' },
    recipe: { warmth: 0.45, fade: 0.35, saturation: -0.1, highlights: [0.08, 0.05, -0.05], grain: 0.25, grainSize: 1.6, vignette: 0.2 },
    stamp: { style: 'classic', color: 'red' },
  }),
  cam({
    id: 'disposable',
    name: 'Disposable',
    blurb: 'Warm flash, light leaks, dark corners',
    body: { kind: 'disposable', color: '#F2C230', accent: '#1F5FAF', label: 'FUN 27' },
    recipe: { warmth: 0.3, contrast: 0.15, saturation: 0.1, flash: 0.35, leak: [1, 0.45, 0.15, 0.55], leakSide: 1, vignette: 0.45, grain: 0.3, grainSize: 1.8, soft: 0.8 },
  }),
  cam({
    id: 'instant',
    name: 'Instant',
    blurb: 'Soft instant print, cyan shadows',
    body: { kind: 'instant', color: '#F1EEE6', accent: '#E0533D', label: 'INSTANT' },
    recipe: { fade: 0.3, contrast: -0.1, saturation: -0.1, shadows: [-0.04, 0.04, 0.06], highlights: [0.06, 0.04, -0.02], warmth: 0.1, soft: 1, vignette: 0.2, glow: 0.15 },
    frame: 'instant',
  }),
  cam({
    id: 'pastel',
    name: 'Pastel',
    blurb: 'Rosy, lifted, soft-focus portraits',
    body: { kind: 'compact', color: '#F2C6D2', accent: '#FFFFFF', label: 'PASTEL' },
    recipe: { exposure: 0.15, contrast: -0.2, fade: 0.25, glow: 0.35, highlights: [0.08, 0, 0.04], saturation: -0.05, soft: 0.8 },
    stamp: { style: 'classic', color: 'white' },
  }),
  cam({
    id: 'action',
    name: 'Action',
    blurb: 'Sharp, contrasty, saturated',
    body: { kind: 'action', color: '#1E1E1E', accent: '#FF6A00', label: 'ACTION', dark: true },
    recipe: { contrast: 0.35, saturation: 0.25, vignette: 0.15, exposure: 0.05 },
  }),
  cam({
    id: 'booth',
    name: 'Booth',
    blurb: 'Black and white, grain, dark corners',
    body: { kind: 'box', color: '#3B3B3B', accent: '#C9A15A', label: 'BOOTH', dark: true },
    recipe: { mono: 1, contrast: 0.35, grain: 0.45, grainSize: 1.5, vignette: 0.6, fade: 0.1 },
    stamp: { style: 'full', color: 'white' },
  }),
];

export const cameraById = (id: string) => CAMERAS.find((c) => c.id === id) ?? CAMERAS[0];

// ---------------------------------------------------------------------------
// Settings for one developed photo

/** The editor's sliders. 0 = the camera's own look. */
export type Adjust = {
  exposure: number; // -1..1
  contrast: number; // -1..1
  saturation: number; // -1..1
  warmth: number; // -1..1
  grain: number; // 0..1
  glow: number; // 0..1
  vignette: number; // 0..1
};

export const NO_ADJUST: Adjust = { exposure: 0, contrast: 0, saturation: 0, warmth: 0, grain: 0, glow: 0, vignette: 0 };

/** Output shape, width:height. */
export type Crop = 'original' | '3:4' | '4:5' | '1:1' | '9:16' | '4:3';
export const CROP_RATIO: Record<Exclude<Crop, 'original'>, number> = { '3:4': 3 / 4, '4:5': 4 / 5, '1:1': 1, '9:16': 9 / 16, '4:3': 4 / 3 };

export type Develop = {
  camera: string;
  /** 0 = original photo, 1 = full camera look. */
  intensity: number;
  adjust: Adjust;
  stamp: { on: boolean; style: StampStyle; color: StampColor; pos: 'br' | 'bl' };
  frame: FrameKind;
  crop: Crop;
};

export function defaultDevelop(cameraId: string, opts?: { stamp?: boolean; crop?: Crop }): Develop {
  const c = cameraById(cameraId);
  return {
    camera: c.id,
    intensity: 1,
    adjust: { ...NO_ADJUST },
    stamp: { on: opts?.stamp ?? true, ...c.stamp, pos: 'br' },
    frame: c.frame,
    crop: opts?.crop ?? 'original',
  };
}

/** Switching camera keeps your crop and date-stamp choice, resets the look. */
export function switchCamera(d: Develop, cameraId: string): Develop {
  const c = cameraById(cameraId);
  return { ...d, camera: c.id, intensity: 1, adjust: { ...NO_ADJUST }, stamp: { ...d.stamp, ...c.stamp }, frame: c.frame };
}

/** The camera's recipe at the chosen intensity, plus the slider adjustments. */
export function effectiveRecipe(d: Develop): Recipe {
  const r = cameraById(d.camera).recipe;
  const k = d.intensity;
  const a = d.adjust;
  const s3 = (v: [number, number, number]): [number, number, number] => [v[0] * k, v[1] * k, v[2] * k];
  return {
    exposure: r.exposure * k + a.exposure,
    contrast: r.contrast * k + a.contrast * 0.5,
    saturation: r.saturation * k + a.saturation,
    warmth: r.warmth * k + a.warmth * 0.6,
    tint: r.tint * k,
    fade: r.fade * k,
    mono: r.mono * k,
    shadows: s3(r.shadows),
    highlights: s3(r.highlights),
    grain: Math.min(1, r.grain * k + a.grain * 0.6),
    grainSize: r.grainSize,
    grainColor: r.grainColor,
    vignette: Math.min(1, r.vignette * k + a.vignette * 0.8),
    fringe: r.fringe * k,
    soft: r.soft * k,
    glow: Math.min(1, r.glow * k + a.glow * 0.8),
    flash: r.flash * k,
    leak: [r.leak[0], r.leak[1], r.leak[2], r.leak[3] * k],
    leakSide: r.leakSide,
  };
}

// ---------------------------------------------------------------------------
// Layout: where the photo sits on the canvas (crop + frame)

export type Layout = { width: number; height: number; photo: { x: number; y: number; width: number; height: number } };

/** Frame borders as a fraction of the photo width: [top, side, bottom]. */
const FRAME: Record<FrameKind, [number, number, number]> = {
  none: [0, 0, 0],
  print: [0.045, 0.045, 0.045],
  instant: [0.06, 0.06, 0.26],
  film: [0.07, 0.05, 0.07],
};

/** Canvas size for a photo of imgW×imgH shown `width` points wide. */
export function layout(imgW: number, imgH: number, d: Develop, width: number): Layout {
  const ratio = d.crop === 'original' ? imgW / imgH : CROP_RATIO[d.crop];
  const [t, s, b] = FRAME[d.frame];
  const pw = width / (1 + 2 * s);
  const ph = pw / ratio;
  return { width, height: ph + pw * (t + b), photo: { x: pw * s, y: pw * t, width: pw, height: ph } };
}

/** Canvas size whose long side is `longSide`. */
export function layoutForLongSide(imgW: number, imgH: number, d: Develop, longSide: number): Layout {
  const unit = layout(imgW, imgH, d, 1000);
  const w = unit.height > unit.width ? (longSide * unit.width) / unit.height : longSide;
  return layout(imgW, imgH, d, Math.round(w));
}

// ---------------------------------------------------------------------------
// The shader

/**
 * Develops `image` (an image shader already placed over the photo rectangle).
 * Coordinates are canvas pixels; `origin`/`size` give the photo rectangle, so
 * every effect scales with the photo and looks the same in the small editor
 * preview and the full-size saved file.
 */
export const DEVELOP_SKSL = `
uniform shader image;
uniform float2 origin;
uniform float2 size;
uniform float exposure;
uniform float contrast;
uniform float saturation;
uniform float warmth;
uniform float tint;
uniform float fade;
uniform float mono;
uniform float3 shadows;
uniform float3 highlights;
uniform float grain;
uniform float grainSize;
uniform float grainColor;
uniform float vignette;
uniform float fringe;
uniform float soft;
uniform float glow;
uniform float flash;
uniform float4 leak;
uniform float leakSide;
uniform float seed;

float hash(float2 p) {
  float3 p3 = fract(float3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float3 tap(float2 p) { return float3(image.eval(p).rgb); }

// Small cross blur for CCD softness.
float3 softTap(float2 p, float r) {
  if (r < 0.05) { return tap(p); }
  float3 c = tap(p) * 0.36;
  c += tap(p + float2(r, 0.0)) * 0.16;
  c += tap(p - float2(r, 0.0)) * 0.16;
  c += tap(p + float2(0.0, r)) * 0.16;
  c += tap(p - float2(0.0, r)) * 0.16;
  return c;
}

half4 main(float2 p) {
  float unit = min(size.x, size.y) / 1000.0;
  float2 uv = (p - origin) / size;
  float2 d = (p - origin - size * 0.5) / min(size.x, size.y);
  float r2 = dot(d, d);

  // Lens: colour fringing grows toward the edges, plus softness.
  float sr = soft * unit;
  float2 shift = d * fringe * unit * 6.0;
  float3 c;
  if (fringe > 0.01) {
    c = float3(softTap(p + shift, sr).r, softTap(p, sr).g, softTap(p - shift, sr).b);
  } else {
    c = softTap(p, sr);
  }

  c *= exp2(exposure);

  // Glow: screen in a blurred copy of the bright parts.
  if (glow > 0.01) {
    float gr = 25.0 * unit;
    float3 b = tap(p + float2(gr, 0.0)) + tap(p - float2(gr, 0.0)) + tap(p + float2(0.0, gr)) + tap(p - float2(0.0, gr));
    b += tap(p + float2(gr, gr) * 0.7) + tap(p - float2(gr, gr) * 0.7) + tap(p + float2(gr, -gr) * 0.7) + tap(p + float2(-gr, gr) * 0.7);
    b = b / 8.0;
    float3 bright = clamp((b - 0.45) * 1.8, 0.0, 1.0);
    c = 1.0 - (1.0 - c) * (1.0 - bright * glow * 0.8);
  }

  // White balance.
  c *= float3(1.0 + 0.12 * warmth, 1.0 + 0.02 * warmth + 0.06 * tint, 1.0 - 0.12 * warmth);

  // Saturation, then black and white.
  float l = dot(c, float3(0.299, 0.587, 0.114));
  c = mix(float3(l), c, 1.0 + saturation);
  c = mix(c, float3(l), mono);

  // Contrast around mid grey.
  c = (c - 0.5) * (1.0 + contrast) + 0.5;

  // Split toning.
  float lum = clamp(dot(c, float3(0.299, 0.587, 0.114)), 0.0, 1.0);
  c += shadows * (1.0 - lum) + highlights * lum;

  // Faded blacks.
  c = c * (1.0 - fade * 0.22) + fade * 0.14;

  // Direct flash: bright centre, falling off, cooler in the dark edges.
  c *= 1.0 + flash * (0.2 - r2 * 1.2);
  c.b += flash * 0.05 * (1.0 - lum);

  // Light leak from one edge.
  float lx = leakSide > 0.5 ? uv.x : 1.0 - uv.x;
  float lk = smoothstep(0.5, 1.05, lx) * (0.65 + 0.35 * sin(uv.y * 4.0 + seed));
  c = 1.0 - (1.0 - c) * (1.0 - leak.rgb * leak.a * lk);

  // Vignette.
  c *= 1.0 - vignette * 0.75 * smoothstep(0.08, 0.55, r2);

  // Grain, strongest in the mid tones.
  float2 gp = floor((p - origin) / max(grainSize * unit, 1.0));
  float n = hash(gp + seed) - 0.5;
  float3 nc = float3(n, hash(gp + seed + 17.0) - 0.5, hash(gp + seed + 43.0) - 0.5);
  float3 g = mix(float3(n), nc, grainColor);
  c += g * grain * 0.28 * (0.55 + lum * (1.0 - lum) * 1.8);

  return half4(half3(clamp(c, 0.0, 1.0)), 1.0);
}
`;

/** Uniform values, in the shader's declaration order. */
export function developUniforms(d: Develop, photo: Layout['photo'], seed: number) {
  const r = effectiveRecipe(d);
  return {
    origin: [photo.x, photo.y],
    size: [photo.width, photo.height],
    exposure: r.exposure,
    contrast: r.contrast,
    saturation: r.saturation,
    warmth: r.warmth,
    tint: r.tint,
    fade: r.fade,
    mono: r.mono,
    shadows: r.shadows,
    highlights: r.highlights,
    grain: r.grain,
    grainSize: r.grainSize,
    grainColor: r.grainColor,
    vignette: r.vignette,
    fringe: r.fringe,
    soft: r.soft,
    glow: r.glow,
    flash: r.flash,
    leak: r.leak,
    leakSide: r.leakSide,
    seed,
  };
}

// ---------------------------------------------------------------------------
// Date stamp and frames

export const STAMP_COLORS: Record<StampColor, { fill: string; glow: string }> = {
  amber: { fill: '#FF9A3C', glow: 'rgba(255,110,20,0.8)' },
  red: { fill: '#FF5A3C', glow: 'rgba(255,60,20,0.8)' },
  green: { fill: '#8DFF6A', glow: 'rgba(60,255,60,0.6)' },
  white: { fill: '#F6F3EA', glow: 'rgba(255,255,255,0.5)' },
};

export function stampLabel(style: StampStyle, date: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  const yy = p(date.getFullYear() % 100);
  if (style === 'full') return `${date.getFullYear()} ${p(date.getMonth() + 1)} ${p(date.getDate())}`;
  if (style === 'short') return `'${yy}`;
  return `'${yy} ${p(date.getMonth() + 1)} ${p(date.getDate())}`;
}

export const FRAME_COLORS: Record<FrameKind, string> = { none: '#000', print: '#FBFAF5', instant: '#F7F5EE', film: '#151515' };

/**
 * A quick approximation of a look for the live viewfinder (colour layers with
 * blend modes); the real look is developed after the shot.
 */
export function previewLayers(r: Recipe) {
  const layers: { color: string; opacity?: number; blend?: 'soft-light' | 'saturation' | 'normal' | 'multiply' | 'screen' }[] = [];
  if (r.mono > 0.5) layers.push({ color: '#000', blend: 'saturation' });
  else if (r.saturation < -0.05) layers.push({ color: '#000', blend: 'saturation', opacity: Math.min(0.8, -r.saturation * 1.4) });
  if (r.warmth > 0.05) layers.push({ color: '#FF9A3C', blend: 'soft-light', opacity: Math.min(0.6, r.warmth * 0.9) });
  if (r.warmth < -0.05) layers.push({ color: '#2F6BFF', blend: 'soft-light', opacity: Math.min(0.6, -r.warmth * 0.9) });
  if (r.tint > 0.05) layers.push({ color: '#4CFF7A', blend: 'soft-light', opacity: r.tint * 1.2 });
  if (r.fade > 0.05) layers.push({ color: '#F3EEE4', opacity: r.fade * 0.3 });
  if (r.glow > 0.2) layers.push({ color: '#FFFFFF', blend: 'soft-light', opacity: r.glow * 0.3 });
  return layers;
}

// ---------------------------------------------------------------------------
// Camera bodies, drawn as SVG (120 × 84)

export function cameraSvg(b: Body): string {
  const ink = b.dark ? '#F2F0EA' : '#25251F';
  const lens = (cx: number, cy: number, r: number) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#1A1A1D"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.78}" fill="#2B2C31" stroke="#55565C" stroke-width="1"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.45}" fill="#1E3550"/>` +
    `<circle cx="${cx}" cy="${cy}" r="${r * 0.22}" fill="#0B1420"/>` +
    `<circle cx="${cx - r * 0.25}" cy="${cy - r * 0.28}" r="${r * 0.13}" fill="#FFFFFF" opacity="0.7"/>`;
  const flash = (x: number, y: number, w: number, h: number) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="#F6F5EF" stroke="#9A9A94" stroke-width="0.8"/>` +
    `<path d="M${x + 2} ${y + h / 2} H${x + w - 2}" stroke="#D6D3C8" stroke-width="0.8"/>`;
  const label = (x: number, y: number, size = 7, color = ink) =>
    `<text x="${x}" y="${y}" font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${size}" fill="${color}" letter-spacing="0.6">${b.label}</text>`;
  const shade = (x: number, y: number, w: number, h: number, rx: number) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="url(#g)"/>`;
  let body = '';
  switch (b.kind) {
    case 'compact':
      body =
        `<rect x="84" y="10" width="16" height="7" rx="3" fill="${b.accent}"/>` +
        `<rect x="6" y="15" width="108" height="60" rx="11" fill="${b.color}"/>` +
        shade(6, 15, 108, 60, 11) +
        flash(14, 23, 22, 12) +
        `<rect x="42" y="24" width="12" height="9" rx="2" fill="#222"/>` +
        lens(80, 47, 21) +
        label(14, 66);
      break;
    case 'slim':
      body =
        `<rect x="88" y="17" width="14" height="5" rx="2" fill="${b.accent}"/>` +
        `<rect x="4" y="21" width="112" height="46" rx="9" fill="${b.color}"/>` +
        shade(4, 21, 112, 46, 9) +
        lens(26, 40, 12) +
        flash(44, 27, 20, 9) +
        `<circle cx="104" cy="58" r="3" fill="${b.accent}"/>` +
        label(44, 59);
      break;
    case 'zoom':
      body =
        `<rect x="18" y="11" width="18" height="6" rx="3" fill="${b.accent}"/>` +
        `<rect x="6" y="16" width="108" height="58" rx="8" fill="${b.color}"/>` +
        shade(6, 16, 108, 58, 8) +
        `<rect x="88" y="16" width="26" height="58" rx="8" fill="#00000022"/>` +
        `<circle cx="58" cy="46" r="25" fill="#00000030"/>` +
        lens(58, 46, 21) +
        flash(90, 22, 18, 10) +
        label(12, 68, 6.5);
      break;
    case 'disposable':
      body =
        `<rect x="92" y="9" width="14" height="8" rx="2" fill="#333"/>` +
        `<rect x="6" y="15" width="108" height="60" rx="6" fill="${b.color}"/>` +
        shade(6, 15, 108, 60, 6) +
        `<rect x="6" y="40" width="108" height="24" fill="${b.accent}"/>` +
        `<text x="14" y="56" font-family="Helvetica, Arial, sans-serif" font-weight="800" font-size="10" fill="#FFFFFF" letter-spacing="0.4">${b.label}</text>` +
        flash(74, 20, 32, 16) +
        lens(30, 29, 10) +
        `<rect x="48" y="22" width="12" height="8" rx="1.5" fill="#222"/>`;
      break;
    case 'instant':
      body =
        `<rect x="14" y="6" width="92" height="74" rx="12" fill="${b.color}"/>` +
        shade(14, 6, 92, 74, 12) +
        `<rect x="56" y="6" width="8" height="54" fill="${b.accent}"/>` +
        `<rect x="56" y="6" width="8" height="18" fill="#F2B233"/>` +
        `<rect x="56" y="24" width="8" height="18" fill="#3E9C5A"/>` +
        flash(20, 12, 22, 14) +
        lens(60, 38, 18) +
        `<rect x="28" y="68" width="64" height="4" rx="2" fill="#2A2A2A"/>` +
        `<rect x="80" y="12" width="18" height="12" rx="2" fill="#222"/>`;
      break;
    case 'flip':
      body =
        `<rect x="30" y="4" width="60" height="76" rx="12" fill="${b.color}"/>` +
        shade(30, 4, 60, 76, 12) +
        `<rect x="30" y="40" width="60" height="3" fill="#00000030"/>` +
        `<rect x="40" y="48" width="40" height="22" rx="4" fill="#1C1C22"/>` +
        `<rect x="43" y="51" width="34" height="16" rx="2" fill="#3C4A66"/>` +
        lens(60, 22, 9) +
        `<circle cx="76" cy="14" r="3" fill="#F6F5EF" stroke="#9A9A94" stroke-width="0.6"/>` +
        label(41, 37, 6, b.accent);
      break;
    case 'box':
      body =
        `<rect x="44" y="4" width="32" height="12" rx="3" fill="${b.color}"/>` +
        `<rect x="10" y="12" width="100" height="66" rx="5" fill="${b.color}"/>` +
        shade(10, 12, 100, 66, 5) +
        `<rect x="10" y="12" width="100" height="10" fill="${b.accent}"/>` +
        lens(60, 48, 22) +
        flash(16, 28, 20, 12) +
        label(82, 72, 6, b.accent);
      break;
    case 'action':
      body =
        `<rect x="24" y="12" width="72" height="64" rx="12" fill="${b.color}"/>` +
        shade(24, 12, 72, 64, 12) +
        `<rect x="74" y="7" width="14" height="6" rx="2" fill="${b.accent}"/>` +
        `<rect x="30" y="18" width="22" height="14" rx="3" fill="#2E3440"/>` +
        lens(66, 48, 20) +
        `<circle cx="36" cy="66" r="3" fill="${b.accent}"/>` +
        label(30, 46, 6, b.accent);
      break;
  }
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 84">` +
    `<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="#FFFFFF" stop-opacity="0.28"/>` +
    `<stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0"/>` +
    `<stop offset="1" stop-color="#000000" stop-opacity="0.18"/>` +
    `</linearGradient></defs>${body}</svg>`
  );
}
