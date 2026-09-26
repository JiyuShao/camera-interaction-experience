uniform sampler2D uLeafMap;
uniform float uOpacity;

varying vec2 vUv;
varying float vTone;
varying float vFade;

void main() {
  vec4 leaf = texture2D(uLeafMap, vUv);
  float mask = max(leaf.a, max(leaf.r, max(leaf.g, leaf.b)));
  if (mask < 0.02) discard;

  vec3 moonIvory = vec3(1.0, 0.94, 0.78);
  vec3 warmGold = vec3(1.0, 0.68, 0.28);
  vec3 color = mix(moonIvory, warmGold, smoothstep(0.16, 0.9, vTone));
  float vein = smoothstep(0.7, 0.98, leaf.r);
  color *= mix(0.74, 1.42, vein);

  float edgeSoftness = smoothstep(0.02, 0.18, mask);
  gl_FragColor = vec4(color, mask * edgeSoftness * uOpacity * vFade);
}
