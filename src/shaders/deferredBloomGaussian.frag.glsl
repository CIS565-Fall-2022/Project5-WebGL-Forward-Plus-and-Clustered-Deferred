#version 100
#extension GL_EXT_draw_buffers: enable

precision highp float;

uniform sampler2D u_brightBuffer;
uniform vec2 u_screenSize;
uniform float u_gaussianKernel[121];

varying vec2 v_uv;

void main() {
  vec3 blur_color = vec3(0, 0, 0);

  float width = u_screenSize.x;
  float height = u_screenSize.y;
  vec2 pixel_coord = v_uv * u_screenSize;

  for (int x_offset = -5; x_offset <= 5; x_offset++) {
    for (int y_offset = -5; y_offset <= 5; y_offset++) {
      float x_float = float(pixel_coord.x + float(x_offset));
      float y_float = float(pixel_coord.y + float(y_offset));

      float u = x_float / width;
      float v = y_float / height;

      float weight = u_gaussianKernel[(x_offset + 5) * 11 + (y_offset + 5)];

      blur_color += texture2D(u_brightBuffer, vec2(u, v)).rgb * weight;
    }
  }
  
  gl_FragData[0] = vec4(blur_color, 1.0);
}
