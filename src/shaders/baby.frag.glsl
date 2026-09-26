uniform sampler2D uLeafMap;
uniform float uOpacity;

varying float vKind;
varying float vAngle;
varying float vTone;
varying float vRandom;

mat2 rotate2d(float angle) {
  float sine = sin(angle);
  float cosine = cos(angle);
  return mat2(cosine, -sine, sine, cosine);
}

vec3 palette(float tone, float kind) {
  vec3 warmWhite = vec3(1.0, 0.955, 0.82);
  vec3 champagne = vec3(1.0, 0.69, 0.27);
  vec3 color = mix(warmWhite, champagne, smoothstep(0.2, 0.88, tone));
  if (kind > 1.5) color = mix(warmWhite, vec3(1.0, 0.84, 0.48), tone);
  return color;
}

void main() {
  vec2 centered = gl_PointCoord - 0.5;
  vec2 rotatedUv = rotate2d(vAngle) * centered + 0.5;
  vec3 color = palette(vTone, vKind);
  float alpha = 0.0;
  float glow = 1.0;

  if (vKind < 0.5) {
    vec4 leaf = texture2D(uLeafMap, rotatedUv);
    alpha = leaf.a * 0.08;
    float vein = smoothstep(0.68, 0.98, leaf.r);
    glow = mix(0.86, 1.3, vein);
  } else if (vKind < 1.5) {
    float radius = length(centered);
    alpha = 1.0 - smoothstep(0.12, 0.5, radius);
    glow = 1.0 + (1.0 - smoothstep(0.0, 0.18, radius)) * 1.2;
  } else {
    vec2 starPoint = abs(rotate2d(vAngle * 0.35) * centered);
    float horizontal = max(starPoint.x * 4.6, starPoint.y * 0.92);
    float vertical = max(starPoint.y * 4.6, starPoint.x * 0.92);
    float shape = min(horizontal, vertical);
    alpha = 1.0 - smoothstep(0.72, 1.02, shape);
    glow = 1.55;
  }

  if (alpha < 0.015) discard;
  float twinkle = 0.93 + 0.07 * sin(vRandom * 37.0);
  gl_FragColor = vec4(color * glow * twinkle, alpha * uOpacity);
}
