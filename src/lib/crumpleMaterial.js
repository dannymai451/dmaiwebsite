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

const shared = `
float broadFace(vec2 uv) {
  vec2 q = (uv - vec2(0.32, 0.80)) / vec2(0.26, 0.30);
  return 1.0 - smoothstep(0.72, 1.35, length(q));
}

float faceCore(vec2 uv) {
  vec2 q = (uv - vec2(0.32, 0.73)) / vec2(0.145, 0.100);
  return 1.0 - smoothstep(0.78, 1.02, length(q));
}

float foldDepth(vec2 uv) {
  return mix(1.0, 0.12, broadFace(uv));
}

void foldAt(int i, out float ang, out float off, out float amp) {
  ang = 0.18; off = 0.315; amp = -0.567;
  if (i == 1) { ang = 0.65; off = 0.225; amp = 0.758; }
  if (i == 2) { ang = 1.12; off = 0.039; amp = -0.730; }
  if (i == 3) { ang = 1.59; off = -0.209; amp = 0.502; }
  if (i == 4) { ang = 2.06; off = -0.162; amp = -0.639; }
  if (i == 5) { ang = 2.53; off = 0.078; amp = 0.773; }
  if (i == 6) { ang = 3.00; off = 0.249; amp = -0.679; }
  if (i == 7) { ang = 3.47; off = 0.319; amp = 0.450; }
  if (i == 8) { ang = 3.94; off = 0.277; amp = -0.699; }
  if (i == 9) { ang = 4.41; off = 0.130; amp = 0.770; }
  if (i == 10) { ang = 4.88; off = -0.096; amp = -0.614; }
  if (i == 11) { ang = 5.35; off = -0.278; amp = 0.532; }
}

void segAt(int i, out vec2 a, out vec2 b, out float amp) {
  a = vec2(0.028, 0.837); b = vec2(0.416, 0.982); amp = -0.664;
  if (i == 1) { a = vec2(0.011, 0.657); b = vec2(0.213, 0.826); amp = 0.608; }
  if (i == 2) { a = vec2(0.807, 0.330); b = vec2(0.871, 0.600); amp = -0.522; }
  if (i == 3) { a = vec2(0.899, 0.463); b = vec2(0.620, 0.738); amp = -0.761; }
  if (i == 4) { a = vec2(0.401, 0.048); b = vec2(0.505, 0.320); amp = 0.711; }
  if (i == 5) { a = vec2(0.602, 0.071); b = vec2(0.955, 0.156); amp = -0.721; }
  if (i == 6) { a = vec2(0.635, 0.599); b = vec2(0.444, 0.888); amp = 0.727; }
  if (i == 7) { a = vec2(0.695, 0.409); b = vec2(0.446, 0.605); amp = 0.638; }
  if (i == 8) { a = vec2(0.454, 0.814); b = vec2(0.847, 0.948); amp = 0.727; }
  if (i == 9) { a = vec2(0.216, 0.049); b = vec2(0.383, 0.215); amp = 0.710; }
  if (i == 10) { a = vec2(0.449, 0.437); b = vec2(0.418, 0.763); amp = -0.601; }
  if (i == 11) { a = vec2(0.925, 0.520); b = vec2(0.763, 0.867); amp = 0.636; }
  if (i == 12) { a = vec2(0.518, 0.029); b = vec2(0.639, 0.393); amp = 0.683; }
  if (i == 13) { a = vec2(0.927, 0.767); b = vec2(0.666, 0.890); amp = 0.660; }
  if (i == 14) { a = vec2(0.083, 0.354); b = vec2(0.109, 0.734); amp = -0.763; }
  if (i == 15) { a = vec2(0.016, 0.182); b = vec2(0.321, 0.425); amp = 0.523; }
  if (i == 16) { a = vec2(0.821, 0.044); b = vec2(0.986, 0.236); amp = 0.584; }
  if (i == 17) { a = vec2(0.539, 0.411); b = vec2(0.837, 0.425); amp = -0.734; }
  if (i == 18) { a = vec2(0.377, 0.433); b = vec2(0.109, 0.513); amp = -0.742; }
  if (i == 19) { a = vec2(0.235, 0.385); b = vec2(0.548, 0.493); amp = -0.685; }
}

vec2 planeOf(vec2 uv, vec2 plane) {
  return vec2((uv.x - 0.5) * plane.x, (uv.y - 0.5) * plane.y);
}

void hinge(vec2 p, vec2 n, float across, float amp, float depth, float k, float mask, inout vec3 disp) {
  float rot = step(0.0, across) * amp * depth * k * mask;
  disp.xy += n * across * (cos(rot) - 1.0) * 0.14;
  disp.z += across * sin(rot);
}

void creaseInk(float ad, float mask, inout float valley, inout float ridge) {
  float v = exp(-ad * 0.30) * mask;
  float s = exp(-ad * 0.11) * mask;
  valley += v;
  ridge += max(s - v, 0.0);
}
`

