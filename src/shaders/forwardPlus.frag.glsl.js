export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;

  uniform mat4 u_viewMatrix;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  uniform vec2 u_canvasresolution;
  uniform vec3 u_clusterslices;

  const float PI = 3.14159;

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
    float u = float(index + 1) / float(${params.numLights + 1});
    vec4 v1 = texture2D(u_lightbuffer, vec2(u, 0.3));
    vec4 v2 = texture2D(u_lightbuffer, vec2(u, 0.6));
    light.position = v1.xyz;
    light.radius = v1.w;
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

    // getting cluster via the view space position like in base.js
    vec4 viewPos = u_viewMatrix * vec4(v_position, 1.0);
    float yFOVAngle = tan(75.0 * 0.5 * 3.14159 / 180.0);
    float xFOVAngle = yFOVAngle * u_canvasresolution.x / u_canvasresolution.y;
    float xSliceHalfWidth = xFOVAngle * viewPos.z;
    int this_cluster_x = int(viewPos.x + xSliceHalfWidth / (2.0 * xSliceHalfWidth / u_clusterslices.x));

    float ySliceHalfWidth = yFOVAngle * viewPos.z;
    int this_cluster_y = int(viewPos.y + ySliceHalfWidth / (2.0 * ySliceHalfWidth / u_clusterslices.y));

    int this_cluster_z = int(u_clusterslices.z * viewPos.z / (1000.0 - 0.1));

    int texture_width = int(u_clusterslices.x * u_clusterslices.y * u_clusterslices.z);
    int texture_height = int(ceil((float(${params.maxLightsPerCluster}) + 1.0) / 4.0));

    int idx = this_cluster_x + this_cluster_y * int(u_clusterslices.x) + this_cluster_z * int(u_clusterslices.x) * int(u_clusterslices.y);
    if (idx > texture_width) {
      gl_FragColor = vec4(vec3(1,0,0), 1.0);
      return;
    }
    int num_lights = int(ExtractFloat(u_clusterbuffer, texture_width, texture_height, idx, 0));
    if (idx > texture_width) {
      gl_FragColor = vec4(vec3(1,0,0), 1.0);
      return;
    }
    for (int light = 0; light < ${params.maxLightsPerCluster}; ++light) {
      if (light >= num_lights) {
        break;
      }
      else {
        int light_idx = int(ExtractFloat(u_clusterbuffer, texture_width, texture_height, idx, light + 1));
        Light this_light = UnpackLight(light_idx);


        float lightDistance = distance(this_light.position, v_position);
        vec3 L = (this_light.position - v_position) / lightDistance;

        float lightIntensity = cubicGaussian(2.0 * lightDistance / this_light.radius);
        float lambertTerm = max(dot(L, normal), 0.0);

        fragColor += albedo * lambertTerm * this_light.color * vec3(lightIntensity);
      }
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
    



  }
  `;
}
