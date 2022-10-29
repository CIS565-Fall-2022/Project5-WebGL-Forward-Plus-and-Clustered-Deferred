#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;

varying vec3 v_position;
varying vec3 v_normal;
varying vec2 v_uv;

vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
}

// Based on the paper "A Survey of Efficient Representations for Independent Unit Vectors" (Cigolle et al. 2014)
vec2 signNotZero(vec2 nor) {
    return vec2((nor.x >= 0.0) ? 1.0 : -1.0, (nor.y >= 0.0) ? 1.0 : -1.0);
}

vec3 encodeNormalBasic(vec3 nor) {
    return nor * 0.5 + 0.5;
}

vec2 encodeNormalOct(vec3 nor) {
    vec2 n = nor.xy * (1.0 / (abs(nor.x) + abs(nor.y) + abs(nor.z)));
    return (nor.z <= 0.0) ? ((1.0 - abs(n.yx)) * signNotZero(n)) : n;
}

void main() {
    vec3 norm = applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv)));
    norm.xy = encodeNormalOct(norm);
    vec3 col = vec3(texture2D(u_colmap, v_uv));

    // Populate g-buffer
    gl_FragData[0] = vec4(v_position, norm.x);
    gl_FragData[1] = vec4(col, norm.y);
    gl_FragData[2] = vec4(16.0, 0.0, 0.0, 0.0); // unused (TODO: disable)
    gl_FragData[3] = vec4(0.0); // unused (TODO: disable)
}