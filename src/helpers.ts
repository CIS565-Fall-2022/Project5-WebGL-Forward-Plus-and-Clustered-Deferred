import { PerspectiveCamera, Vector3 } from "three";

export function getPlaneNormals(cam: PerspectiveCamera) {
  // reference: http://davidlively.com/programming/graphics/frustum-calculation-and-culling-hopefully-demystified/
  const hh = Math.tan(cam.fov / 2) * cam.near;
  const hw = hh * cam.aspect;

  const nw = new Vector3(-hw, hh, 1);
  const ne = new Vector3(hw, hh, 1);
  const se = new Vector3(hw, -hh, 1);
  const sw = new Vector3(-hw, -hh, 1);

  // camera space frustum plane normals
  const top = nw.cross(ne).normalize();
  const right = ne.cross(se).normalize();
  const bottom = se.cross(sw).normalize();
  const left = sw.cross(nw).normalize();
  const near = new Vector3(0, 0, 1);
  const far = new Vector3(0, 0, -1);
}