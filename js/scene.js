import * as THREE from './three.module.js';
import { OrbitControls } from './OrbitControls.js';
import warehouse from './warehouse.js';
import * as dat from './dat.gui.module.js';
import { OutlinePass } from './OutlinePass.js';
import { EffectComposer } from './EffectComposer.js';
import { RenderPass } from './RenderPass.js';
import { ShaderPass } from './ShaderPass.js';
import { FXAAShader } from './FXAAShader.js';
import { GLTFLoader } from './GLTFLoader.js';

let camera, controls, scene, renderer, gui, composer, outlinePass, effectFXAA;
// const scale = [2, 2, 2];

const floorHeight = 2.8;

const containerSizes = {
	"low": [4, 2.4, 2.5],
	"normal": [4, 2.8, 2.5],
	"long": [6, 2.8, 2.5]
}

const stairSize = [2, floorHeight, floorHeight];
const catwalkHeight = 0.2;
const beamWidth = 0.2;
const railWidth = 0.1;
const railHeight = 1.2;
const defaultRailBeamDistance = 3;

const raycaster = new THREE.Raycaster();
const mousePos = new THREE.Vector2();

const doMatrixAutoUpdate = true;

const urlParams = new URLSearchParams(window.location.search);
const lowQuery = urlParams.get('low');
const lowQuality = lowQuery === 'false' ? false : !!lowQuery ?? false;
if (lowQuality)
	console.info("Launching in low quality mode");

const animate = lowQuality ? animateLow : animateHigh
const targetFPS = 30;

const clock = new THREE.Clock();
const interval = 1 / targetFPS;
let delta = 0;

function animateLow() {
	requestAnimationFrame(animateLow);
	delta += clock.getDelta();

	if (delta > interval) {
		composer.render();

		delta = delta % interval;
	}
}

function animateHigh() {
	requestAnimationFrame(animateHigh);
	controls.update(); // only required if controls.enableDamping = true, or if controls.autoRotate = true

	composer.render();
	// render();
}

function onMouseMove(event) {
	mousePos.x = (event.clientX / window.innerWidth) * 2 - 1;
	mousePos.y = - (event.clientY / window.innerHeight) * 2 + 1;
}

window.addEventListener('mousemove', onMouseMove, false);
window.addEventListener('click', onObjClick, false);

function onObjClick(event) {
	// update the picking ray with the camera and mouse position
	raycaster.setFromCamera(mousePos, camera);

	// calculate objects intersecting the picking ray
	const intersects = raycaster.intersectObjects(scene.children);

	if (intersects[0].object.geometry.type !== "PlaneGeometry") {
		console.log(intersects[0].object);

		let selectedObject = intersects[0].object.parent.type === "Group" ?
			intersects[0].object.parent : intersects[0].object;
		// selectedObject = selectedObject.parent.type === "Group" ?
		// 	selectedObject.parent : selectedObject.object;

		gui.destroy();
		gui = new dat.GUI();
		const objFolder = gui.addFolder('Obj')
		objFolder.add(selectedObject.position, 'x', -10.0, 50.0, 0.01)
		objFolder.add(selectedObject.position, 'y', -10.0, 50.0, 0.01)
		objFolder.add(selectedObject.position, 'z', -10.0, 50.0, 0.01)
		// objFolder.add(selectedObject.rotation, 'x', 0, Math.PI * 2)
		// objFolder.add(selectedObject.rotation, 'y', 0, Math.PI * 2)
		// objFolder.add(selectedObject.rotation, 'z', 0, Math.PI * 2)
		objFolder.add(selectedObject, 'name')
		objFolder.open()


		outlinePass.selectedObjects = [selectedObject];
		controls.target = new THREE.Vector3(...selectedObject.position);

		// const cameraFolder = gui.addFolder('Camera')
		// cameraFolder.add(camera.position, 'z', 0, 10)
		// cameraFolder.open()
	}

	// for (let i = 0; i < intersects.length; i++) {
	// 	if (intersects[i].object.geometry.type !== "PlaneGeometry")
	// 		console.log(intersects[i].object);
	// }
}

function createGUI() {
	gui = new dat.GUI();

}

