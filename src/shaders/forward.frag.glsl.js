const glsl = String.raw;

export default function(params) {
  return glsl`
  #version 100
  // replace the string interpolation with a number for VScode glsl linting extension to work
  #define NUM_LIGHTS ${params.numLights}

  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  varying vec3 v_position;
  varying vec3 v_normal;
  varying vec2 v_uv;

  // TBN transformation of tangent space normal into world normal
  // uses arbitrary tangent (no tangent buffer)
  vec3 applyNormalMap(vec3 geomnor, vec3 normap) {
    normap = normap * 2.0 - 1.0;
    vec3 up = normalize(vec3(0.001, 1, 0.001));
    vec3 surftan = normalize(cross(geomnor, up));
    vec3 surfbinor = cross(geomnor, surftan);
    return normap.y * surftan + normap.x * surfbinor + normap.z * geomnor;
  }

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  // index = index of the light (eg. the 5th light -> index = 4)
  // component = which float you want to access (eg. the light's position's z coord -> component = 2)
  // assuming layout | pos.x pos.y pos.z radius | col.r col.g col.b |
  //                 pixel0                     pixel1
  //                 | pc 0  pc 1  pc 2  pc 3  | pc 0  pc 1   pc 2  |
  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
    // Get pixel x and y coords as fraction (aka normalized texture coords from 0 to 1)
    // + 1 to offset the 0-indexing
    float u = float(index + 1) / float(textureWidth + 1); 
    int pixel = component / 4;
    float v = float(pixel + 1) / float(textureHeight + 1);
    vec4 texel = texture2D(texture, vec2(u, v));
    int pixelComponent = component - pixel * 4;
    if (pixelComponent == 0) {
      return texel[0];
    } else if (pixelComponent == 1) {
      return texel[1];
    } else if (pixelComponent == 2) {
      return texel[2];
    } else if (pixelComponent == 3) {
      return texel[3];
    }
  }

  Light UnpackLight(int index) {
    Light light;
    float u = float(index + 1) / float(NUM_LIGHTS + 1);
     // this only works because we loaded texture of width=NUM_LIGHTS, height=2
     // would change if we add more light info
     // it's seriously the most disgusting code I've seen in a long time
     // how is it more jank than cuda, what's the point of using a 
     // higher level language if it can't at least make the code less jank
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.0));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.5));
    light.position = v1.xyz;

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    light.radius = ExtractFloat(u_lightbuffer, NUM_LIGHTS, 2, index, 3);

    light.color = v2.rgb;
    return light;
  }

  // Cubic approximation of gaussian curve so we falloff to exactly 0 at the light radius
  float cubicGaussian(float h) {
    if (h < 1.0) {
      return 0.25 * pow(2.0 - h, 3.0) - pow(1.0 - h, 3.0);
    } else if (h < 2.0) {
      return 0.25 * pow(2.0 - h, 3.0);
    } else {
      return 0.0;
    }
  }

  void main() {
    vec3 albedo = texture2D(u_colmap, v_uv).rgb;
    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap); // now it's a world normal

    vec3 fragColor = vec3(0.0);

    // very simple light calculations added together. Lambert with distance falloff
    // no occlusion considered, all lights just shine straight through the wall...
    for (int i = 0; i < NUM_LIGHTS; ++i) {
      Light light = UnpackLight(i);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}
