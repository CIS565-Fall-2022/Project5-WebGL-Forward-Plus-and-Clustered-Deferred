import { PerspectiveCamera, Quaternion, Vector3 } from "three";
import {FRUSTUM_NEAR_DEPTH, FRUSTUM_FAR_DEPTH } from "./scene";

export type Sphere = {
  center: Vector3;
  radius: number;
}

export function getPlaneNormalsOfSubFrustum(cam: PerspectiveCamera, slices: Vector3, index: Vector3) {
  // reference: http://davidlively.com/programming/graphics/frustum-calculation-and-culling-hopefully-demystified/
  // However, instead of using the corners of the frustum/near clip plane intersect
  // we use corners of a subfrustum

  const hh = Math.tan((cam.fov * Math.PI / 180) / 2);
  const hw = hh * cam.aspect;

  const tileWidth = 2 * hw / slices.x;
  const tileHeight = 2 * hh / slices.y;

  // for camera at origin, pointing outwards in -z direction
  const xLeft = -hw + index.x * tileWidth;
  const xRight = xLeft + tileWidth;
  const yBot = -hh + index.y * tileHeight;
  const yTop = yBot + tileHeight;

  const nw = new Vector3(xLeft, yTop, 1);
  const ne = new Vector3(xRight, yTop, 1);
  const se = new Vector3(xLeft, yBot, 1);
  const sw = new Vector3(xRight, yBot, 1);

  const quat = new Quaternion();
  cam.getWorldQuaternion(quat);

  const top = nw.cross(ne).applyQuaternion(quat).normalize();
  const right = ne.cross(se).applyQuaternion(quat).normalize();
  const bottom = se.cross(sw).applyQuaternion(quat).normalize();
  const left = sw.cross(nw).applyQuaternion(quat).normalize();
  const near = new Vector3(0, 0, 1).applyQuaternion(quat);
  const far = new Vector3(0, 0, -1).applyQuaternion(quat);

  return {top, right, bottom, left, near, far};
}

function signedDist(point: Vector3, planeNormal: Vector3, planeOrig: Vector3) {
  return point.sub(planeOrig).dot(planeNormal);
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

  const distTop = signedDist(sphere.center, top, eye);
  const distBot = signedDist(sphere.center, bottom, eye);
  const distLeft = signedDist(sphere.center, left, eye);
  const distRight = signedDist(sphere.center, right, eye);

  const tileDepth = (FRUSTUM_FAR_DEPTH - FRUSTUM_NEAR_DEPTH) / slices.z;
  const nearZ: number = FRUSTUM_NEAR_DEPTH + index.z * tileDepth;
  const farZ = nearZ + tileDepth;
  const camForward = new Vector3();
  cam.getWorldDirection(camForward);
  const nearPlaneOrigin = eye.add(camForward.multiplyScalar(nearZ));
  const farPlaneOrigin = eye.add(camForward.multiplyScalar(farZ));

  const distNear = signedDist(sphere.center, near, nearPlaneOrigin);
  const distFar = signedDist(sphere.center, far, farPlaneOrigin);

  return distTop > sphere.radius && distBot > sphere.radius
    && distLeft > sphere.radius && distRight > sphere.radius
    && distNear > sphere.radius && distFar > sphere.radius;
}