function createContainer(container) {
	const geometry = new THREE.BoxGeometry(...containerSizes[container.type]);
	// const material = new THREE.MeshPhongMaterial({ color: 0xffffff, specular: 0x111111, shininess: 5 });
	// material.receiveShadow = true;
	// material.castShadow = true;
	// const material = new THREE.MeshStandardMaterial({ color: 'blue' });
	const material = new THREE.MeshNormalMaterial({ color: 'blue', wireframe: false });
	const mesh = new THREE.Mesh(geometry, material);
	mesh.position.x = container.position[0];
	mesh.position.y = ((containerSizes[container.type][1]) + ((container.floor ?? 0) * floorHeight)) / 2;
	mesh.position.z = container.position[1];
	if (container.rotation)
		mesh.rotateY(THREE.Math.degToRad(container.rotation));

	mesh.name = container.id;
	mesh.updateMatrix();
	mesh.matrixAutoUpdate = doMatrixAutoUpdate;
	scene.add(mesh);
}

function createFullStairs(stair) {
	const numOfStairs = 10;
	const stepSize = stairSize[1] / numOfStairs;
	const material = new THREE.MeshBasicMaterial({ color: 'gray', wireframe: true });
	const stairGroup = new THREE.Group();
	stairGroup.position.x = stair.position[0];
	stairGroup.position.z = stair.position[1];

	for (let i = 0; i < numOfStairs; i++) {
		const geometry = new THREE.BoxGeometry(stairSize[0], stepSize, stairSize[2] - (i * stepSize));
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.x = 0;
		mesh.position.y = ((stair.floor ?? 0) * stairSize[1]) + (i * stepSize) + (stepSize / 2);
		mesh.position.z = - (i * stepSize / 2);
		mesh.updateMatrix();
		mesh.matrixAutoUpdate = doMatrixAutoUpdate;
		stairGroup.add(mesh);
	}

	if (stair.rotation)
		stairGroup.rotateY(THREE.Math.degToRad(stair.rotation));

	scene.add(stairGroup);
}

function createStairs(stair) {
	const numOfStairs = 10;
	const stepSize = stairSize[1] / numOfStairs;
	const material = new THREE.MeshNormalMaterial({ color: 'gray', wireframe: false });
	const stairGroup = new THREE.Group();
	stairGroup.position.x = stair.position[0];
	stairGroup.position.z = stair.position[1];

	for (let i = 0; i < numOfStairs; i++) {
		const geometry = new THREE.BoxGeometry(stairSize[0], stepSize, stepSize);
		const mesh = new THREE.Mesh(geometry, material);
		mesh.position.x = 0;
		mesh.position.y = ((stair.floor ?? 0) * stairSize[1]) + (i * stepSize) + (stepSize / 2);
		mesh.position.z = - (i * stepSize);
		// mesh.updateMatrix();
		// mesh.matrixAutoUpdate = doMatrixAutoUpdate;
		stairGroup.add(mesh);
	}

	if (stair.rails) {
		const railDistance = 1.5;
		const railGroup = new THREE.Group();
		const railLength = Math.sqrt(2) * stairSize[1];
		const verticalBeamGeometry = new THREE.BoxGeometry(railWidth, railHeight, railWidth);
		const numOfVerticalBeams = Math.ceil(railLength / railDistance);
		const verticalBeamDistance = railLength / numOfVerticalBeams;

		const stairSideOffset = stair.rails === "left" ? - 1 : 1;

		for (let i = 0; i < numOfVerticalBeams; i++) {
			const verticalBeam = new THREE.Mesh(verticalBeamGeometry, material);
			verticalBeam.position.x = stairSideOffset;
			verticalBeam.position.y = (railHeight) * (i + 1);
			verticalBeam.position.z = -(i * verticalBeamDistance);
			// verticalBeam.updateMatrix();
			// verticalBeam.matrixAutoUpdate = doMatrixAutoUpdate;

			railGroup.add(verticalBeam)
		}

		const horizontalBeamGeometry = new THREE.BoxGeometry(railWidth, railWidth, railLength);
		const horizontalBeamDistance = (railHeight / 4);

		for (let i = 1; i < 5; i++) {
			const horizontalBeam = new THREE.Mesh(horizontalBeamGeometry, material);
			horizontalBeam.position.x = stairSideOffset;
			horizontalBeam.position.y = (horizontalBeamDistance * (i + 1)) + stairSize[1] / 2;
			horizontalBeam.position.z = (stairSize.length / 2) - stairSize[2];
			// horizontalBeam.position.z = -1;
			// horizontalBeam.position.y = 3;
			horizontalBeam.rotateX(Math.PI / 4)
			// horizontalBeam.updateMatrix();
			// horizontalBeam.matrixAutoUpdate = doMatrixAutoUpdate;
			railGroup.add(horizontalBeam)
		}

		railGroup.position.y = -0.4;

		stairGroup.add(railGroup);
	}

	stairGroup.rotateY(Math.PI);

	if (stair.rotation)
		stairGroup.rotateY(THREE.Math.degToRad(stair.rotation));

	scene.add(stairGroup);
}