const vertexShader = `
uniform float uProgress;
uniform vec2 uPlane;
varying vec2 vUv;
varying vec3 vView;
varying vec2 vPlane;

${shared}

void main() {
  vUv = uv;
  float k = 1.0 - uProgress;
  float span = min(uPlane.x, uPlane.y);
  float depth = foldDepth(uv);
  float segDepth = depth * (1.0 - faceCore(uv));
  vec3 disp = vec3(0.0);
  for (int i = 0; i < 12; i++) {
    float ang;
    float off;
    float amp;
    foldAt(i, ang, off, amp);
    vec2 n = vec2(cos(ang), sin(ang));
    float across = dot(position.xy, n) - off * span;
    hinge(position.xy, n, across, amp, depth, k, 1.0, disp);
  }
  for (int i = 0; i < 20; i++) {
    vec2 a;
    vec2 b;
    float amp;
    segAt(i, a, b, amp);
    a = planeOf(a, uPlane);
    b = planeOf(b, uPlane);
    vec2 dir = b - a;
    float L = length(dir);
    dir /= max(L, 1.0e-4);
    vec2 n = vec2(-dir.y, dir.x);
    float along = dot(position.xy - a, dir);
    float across = dot(position.xy - a, n);
    float end = L * 0.08;
    float mask = smoothstep(0.0, end, along) * smoothstep(0.0, end, L - along);
    hinge(position.xy, n, across, amp, segDepth, k, mask, disp);
  }
  vec4 view = modelViewMatrix * vec4(position + disp, 1.0);
  vView = view.xyz;
  vPlane = position.xy;
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

${shared}

void main() {
  vec4 texel = texture2D(uMap, vUv);
  float k = 1.0 - uProgress;
  if (k != 0.0) {
    if (texel.a < 0.02) discard;
    vec3 nrm = cross(dFdx(vView), dFdy(vView));
    float nlen = length(nrm);
    nrm = nlen > 1.0e-5 ? nrm / nlen : vec3(0.0, 0.0, 1.0);
    if (nrm.z < 0.0) nrm = -nrm;
    vec3 L = normalize(vec3(-0.82, 0.42, 0.39));
    float ndl = dot(nrm, L);
    float facet = clamp(1.0 + (ndl - L.z) * 1.45, 0.70, 1.25);
    float face = broadFace(vUv);
    float core = faceCore(vUv);
    float shade = mix(1.0, facet, mix(0.35, 1.0, 1.0 - face));

    vec3 paper = texture2D(uPaper, vUv).rgb;
    float lum = dot(paper, vec3(0.2126, 0.7152, 0.0722));
    float gray = clamp((lum - 0.30) / 0.26, 0.0, 1.0);
    gray = gray * gray * (3.0 - 2.0 * gray);
    float wrinkle = mix(0.68, 1.24, gray);
    float slope = length(vec2(dFdx(lum), dFdy(lum)));
    wrinkle *= mix(1.0, 0.74, clamp(slope * 42.0, 0.0, 1.0));
    wrinkle = clamp(wrinkle, 0.65, 1.25);
    shade *= mix(1.0, wrinkle, mix(0.22, 1.0, 1.0 - face));

    float span = min(uPlane.x, uPlane.y);
    float valley = 0.0;
    float ridge = 0.0;
    for (int i = 0; i < 12; i++) {
      float ang;
      float off;
      float amp;
      foldAt(i, ang, off, amp);
      vec2 n = vec2(cos(ang), sin(ang));
      creaseInk(abs(dot(vPlane, n) - off * span), 1.0, valley, ridge);
    }
    for (int i = 0; i < 20; i++) {
      vec2 a;
      vec2 b;
      float amp;
      segAt(i, a, b, amp);
      a = planeOf(a, uPlane);
      b = planeOf(b, uPlane);
      vec2 dir = b - a;
      float L = length(dir);
      dir /= max(L, 1.0e-4);
      vec2 n = vec2(-dir.y, dir.x);
      float along = dot(vPlane - a, dir);
      float end = L * 0.08;
      float mask = smoothstep(0.0, end, along) * smoothstep(0.0, end, L - along);
      creaseInk(abs(dot(vPlane - a, n)), mask, valley, ridge);
    }
    float ink = 1.0 - core;
    shade *= mix(1.0, 0.60, clamp(valley, 0.0, 1.0) * ink);
    shade *= mix(1.0, 1.22, clamp(ridge, 0.0, 1.0) * ink);
    shade = clamp(shade, 0.65, 1.25);
    texel.rgb *= mix(1.0, shade, k);
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
