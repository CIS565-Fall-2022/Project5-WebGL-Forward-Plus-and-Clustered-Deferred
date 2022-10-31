export default function(params) {
  return `
  // TODO: This is pretty much just a clone of forward.frag.glsl.js

  #version 100
  precision highp float;

  uniform sampler2D u_colmap;
  uniform sampler2D u_normap;
  uniform sampler2D u_lightbuffer;


  uniform vec3 u_camPos;

  // TODO: Read this buffer to determine the lights influencing a cluster
  uniform sampler2D u_clusterbuffer;

  uniform vec2 u_frustumDims;

  uniform vec4 u_matProperties;

  const float PI = 3.14159;

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

// based on Adam Mally's CIS 561 Real-Time Microfacet Slides
vec3 schlickApproximation(float cosViewingAngle, vec3 R) {
    return R + ((1.0 - R) * pow(1.0 - cosViewingAngle, 5.0));
}

float microfacetGTerm(float roughness, vec3 wo, vec3 wi, vec3 n) {
    float k = ((roughness + 1.0) * (roughness + 1.0)) / 8.0;
    float schlickWo = dot(n, wo) / ((dot(n, wo) * (1.0 - k)) + k);
    float schlickWi = dot(n, wi) / ((dot(n, wi) * (1.0 - k)) + k);
    return schlickWo * schlickWi;
}

float microfacetDTerm(float roughness, vec3 n, vec3 wh) {
    float roughnessFr = roughness * roughness * roughness * roughness;
    float innerDenom = (dot(n, wh) * dot(n, wh) * (roughnessFr - 1.0)) + 1.0;
    float denom = PI * innerDenom * innerDenom;
    return roughnessFr / denom;
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

    vec3 f_lambert = albedo * 0.31831015504887652430775499030746;

    vec3 normap = texture2D(u_normap, v_uv).xyz;
    vec3 normal = applyNormalMap(v_normal, normap);

    vec3 wo = normalize(u_camPos - v_position);
    float wo_dot_normal = dot(wo, normal);

    vec3 fragColor = vec3(0.0);

    // getting cluster via the view space position like in base.js
    float xSliceHalfWidth = u_frustumDims.x * v_view_position.z;
    int this_cluster_x = int(v_view_position.x + float(${params.numXSlices}) * xSliceHalfWidth / (2.0 * xSliceHalfWidth));

    float ySliceHalfWidth = u_frustumDims.y * v_view_position.z;
    int this_cluster_y = int(v_view_position.y + float(${params.numYSlices}) * ySliceHalfWidth / (2.0 * ySliceHalfWidth));

    int this_cluster_z = int(float(${params.numZSlices}) * v_view_position.z / (1000.0 - 0.1));

    int idx = this_cluster_x + this_cluster_y * ${params.numXSlices} + this_cluster_z * ${params.numXSlices} * ${params.numYSlices};

    int num_lights = int(ExtractFloat(u_clusterbuffer, ${params.numClusters}, ${params.pixelsPerCluster}, idx, 0));

    for (int light = 0; light < ${params.maxLightsPerCluster}; ++light) {
      if (light >= num_lights) {
        break;
      }
      else {
        int light_idx = int(ExtractFloat(u_clusterbuffer, ${params.numClusters}, ${params.pixelsPerCluster}, idx, light + 1));
        
        Light this_light = UnpackLight(light_idx);

        vec3 fragToLightPos = this_light.position - v_position;

        vec3 wi = normalize(fragToLightPos);
        float wi_dot_normal = dot(wi, normal);
        if (wi_dot_normal < 0.0) {
          continue;
        }
        vec3 wh = normalize(wo + wi);

        // use cubic gaussian based on light radius as falloff (not inverse square)
        vec3 ithLightIrradiance = this_light.color * cubicGaussian(2.0 * sqrt(dot(fragToLightPos, fragToLightPos)) / this_light.radius);
        
        // R term
        vec3 R = mix(vec3(0.04), albedo, u_matProperties.y);

        // fresnel using schlicks approximation
        vec3 F = schlickApproximation(max(dot(wh, wo), 0.0), R);

        // geometry term of microfacet (self shadowing)
        float G = microfacetGTerm(u_matProperties.x, wo, wi, normal);

        // D term
        float D = microfacetDTerm(u_matProperties.x, normal, wh);

        // compute cook-torrance
        vec3 f_cook_torrance = (D*G*F) / (4.0 * wo_dot_normal * wi_dot_normal);

        // compute lambert weighting
        vec3 kd = vec3(1.0) - F;

        kd *= (1.0 - u_matProperties.y);
        
        vec3 f = kd * f_lambert + f_cook_torrance;

        // accumulate total lighting on fragment
        fragColor += f * ithLightIrradiance * wi_dot_normal;
      }
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
    
  }
  `;
}
