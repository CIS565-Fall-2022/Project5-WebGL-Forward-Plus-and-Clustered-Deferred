import { PerspectiveCamera, Vector3 } from "three";
import {getCorners, sub} from "./helpers";

const EPSILON = 0.01;

let cam;

beforeEach(() => {
  // aspect is width / height
  cam = new PerspectiveCamera(45, 4/3);
})

function testApproxEq(v1: Vector3, v2: Vector3) {
  expect(v1.clone().manhattanDistanceTo(v2)).toBeLessThan(EPSILON);
}

test("getCorners 1 slice", () => {
  const slices = new Vector3(1, 1, 1);
  const index = new Vector3(0, 0, 0);

  const {ne, nw, se, sw} = getCorners(cam, slices, index);
  console.log(getCorners(cam, slices, index));

  // check aspect ratio
 testApproxEq(sub(ne, se), sub(nw, sw));
 testApproxEq(sub(ne, nw), sub(se, sw));

 expect(sub(ne, se).length() * cam.aspect).toBeCloseTo(sub(ne, nw).length());
});