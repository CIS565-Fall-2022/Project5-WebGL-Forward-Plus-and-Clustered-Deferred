import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ClusteredDeferredRenderer from './renderers/clusteredDeferred';
import ClusteredDeferredOptimizedRenderer from './renderers/clusteredDeferredOptimized';
import Scene from './scene';
import Wireframe from './wireframe';

const FORWARD = 'Forward';
const FORWARD_PLUS = 'Forward+';
const CLUSTERED = 'Clustered Deferred';
const CLUSTERED_OPTIMIZED = 'Clustered Optimized';

const LAMBERTIAN = 'Lambertian';
const BLINN_PHONG = 'Blinn-Phong';

let currShader = 0; // Default: Lambertian

const params = {
  renderer: CLUSTERED,
  surfaceShader: LAMBERTIAN,
  _renderer: null,
};

setRenderer(params.renderer);

function setRenderer(renderer) {
  switch(renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer(currShader);
      break;
    case FORWARD_PLUS:
      params._renderer = new ForwardPlusRenderer(25, 25, 25, currShader);
      break;
    case CLUSTERED:
      params._renderer = new ClusteredDeferredRenderer(25, 25, 25, currShader);
      break;
    case CLUSTERED_OPTIMIZED:
      params._renderer = new ClusteredDeferredOptimizedRenderer(25, 25, 25, currShader);
      break;
  }
}

function setShader(shader) {
  switch(shader) {
    case LAMBERTIAN:
      currShader = 0;
      break;
    case BLINN_PHONG:
      currShader = 1;
      break;
  }
}

gui.add(params, 'renderer', [FORWARD, FORWARD_PLUS, CLUSTERED, CLUSTERED_OPTIMIZED]).onChange(setRenderer);
gui.add(params, 'surfaceShader', [LAMBERTIAN, BLINN_PHONG]).onChange(setShader);

const scene = new Scene();
scene.loadGLTF('models/sponza/sponza.gltf');

// LOOK: The Wireframe class is for debugging.
// It lets you draw arbitrary lines in the scene.
// This may be helpful for visualizing your frustum clusters so you can make
// sure that they are in the right place.
const wireframe = new Wireframe();

var segmentStart = [-14.0, 0.0, -6.0];
var segmentEnd = [14.0, 20.0, 6.0];
var segmentColor = [1.0, 0.0, 0.0];
//wireframe.addLineSegment(segmentStart, segmentEnd, segmentColor);
//wireframe.addLineSegment([-14.0, 1.0, -6.0], [14.0, 21.0, 6.0], [0.0, 1.0, 0.0]);

camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
gl.enable(gl.DEPTH_TEST);

function render() {
  scene.update();  
  params._renderer.updateSurfaceShader(currShader);
  params._renderer.render(camera, scene, wireframe);

  // LOOK: Render wireframe "in front" of everything else.
  // If you would like the wireframe to render behind and in front
  // of objects based on relative depths in the scene, comment out /
  //the gl.disable(gl.DEPTH_TEST) and gl.enable(gl.DEPTH_TEST) lines.

  // gl.disable(gl.DEPTH_TEST);
  // wireframe.render(camera);
  // gl.enable(gl.DEPTH_TEST);
}

makeRenderLoop(render)();