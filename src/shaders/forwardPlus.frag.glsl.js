const glsl = String.raw;

export default function(params) {
  return glsl`
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  // replace the string interpolation with a number for VScode glsl linting extension to work
  #define NUM_LIGHTS ${params.numLights}
  #define X_SLICES ${params.xSlices}.0
  #define Y_SLICES ${params.ySlices}.0
  #define Z_SLICES ${params.zSlices}.0
  #define FRUSTUM_NEAR_DEPTH ${params.frustumNearDepth}.0
  #define FRUSTUM_FAR_DEPTH ${params.frustumFarDepth}.0

  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  uniform vec2 u_screenSize;

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

  struct Light {
    vec3 position;
    float radius;
    vec3 color;
  };

  float ExtractFloat(sampler2D texture, int textureWidth, int textureHeight, int index, int component) {
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
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
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
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 fragColor = vec3(0.0);

    for (int i = 0; i < NUM_LIGHTS; ++i) {
      Light light = UnpackLight(i);
      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity);
    }

    // about gl_FragCoord: xy coordinates are literally array index if image is pixel array
    // Getting tile coordinate: get tile xy based on pixel position -> (0, screen_x or y) to (0, 15)
    // get z coordinate based on depth taking tile near/far clip distances into account -> (1, 1000) to (0, 15)
    int cluster_x = int(gl_FragCoord.x * X_SLICES / u_screenSize.x);
    int cluster_y = int(gl_FragCoord.y * Y_SLICES / u_screenSize.y);
    float depth = gl_FragCoord.z / gl_FragCoord.w; // positive depth away from camera
    int cluster_z = int(clamp((depth - FRUSTUM_NEAR_DEPTH) * Z_SLICES
      / (FRUSTUM_FAR_DEPTH - FRUSTUM_NEAR_DEPTH), 0.0, Z_SLICES - 1.0));

    // float numLights = texture2D(u_clusterbuffer, vec3(cluster_xy, cluster_z));

    // for (int i = 0; i < numLights; ++i) {
      
    // }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);

    float cluster_x_float = float(cluster_x);
    float cluster_y_float = float(cluster_y);
    float cluster_z_float = float(cluster_z);
    // gl_FragColor = vec4(0, 0, cluster_z_float / 15.0, 1.0);
  }
  `;
}
