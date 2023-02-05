import TextureBuffer from './textureBuffer';
import {subFrustumSphereIntersectTest} from '../helpers'
import { PerspectiveCamera, Vector3 } from 'three';
import { NUM_LIGHTS, FRUSTUM_NEAR_DEPTH, FRUSTUM_FAR_DEPTH } from '../scene';

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {

  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    // format:
    // | # of lights (float) | index of 1st light (float) | index of 2nd light (float) | ... | undef float | undef float |
    // this buffer is a (# of clusters) x (# of lights + 1) sized image
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  getIndex1D(x, y, z) {
    return x + y * this._xSlices + z * this._xSlices * this._ySlices;
  }

  updateClusters(camera, viewMatrix, scene) { // view matrix is for transforming the lights
    
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          // Reset the light count to 0 for every cluster
          const bufferIdx = this.getIndex1D(x, y, z);
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(bufferIdx, 0)] = 0;
        }
      }
    }

    // Above method is too slow and also may not be working.
    for (let i = 0; i < NUM_LIGHTS; ++i) {

      // project sphere light position into camera view space
      const light = scene.lights[i];
      const lightCenter = new Vector3(light.position[0], light.position[1], light.position[2]);
      lightCenter.applyMatrix4(camera.matrixWorldInverse); // camera.matrixWorldInverse is the view matrix

      // after untransforming, camera is facing -z direction
      // take bounding box aligned with camera space
      const bbMin = lightCenter.clone().sub(new Vector3(light.radius, light.radius, -light.radius));
      const bbMax = lightCenter.clone().add(new Vector3(light.radius, light.radius, -light.radius));

      // find z indices of bounding box corners using the predetermined near and far depths
      // these are different necessarily from camera near/far clip planes
      const zMin = Math.floor(Math.max((-bbMin.z - FRUSTUM_NEAR_DEPTH)
        / (FRUSTUM_FAR_DEPTH - FRUSTUM_NEAR_DEPTH) * this._zSlices, 0));
      const zMax = Math.floor(Math.min((-bbMax.z - FRUSTUM_NEAR_DEPTH)
        / (FRUSTUM_FAR_DEPTH - FRUSTUM_NEAR_DEPTH) * this._zSlices, this._zSlices));

      // TODO: zMin and zMax could be out of bounds

      // find xy indices of bounding box corners by using projection matrix
      // Multiplies this vector (with an implicit 1 in the 4th dimension) and m, and divides by perspective.
      // result is NDC from -1 to 1
      bbMin.applyMatrix4(camera.projectionMatrix);
      bbMax.applyMatrix4(camera.projectionMatrix);

      const xMin = Math.floor(Math.max((bbMin.x + 1) / 2 * this._xSlices), 0);
      const xMax = Math.ceil(Math.min((bbMax.x + 1) / 2 * this._xSlices), this._xSlices);
      const yMin = Math.floor(Math.max((bbMin.y + 1) / 2 * this._ySlices), 0);
      const yMax = Math.ceil(Math.min((bbMax.y + 1) / 2 * this._ySlices), this._ySlices);

      for (let x = xMin; x < xMax; x++) {
        for (let y = yMin; y < yMax; y++) {
          for (let z = zMin; z < zMax; z++) {
            const bufferIdx = this.getIndex1D(x, y, z);
            const lightIdx = this._clusterTexture.bufferIndex(bufferIdx, 0);

            const lightCount = this._clusterTexture.buffer[lightIdx];
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(bufferIdx, lightCount + 1)] = i; // put in r component 
            // increment light count
            this._clusterTexture.buffer[lightIdx]++;
          }
        }
      }
    }

    this._clusterTexture.update();
  }
}