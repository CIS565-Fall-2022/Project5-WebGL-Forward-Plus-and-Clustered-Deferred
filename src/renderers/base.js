import { vec4 } from 'gl-matrix';
import TextureBuffer from './textureBuffer';
import { cameraControls } from './../init';
import { NUM_LIGHTS } from './../scene';

export const MAX_LIGHTS_PER_CLUSTER = NUM_LIGHTS;

export default class BaseRenderer {
  constructor(xSlices, ySlices, zSlices) {
    // Create a texture to store cluster data. Each cluster stores the number of lights followed by the light indices
    this._clusterTexture = new TextureBuffer(xSlices * ySlices * zSlices, MAX_LIGHTS_PER_CLUSTER + 1);
    this._xSlices = xSlices;
    this._ySlices = ySlices;
    this._zSlices = zSlices;
    this._frame = 0;
    this._maxLightsPerCluster = MAX_LIGHTS_PER_CLUSTER;
  }

  updateClusters(camera, viewMatrix, scene) {

    // clear out old light counts
    for (let z = 0; z < this._zSlices; ++z) {
      for (let y = 0; y < this._ySlices; ++y) {
        for (let x = 0; x < this._xSlices; ++x) {
          let idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;

          this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)] = 0;
        }
      }
    }

    // half height calculation (independent of z depth)
    let frustum_half_height = Math.tan(camera.fov * 0.5 * Math.PI / 180.0);

    // dividing total depth of frustum by number of z slices
    let frustum_z_stride = (camera.far - camera.near) / this._zSlices;

    for (let i = 0; i < scene.lights.length; i++) {

      
      let light_position = scene.lights[i].position;
      let light_radius = scene.lights[i].radius;

      // get bounding box of sphere representing light with position and radius
      let sphere_AABB_min = vec4.fromValues(light_position[0] - light_radius, light_position[1] - light_radius, light_position[2] - light_radius, 1);
      let sphere_AABB_max = vec4.fromValues(light_position[0] + light_radius, light_position[1] + light_radius, light_position[2] + light_radius, 1);

      // transform from world space to view space
      vec4.transformMat4(sphere_AABB_min, sphere_AABB_min, viewMatrix);
      vec4.transformMat4(sphere_AABB_max, sphere_AABB_max, viewMatrix);

      // multiply z coordinate by -1 to make z positive in front of camera
      sphere_AABB_min[2] *= -1.0;
      sphere_AABB_max[2] *= -1.0;

      // calculate the frustum half height at depth where sphere bounding box are in view space
      let half_height_at_depth_min = frustum_half_height * sphere_AABB_min[2];
      let half_height_at_depth_max = frustum_half_height * sphere_AABB_max[2];

      // calculate frustum half width from half height using aspect ratio
      let half_width_at_depth_min = half_height_at_depth_min * camera.aspect;
      let half_width_at_depth_max = half_height_at_depth_max * camera.aspect;

      // calculate x and y cluster index values by shifting negative x and y to positive
      let frustum_grid_index_min_x = sphere_AABB_min[0] + (this._xSlices * half_width_at_depth_min) / (2.0 * half_width_at_depth_min);
      let frustum_grid_index_max_x = sphere_AABB_max[0] + (this._xSlices * half_width_at_depth_max) / (2.0 * half_width_at_depth_max);

      let frustum_grid_index_min_y = sphere_AABB_min[1] + (this._ySlices * half_height_at_depth_min) / (2.0 * half_height_at_depth_min);
      let frustum_grid_index_max_y = sphere_AABB_max[1] + (this._ySlices * half_height_at_depth_max) / (2.0 * half_height_at_depth_max);

      // divided view z coordinate by length of each cluster in z direction to get z cluster
      let frustum_grid_index_min_z = sphere_AABB_min[2] / frustum_z_stride;
      let frustum_grid_index_max_z = sphere_AABB_max[2] / frustum_z_stride;


      // flip directions if necessary
      if (frustum_grid_index_min_x > frustum_grid_index_max_x) {
        let temp = frustum_grid_index_min_x;
        frustum_grid_index_min_x = frustum_grid_index_max_x;
        frustum_grid_index_max_x = temp;
      }

      if (frustum_grid_index_min_y > frustum_grid_index_max_y) {
        let temp = frustum_grid_index_min_y;
        frustum_grid_index_min_y = frustum_grid_index_max_y;
        frustum_grid_index_max_y = temp;
      }

      if (frustum_grid_index_min_z > frustum_grid_index_max_z) {
        let temp = frustum_grid_index_min_z;
        frustum_grid_index_min_z = frustum_grid_index_max_z;
        frustum_grid_index_max_z = temp;
      }

      // cull lights outside view
      if ((frustum_grid_index_min_x < 0.0 && frustum_grid_index_max_x < 0.0) || (frustum_grid_index_min_x > this._xSlices && frustum_grid_index_max_x > this._xSlices)) {
        continue;
      }
      if ((frustum_grid_index_min_y < 0.0 && frustum_grid_index_max_y < 0.0) || (frustum_grid_index_min_y > this._ySlices && frustum_grid_index_max_y > this._ySlices)) {
        continue;
      }
      if ((frustum_grid_index_min_z < 0.0 && frustum_grid_index_max_z < 0.0) || (frustum_grid_index_min_z > this._zSlices && frustum_grid_index_max_z > this._zSlices)) {
        continue;
      }

      // clamp and floor mins and ceil maxes to get final cluster bounds
      frustum_grid_index_min_x = Math.floor(Math.min(Math.max(frustum_grid_index_min_x, 0.0), this._xSlices - 1));
      frustum_grid_index_max_x = Math.ceil(Math.min(Math.max(frustum_grid_index_max_x, 0.0), this._xSlices));

      frustum_grid_index_min_y = Math.floor(Math.min(Math.max(frustum_grid_index_min_y, 0.0), this._ySlices - 1));
      frustum_grid_index_max_y = Math.ceil(Math.min(Math.max(frustum_grid_index_max_y, 0.0), this._ySlices));

      frustum_grid_index_min_z = Math.floor(Math.min(Math.max(frustum_grid_index_min_z, 0.0), this._zSlices - 1));
      frustum_grid_index_max_z = Math.ceil(Math.min(Math.max(frustum_grid_index_max_z, 0.0), this._zSlices));

      // add light to each cluster it is in
      for (let z = frustum_grid_index_min_z; z < frustum_grid_index_max_z; ++z) {
        for (let y = frustum_grid_index_min_y; y < frustum_grid_index_max_y; ++y) {
          for (let x = frustum_grid_index_min_x; x < frustum_grid_index_max_x; ++x) {
            let idx = x + y * this._xSlices + z * this._xSlices * this._ySlices;

            if (this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)] < MAX_LIGHTS_PER_CLUSTER) {
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)]++;

              let pixel_to_put_light_into = Math.floor(this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)] / 4);
              let component_to_put_light_into = Math.floor(this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, 0)] % 4);
              this._clusterTexture.buffer[this._clusterTexture.bufferIndex(idx, pixel_to_put_light_into) + component_to_put_light_into] = i;
            }
          }
        }
      }
  }


  this._frame++;

  this._clusterTexture.update();
  }
}