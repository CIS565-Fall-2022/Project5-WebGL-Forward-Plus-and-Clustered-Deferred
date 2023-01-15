import { PerspectiveCamera, Quaternion, Vector3 } from "three";

// not necessarily equal to camera near and far clip planes
// for grouping light clusters
export const FRUSTUM_NEAR_DEPTH = 1;
export const FRUSTUM_FAR_DEPTH = 1000;

export type Sphere = {
  center: Vector3;
  radius: number;
}

export function sub(v1: Vector3, v2: Vector3) {
  return v1.clone().sub(v2);
}

export function cross(v1: Vector3, v2: Vector3) {
  return v1.clone().cross(v2);
}

export function getCorners(cam: PerspectiveCamera, slices: Vector3, index: Vector3) {
  // reference: http://davidlively.com/programming/graphics/frustum-calculation-and-culling-hopefully-demystified/
  // However, instead of using the corners of the frustum/near clip plane intersect
  // we use corners of a subfrustum

  const hh = Math.tan((cam.getEffectiveFOV() * Math.PI / 180) / 2);
  const hw = hh * cam.aspect;

  const tileWidth = 2 * hw / slices.x;
  const tileHeight = 2 * hh / slices.y;

  // Index should use origin at TOP LEFT corner of screen
  const xLeft = -hw + index.x * tileWidth;
  const xRight = xLeft + tileWidth;
  const yTop = hh - index.y * tileHeight;
  const yBot = yTop - tileHeight;

  const nw = new Vector3(xLeft, yTop, 1);
  const ne = new Vector3(xRight, yTop, 1);
  const se = new Vector3(xRight, yBot, 1);
  const sw = new Vector3(xLeft, yBot, 1);
  
  return {nw, ne, se, sw};
}

export function getPlaneNormalsOfSubFrustum(cam: PerspectiveCamera, slices: Vector3, index: Vector3) {
  const {nw, ne, se, sw} = getCorners(cam, slices, index);

  const quat = new Quaternion();
  cam.getWorldQuaternion(quat);

  const top = cross(nw, ne).applyQuaternion(quat).normalize();
  const right = cross(ne, se).applyQuaternion(quat).normalize();
  const bottom = cross(se, sw).applyQuaternion(quat).normalize();
  const left = cross(sw, nw).applyQuaternion(quat).normalize();
  const near = new Vector3(0, 0, 1).applyQuaternion(quat);
  const far = new Vector3(0, 0, -1).applyQuaternion(quat);

  return {top, right, bottom, left, near, far};
}

// dist is positive if on correct (inside) of sub-frustum
// dist is negative if on incorrect side, but if its abs value is less than sphere radius
// it might still be counted as overlapping
function signedDist(point: Vector3, planeNormal: Vector3, planeOrig: Vector3) {
  return sub(point, planeOrig).dot(planeNormal);
}

export function subFrustumSphereIntersectTest(
  cam: PerspectiveCamera,
  slices: Vector3,
  index: Vector3,
  sphere: Sphere,
) {
  const {top, right, bottom, left, near, far} = getPlaneNormalsOfSubFrustum(cam, slices, index);
  const eye = new Vector3();
  cam.getWorldPosition(eye);

  const tileDepth = (FRUSTUM_FAR_DEPTH - FRUSTUM_NEAR_DEPTH) / slices.z;
  const nearZ: number = FRUSTUM_NEAR_DEPTH + index.z * tileDepth;
  const farZ = nearZ + tileDepth;
  const camForward = new Vector3();
  cam.getWorldDirection(camForward);
  const nearPlaneOrigin = eye.clone().addScaledVector(camForward, nearZ);
  const farPlaneOrigin = eye.clone().addScaledVector(camForward, farZ);

  const distTop = signedDist(sphere.center, top, eye);
  const distBot = signedDist(sphere.center, bottom, eye);
  const distLeft = signedDist(sphere.center, left, eye);
  const distRight = signedDist(sphere.center, right, eye);
  const distNear = signedDist(sphere.center, near, nearPlaneOrigin);
  const distFar = signedDist(sphere.center, far, farPlaneOrigin);

  return -distTop < sphere.radius && -distBot < sphere.radius
    && -distLeft < sphere.radius && -distRight < sphere.radius
    && -distNear < sphere.radius && -distFar < sphere.radius;
}
