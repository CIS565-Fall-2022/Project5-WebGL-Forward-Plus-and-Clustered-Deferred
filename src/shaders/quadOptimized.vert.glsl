#version 100
precision highp float;

uniform mat4 u_invViewProjectionMatrix;
uniform vec3 u_camPos;

attribute vec3 a_position;

varying vec4 v_position;
varying vec3 v_viewDir;
varying vec2 v_uv;

void main() {
    gl_Position = vec4(a_position, 1.0);
    v_position = u_invViewProjectionMatrix * vec4(a_position, 1.0);
    v_position /= v_position.w;
    v_viewDir = v_position.xyz - u_camPos.xyz;
    v_uv = a_position.xy * 0.5 + 0.5;
}