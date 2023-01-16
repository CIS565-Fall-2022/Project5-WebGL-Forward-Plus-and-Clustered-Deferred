import { PerspectiveCamera, Vector3 } from "three";
import {getCorners, getPlaneNormalsOfSubFrustum, sub, neg, subFrustumSphereIntersectTest} from "./helpers";

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

  // check aspect ratio
 testApproxEq(sub(ne, se), sub(nw, sw));
 testApproxEq(sub(ne, nw), sub(se, sw));

 expect(sub(ne, se).length() * cam.aspect).toBeCloseTo(sub(ne, nw).length());
});

test("getCorners 4 slice top right", () => {
  const slices = new Vector3(2, 2, 1);
  const index = new Vector3(1, 0, 0); // top right corner

  const {ne, nw, se, sw} = getCorners(cam, slices, index);
  testApproxEq(sub(ne, se), sub(nw, sw));
  testApproxEq(sub(ne, nw), sub(se, sw));
  expect(sub(ne, se).length() * cam.aspect).toBeCloseTo(sub(ne, nw).length());

  expect(nw.x).toBeCloseTo(0);
  expect(sw.x).toBeCloseTo(0);
  expect(sw.y).toBeCloseTo(0);
  expect(se.y).toBeCloseTo(0);
});

test("getPlaneNormalOfSubFrustum 1 slice", () => {
  const slices = new Vector3(1, 1, 1);
  const index = new Vector3(0, 0, 0);

  const {top, right, bottom, left, near, far} = getPlaneNormalsOfSubFrustum(cam, slices, index);
  testApproxEq(near, neg(far));
});

test("getPlaneNormalOfSubFrustum 9 slice", () => {
  const slices = new Vector3(3, 3, 1);

  const normsTopLeft = getPlaneNormalsOfSubFrustum(cam, slices, new Vector3(0, 0, 0));
  const normsTopMid = getPlaneNormalsOfSubFrustum(cam, slices, new Vector3(1, 0, 0));
  const normsCenter = getPlaneNormalsOfSubFrustum(cam, slices, new Vector3(1, 1, 0));

  testApproxEq(normsTopLeft.right, neg(normsTopMid.left));
  testApproxEq(normsTopLeft.right, neg(normsCenter.left));
  testApproxEq(normsTopMid.bottom, neg(normsCenter.top));
});

test("getPlaneNormalOfSubFrustum 9 slice with look at", () => {
  const slices = new Vector3(3, 3, 1);
  cam.lookAt(-10, 4, -9);

  const normsTopLeft = getPlaneNormalsOfSubFrustum(cam, slices, new Vector3(0, 0, 0));
  const normsTopMid = getPlaneNormalsOfSubFrustum(cam, slices, new Vector3(1, 0, 0));
  const normsCenter = getPlaneNormalsOfSubFrustum(cam, slices, new Vector3(1, 1, 0));

  testApproxEq(normsTopLeft.right, neg(normsTopMid.left));
  testApproxEq(normsTopLeft.right, neg(normsCenter.left));
  testApproxEq(normsTopMid.bottom, neg(normsCenter.top));
});

test("subFrustumSphereIntersectTest should be true for point we're looking at, false if not looking at", () => {
  const slices = new Vector3(1, 1, 1);
  const index = new Vector3(0, 0, 0);

  for (let i = 0; i < 10; ++i) {
    const point = new Vector3(Math.random() * 100 - 50, Math.random() * 100 - 50, Math.random() * 100 - 50);
    cam.position.set(Math.random() * 100 - 50, Math.random() * 100 - 50, Math.random() * 100 - 50);
    cam.lookAt(point);

    expect(subFrustumSphereIntersectTest(cam, slices, index, {
      center: point,
      radius: 0,
    })).toBeTruthy();

    cam.rotation.set(Math.PI, 0, 0);

    expect(subFrustumSphereIntersectTest(cam, slices, index, {
      center: point,
      radius: 0,
    })).toBeFalsy();
  }
});

test("subFrustumSphereIntersectTest sliced", () => {
  const slices = new Vector3(3, 5, 1);
  const index = new Vector3(1, 2, 0);

  const point = new Vector3(-8, 70, 5);
  cam.lookAt(point);

  expect(subFrustumSphereIntersectTest(cam, slices, index, {
    center: point,
    radius: 0,
  })).toBeTruthy();
});