function createCatwalk(catwalk) {
	const catwalkGroup = new THREE.Group();
	catwalkGroup.position.x = catwalk.position[0];
	catwalkGroup.position.z = catwalk.position[1];

	const material = new THREE.MeshNormalMaterial({ color: 'gray' });

	const topPartGeometry = new THREE.BoxGeometry(catwalk.size[0], catwalkHeight, catwalk.size[1]);
	const topPart = new THREE.Mesh(topPartGeometry, material);

	topPart.position.x = 0;
	topPart.position.y = floorHeight - (catwalkHeight / 2);
	topPart.position.z = 0;
	topPart.updateMatrix();
	topPart.matrixAutoUpdate = doMatrixAutoUpdate;

	catwalkGroup.add(topPart);

	// const beamXOffset = catwalk.size[0] / 2;
	// const beamYOffset = catwalk.size[1] / 2;
	// const beamPositions = [
	// 	[-beamXOffset + beamWidth, -beamYOffset + beamWidth],
	// 	[-beamXOffset + beamWidth, beamYOffset - beamWidth],
	// 	[beamXOffset - beamWidth, -beamYOffset + beamWidth],
	// 	[beamXOffset - beamWidth, beamYOffset - beamWidth]]
	// const beamGeometry = new THREE.BoxGeometry(beamWidth, floorHeight - (catwalkHeight / 2), beamWidth);
	// for (const beamPosition of beamPositions) {
	// 	const beam = new THREE.Mesh(beamGeometry, material);
	// 	beam.position.x = beamPosition[0];
	// 	beam.position.y = beamGeometry.parameters.height / 2;
	// 	beam.position.z = beamPosition[1];
	// 	catwalkGroup.add(beam);
	// }

	scene.add(catwalkGroup);
}

function createRail(rail) {
	const railGroup = new THREE.Group();

	railGroup.position.x = rail.position[0];
	railGroup.position.y = floorHeight * (rail.floor ?? 1);
	railGroup.position.z = rail.position[1];

	const material = new THREE.MeshNormalMaterial({ color: 'gray' });
	const verticalBeamGeometry = new THREE.BoxGeometry(railWidth, railHeight, railWidth);
	const numOfVerticalBeams = rail.numOfBeams ?? (Math.ceil(rail.length / defaultRailBeamDistance));
	const verticalBeamDistance = rail.length / numOfVerticalBeams;

	for (let i = 0; i <= numOfVerticalBeams; i++) {
		const verticalBeam = new THREE.Mesh(verticalBeamGeometry, material);
		verticalBeam.position.x = (i * verticalBeamDistance);
		verticalBeam.position.y = railHeight / 2;
		verticalBeam.position.z = 0;
		railGroup.add(verticalBeam)
	}

	const horizontalBeamGeometry = new THREE.BoxGeometry(rail.length, railWidth, railWidth);
	const horizontalBeamDistance = (railHeight / 4);

	for (let i = 1; i < 5; i++) {
		const horizontalBeam = new THREE.Mesh(horizontalBeamGeometry, material);
		horizontalBeam.position.x = rail.length / 2;
		horizontalBeam.position.y = horizontalBeamDistance * i;
		horizontalBeam.position.z = 0;
		railGroup.add(horizontalBeam)
	}

	if (rail.rotation)
		railGroup.rotateY(THREE.Math.degToRad(rail.rotation));

	scene.add(railGroup);
}

function createObjects() {
	for (const container of warehouse.containers) {
		createContainer(container);
	}
	for (const stair of warehouse.stairs) {
		createStairs(stair);
	}
	for (const catwalk of warehouse.catwalks) {
		createCatwalk(catwalk);
	}
	for (const rail of warehouse.rails) {
		createRail(rail);
	}
}

export function showScene() {
	init();
	//render(); // remove when using next line for animation loop (requestAnimationFrame)
	createGUI();
	createObjects();
	animate();
}

