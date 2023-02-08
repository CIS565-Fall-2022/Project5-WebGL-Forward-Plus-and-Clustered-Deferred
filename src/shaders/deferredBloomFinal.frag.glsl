#version 100

precision highp float;

uniform sampler2D u_blurBuffer;
uniform sampler2D u_renderBuffer;

varying vec2 v_uv;

void main() {
  vec3 color = texture2D(u_blurBuffer, v_uv).rgb + texture2D(u_renderBuffer, v_uv).rgb;

  gl_FragColor = vec4(color, 1.0);
}

