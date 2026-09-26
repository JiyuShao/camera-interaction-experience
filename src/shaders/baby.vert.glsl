attribute vec3 aScatter;
attribute float aRandom;
attribute float aSize;
attribute float aKind;
attribute float aAngle;
attribute float aTone;

uniform float uTime;
uniform float uScatter;
uniform float uPixelRatio;

varying float vKind;
varying float vAngle;
varying float vTone;
varying float vRandom;

mat2 rotate2d(float angle) {
  float sine = sin(angle);
  float cosine = cos(angle);
  return mat2(cosine, -sine, sine, cosine);
}

void main() {
  float localScatter = smoothstep(aRandom * 0.16, 0.82 + aRandom * 0.16, uScatter);
  float transitionArc = sin(localScatter * 3.14159265);
  float breath = 1.0 + sin(uTime * 1.12 + aRandom * 0.9) * 0.005 * (1.0 - uScatter);
  vec3 baby = position * breath;
  vec3 transformed = mix(baby, aScatter, localScatter);

  float swirl = transitionArc * (0.18 + aRandom * 0.34);
  transformed.xy = rotate2d(swirl) * transformed.xy;
  transformed.x += sin(uTime * 0.31 + aRandom * 29.0) * 0.055 * localScatter;
  transformed.y += cos(uTime * 0.27 + aRandom * 23.0) * 0.045 * localScatter;
  transformed.z += sin(uTime * 0.22 + aRandom * 17.0) * 0.04 * localScatter;

  vec4 viewPosition = modelViewMatrix * vec4(transformed, 1.0);
  gl_Position = projectionMatrix * viewPosition;
  float gatheredSize = mix(0.68, 1.0, localScatter);
  gl_PointSize = aSize * gatheredSize * uPixelRatio * (3.35 / max(2.2, -viewPosition.z));

  vKind = aKind;
  vAngle = aAngle + localScatter * sin(uTime * (0.32 + aRandom * 0.3) + aRandom * 12.0) * 1.1;
  vTone = aTone;
  vRandom = aRandom;
}
