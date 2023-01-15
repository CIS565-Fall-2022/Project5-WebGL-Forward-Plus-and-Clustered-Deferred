import { PerspectiveCamera, Vector3 } from "three";
import {getCorners} from "./helpers";

const EPSILON = 0.01;

let cam;

beforeEach(() => {
  // aspect is width / height
  cam = new PerspectiveCamera(45, 4/3);
})

function testApproxEq(v1: Vector3, v2: Vector3) {
  expect(v1.manhattanDistanceTo(v2)).toBeLessThan(EPSILON);
}

test("getPlaneNormalsOfSubFrustum 1 slice", () => {
  const slices = new Vector3(1, 1, 1);
  const index = new Vector3(0, 0, 0);

  const {ne, nw, se, sw} = getCorners(cam, slices, index);
  console.log(getCorners(cam, slices, index));

  // check aspect ratio
//  testApproxEq(ne.sub(se), nw.sub(sw));
//  testApproxEq(ne.sub(nw), se.sub(sw));

//  expect(ne.sub(se).length() * cam.aspect).toBeCloseTo(ne.sub(nw).length());
});