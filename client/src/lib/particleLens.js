import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  Mesh,
  NormalBlending,
  PerspectiveCamera,
  PlaneGeometry,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";

/**
 * Camera-lens backdrop for the landing page hero (see HeroBackdrop in
 * pages/Home.jsx) - focus, perspective, precision, clarity. Loaded with a
 * dynamic import so three.js stays out of the main bundle.
 *
 * Built from particles in the site's --amber / --steel tokens: an 8-blade
 * aperture whose blade edges run out into the classic pinwheel seams, a
 * rotating focus ring with tick marks, the lens barrel and an outer distance
 * scale. A glass layer adds warm light through the opening and coating
 * reflections that shift with the cursor. The aperture slowly opens and
 * closes (the blades turn as they move, like a real diaphragm).
 *
 * setScroll(0..1) drives the fly-through: the aperture opens wide and the
 * camera moves through it while everything fades.
 */

// Site palette (client/src/index.css :root), as 0-1 sRGB. The shaders write
// these straight to the canvas, so no colour-space conversion is wanted.
const hex = (h) => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];
const GOLD_LIGHT = hex(0xf6c392); // --amber-3
const GOLD = hex(0xe8a25c); // --amber-2
const AMBER = hex(0xd98c46); // --amber
const STEEL = hex(0x7ba3cf); // --steel
const STEEL_DEEP = hex(0x3d5f85); // --steel-2
const STEEL_PALE = hex(0xa9c6e6);
const SPARK = hex(0xfff4e2);

// Lens geometry, in lens-local units (before LENS_SCALE).
const BLADES = 8;
const APERTURE = 1.35; // resting inradius of the opening
const BARREL = 4.0; // outer edge of the blades
const FOCUS_IN = 4.55; // focus ring (with ticks)
const FOCUS_OUT = 4.95;
const OUTER = 5.45; // lens barrel
const SCALE_RING = 5.85; // outer distance scale
const FOCUS_TICKS = 72;
const SCALE_TICKS = 180;

const FOV = 50;
const CAMERA_Z = 11;
// Where the lens centre sits on the (viewport-sized) canvas, as a fraction of
// its height from the top - behind the hero logo.
const CORE_Y = 0.4;
// Overall size of the lens on screen.
const LENS_SCALE = 0.82;
const ZONE_DIM = 0.85; // how much the lens fades behind the hero text

// Particle kinds (aKind).
const K_BLADE = 0;
const K_EDGE = 1;
const K_RING = 2;
const K_HAZE = 3;

const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const scale = (c, k) => [c[0] * k, c[1] * k, c[2] * k];
const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
const TAU = Math.PI * 2;

