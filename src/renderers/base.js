import { vec3, vec4 } from 'gl-matrix';
import { NUM_LIGHTS } from '../scene';
import TextureBuffer from './textureBuffer';

export const MAX_LIGHTS_PER_CLUSTER = 100;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
  }
  
  updateClusters(camera, viewMatrix, scene, wireframe) {
    // TODO: Update the cluster texture with the count and indices of the lights in each cluster
    // This will take some time. The math is nontrivial...
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let i = x + y * this._xSlices + z * this._xSlices * this._ySlices;
          // Reset the light count to 0 for every cluster
          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(i, 0)] = 0;
        }
      }
    }

    // Project to camera space, z slices are centered at 0,0
    // For min, max point on sphere, calc min, max cluster indicies
    // Get w,h of Z slice of view frustrum using:
    // h = 2 * tan(fovRadians/ 2) * zDist; w = h * aspectRatio;
    // Compute which x,y bucket/cluster
    // Compute which z bucket/cluster
    // Cache ratio to avoid repeated computations
    let heightRatio = 2 * Math.tan(camera.fov / 2  * Math.PI / 180);
    let widthRatio = heightRatio * camera.aspect;

    //Loop over all lights
    for (let i = 0; i < NUM_LIGHTS; ++i) {
      let light = scene.lights[i];
      let lightPos = vec4.fromValues(light.position[0], light.position[1], light.position[2], 1);
      // Do radius and camera.near offset before projection since they are in world position?
      // Not as efficent bc more lights in range now :/ but not sure why flickering was occuring
      // 7 was found experimentally, removes ~most flickering
      let radius = light.radius + 7; //This offset increases the reach of the light to reduce flickering
      let lightMin = vec4.fromValues(light.position[0] - radius, light.position[1] - radius, light.position[2] - camera.near - radius, 1);
      let lightMax = vec4.fromValues(light.position[0] + radius, light.position[1] + radius, light.position[2] - camera.near + radius, 1);
      //let cameraPos = vec4.fromValues(camera.position.x, camera.position.y, camera.position.z, 1);
      
      //Project to camera space
      vec4.transformMat4(lightMin, lightMin, viewMatrix);
      vec4.transformMat4(lightMax, lightMax, viewMatrix);
      vec4.transformMat4(lightPos, lightPos, viewMatrix);

      
      // NOTE: sign of z becomes flipped after viewMatrix transform
      // clamp light min so that zmin is not neg?
      var tempMin = [lightMin[0], lightMin[1], lightMin[2], 1];
      var tempMax = [lightMax[0], lightMax[1], lightMax[2], 1];
      // if (lightMin[2] > 0) {
      //   lightMin[2] = 0;
      // }
      // if (lightMax[2] > 0) {
      //   lightMax[2] = 0;
      // }
      lightMin[2] *= -1;
      lightMax[2] *= -1;
      lightPos[2] *= -1;
      // if (lightMin[2] < 0 || lightMax[2] < 0 || lightMin[2] > lightMax[2]) {
      //   // console.log(tempMin);
      //   // console.log(tempMax);
      //   // debugger;
      //   continue;
      // }
      // if (lightMin[0] > lightMax[0] || lightMin[1] > lightMax[1]) {
      //   debugger;
      // }

      // Calc h, w based on Z
      let totalHeightNear = heightRatio * lightMin[2];
      let totalWidthNear = widthRatio * lightMin[2];
      let totalHeightFar = heightRatio * lightMax[2];
      let totalWidthFar = widthRatio * lightMax[2];
      
      //Half height
      let halfHeightNear = totalHeightNear / 2.0;
      let halfWidthNear = totalWidthNear / 2.0;
      let halfHeightFar = totalHeightFar / 2.0;
      let halfWidthFar = totalWidthFar / 2.0;

      //Strides
      let yStrideNear = totalHeightNear / this._ySlices;
      let xStrideNear = totalWidthNear / this._xSlices;
      let yStrideFar = totalHeightFar / this._ySlices;
      let xStrideFar = totalWidthFar / this._xSlices;
      let zStride = (camera.far - camera.near) / this._zSlices;
      
      // Add h,w / 2 to be relative to [0, h,w] instead of [-h/2,-w/2, h/2,w/2] to avoid negative flooring issues
      //Camera space pos after being shifted
      let yMinPos = (lightMin[1] + halfHeightNear);
      let yMaxPos = (lightMax[1] + halfHeightFar);
      let xMinPos = (lightMin[0] + halfWidthNear);
      let xMaxPos = (lightMax[0] + halfWidthFar);

      // if (yMinPos < 0 || yMaxPos < 0 || xMinPos < 0 || xMaxPos < 0) {
      //   debugger;
      // }
      // if (yStrideNear < 0 || xStrideNear < 0 || yStrideFar < 0 || xStrideFar < 0) {
      //   debugger;
      // }
      
      let totalWidth = lightPos[2] * widthRatio;
      let totalHeight = lightPos[2] * heightRatio;
      let yStride = totalHeight / this._ySlices;
      let xStride = totalWidth / this._xSlices;

      // x, y bucketing
      // clamp out of bounds
      let yMax = Math.min(Math.max(Math.floor(yMaxPos / yStrideFar), 0), this._ySlices - 1);
      let yMin = Math.min(Math.max(Math.floor(yMinPos / yStrideNear), 0), this._ySlices - 1);
      let xMin = Math.min(Math.max(Math.floor(xMinPos / xStrideNear), 0), this._xSlices - 1);
      let xMax = Math.min(Math.max(Math.floor(xMaxPos / xStrideFar), 0), this._xSlices - 1);

      // z bucketing, z ranges from camera.near -> camera.far
      // Subtract camera.near to get [0, camera.far-camera.near]
      //Something is wrong here maybe? Z is never > 0 bc zStride is so big
      let zMin = Math.min(Math.max(Math.floor(lightMin[2] / zStride), 0), this._zSlices - 1);
      let zMax = Math.min(Math.max(Math.floor(lightMax[2] / zStride), 0), this._zSlices - 1);
      //console.log("(%d, %d), (%d, %d), (%d,%d)", xMin, xMax, yMin, yMax, zMin, zMax);

      // Loop through all canidate frustrums
      for (let z = zMin; z <= zMax; ++z) {
        for (let y = yMin; y <= yMax; ++y) {
          for (let x = xMin; x <= xMax; ++x) {        
            let idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;
            let numLights = this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)];
            if (numLights > MAX_LIGHTS_PER_CLUSTER) {
              continue;
            }
            ++this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)];
            ++numLights;
            
            let debug = 1;

            if (debug == 0) {
              // DEBUG CODE
              // NOTE: Flip zs back around to be negative for transformation
              let startZ = z * zStride + camera.near;
              let frontBL = vec4.fromValues(x * xStrideNear - halfWidthNear, y * yStrideNear - halfHeightNear, -startZ, 1);
              let frontBR = vec4.fromValues(frontBL[0] + xStrideNear, frontBL[1], frontBL[2], 1);
              let frontTL = vec4.fromValues(frontBL[0], frontBL[1] + yStrideNear, frontBL[2], 1);
              let frontTR = vec4.fromValues(frontBL[0] + xStrideNear, frontBL[1] + yStrideNear, frontBL[2], 1);

              let backBL = vec4.fromValues(x * xStrideFar - halfWidthFar, y * yStrideFar - halfHeightFar, -(startZ + zStride), 1);
              let backBR = vec4.fromValues(backBL[0] + xStrideFar, backBL[1], backBL[2], 1);
              let backTL = vec4.fromValues(backBL[0], backBL[1] + yStrideFar, backBL[2], 1);
              let backTR = vec4.fromValues(backBL[0] + xStrideFar, backBL[1] + yStrideFar, backBL[2], 1);

              // Transform back to world space
              let tempFrontBL = vec4.create();
              let tempFrontBR = vec4.create();
              let tempFrontTL = vec4.create();
              let tempFrontTR = vec4.create();

              vec4.transformMat4(tempFrontBL, frontBL, camera.matrixWorld.toArray());
              vec4.transformMat4(tempFrontBR, frontBR, camera.matrixWorld.toArray());
              vec4.transformMat4(tempFrontTL, frontTL, camera.matrixWorld.toArray());
              vec4.transformMat4(tempFrontTR, frontTR, camera.matrixWorld.toArray());

              vec4.transformMat4(backBL, backBL, camera.matrixWorld.toArray());
              vec4.transformMat4(backBR, backBR, camera.matrixWorld.toArray());
              vec4.transformMat4(backTL, backTL, camera.matrixWorld.toArray());
              vec4.transformMat4(backTR, backTR, camera.matrixWorld.toArray());
              
              // Draw Lines
              var red = [1.0, 0.0, 0.0];
              var green = [0.0, 1.0, 0.0];
              var blue = [0.0, 0.0, 1.0];
              // Front face
              wireframe.addLineSegment([frontBL[0], frontBL[1], frontBL[2]], [frontTL[0], frontTL[1], frontTL[2]], red);
              wireframe.addLineSegment([frontBL[0], frontBL[1], frontBL[2]], [frontBR[0], frontBR[1], frontBR[2]], red);
              wireframe.addLineSegment([frontBR[0], frontBR[1], frontBR[2]], [frontTR[0], frontTR[1], frontTR[2]], red);
              wireframe.addLineSegment([frontTR[0], frontTR[1], frontTR[2]], [frontTL[0], frontTL[1], frontTL[2]], red);

              // Back face
              wireframe.addLineSegment([backBL[0], backBL[1], backBL[2]], [backTL[0], backTL[1], backTL[2]], blue);
              wireframe.addLineSegment([backBL[0], backBL[1], backBL[2]], [backBR[0], backBR[1], backBR[2]], blue);
              wireframe.addLineSegment([backBR[0], backBR[1], backBR[2]], [backTR[0], backTR[1], backTR[2]], blue);
              wireframe.addLineSegment([backTR[0], backTR[1], backTR[2]], [backTL[0], backTL[1], backTL[2]], blue);

              //Connecting Lines
              wireframe.addLineSegment([backBL[0], backBL[1], backBL[2]], [frontBL[0], frontBL[1], frontBL[2]], green);
              wireframe.addLineSegment([backBR[0], backBR[1], backBR[2]], [frontBR[0], frontBR[1], frontBR[2]], green);
              wireframe.addLineSegment([backTR[0], backTR[1], backTR[2]], [frontTR[0], frontTR[1], frontTR[2]], green);
              wireframe.addLineSegment([backTL[0], backTL[1], backTL[2]], [frontTL[0], frontTL[1], frontTL[2]], green);
            }
            
            // Set light index
            this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, Math.floor(numLights / 4)) + Math.floor(numLights % 4)] = i;
          }
        }
      }
    }

    this._clusterTexture.update();
  }

}