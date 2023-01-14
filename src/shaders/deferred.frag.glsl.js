const glsl = String.raw;

export default function(params) {
  return glsl`
  #version 100
  // replace the string interpolation with a number for VScode glsl linting extension to work
  #define NUM_G_BUFFERS ${params.numGBuffers}

  precision highp float;
  
  uniform sampler2D u_gbuffers[NUM_G_BUFFERS];
  
  varying vec2 v_uv;
  
  void main() {
    // TODO: extract data from g buffers and do lighting
    // vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    // vec4 gb1 = texture2D(u_gbuffers[1], v_uv);
    // vec4 gb2 = texture2D(u_gbuffers[2], v_uv);
    // vec4 gb3 = texture2D(u_gbuffers[3], v_uv);

    gl_FragColor = vec4(v_uv, 0.0, 1.0);
  }
  `;
}