function buildParticles(count) {
  const kind = new Float32Array(count);
  const pa = new Float32Array(count); // blade/ring/haze: radius · edge: blade index
  const pb = new Float32Array(count); // blade/ring/haze: angle · edge: position along the edge
  const pc = new Float32Array(count); // ring: rotation speed
  const size = new Float32Array(count);
  const phase = new Float32Array(count);
  const colour = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const roll = Math.random();
    let k, a, b, c = 0, s, col;
    if (roll < 0.42) {
      // Blade surfaces: brushed metal, hidden inside the opening by the shader.
      k = K_BLADE;
      a = 0.9 + (BARREL - 0.9) * Math.sqrt(Math.random());
      b = Math.random() * TAU;
      s = 1.1 + Math.random() * 1.0;
      col = scale(mix(STEEL_DEEP, AMBER, Math.random() * 0.45), 0.75);
    } else if (roll < 0.6) {
      // Blade edges: the bright outline of the opening, then the pinwheel
      // seams where each edge runs on under the next blade.
      k = K_EDGE;
      a = Math.floor(Math.random() * BLADES);
      const outline = Math.random() < 0.45;
      b = outline ? Math.random() : 1 + Math.random() * 4.5;
      s = outline ? 1.6 + Math.random() * 1.2 : 1.4 + Math.random() * 1.0;
      col = outline ? mix(GOLD_LIGHT, SPARK, Math.random() * 0.4) : scale(mix(GOLD_LIGHT, GOLD, Math.random()), 1.25);
    } else if (roll < 0.92) {
      k = K_RING;
      const r2 = Math.random();
      if (r2 < 0.22) {
        // Inner bezel around the blades.
        a = BARREL + 0.15 + gauss() * 0.03;
        b = Math.random() * TAU;
        s = 1.8 + Math.random() * 1.0;
        col = mix(STEEL, STEEL_PALE, 0.3 + Math.random() * 0.7);
      } else if (r2 < 0.55) {
        // Focus ring: tick marks, longer every sixth, rotating slowly.
        const t = Math.floor(Math.random() * FOCUS_TICKS);
        const long = t % 6 === 0;
        b = (t / FOCUS_TICKS) * TAU + gauss() * 0.002;
        a = FOCUS_IN + Math.random() * (long ? FOCUS_OUT - FOCUS_IN : (FOCUS_OUT - FOCUS_IN) * 0.5);
        c = 0.05;
        s = long ? 2.2 + Math.random() * 0.9 : 1.7 + Math.random() * 0.7;
        col = long ? mix(GOLD_LIGHT, SPARK, 0.3) : GOLD;
      } else if (r2 < 0.68) {
        // Thin ring just outside the focus ticks, turning with them.
        a = FOCUS_OUT + 0.1 + gauss() * 0.02;
        b = Math.random() * TAU;
        c = 0.05;
        s = 1.5 + Math.random() * 0.8;
        col = AMBER;
      } else if (r2 < 0.85) {
        // Lens barrel.
        a = OUTER + gauss() * 0.06;
        b = Math.random() * TAU;
        s = 1.8 + Math.random() * 1.1;
        col = mix(STEEL, STEEL_PALE, Math.random() * 0.5);
      } else {
        // Outer distance scale: fine ticks turning the other way.
        const t = Math.floor(Math.random() * SCALE_TICKS);
        b = (t / SCALE_TICKS) * TAU;
        a = SCALE_RING + Math.random() * (t % 10 === 0 ? 0.28 : 0.12);
        c = -0.03;
        s = 1.4 + Math.random() * 0.7;
        col = STEEL;
      }
    } else {
      // Faint haze around the lens for depth.
      k = K_HAZE;
      a = SCALE_RING * (1.1 + Math.pow(Math.random(), 1.4) * 0.8);
      b = Math.random() * TAU;
      s = 0.7 + Math.random() * 1.1;
      col = scale(Math.random() < 0.65 ? STEEL_DEEP : AMBER, 0.35);
    }
    kind[i] = k;
    pa[i] = a;
    pb[i] = b;
    pc[i] = c;
    size[i] = s;
    phase[i] = Math.random() * TAU;
    colour.set(col, i * 3);
  }

  const geometry = new BufferGeometry();
  // three needs a position attribute for the vertex count; the shader
  // computes the real position.
  geometry.setAttribute("position", new BufferAttribute(new Float32Array(count * 3), 3));
  geometry.setAttribute("aKind", new BufferAttribute(kind, 1));
  geometry.setAttribute("aA", new BufferAttribute(pa, 1));
  geometry.setAttribute("aB", new BufferAttribute(pb, 1));
  geometry.setAttribute("aC", new BufferAttribute(pc, 1));
  geometry.setAttribute("aSize", new BufferAttribute(size, 1));
  geometry.setAttribute("aPhase", new BufferAttribute(phase, 1));
  geometry.setAttribute("aColor", new BufferAttribute(colour, 3));
  return geometry;
}

// Soft rounded-rect "text zone" (device px, top-left origin): 1 outside, fading
// to 1 - uZoneDim inside, so the lens dims wherever the hero text sits.
const zoneUniforms = () => ({
  uZoneCenter: { value: [0, 0] },
  uZoneHalf: { value: [0, 0] },
  uZoneDim: { value: 0 },
  uViewport: { value: [1, 1] },
});
const zoneGlsl = /* glsl */ `
  uniform vec2 uZoneCenter, uZoneHalf, uViewport;
  uniform float uZoneDim;
  float zoneMask(vec2 px) {
    vec2 q = max(abs(px - uZoneCenter) - uZoneHalf, 0.0);
    float d = length(q) / (90.0 * uViewport.y / 800.0 + 1.0);
    return 1.0 - uZoneDim * (1.0 - smoothstep(0.0, 1.0, d));
  }
`;

