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

void main() {
  vUv = uv;
  float k = 1.0 - uProgress;
  float h = uPlane.y;
  float w = uPlane.x;
  float span = min(w, h);
  float crease = 0.0;
  float tilt = 0.0;
  vec3 p = vec3(position.xy, 0.0);
  float yFold = 0.04 * h + sin(p.x / w * 6.2831853) * h * 0.04;
  float xFold = -0.02 * w + sin(p.y / h * 6.2831853) * w * 0.03;
  p = bendY(p, yFold, 0.78, h * 0.32, crease, tilt);
  p = bendX(p, xFold, -0.42, w * 0.36, crease, tilt);

  float e = 0.018;
  vec2 nuv = uv * vec2(2.15, 2.55) + vec2(1.6, 0.4);
  float n0 = noise(nuv);
  float gx = (noise(nuv + vec2(e, 0.0)) - noise(nuv - vec2(e, 0.0))) / (2.0 * e);
  float gy = (noise(nuv + vec2(0.0, e)) - noise(nuv - vec2(0.0, e))) / (2.0 * e);
  p.xy += vec2(-gx, -gy) * span * 0.05;
  p.z += (n0 - 0.5) * span * 0.2;

  vec3 pos = position + (p - position) * k;
  float shade = mix(1.0, 0.58, clamp(crease * 0.55, 0.0, 1.0));
  shade *= mix(0.8, 1.0, cos(clamp(tilt * 0.55, 0.0, 1.15)));
  shade *= mix(1.0, 0.76, smoothstep(0.15, 0.7, 0.62 - n0));
  vShade = mix(1.0, shade, k);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const fragmentShader = `
uniform sampler2D uMap;
uniform float uProgress;
varying vec2 vUv;
varying float vShade;

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
    texel.rgb *= vShade;
    texel.rgb *= 1.0 + (grain(gl_FragCoord.xy) - 0.5) * 0.035 * k;
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
