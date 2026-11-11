import {
  ClampToEdgeWrapping,
  DoubleSide,
  NearestFilter,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
} from 'three'

const vertexShader = `
uniform float uProgress;
uniform vec2 uPlane;
varying vec2 vUv;
varying float vShade;
varying float vDepth;

float hash(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  float a = hash(i);
  float b = hash(i + vec2(1.0, 0.0));
  float c = hash(i + vec2(0.0, 1.0));
  float d = hash(i + vec2(1.0, 1.0));
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

vec3 bendY(vec3 p, float axis, float angle, float soft, inout float crease, inout float tilt) {
  float d = p.y - axis;
  float t = d / soft;
  float th = tanh(t);
  float ang = th * angle;
  crease += (1.0 - th * th) * abs(angle);
  tilt += abs(ang);
  return vec3(p.x, axis + d * cos(ang), p.z + d * sin(ang));
}

vec3 bendX(vec3 p, float axis, float angle, float soft, inout float crease, inout float tilt) {
  float d = p.x - axis;
  float th = tanh(d / soft);
  float ang = th * angle;
  crease += (1.0 - th * th) * abs(angle);
  tilt += abs(ang);
  return vec3(axis + d * cos(ang), p.y, p.z + d * sin(ang));
}

float foldDepth(vec2 uv) {
  vec2 q = (uv - vec2(0.32, 0.80)) / vec2(0.26, 0.30);
  float face = 1.0 - smoothstep(0.72, 1.35, length(q));
  return mix(1.0, 0.12, face);
}

void main() {
  vUv = uv;
  float k = 1.0 - uProgress;
  float h = uPlane.y;
  float w = uPlane.x;
  float span = min(w, h);
  float depth = foldDepth(uv);
  vDepth = depth;
  float crease = 0.0;
  float tilt = 0.0;
  vec3 p = vec3(position.xy, 0.0);
  float chest = (0.42 - 0.5) * h + sin(p.x / w * 8.5) * h * 0.022;
  float hands = (0.24 - 0.5) * h + sin(p.x / w * 6.4 + 1.1) * h * 0.018;
  float hem = (0.10 - 0.5) * h + sin(p.x / w * 11.0) * h * 0.012;
  p = bendY(p, chest, 0.95 * depth, h * 0.065, crease, tilt);
  p = bendY(p, hands, -0.85 * depth, h * 0.05, crease, tilt);
  p = bendY(p, hem, 0.6 * depth, h * 0.042, crease, tilt);
  float gate = 1.0 - smoothstep(0.52, 0.62, uv.y);
  p = bendX(p, (0.14 - 0.5) * w, 0.7 * depth * gate, w * 0.07, crease, tilt);
  p = bendX(p, (0.84 - 0.5) * w, -0.6 * depth * gate, w * 0.08, crease, tilt);

  float e = 0.016;
  vec2 nuv = uv * vec2(3.4, 4.2) + vec2(1.7, 0.4);
  float n0 = noise(nuv);
  float gx = (noise(nuv + vec2(e, 0.0)) - noise(nuv - vec2(e, 0.0))) / (2.0 * e);
  float gy = (noise(nuv + vec2(0.0, e)) - noise(nuv - vec2(0.0, e))) / (2.0 * e);
  vec2 nuv2 = uv * vec2(6.8, 7.4) + vec2(5.0, 1.2);
  float hx = (noise(nuv2 + vec2(e, 0.0)) - noise(nuv2 - vec2(e, 0.0))) / (2.0 * e);
  float hy = (noise(nuv2 + vec2(0.0, e)) - noise(nuv2 - vec2(0.0, e))) / (2.0 * e);
  p.xy += (vec2(-gx, -gy) * 0.05 + vec2(-hx, -hy) * 0.018) * span * depth;
  p.z += ((n0 - 0.5) * 0.22 + (noise(nuv2) - 0.5) * 0.08) * span * depth;

  vec3 pos = position + (p - position) * k;
  float shade = mix(1.0, 0.5, clamp(crease * 0.42, 0.0, 1.0));
  shade *= mix(0.78, 1.0, cos(clamp(tilt * 0.4, 0.0, 1.15)));
  vShade = mix(1.0, shade, k);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const fragmentShader = `
uniform sampler2D uMap;
uniform float uProgress;
varying vec2 vUv;
varying float vShade;
varying float vDepth;

float grain(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

void main() {
  vec4 texel = texture2D(uMap, vUv);
  float k = 1.0 - uProgress;
  if (k != 0.0) {
    if (texel.a < 0.02) discard;
    float y1 = 0.42 + 0.022 * sin(vUv.x * 8.5);
    float y2 = 0.24 + 0.018 * sin(vUv.x * 6.4 + 1.1);
    float y3 = 0.10 + 0.012 * sin(vUv.x * 11.0);
    float lines = exp(-abs(vUv.y - y1) * 95.0);
    lines += exp(-abs(vUv.y - y2) * 115.0);
    lines += exp(-abs(vUv.y - y3) * 130.0);
    float side = 1.0 - smoothstep(0.52, 0.62, vUv.y);
    float x1 = 0.14 + 0.012 * sin(vUv.y * 8.0);
    float x2 = 0.84 + 0.014 * sin(vUv.y * 8.0 + 1.7);
    lines += (exp(-abs(vUv.x - x1) * 75.0) + exp(-abs(vUv.x - x2) * 75.0)) * side;
    float ink = clamp(lines, 0.0, 1.0) * vDepth;
    texel.rgb *= mix(1.0, mix(1.0, 0.46, ink), k);
    texel.rgb *= vShade;
    texel.rgb *= 1.0 + (grain(gl_FragCoord.xy) - 0.5) * 0.04 * k;
  }
  gl_FragColor = texel;
  #include <colorspace_fragment>
}
`

export function createCrumpleMaterial(texture) {
  texture.colorSpace = SRGBColorSpace
  texture.minFilter = NearestFilter
  texture.magFilter = NearestFilter
  texture.generateMipmaps = false
  texture.wrapS = ClampToEdgeWrapping
  texture.wrapT = ClampToEdgeWrapping
  texture.anisotropy = 1
  texture.needsUpdate = true

  return new ShaderMaterial({
    uniforms: {
      uMap: { value: texture },
      uProgress: { value: 0 },
      uPlane: { value: new Vector2(1, 1) },
    },
    vertexShader,
    fragmentShader,
    transparent: true,
    depthTest: true,
    depthWrite: true,
    toneMapped: false,
    side: DoubleSide,
  })
}