// The aperture: a regular polygon with inradius uAperture, rotated by uRot.
const apertureGlsl = /* glsl */ `
  uniform float uAperture, uRot;
  const float N = ${BLADES.toFixed(1)};
  const float PI = 3.14159265;
  const float TAU = 6.2831853;
  // Distance from the centre to the opening's edge in direction a.
  float openingRadius(float a) {
    float seg = TAU / N;
    float d = mod(a - uRot, seg) - seg * 0.5;
    return uAperture / cos(d);
  }
  vec2 bladeVertex(float k) {
    float a = uRot + k * TAU / N;
    return vec2(cos(a), sin(a)) * uAperture / cos(PI / N);
  }
`;

const pointsMaterial = () =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uFade: { value: 1 },
      uScale: { value: 1 },
      uAperture: { value: APERTURE },
      uRot: { value: 0 },
      ...zoneUniforms(),
    },
    vertexShader: /* glsl */ `
      ${zoneGlsl}
      ${apertureGlsl}
      attribute float aKind, aA, aB, aC, aSize, aPhase;
      attribute vec3 aColor;
      uniform float uTime, uFade, uScale;
      varying vec3 vColor;
      varying float vAlpha;
      const float BARREL = ${BARREL.toFixed(3)};
      void main() {
        int k = int(aKind + 0.5);
        vec2 p;
        float vis = 1.0;
        float gain = 1.0;
        if (k == ${K_BLADE}) {
          p = vec2(cos(aB), sin(aB)) * aA;
          // Hidden inside the opening; a metallic sheen varies around the lens.
          vis = smoothstep(openingRadius(aB), openingRadius(aB) + 0.1, aA);
          gain = 0.55 + 0.75 * pow(0.5 + 0.5 * sin(aB * N * 0.5 + uRot * 3.0 + aA * 0.9), 2.0);
        } else if (k == ${K_EDGE}) {
          vec2 v0 = bladeVertex(aA);
          vec2 v1 = bladeVertex(aA + 1.0);
          p = v0 + (v1 - v0) * aB;
          vis = 1.0 - smoothstep(BARREL - 0.1, BARREL + 0.05, length(p));
        } else {
          float a = aB + uTime * aC;
          p = vec2(cos(a), sin(a)) * aA;
        }
        vec4 mv = modelViewMatrix * vec4(p, 0.0, 1.0);
        gl_Position = projectionMatrix * mv;
        float twinkle = 0.75 + 0.25 * sin(uTime * 1.5 + aPhase);
        gl_PointSize = aSize * twinkle * uScale * (7.0 / -mv.z);
        vColor = aColor * gain;
        vec2 ndc = gl_Position.xy / gl_Position.w;
        vec2 px = vec2((ndc.x * 0.5 + 0.5) * uViewport.x, (0.5 - ndc.y * 0.5) * uViewport.y);
        vAlpha = uFade * (0.8 + 0.2 * twinkle) * vis * zoneMask(px);
      }
    `,
    fragmentShader: /* glsl */ `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        a = a * (0.35 + 0.65 * a) * vAlpha;
        if (a < 0.003) discard;
        gl_FragColor = vec4(vColor, a);
      }
    `,
  });

