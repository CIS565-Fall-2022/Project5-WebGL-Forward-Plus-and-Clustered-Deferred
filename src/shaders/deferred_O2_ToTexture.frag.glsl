#version 100
#extension GL_EXT_draw_buffers: enable
precision highp float;

uniform sampler2D u_colmap;
uniform sampler2D u_normap;

uniform mat4 u_viewMatrix;

varying vec3 v_position;
varying vec3 v_view_position;
varying vec3 v_normal;
varying vec2 v_uv;

vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
}

// from https://jcgt.org/published/0003/02/01/paper.pdf
vec2 encode_normal(vec3 normal) {

    vec2 encoded_normal = normal.xy * (1.0 / (abs(normal.x) + abs(normal.y) + abs(normal.z)));

    vec2 sign_bit;
    if (encoded_normal.x >= 0.0) {
        sign_bit.x = 1.0;
    }
    else {
        sign_bit.x = -1.0;
    }
    if (encoded_normal.y >= 0.0) {
        sign_bit.y = 1.0;
    }
    else {
        sign_bit.y = -1.0;
    }

    if (normal.z <= 0.0) {
        return ((1.0 - abs(encoded_normal.yx)) * sign_bit);
    }
    else {
        return encoded_normal;
    }
}


void main() {
    vec3 norm = applyNormalMap(v_normal, vec3(texture2D(u_normap, v_uv)));
    vec3 col = vec3(texture2D(u_colmap, v_uv));

    
    vec2 norm_compressed = encode_normal(norm);

    // TODO: populate your g buffer
    
    gl_FragData[0] = vec4(length(v_view_position), 0, 0, norm_compressed.x);
    gl_FragData[1] = vec4(norm_compressed.y, col.x, col.y, col.z);
}