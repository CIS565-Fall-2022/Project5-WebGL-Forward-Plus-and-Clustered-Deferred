export default function(params) {
  return `
  #version 100
  precision highp float;
  
  uniform sampler2D u_gbuffers[${params.numGBuffers}];
  uniform sampler2D u_lightbuffer;
  uniform sampler2D u_clusterbuffer;
  
  uniform mat4 u_viewMatrix;
  uniform vec3 u_slices; //x,y,z slices
  uniform float u_height; // Image height, width
  uniform float u_width;
  uniform float u_near; // Camera near, far
  uniform float u_far;

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

  void main() {
    //Unpack Gbuf
    // vec4 buf0 = texture2D(u_gbuffers[0], v_uv);
    // vec4 buf1 = texture2D(u_gbuffers[1], v_uv);;
    // //Can be unsed if we optimize
    // vec4 buf2 = texture2D(u_gbuffers[2], v_uv);;

    // vec3 v_position = buf0.xyz;
    // vec3 albedo = vec3(buf0.w, buf1.xy);
    // vec3 normal = vec3(buf1.zw, buf2.x);

    vec3 v_position = texture2D(u_gbuffers[0], v_uv).xyz;
    vec3 albedo = texture2D(u_gbuffers[1], v_uv).rgb;
    vec3 normal = texture2D(u_gbuffers[2], v_uv).xyz;

    vec3 fragColor = vec3(0.0);

    // gl_FragCoord already in camera space
    // We can use it directly to bucket x,y if we know image size
    int x = int(float(gl_FragCoord.x / u_width) * u_slices.x);
    int y = int(float(gl_FragCoord.y / u_height) * u_slices.y);

    // Convert to camera space
    vec4 cameraSpacePos = u_viewMatrix * vec4(v_position, 1);
    
    // Need to convert from [near, far] to [0, far-near]
    int z = int((cameraSpacePos.z - u_near) / (u_far - u_near) * u_slices.z);

    //Index into cluster texture to get num lights (0th element)
    int clusterWidth = int(u_slices.x * u_slices.y * u_slices.z);
    int clusterHeight = int(ceil(float(${params.numLights} + 1) / 4.0));
    int index = x + y * int(u_slices.x) + z * int(u_slices.x) * int(u_slices.y);
    int numLights = int(ExtractFloat(u_clusterbuffer, clusterWidth, clusterHeight, index, 0));

    // Still loop to numLights bc cant have dynamic for loops :(
    for (int i = 0; i < ${params.numLights}; ++i) {
      if (i > numLights) {
        break;
      }
      // i+1 element since first element is number of lights
      int lightIndex = int(ExtractFloat(u_clusterbuffer, clusterWidth, clusterHeight, index, i+1));

      Light light = UnpackLight(lightIndex);

      float lightDistance = distance(light.position, v_position);
      vec3 L = (light.position - v_position) / lightDistance; //Light dir

      float lightIntensity = cubicGaussian(2.0 * lightDistance / light.radius);
      float lambertTerm = max(dot(L, normal), 0.0);

      // Blinn Phong from https://en.wikipedia.org/wiki/Blinn%E2%80%93Phong_reflection_model
      vec3 specularColor = vec3(1.0, 1.0, 1.0);
      float shininess = 16.0;
      float specular = 0.0;
      if (lambertTerm > 0.0) {
        vec3 viewDir = vec3(-cameraSpacePos);
        vec3 halfDir = normalize(L + viewDir);
        float specAngle = max(dot(halfDir, normal), 0.0);
        specular = pow(specAngle, shininess);
      }

      fragColor += albedo * lambertTerm * light.color * vec3(lightIntensity)
                + specularColor * specular * light.color * vec3(lightIntensity);
    }

    const vec3 ambientLight = vec3(0.025);
    fragColor += albedo * ambientLight;

    gl_FragColor = vec4(fragColor, 1.0);
  }
  `;
}