// Shared vertex shader for the flat quad: passes the local xy position.
const quadVertex = /* glsl */ `
  varying vec2 vPos;
  void main() {
    vPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

// Dark lens body behind everything: makes the lens read as a solid, dark
// object against the warm page, so its bright rings stand out. Output is
// premultiplied (dark colour, alpha = coverage).
const bodyMaterial = () =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: NormalBlending,
    uniforms: { uFade: { value: 1 } },
    vertexShader: quadVertex,
    fragmentShader: /* glsl */ `
      uniform float uFade;
      varying vec2 vPos;
      void main() {
        float r = length(vPos);
        float a = (1.0 - smoothstep(${(OUTER - 0.2).toFixed(2)}, ${(SCALE_RING + 0.5).toFixed(2)}, r)) * 0.82;
        a *= uFade;
        gl_FragColor = vec4(vec3(0.02, 0.018, 0.024) * a, a);
      }
    `,
  });

// Glass: warm light through the opening, thin-film coating reflections and a
// small highlight, all shifting slightly with the cursor (uLook).
const glassMaterial = () =>
  new ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
    uniforms: {
      uFade: { value: 1 },
      uTime: { value: 0 },
      uLook: { value: [0, 0] },
      uAperture: { value: APERTURE },
      uRot: { value: 0 },
      ...zoneUniforms(),
    },
    vertexShader: quadVertex,
    fragmentShader: /* glsl */ `
      ${zoneGlsl}
      ${apertureGlsl}
      uniform float uFade, uTime;
      uniform vec2 uLook;
      varying vec2 vPos;
      float arc(vec2 p, float radius, float width, float centre, float span) {
        float r = length(p);
        float a = atan(p.y, p.x);
        float da = abs(mod(a - centre + PI, TAU) - PI);
        return exp(-pow((r - radius) / width, 2.0)) * smoothstep(span, 0.0, da);
      }
      void main() {
        float r = length(vPos);
        float a = atan(vPos.y, vPos.x);
        float inside = 1.0 - smoothstep(-0.06, 0.06, r - openingRadius(a));
        // Light coming through the opening, brightest at the centre.
        float light = inside * (0.18 + 0.4 * exp(-r * r / (uAperture * uAperture * 0.5)));
        vec3 col = vec3(0.98, 0.72, 0.4) * light * (0.94 + 0.06 * sin(uTime * 0.8));
        // Coating reflections on the front element.
        vec2 q = vPos - uLook * 1.2;
        col += vec3(0.95, 0.6, 0.28) * arc(q, 3.1, 0.14, 2.35, 0.9) * 0.45;
        col += vec3(0.48, 0.64, 0.82) * arc(q, 2.2, 0.1, -0.8, 0.75) * 0.4;
        col += vec3(0.62, 0.5, 0.75) * arc(q, 3.6, 0.08, -0.4, 0.5) * 0.18;
        // Small specular highlight.
        vec2 h = vPos - vec2(-1.7, 1.9) - uLook * 1.6;
        col += vec3(1.0, 0.97, 0.9) * smoothstep(0.35, 0.0, length(h)) * 0.6;
        col *= uFade * zoneMask(vec2(gl_FragCoord.x, uViewport.y - gl_FragCoord.y));
        // The canvas is transparent (premultiplied): alpha must carry the
        // intensity, or the whole quad turns opaque over the page.
        float i = max(max(col.r, col.g), col.b);
        gl_FragColor = vec4(col / max(i, 1e-4), i);
      }
    `,
  });

export function createLens(canvas, { count = 12000 } = {}) {
  const renderer = new WebGLRenderer({ canvas, antialias: false, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));

  const scene = new Scene();
  const camera = new PerspectiveCamera(FOV, 1, 0.1, 100);
  const lens = new Group();
  lens.scale.setScalar(LENS_SCALE);
  scene.add(lens);

  const bodyQuad = new PlaneGeometry((SCALE_RING + 0.6) * 2, (SCALE_RING + 0.6) * 2);
  const bodyMat = bodyMaterial();
  const body = new Mesh(bodyQuad, bodyMat);
  body.position.z = -0.05;
  body.renderOrder = 0;
  lens.add(body);

  const geometry = buildParticles(count);
  const material = pointsMaterial();
  const points = new Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 1;
  lens.add(points);

  const quad = new PlaneGeometry(BARREL * 2.2, BARREL * 2.2);
  const glassMat = glassMaterial();
  const glass = new Mesh(quad, glassMat);
  glass.position.z = 0.05;
  glass.renderOrder = 2;
  lens.add(glass);

  let frame = 0;
  let running = false;
  let last = 0;
  let time = Math.random() * 100;
  let baseZ = CAMERA_Z;
  let frames = 0;
  const target = { scroll: 0, x: 0, y: 0 };
  const eased = { scroll: 0, x: 0, y: 0 };
  const zoneMats = [material, glassMat];
  let zone = null;
  let viewport = [1, 1];

  function applyZone() {
    const pr = renderer.getPixelRatio();
    for (const m of zoneMats) {
      m.uniforms.uViewport.value = viewport;
      if (zone) {
        m.uniforms.uZoneCenter.value = [(zone.x + zone.width / 2) * pr, (zone.y + zone.height / 2) * pr];
        m.uniforms.uZoneHalf.value = [(zone.width / 2) * pr, (zone.height / 2) * pr];
      }
      m.uniforms.uZoneDim.value = zone ? ZONE_DIM : 0;
    }
  }

  function apply() {
    const s = eased.scroll;
    // Stopping down and opening up; the blades turn as they move.
    const breathe = 0.3 * Math.sin(time * 0.35);
    const aperture = APERTURE + breathe + s * 2.5;
    const rot = 0.3 + (aperture - APERTURE) * 0.45;
    camera.position.set(0, 0, baseZ - s * (baseZ - 1.8));
    // A gentle tilt toward the cursor.
    lens.position.set(eased.x * 0.3, -eased.y * 0.3, 0);
    lens.rotation.set(eased.y * 0.14, eased.x * 0.14, 0);
    const fade = 1 - s * 0.85;
    for (const m of [material, glassMat]) {
      m.uniforms.uAperture.value = aperture;
      m.uniforms.uRot.value = rot;
      m.uniforms.uFade.value = fade;
      m.uniforms.uTime.value = time;
    }
    glassMat.uniforms.uLook.value = [eased.x, -eased.y];
    bodyMat.uniforms.uFade.value = fade;
  }

  function tick(now) {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    const k = 1 - Math.pow(0.001, dt); // frame-rate independent easing
    eased.scroll += (target.scroll - eased.scroll) * k;
    eased.x += (target.x - eased.x) * k * 0.5;
    eased.y += (target.y - eased.y) * k * 0.5;
    time += dt;
    apply();
    renderer.render(scene, camera);
    frames++;
    frame = requestAnimationFrame(tick);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    },
    stop() {
      running = false;
      cancelAnimationFrame(frame);
    },
    /** Draws one frame at the current targets (used while paused). */
    renderOnce() {
      Object.assign(eased, target);
      apply();
      renderer.render(scene, camera);
      frames++;
    },
    setScroll(p) {
      target.scroll = Math.min(1, Math.max(0, p));
    },
    /** Dims the lens inside this canvas-relative rectangle (CSS px). */
    setTextZone(rect) {
      zone = rect && rect.width > 0 && rect.height > 0 ? rect : null;
      applyZone();
    },
    setPointer(x, y) {
      target.x = x;
      target.y = y;
    },
    resize(width, height) {
      if (!width || !height) return;
      renderer.setSize(width, height, false);
      viewport = [width * renderer.getPixelRatio(), height * renderer.getPixelRatio()];
      applyZone();
      const aspect = width / height;
      camera.aspect = aspect;
      // Narrow screens: step back until the whole lens fits the width.
      const halfTan = Math.tan(((FOV / 2) * Math.PI) / 180);
      baseZ = Math.max(CAMERA_Z, (SCALE_RING * LENS_SCALE * 1.06) / (halfTan * aspect));
      // The centre sits behind the logo, which is higher on tall screens.
      const coreY = aspect < 1 ? CORE_Y - 0.08 : CORE_Y;
      camera.setViewOffset(width, height, 0, (0.5 - coreY) * height, width, height);
      camera.updateProjectionMatrix();
      // Keep particles the same on-screen size when the camera steps back.
      material.uniforms.uScale.value = (height / 800) * renderer.getPixelRatio() * 3.6 * Math.sqrt(baseZ / CAMERA_Z);
      if (!running) this.renderOnce();
    },
    get frames() {
      return frames;
    },
    dispose() {
      this.stop();
      geometry.dispose();
      material.dispose();
      quad.dispose();
      glassMat.dispose();
      bodyQuad.dispose();
      bodyMat.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
