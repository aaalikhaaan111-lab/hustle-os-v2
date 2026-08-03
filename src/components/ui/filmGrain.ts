// The landing page's one and only grain.
//
// It runs as a full-viewport WebGL pass in GrainField, mounted once behind
// the whole landing. It used to be a post-processing pass inside WaveField,
// which is why it stopped at the hero's edge; the shader body below is that
// same pass, unchanged.

/** The noise body, injected into GrainField's fragment shader. Reads the
 *  `time` uniform declared by that shader. */
export const SPARKLE_NOISE_GLSL = `
  float sparkleNoise(vec2 p) {
    vec2 jPos = p + vec2(37.0, 17.0) * fract(time * 0.07);
    vec3 p3 = fract(vec3(jPos.xyx) * vec3(.1031, .1030, .0973) + time * 0.1);
    p3 += dot(p3, p3.yxz + 19.19);
    return fract((p3.x + p3.y) * p3.z);
  }
`;

/** The values WaveField's grain pass was created with. */
export const GRAIN_INTENSITY = 0.9;
export const GRAIN_SCALE = 0.3;
