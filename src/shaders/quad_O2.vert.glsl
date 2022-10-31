#version 100
precision highp float;

uniform mat4 u_viewProjectionInv;
uniform vec3 u_camPos;

attribute vec3 a_position;

varying vec2 v_uv;
varying vec3 v_view_ray;

void main() {
    gl_Position = vec4(a_position, 1.0);
    v_uv = a_position.xy * 0.5 + 0.5;
    vec4 pos = u_viewProjectionInv * vec4(a_position, 1.0);
    v_view_ray = (pos.xyz / pos.w) - u_camPos;
}