function init() {
	scene = new THREE.Scene();
	scene.background = new THREE.Color(0xcccccc);
	// scene.fog = new THREE.FogExp2(0xcccccc, 0.002);

	var axesHelper = new THREE.AxesHelper(5);
	scene.add(axesHelper);

	renderer = new THREE.WebGLRenderer();
	// renderer = new THREE.WebGLRenderer({ antialias: true });
	// renderer.setPixelRatio(window.devicePixelRatio * 1.5);
	renderer.setPixelRatio(window.devicePixelRatio * (lowQuality ? 1 : 1.5));
	renderer.setSize(window.innerWidth, window.innerHeight);
	renderer.shadowMap.enabled = true;

	document.body.appendChild(renderer.domElement);

	camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 1000);
	camera.position.set(0, 20, 0);

	createControls();
	addPostProcessing();
	addPlane();
	addLights();
}

function createControls() {
	controls = new OrbitControls(camera, renderer.domElement);
	controls.listenToKeyEvents(window); // optional
	//controls.addEventListener( 'change', render ); // call this only in static scenes (i.e., if there is no animation loop)
	controls.enableDamping = true; // an animation loop is required when either damping or auto-rotation are enabled
	controls.dampingFactor = 0.05;

	controls.screenSpacePanning = false;

	controls.minDistance = 20;
	controls.maxDistance = 500;

	controls.maxPolarAngle = Math.PI / 2;
	controls.target = new THREE.Vector3(15, 0, 15);
}

function addPostProcessing() {
	composer = new EffectComposer(renderer);

	const renderPass = new RenderPass(scene, camera);
	composer.addPass(renderPass);

	outlinePass = new OutlinePass(new THREE.Vector2(window.innerWidth, window.innerHeight), scene, camera);
	outlinePass.pulsePeriod = 3;
	outlinePass.edgeThickness = 2.5;
	outlinePass.edgeStrength = 5;
	outlinePass.edgeGlow = 2;
	// outlinePass.visibleEdgeColor = 'red';
	composer.addPass(outlinePass);

	effectFXAA = new ShaderPass(FXAAShader);
	const pixelRatio = renderer.getPixelRatio();
	effectFXAA.uniforms['resolution'].value.set(1 / (window.innerWidth * pixelRatio), 1 / (window.innerHeight * pixelRatio));
	composer.addPass(effectFXAA);
}

function addPlane() {
	var geo = new THREE.PlaneBufferGeometry(2000, 2000, 8, 8);
	var mat = new THREE.MeshBasicMaterial({ color: 'orange', side: THREE.DoubleSide });
	var plane = new THREE.Mesh(geo, mat);
	plane.rotateX(- Math.PI / 2);
	scene.add(plane);
}

function addLights() {
	// const light = new THREE.DirectionalLight(0xddffdd, 0.6);
	// light.position.set(1, 1, 1);
	// light.castShadow = true;
	// light.shadow.mapSize.width = 1024;
	// light.shadow.mapSize.height = 1024;

	// const d = 10;

	// light.shadow.camera.left = - d;
	// light.shadow.camera.right = d;
	// light.shadow.camera.top = d;
	// light.shadow.camera.bottom = - d;
	// light.shadow.camera.far = 1000;

	// scene.add(light);

	const dirLight1 = new THREE.DirectionalLight(0xffffff);
	dirLight1.position.set(1, 1, 1);
	scene.add(dirLight1);

	const dirLight2 = new THREE.DirectionalLight(0x002288);
	dirLight2.position.set(- 1, - 1, - 1);
	scene.add(dirLight2);

	const ambientLight = new THREE.AmbientLight(0x222222);
	scene.add(ambientLight);

	window.addEventListener('resize', onWindowResize);
}

function onWindowResize() {
	camera.aspect = window.innerWidth / window.innerHeight;
	camera.updateProjectionMatrix();
	renderer.setSize(window.innerWidth, window.innerHeight);
	composer.setSize(window.innerWidth, window.innerHeight);
	const pixelRatio = renderer.getPixelRatio();
	effectFXAA.uniforms['resolution'].value.set(1 / (window.innerWidth * pixelRatio), 1 / (window.innerHeight * pixelRatio));
}

function loadModel(path, scale = 1) {
	const loader = new GLTFLoader();

	loader.load(`./js/models/${path}`, function (gltf) {
		gltf.scene.scale.x = scale;
		gltf.scene.scale.y = scale;
		gltf.scene.scale.z = scale;
		scene.add(gltf.scene);

	}, undefined, function (error) {

		console.error(error);

	});
}

window.showWarehouse = () => {
	var id = prompt("Kérjük adja meg a raktárszámot!");
	console.log(scene)

	if (id) {
		for (const children of scene.children) {
			if (children.type == "Mesh" && children.name == id) {
				outlinePass.selectedObjects = [children];
				controls.target = new THREE.Vector3(...children.position);
			}
		}
	}

}
