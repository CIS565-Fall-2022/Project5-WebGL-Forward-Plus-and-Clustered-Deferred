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
  
  getIndex3D(i) {
    const z = Math.floor(i / ( this._xSlices * this._ySlices));
    const y = Math.floor((i - (z * this._xSlices * this._ySlices)) / this._xSlices);
    const x = i % this._xSlices;
    return {x, y, z};
  }

  updateClusters(camera, viewMatrix, scene, debug) { // view matrix is for transforming the lights
    
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

    let clusterLights = new Map();

    // Above method is too slow and also may not be working.
    for (let i = 0; i < NUM_LIGHTS; ++i) {

      // project sphere light position into camera view space
      const light = scene.lights[i];
      const lightCenter = new Vector3(light.position[0], light.position[1], light.position[2]);
      const radius = light.radius;
      lightCenter.applyMatrix4(camera.matrixWorldInverse); // camera.matrixWorldInverse is the view matrix

      // debugger;

      // after untransforming, camera is facing -z direction
      // take bounding rectangle aligned with camera space
      // the bottom left and top right points would have the same z coordinate
      const bbMin = lightCenter.clone().sub(new Vector3(radius, radius, 0));
      const bbMax = lightCenter.clone().add(new Vector3(radius, radius, 0));

      // find min and max z coords using the predetermined near and far depths
      // these are different necessarily from camera near/far clip planes
      const zMin = ((-lightCenter.z - radius) - FRUSTUM_NEAR_DEPTH)
        / (FRUSTUM_FAR_DEPTH - FRUSTUM_NEAR_DEPTH) * this._zSlices;
      const zMax = ((-lightCenter.z + radius) - FRUSTUM_NEAR_DEPTH)
        / (FRUSTUM_FAR_DEPTH - FRUSTUM_NEAR_DEPTH) * this._zSlices;

      // find xy indices of bounding box corners by using projection matrix
      // Multiplies this vector (with an implicit 1 in the 4th dimension) and m, and divides by perspective.
      // result is NDC from -1 to 1
      bbMin.applyMatrix4(camera.projectionMatrix);
      bbMax.applyMatrix4(camera.projectionMatrix);

      const xMin = (bbMin.x + 1) / 2 * this._xSlices;
      const xMax = (bbMax.x + 1) / 2 * this._xSlices;
      const yMin = (bbMin.y + 1) / 2 * this._ySlices;
      const yMax = (bbMax.y + 1) / 2 * this._ySlices;

      // Dealing with out of bounds
      // If min is out of bounds in max direction or vice versa
      // then the entire light is out of bounds, don't bother adding it to any clusters
      if (xMin > this._xSlices - 1 || yMin > this._ySlices - 1 || zMin > this._zSlices - 1
        || xMax < 0 || yMax < 0 || zMax < 0) {
        continue;
      }
      // Otherwise, clamp min and max bounds
      const xMinClamped = Math.floor(Math.max(0, xMin));
      const yMinClamped = Math.floor(Math.max(0, yMin));
      const zMinClamped = Math.floor(Math.max(0, zMin));
      const xMaxClamped = Math.floor(Math.min(xMax, this._xSlices - 1));
      const yMaxClamped = Math.floor(Math.min(yMax, this._ySlices - 1));
      const zMaxClamped = Math.floor(Math.min(zMax, this._zSlices - 1));

      // debugger;

      for (let x = xMinClamped; x <= xMaxClamped; x++) {
        for (let y = yMinClamped; y <= yMaxClamped; y++) {
          for (let z = zMinClamped; z <= zMaxClamped; z++) {

            const bufferIdx = this.getIndex1D(x, y, z);
            const lightIdx = this._clusterTexture.bufferIndex(bufferIdx, 0);
            // get light idx + 1 to offset the first element being used for light count 
            this._clusterTexture.buffer[lightIdx] += 1;
            const lightCount = this._clusterTexture.buffer[lightIdx];
            
            const pixel = Math.floor(lightCount / 4);
            const pixelComponent = lightCount % 4;

            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(bufferIdx, pixel) + pixelComponent] = i; // put in r component 

            if (debug) {
              const lights = clusterLights.get(bufferIdx);
              if (lights) {
                lights.push(lightCenter);
              } else {
                clusterLights = clusterLights.set(bufferIdx, [lightCenter]);
              }
            }
          }
        }
      }
    }

    if (debug) {
      for (let i = 0; i < this._xSlices * this._ySlices * this._zSlices; ++i) {
        const lights = clusterLights.get(i);
        const {x, y, z} = this.getIndex3D(i);
        if (lights) {
          console.log(`Cluster ${x},${y},${z}: ${lights.length} lights: ${lights.map((l) => `(${l.x}, ${l.y}, ${l.z}\n)`)}`);
        }
      }
    }

    this._clusterTexture.update();
  }
}