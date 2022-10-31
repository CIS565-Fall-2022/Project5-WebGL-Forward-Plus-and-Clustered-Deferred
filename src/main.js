import { makeRenderLoop, camera, cameraControls, gui, gl } from './init';
import ForwardRenderer from './renderers/forward';
import ForwardPlusRenderer from './renderers/forwardPlus';
import ForwardPlusRenderer_GGX from './renderers/forwardPlus_GGX';
import ClusteredDeferredRenderer_O0 from './renderers/clusteredDeferred_O0';
import ClusteredDeferredRenderer_O1 from './renderers/clusteredDeferred_O1';
import ClusteredDeferredRenderer_O2 from './renderers/clusteredDeferred_O2';
import ClusteredDeferredRenderer_O2_GGX from './renderers/clusteredDeferred_O2_GGX';
import Scene from './scene';
import Wireframe from './wireframe';

const FORWARD = 'Forward';
const FORWARD_PLUS = 'Forward+';
const FORWARD_PLUS_GGX = 'Forward+ GGX';
const CLUSTERED_O0 = 'Clustered Deferred O0';
const CLUSTERED_O1 = 'Clustered Deferred O1';
const CLUSTERED_O2 = 'Clustered Deferred O2';
const CLUSTERED_O2_GGX = 'Clustered Deferred O2 GGX';

const params = {
  renderer: CLUSTERED_O0,
  _renderer: null,
  xSlices: 20,
  ySlices: 20,
  zSlices: 20,
  roughness: 0.25,
  metallic: 0.0
};

setRenderer(params.renderer);

function setRenderer(renderer) {
  switch(renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer(params.roughness, params.metallic);
      break;
    case FORWARD_PLUS:
      params._renderer = new ForwardPlusRenderer(params.xSlices, params.ySlices, params.zSlices);
      break;
    case FORWARD_PLUS_GGX:
      params._renderer = new ForwardPlusRenderer_GGX(params.xSlices, params.ySlices, params.zSlices, params.roughness, params.metallic);
      break;
    case CLUSTERED_O0:
      params._renderer = new ClusteredDeferredRenderer_O0(params.xSlices, params.ySlices, params.zSlices);
      break;
    case CLUSTERED_O1:
      params._renderer = new ClusteredDeferredRenderer_O1(params.xSlices, params.ySlices, params.zSlices);
      break;
    case CLUSTERED_O2:
      params._renderer = new ClusteredDeferredRenderer_O2(params.xSlices, params.ySlices, params.zSlices);
      break;
    case CLUSTERED_O2_GGX:
      params._renderer = new ClusteredDeferredRenderer_O2_GGX(params.xSlices, params.ySlices, params.zSlices, params.roughness, params.metallic);
      break;
  }
}

function setRendererParams() {
  switch(params.renderer) {
    case FORWARD:
      params._renderer = new ForwardRenderer(params.roughness, params.metallic);
      break;
    case FORWARD_PLUS:
      params._renderer = new ForwardPlusRenderer(params.xSlices, params.ySlices, params.zSlices);
      break;
    case FORWARD_PLUS_GGX:
      params._renderer = new ForwardPlusRenderer_GGX(params.xSlices, params.ySlices, params.zSlices, params.roughness, params.metallic);
      break;
    case CLUSTERED_O0:
      params._renderer = new ClusteredDeferredRenderer_O0(params.xSlices, params.ySlices, params.zSlices);
      break;
    case CLUSTERED_O1:
      params._renderer = new ClusteredDeferredRenderer_O1(params.xSlices, params.ySlices, params.zSlices);
      break;
    case CLUSTERED_O2:
      params._renderer = new ClusteredDeferredRenderer_O2(params.xSlices, params.ySlices, params.zSlices);
      break;
    case CLUSTERED_O2_GGX:
      params._renderer = new ClusteredDeferredRenderer_O2_GGX(params.xSlices, params.ySlices, params.zSlices, params.roughness, params.metallic);
      break;
  }
}

function setMaterialParams() {
  params._renderer._roughness = params.roughness;
  params._renderer._metallic = params.metallic;

}

gui.add(params, 'renderer', [FORWARD, FORWARD_PLUS, FORWARD_PLUS_GGX, CLUSTERED_O0, CLUSTERED_O1, CLUSTERED_O2, CLUSTERED_O2_GGX]).onChange(setRenderer);
gui.add(params, 'xSlices', 1, 50).step(1).onChange(setRendererParams);
gui.add(params, 'ySlices', 1, 50).step(1).onChange(setRendererParams);
gui.add(params, 'zSlices', 1, 50).step(1).onChange(setRendererParams);
gui.add(params, 'roughness', 0.0, 1.0).step(0.01).onChange(setMaterialParams);
gui.add(params, 'metallic', 0.0, 1.0).step(0.01).onChange(setMaterialParams);


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
wireframe.addLineSegment(segmentStart, segmentEnd, segmentColor);
wireframe.addLineSegment([-14.0, 1.0, -6.0], [14.0, 21.0, 6.0], [0.0, 1.0, 0.0]);
wireframe.addLineSegment([1.0, 1.0, 1.0], [1.0, 2.0, 1.0], [0.0, 0.0, 1.0]);

camera.position.set(-10, 8, 0);
cameraControls.target.set(0, 2, 0);
gl.enable(gl.DEPTH_TEST);

function render() {
  scene.update();  
  params._renderer.render(camera, scene);

  // LOOK: Render wireframe "in front" of everything else.
  // If you would like the wireframe to render behind and in front
  // of objects based on relative depths in the scene, comment out /
  //the gl.disable(gl.DEPTH_TEST) and gl.enable(gl.DEPTH_TEST) lines.
  //gl.disable(gl.DEPTH_TEST);
  //wireframe.render(camera);
  //gl.enable(gl.DEPTH_TEST);
}

makeRenderLoop(render)();