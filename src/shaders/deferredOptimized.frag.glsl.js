export default function(params) {
  return `
  #version 100
  precision highp float;

  #define LAMBERTIAN
  //#define BLINN_PHONG
  #define PI 3.1415926535897932384626433832795

  uniform mat4 u_viewMatrix;
  
  uniform sampler2D u_clusterbuffer;
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  
  uniform vec2 u_clusterdims;
  uniform vec2 u_screendims;
  uniform vec3 u_slices;
  uniform vec3 u_camPos;
  uniform float u_fov;
  uniform float u_aspect;
  uniform float u_clipDist;
  
  varying vec4 v_position;
  varying vec3 v_viewDir;
  varying vec2 v_uv;

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

    // LOOK: This extracts the 4th float (radius) of the (index)th light in the buffer
    // Note that this is just an example implementation to extract one float.
    // There are more efficient ways if you need adjacent values
    light.radius = ExtractFloat(u_lightbuffer, ${params.numLights}, 2, index, 3);

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

  // Based on the paper "A Survey of Efficient Representations for Independent Unit Vectors" (Cigolle et al. 2014)
  vec2 signNotZero(vec2 nor) {
    return vec2((nor.x >= 0.0) ? 1.0 : -1.0, (nor.y >= 0.0) ? 1.0 : -1.0);
  }

  vec3 decodeNormalBasic(vec3 nor) {
    return nor * 2.0 - 1.0;
  }

  vec3 decodeNormalOct(vec2 en) {
    vec3 n = vec3(en.xy, 1.0 - abs(en.x) - abs(en.y));
    if (n.z < 0.0) n.xy = (1.0 - abs(n.yx)) * signNotZero(n.xy);
    return normalize (n);
  }

  vec3 reconstructWorldPos(float depth) {
    vec3 viewDir = normalize(v_viewDir);
    return u_camPos + depth * viewDir;
  }
  
  void main() {
    // Extract data from g-buffers
    vec4 gb0 = texture2D(u_gbuffers[0], v_uv); // depth, normal.x, normal.y, specExponent
    vec4 gb1 = texture2D(u_gbuffers[1], v_uv); // albedo.xyz, 

    // Uncomment for visualizing G-Buffer values
    //vec3 posColor = reconstructWorldPos(gb0.x);
    //vec3 normColor = 0.5 * (decodeNormalOct(vec2(gb0.y, gb0.z)) + vec3(1.0));
    //vec3 albedo = gb1.xyz;
    //gl_FragColor = vec4(posColor * 0.05, 1.0);
    //return;

    vec3 pos = reconstructWorldPos(gb0.x);
    vec3 norm = decodeNormalOct(vec2(gb0.y, gb0.z));
    vec3 diffuseColor = gb1.xyz;
    vec3 specularColor = vec3(1.0);
    float specExponent = gb0.w;

    // Get cluster index of current fragment
    vec3 viewPos = (u_viewMatrix * vec4(pos, 1.0)).xyz;
    float tanFov = tan(0.5 * u_fov * (PI / 180.0));
    float halfYLen = viewPos.z * tanFov;
    float halfXLen = halfYLen * u_aspect;
    int clusterX = int(viewPos.x + (u_slices.x * halfXLen) / (2.0 * halfXLen));
    int clusterY = int(viewPos.y + (u_slices.y * halfYLen) / (2.0 * halfYLen));
    int clusterZ = int(u_slices.z * (viewPos.z / u_clipDist));

    int clusterIndex = clusterX + clusterY * int(u_slices.x) + clusterZ * int(u_slices.x) * int(u_slices.y);
    int clusterLightsCount = int(ExtractFloat(u_clusterbuffer, int(u_clusterdims.x), int(u_clusterdims.y), clusterIndex, 0));

    // Do lighting
    vec3 fragColor = vec3(0.0);

    for (int i = 0; i < ${params.maxClusterLights}; ++i) {
      if (i >= clusterLightsCount) break;

      // Get light index
      int lightIdx = int(ExtractFloat(u_clusterbuffer, int(u_clusterdims.x), int(u_clusterdims.y), clusterIndex, i + 1));

      // Unpack light info
      Light light = UnpackLight(lightIdx);

#ifdef LAMBERTIAN
      float lightDistance = distance(light.position, pos);
      vec3 L = (light.position - pos) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, norm), 0.0);

      fragColor += diffuseColor * lambertTerm * light.color * vec3(lightIntensity);
#endif

#ifdef BLINN_PHONG
      float lightDistance = distance(light.position, pos);
      vec3 L = (light.position - pos) / lightDistance;

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float NdotL = max(dot(L, norm), 0.0);
      vec3 diffuseTerm = NdotL * light.color * lightIntensity;

      vec3 view = normalize(u_camPos - pos);
      vec3 H = normalize(view + L);
      float NdotH = max(dot(H, norm), 0.0);
      float specIntensity = pow(NdotH, specExponent);
      vec3 specularTerm = specIntensity * light.color * lightIntensity;

      fragColor += diffuseColor * diffuseTerm + specularColor * specularTerm;
#endif
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += diffuseColor * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}