import TextureBuffer from './textureBuffer';
import {vec3, vec4} from 'gl-matrix';

export const MAX_LIGHTS_PER_CLUSTER = 100;

function clampClusterIndex(val, min, max)
{
  return Math.min(Math.max(val, min), max);
}

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    // 3D grid of size xSlices * ySlices * zSlices
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    this._elementCount = xSlices * ySlices * zSlices;
    this._elementSize = Math.ceil((MAX_LIGHTS_PER_CLUSTER + 1) / 4);
  }

  updateClusters(camera, viewMatrix, scene, wireframe) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    //console.log("Number scene lights: ", scene.lights.length);

    // Each x, y, z represents one cluster
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          // 1D grid index
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    // For each light, figure out which clusters it overlaps
    // For each cluster, add this light to its light count and light list
    for (let i = 0; i < scene.lights.length; ++i) {
      // STEP 1. Find light position and radius
      let lightPos = scene.lights[i].position;
      //let lightPos = vec3.fromValues(1.0, 1.0, 1.0);
      let lightRadius = scene.lights[i].radius;
      //console.log("Light pos: ", lightPos, " light radius: ", lightRadius);

      // STEP 2. Find bounding box (min and max) of light based on radius
      let bbMin = vec3.fromValues(lightPos[0] - lightRadius, lightPos[1] - lightRadius, lightPos[2] - lightRadius);
      let bbMax = vec3.fromValues(lightPos[0] + lightRadius, lightPos[1] + lightRadius, lightPos[2] + lightRadius);
      //console.log("Bounding box min: ", bbMin);
      //console.log("Bounding box max: ", bbMax);

      // STEP 3. Transform bounding box (min and max) into view space using viewMatrix
      let viewBBMin = vec3.create();
      let viewBBMax = vec3.create();
      vec3.transformMat4(viewBBMin, bbMin, viewMatrix);
      vec3.transformMat4(viewBBMax, bbMax, viewMatrix);
      //console.log("View BB Min: ", viewBBMin);
      //console.log("View BB Max: ", viewBBMax);

      // STEP 4. Find x, y, z lengths of sub-frustum to project AABB coordinates into clip space 
      let zNear = -1.0 * viewBBMin[2];
      let zFar = -1.0 * viewBBMax[2];
      let zStep = (camera.far - camera.near) / this._zSlices;
      let tanFov = Math.tan(0.5 * camera.fov * (Math.PI / 180.0));

      let halfYLenNear = zNear * tanFov;
      let halfXLenNear = halfYLenNear * camera.aspect;
      //console.log("halfYLenNear", halfYLenNear);
      //console.log("halfXLenNear", halfXLenNear);

      let halfYLenFar = zFar * tanFov;
      let halfXLenFar = halfYLenFar * camera.aspect;
      //console.log("halfYLenFar", halfYLenFar);
      //console.log("halfXLenFar", halfXLenFar);

      // STEP 5. Calculate min and max cluster indices (clamp to cull objects out of view)
      let xMin = Math.floor(this._xSlices * ((viewBBMin[0] + halfXLenNear) / (2.0 * halfXLenNear)));
      let xMax = Math.ceil(this._xSlices * ((viewBBMax[0] + halfXLenFar) / (2.0 * halfXLenFar)));
      xMin = clampClusterIndex(xMin, 0, this._xSlices);
      xMax = clampClusterIndex(xMax, 0, this._xSlices);
      //console.log("x: ", xMin, xMax);

      let yMin = Math.floor(this._ySlices * ((viewBBMin[1] + halfYLenNear) / (2.0 * halfYLenNear)));
      let yMax = Math.ceil(this._ySlices * ((viewBBMax[1] + halfYLenFar) / (2.0 * halfYLenFar)));
      yMin = clampClusterIndex(yMin, 0, this._ySlices);
      yMax = clampClusterIndex(yMax, 0, this._ySlices);
      //console.log("y: ", yMin, yMax);

      let zMin = Math.floor(zNear / zStep);
      let zMax = Math.ceil(zFar / zStep);
      zMin = clampClusterIndex(zMin, 0, this._zSlices);
      zMax = clampClusterIndex(zMax, 0, this._zSlices);
      //console.log("z: ", zMin, zMax);

      // STEP 6. Iterate over min and max x, y, z frustum coordinates and add light to light count and light indices
      // Add this information to the clusterTexture - first index will be light count, the following indices will be the lights
      // Each cluster has ceil(lightsSize / 4) pixels, where each pixel holds 4 float values
      for (let z = zMin; z < zMax; ++z) {
        for (let y = yMin; y < yMax; ++y) {
          for (let x = xMin; x < xMax; ++x) {
            // Current cluster's 1D index
            let clusterIdx = x + y * this._xSlices + z * this._xSlices * this._ySlices;

            // Increment light count
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterIdx, 0)] += 1;

            // Next available index to add a light
            let lightIdx = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterIdx, 0)];
            //console.log(lightIdx);

            if (lightIdx <= MAX_LIGHTS_PER_CLUSTER) {
              // Add light (with index i) to cluster's list of lights
              let pixelNum = Math.floor(lightIdx / 4);
              let pixelComponent = Math.floor(lightIdx % 4);
              //console.log(pixelComponent);
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(clusterIdx, pixelNum) + pixelComponent] = i;
            }
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}