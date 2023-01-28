import TextureBuffer from './textureBuffer';
import {subFrustumSphereIntersectTest} from '../helpers'
import { Vector3 } from 'three';
import { NUM_LIGHTS } from '../scene';

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    // format:
    // | # of lights (float) | index of 1st light (float) | index of 2nd light (float) | ... | undef float | undef float |
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }

  getIndex1D(x, y, z) {
    return x + y * this._xSlices + z * this._xSlices * this._ySlices;
  }

  updateClusters(camera, viewMatrix, scene) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...

    const slices = new Vector3(this._xSlices, this._ySlices, this._zSlices);

    // for (let z = 0; z < this._zSlices; ++z) {
    //   for (let y = 0; y < this._ySlices; ++y) {
    //     for (let x = 0; x < this._xSlices; ++x) {
          
    //       const bufferIdx = this.getIndex1D(x, y, z);
          
    //       let lightCount = 0;

    //       for (let i = 0; i < NUM_LIGHTS; ++i) {
    //         const light = scene.lights[i];
    //         const index = new Vector3(x, y, z);
    //         const size = new Vector3(1, 1, 1);

    //         const isInsideCluster = subFrustumSphereIntersectTest(camera, slices, index, size, {
    //           center: light.position,
    //           radius: light.radius,
    //         });

    //         if (isInsideCluster) {
    //           this._clusterTexture.buffer[this._clusterTexture.bufferIndex(bufferIdx, ++lightCount)] = i; 
    //         }
    //       }

    //       this._clusterTexture.buffer[this._clusterTexture.bufferIndex(bufferIdx, 0)] = lightCount;
    //     }
    //   }
    // }

    // Just search each frustum grid cell and check if light fits in it
    // TODO: binary search for more effective culling
    // for (let i = 0; i < NUM_LIGHTS; ++i) {
      
    //   const search = (index, size) => {
    //     const isInside = subFrustumSphereIntersectTest(camera, slices, index, size, {
    //       center: scene.lights[i].position,
    //       radius: scene.lights[i].radius,
    //     });

    //     if (isInside) {
    //       // search(index)
    //     }
    //   }

    //   search(new Vector3(0, 0, 0), new Vector3(slices));
    // }

    this._clusterTexture.update();
  }
}