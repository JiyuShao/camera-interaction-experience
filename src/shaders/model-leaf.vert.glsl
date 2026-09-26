attribute vec3 aBabyPosition;
attribute vec3 aScatterPosition;
attribute float aRandom;
attribute float aSize;
attribute float aAngle;
attribute float aTone;

uniform float uTime;
uniform float uScatter;
uniform float uLeafFlutterStrength;

varying vec2 vUv;
varying float vTone;
varying float vFade;

mat2 rotate2d(float angle) {
  float sine = sin(angle);
  float cosine = cos(angle);
  return mat2(cosine, -sine, sine, cosine);
}

void main() {
  float localScatter = smoothstep(aRandom * 0.2, 0.78 + aRandom * 0.18, uScatter);
  float transitionArc = sin(localScatter * 3.14159265);
  float breath = 1.0 + sin(uTime * 1.08 + aRandom * 3.0) * 0.006 * (1.0 - localScatter);
  vec3 center = mix(aBabyPosition * breath, aScatterPosition, localScatter);

  float windAngle = transitionArc * (0.52 + aRandom * 0.9);
  center.xy = rotate2d(windAngle) * center.xy;

  float flutter = uLeafFlutterStrength * mix(0.08, 1.0, localScatter);
  center.x += sin(uTime * (0.48 + aRandom * 0.28) + aRandom * 31.0) * flutter;
  center.y += cos(uTime * (0.41 + aRandom * 0.22) + aRandom * 27.0) * flutter * 0.7;
  center.z += sin(uTime * (0.36 + aRandom * 0.18) + aRandom * 19.0) * flutter * 0.52;

  vec4 viewPosition = modelViewMatrix * vec4(center, 1.0);
  float modelScale = length(vec3(modelViewMatrix[0].xyz));
  float flip = 0.58 + 0.42 * abs(sin(uTime * (0.62 + aRandom * 0.4) + aRandom * 18.0));
  float angle = aAngle
    + uTime * (0.09 + aRandom * 0.16)
    + localScatter * sin(uTime * 0.44 + aRandom * 14.0) * 0.82;
  vec2 quad = rotate2d(angle) * vec2(position.x * flip, position.y);
  viewPosition.xy += quad * aSize * modelScale * mix(0.84, 1.0, localScatter);

  gl_Position = projectionMatrix * viewPosition;
  vUv = uv;
  vTone = aTone;
  vFade = mix(0.86, 1.0, localScatter);
}
