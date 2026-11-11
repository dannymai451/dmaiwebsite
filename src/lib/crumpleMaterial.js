import {
  ClampToEdgeWrapping,
  DoubleSide,
  LinearFilter,
  LinearSRGBColorSpace,
  NearestFilter,
  ShaderMaterial,
  SRGBColorSpace,
  Vector2,
} from 'three'

const foldParams = `
void foldAt(int i, out float ang, out float off, out float amp) {
  ang = 0.18; off = 0.315; amp = -0.366;
  if (i == 1) { ang = 0.65; off = 0.225; amp = 0.489; }
  if (i == 2) { ang = 1.12; off = 0.039; amp = -0.471; }
  if (i == 3) { ang = 1.59; off = -0.209; amp = 0.324; }
  if (i == 4) { ang = 2.06; off = -0.162; amp = -0.412; }
  if (i == 5) { ang = 2.53; off = 0.078; amp = 0.499; }
  if (i == 6) { ang = 3.00; off = 0.249; amp = -0.438; }
  if (i == 7) { ang = 3.47; off = 0.319; amp = 0.290; }
  if (i == 8) { ang = 3.94; off = 0.277; amp = -0.451; }
  if (i == 9) { ang = 4.41; off = 0.130; amp = 0.497; }
  if (i == 10) { ang = 4.88; off = -0.096; amp = -0.396; }
  if (i == 11) { ang = 5.35; off = -0.278; amp = 0.343; }
}
`

const vertexShader = `
uniform float uProgress;
uniform vec2 uPlane;
varying vec2 vUv;
varying vec3 vView;
varying vec2 vPlane;
varying float vDepth;

float foldDepth(vec2 uv) {
  vec2 q = (uv - vec2(0.32, 0.80)) / vec2(0.26, 0.30);
  float face = 1.0 - smoothstep(0.72, 1.35, length(q));
  return mix(1.0, 0.12, face);
}

${foldParams}

void main() {
  vUv = uv;
  float k = 1.0 - uProgress;
  float span = min(uPlane.x, uPlane.y);
  float depth = foldDepth(uv);
  vDepth = depth;
  vec3 disp = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float ang;
    float off;
    float amp;
    foldAt(i, ang, off, amp);
    vec2 n = vec2(cos(ang), sin(ang));
    float d = dot(position.xy, n) - off * span;
    float rot = step(0.0, d) * amp * depth * k;
    disp.xy += n * d * (cos(rot) - 1.0) * 0.22;
    disp.z += d * sin(rot);
  }
  vec3 pos = position + disp;
  vPlane = position.xy;
  vec4 view = modelViewMatrix * vec4(pos, 1.0);
  vView = view.xyz;
  gl_Position = projectionMatrix * view;
}
`

const fragmentShader = `
uniform sampler2D uMap;
uniform sampler2D uPaper;
uniform float uProgress;
uniform vec2 uPlane;
varying vec2 vUv;
varying vec3 vView;
varying vec2 vPlane;
varying float vDepth;

${foldParams}

void main() {
  vec4 texel = texture2D(uMap, vUv);
  float k = 1.0 - uProgress;
  if (k != 0.0) {
    if (texel.a < 0.02) discard;
    vec3 paper = texture2D(uPaper, vUv).rgb;
    float lum = dot(paper, vec3(0.2126, 0.7152, 0.0722));
    float gray = clamp((lum - 0.30) / 0.26, 0.0, 1.0);
    gray = gray * gray * (3.0 - 2.0 * gray);
    float wrinkle = mix(0.80, 1.06, gray);
    float slope = length(vec2(dFdx(lum), dFdy(lum)));
    wrinkle *= mix(1.0, 0.72, clamp(slope * 32.0, 0.0, 1.0));
    float amount = mix(0.3, 1.0, vDepth);
    texel.rgb *= mix(1.0, wrinkle, k * amount);

    vec3 nrm = cross(dFdx(vView), dFdy(vView));
    float nlen = length(nrm);
    nrm = nlen > 1e-5 ? nrm / nlen : vec3(0.0, 0.0, 1.0);
    if (nrm.z < 0.0) nrm = -nrm;
    float ndl = dot(nrm, normalize(vec3(-0.28, 0.42, 0.86)));
    float facet = mix(0.58, 1.16, clamp(ndl * 0.5 + 0.5, 0.0, 1.0));
    texel.rgb *= mix(1.0, facet, k * mix(0.2, 1.0, vDepth));

    float span = min(uPlane.x, uPlane.y);
    float valley = 0.0;
    float ridge = 0.0;
    for (int i = 0; i < 12; i++) {
      float ang;
      float off;
      float amp;
      foldAt(i, ang, off, amp);
      vec2 n = vec2(cos(ang), sin(ang));
      float ad = abs(dot(vPlane, n) - off * span);
      float v = exp(-ad * 0.16);
      float s = exp(-ad * 0.055);
      valley += v;
      ridge += max(s - v, 0.0);
    }
    float weight = k * mix(0.18, 1.0, vDepth);
    texel.rgb *= mix(1.0, 0.32, clamp(valley, 0.0, 1.0) * weight);
    texel.rgb += clamp(ridge, 0.0, 1.0) * 0.26 * weight;
  }
  gl_FragColor = texel;
  #include <colorspace_fragment>
}
`

export function createCrumpleMaterial(photo, paper) {
  photo.colorSpace = SRGBColorSpace
  photo.minFilter = NearestFilter
  photo.magFilter = NearestFilter
  photo.generateMipmaps = false
  photo.wrapS = ClampToEdgeWrapping
  photo.wrapT = ClampToEdgeWrapping
  photo.anisotropy = 1
  photo.needsUpdate = true

  // Public-domain photo, Photos Public Domain, 2012.
  // https://commons.wikimedia.org/wiki/File:Crumpled_olive_green_paper.jpg
  paper.colorSpace = LinearSRGBColorSpace
  paper.minFilter = LinearFilter
  paper.magFilter = LinearFilter
  paper.generateMipmaps = false
  paper.wrapS = ClampToEdgeWrapping
  paper.wrapT = ClampToEdgeWrapping
  paper.needsUpdate = true

  return new ShaderMaterial({
    uniforms: {
      uMap: { value: photo },
      uPaper: { value: paper },
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
