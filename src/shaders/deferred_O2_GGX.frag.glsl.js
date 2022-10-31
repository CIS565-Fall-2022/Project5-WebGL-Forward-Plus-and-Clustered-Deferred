export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];

  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;

  uniform vec3 u_camPos;

  uniform mat4 u_viewMatrix;
  uniform vec2 u_canvasresolution;
  uniform vec3 u_clusterslices;

  
  uniform vec4 u_matProperties;

  const float PI = 3.14159;
  
  varying vec2 v_uv;
  varying vec3 v_view_ray;

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

  // from https://jcgt.org/published/0003/02/01/paper.pdf
  vec3 decode_normal(vec2 encoded_normal) {
    vec3 decoded_normal = vec3(encoded_normal.xy, 1.0 - (abs(encoded_normal.x) + abs(encoded_normal.y)));

    if (decoded_normal.z < 0.0) {
      vec2 sign_bit;
      if (decoded_normal.x >= 0.0) {
        sign_bit.x = 1.0;
      }
      else {
        sign_bit.x = -1.0;
      }
      if (decoded_normal.y >= 0.0) {
        sign_bit.y = 1.0;
      }
      else {
        sign_bit.y = -1.0;
      }
      decoded_normal.xy = (1.0 - abs(decoded_normal.yx)) * sign_bit;
    }

    return normalize(decoded_normal);
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
  
  void main() {
    // TODO: extract data from g buffers and do lighting
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv);
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv);

    vec3 view_ray = normalize(v_view_ray);
    float depth = gb0.x;
    vec3 world_space_position = u_camPos + view_ray * depth;

    vec3 normal = decode_normal(vec2(gb0.w, gb1.x));

    vec3 wo = normalize(u_camPos - world_space_position);
    float wo_dot_normal = dot(wo, normal);
    
    vec3 albedo = vec3(gb1.yzw);

    vec3 f_lambert = albedo * 0.31831015504887652430775499030746;

    vec3 fragColor = vec3(0.0);

    vec4 viewPos = u_viewMatrix * vec4(world_space_position, 1.0);
    float yFOVAngle = tan(75.0 * 0.5 * 3.14159 / 180.0);
    float xFOVAngle = yFOVAngle * u_canvasresolution.x / u_canvasresolution.y;
    float xSliceHalfWidth = xFOVAngle * viewPos.z;
    int this_cluster_x = int(viewPos.x + xSliceHalfWidth / (2.0 * xSliceHalfWidth / u_clusterslices.x));

    float ySliceHalfWidth = yFOVAngle * viewPos.z;
    int this_cluster_y = int(viewPos.y + ySliceHalfWidth / (2.0 * ySliceHalfWidth / u_clusterslices.y));

    int this_cluster_z = int(u_clusterslices.z * viewPos.z / (1000.0 - 0.1));


    //int this_cluster_x = int((gl_FragCoord.x / u_canvasresolution.x) * u_clusterslices.x);
    //int this_cluster_y = int((gl_FragCoord.y / u_canvasresolution.y) * u_clusterslices.y);
    //int this_cluster_z = int(((gl_FragCoord.z * gl_FragCoord.w) / (1000.0 - 0.1)) * u_clusterslices.z);
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


        // attenuate intensity inverse square law
        vec3 fragToLightPos = this_light.position - world_space_position;

        vec3 wi = normalize(fragToLightPos);
        float wi_dot_normal = dot(wi, normal);
        if (wi_dot_normal < 0.0) {
          continue;
        }
        vec3 wh = normalize(wo + wi);


        vec3 ithLightIrradiance = this_light.color * cubicGaussian(2.0 * sqrt(dot(fragToLightPos, fragToLightPos)) / this_light.radius);
        
        // R term
        vec3 R = mix(vec3(0.04), albedo, u_matProperties.y);

        // F term
        vec3 F = schlickApproximation(max(dot(wh, wo), 0.0), R);

        // G term
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