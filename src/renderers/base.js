import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

// Class to represent one subdivision of camera frustum
export class SubFrustum {
  constructor() {

  }

  // Check for intersection with frustum and light
  intersectWithLight(lightIdx) {
    return true;
  }
}

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    // 3D grid of size xSlices * ySlices * zSlices
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    let zDepth = camera.far / this._zSlices;
    // TODO: how to get camera attributes?

    // Each x, y, z represents one cluster
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          // 1D grid index
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;

          // Compute sub-frustum
          // TODO: calculate six planes of frustum and store in SubFrustum class object
          let subFrustrum = new SubFrustum();

          let lightsCount = 0;
          for (let i = 0; i < scene.lights.length; i++) {
            // Check for intersection against frustum
            let intersect = subFrustum.intersectWithLight(i);

            if (intersect) {
              // Add to list of light indices
            }
          }
        }
      }
    }

    // 

    // STEP 1. Compute clusters (sub-frustums)
    // 1a. Find zNear and zFar depending on z-slice, and similar calculations in x and y directions
    // Q1: How to create sub-frustums? We can get the far and near, but how about other planes? 
    // Q2: How to use viewMatrix to calculate other planes?

    // STEP 2. For each cluster, iterate through all of the lights and check for intersection
    // Q3: Does "intersection" mean that frustum fully encompasses light? Or is enough if it just overlaps?
    // Q4: Is this the same as bounding sphere-frustum intersection?

    // STEP 3. If the light intersects the cluster, then add its index to the cluster's list of lights
    // Add this information to the clusterTexture - first index will be light count, then the follow indices will be 
    // Keep temp lightsCount variable and continuously increment it; also use this to assign lightIndices

    this._clusterTexture.update();
  }
}