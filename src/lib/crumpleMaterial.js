// Fold adapted from Subframe Crease Reveal (MIT). Copyright (c) 2026 Subframe.

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
varying vec3 vPos;

vec3 foldedTarget(vec2 uv) {
  float u = uv.x;
  float v = uv.y;
  float a = (u - 0.5) * 6.5973445725;
  float b = (v - 0.5) * 2.7646015352;
  float r = 0.35
    + 0.054 * sin(u * 29.0 + v * 23.0)
    + 0.035 * cos(v * 41.0 - u * 17.0)
    + 0.045 * abs(sin(u * 12.566370614))
    + 0.035 * abs(sin(v * 18.849555922));
  vec3 wad = vec3(
    sin(a) * cos(b) * r,
    -sin(b) * r * 1.25,
    cos(a) * cos(b) * r + 0.07 * sin(u * 37.0 + v * 19.0)
  );
  return wad * (min(uPlane.x, uPlane.y) * 0.7);
}

void main() {
  vUv = uv;
  float k = 1.0 - uProgress;
  vec3 pos = position + (foldedTarget(uv) - position) * k;
  vPos = pos;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
}
`

const fragmentShader = `
uniform sampler2D uMap;
uniform float uProgress;
varying vec2 vUv;
varying vec3 vPos;

void main() {
  vec4 texel = texture2D(uMap, vUv);
  float k = 1.0 - uProgress;
  if (k != 0.0) {
    if (texel.a < 0.02) discard;
    vec3 axis = cross(dFdx(vPos), dFdy(vPos));
    float len2 = dot(axis, axis);
    float facing = len2 > 1e-8 ? clamp(abs(axis.z) * inversesqrt(len2), 0.0, 1.0) : 1.0;
    texel.rgb *= mix(1.0, 0.32 + 0.68 * facing, k);
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
