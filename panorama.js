/**
 *    360 panorama viewer for stills and video, either equirectangular (2:1)
 *    or raw 360fly fisheye (square, 360x240 degrees).
 *    2016-2026 Anne Jan Brouwer
 *
 *    Based on code from https://gist.github.com/bellbind/d2be9cc09bf6241f255d
 *    With some shader stuff from http://stackoverflow.com/a/21742418/395588
 *
 *    Query parameters:
 *      src=<name>        media base name (default "dak-raw"), or a full file
 *                        name such as "sitting.webm" or "standing.jpg"
 *      type=video|image  what <name> refers to (default "video")
 *      mode=raw|equirect raw 360fly fisheye (default) or equirectangular
 *      vr=1              start in side-by-side cardboard mode
 */

import * as THREE from "three";
import { StereoEffect } from "three/addons/effects/StereoEffect.js";

// [configuration]
const params = new URLSearchParams(location.search);
const src = params.get("src") || "dak-raw";
const ext = (src.match(/\.(\w+)$/) || [])[1]?.toLowerCase();
const isVideo = ext
	? ["mp4", "webm", "ogv", "mov", "m4v"].includes(ext)
	: (params.get("type") || "video") !== "image";
const raw = (params.get("mode") || "raw") !== "equirect";
let cardboard = params.get("vr") === "1";

// [shaders for raw 360fly footage]
const vertexShader = /* glsl */ `
	varying vec3 vNormal;
	void main() {
		vNormal = normal;
		gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
	}
`;

// "texture" is a reserved function name in GLSL ES 3.0, so the sampler is
// called "map" nowadays.
const fragmentShader = /* glsl */ `
	uniform sampler2D map;
	varying vec3 vNormal;
	void main() {
		vec3 abNormal = vNormal;
		abNormal.y += .666; // weird way of scaling
		abNormal.x = -abNormal.x; // flip x
		vec2 uv = normalize( abNormal ).zx * 0.5 + 0.5; // rotate texture
		vec3 color = texture2D( map, uv ).rgb; // map color
		if ( vNormal.y < - .666 ) color = vec3( .13, .37, 1.0 + vNormal.y ); // bottom deadzone
		gl_FragColor = vec4( color, 1.0 );
	}
`;

const $ = (id) => document.getElementById(id);
const view = $("container");
const status = $("status");
const say = (msg) => { status.textContent = msg || ""; };

// [prepare screen]
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
view.appendChild(renderer.domElement);
const effect = new StereoEffect(renderer);

// [prepare camera]
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 1, 1000);
camera.lookAt(0, 0, -1);

window.addEventListener("resize", () => {
	const w = window.innerWidth, h = window.innerHeight;
	camera.aspect = w / h;
	camera.updateProjectionMatrix();
	renderer.setSize(w, h);
});

// [camera rotation by pointer: mouse, touch or pen]
let lon = 0;
let lat = 0;
let gyroActive = false;
const euler = new THREE.Euler();
const Y_AXIS = new THREE.Vector3(0, 1, 0);

const applyPointerRotation = () => {
	if (gyroActive) return; // gyro drives the camera, drag only adds yaw
	camera.quaternion.setFromEuler(euler.set(lat, lon, 0, "YXZ"));
};

const onPointerMove = (ev) => {
	const scale = 0.0035 * (camera.fov / 75);
	lat = Math.min(Math.max(-Math.PI / 2, lat - ev.movementY * scale), Math.PI / 2);
	lon -= ev.movementX * scale;
	applyPointerRotation();
};
view.addEventListener("pointerdown", (ev) => {
	view.setPointerCapture(ev.pointerId);
	view.addEventListener("pointermove", onPointerMove);
});
const stopDrag = (ev) => {
	view.removeEventListener("pointermove", onPointerMove);
	if (view.hasPointerCapture(ev.pointerId)) view.releasePointerCapture(ev.pointerId);
};
view.addEventListener("pointerup", stopDrag);
view.addEventListener("pointercancel", stopDrag);

// [zoom with the mouse wheel]
view.addEventListener("wheel", (ev) => {
	ev.preventDefault();
	camera.fov = Math.min(Math.max(30, camera.fov + ev.deltaY * 0.05), 110);
	camera.updateProjectionMatrix();
}, { passive: false });

// [camera rotation by the device orientation sensors on phones and tablets]
// see: https://developer.mozilla.org/docs/Web/API/Device_orientation_events
const eyem = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));
const d2r = Math.PI / 180;
const getOrientation = () => {
	if (screen.orientation) return screen.orientation.angle;
	if (typeof window.orientation === "number") return window.orientation; // old iOS
	return 0;
};
const rotm = new THREE.Quaternion();
const devm = new THREE.Quaternion();
const yawm = new THREE.Quaternion();
const gyroSensor = (ev) => {
	const alpha = ev.alpha || 0;
	const beta = ev.beta || 0;
	const gamma = ev.gamma || 0;
	if (alpha === 0 && beta === 0 && gamma === 0) return;
	gyroActive = true;
	const angle = getOrientation();

	// device rot axis order Z-X-Y as alpha, beta, gamma
	// portrait mode Z=rear->front(screen), X=left->right, Y=near->far(cam)
	// => map Z-X-Y to 3D world axes as:
	// - portrait  => y-x-z
	// - landscape => y-z-x
	const rotType = (angle === 0 || angle === 180) ? "YXZ" : "YZX";
	rotm.setFromEuler(euler.set(beta * d2r, alpha * d2r, -gamma * d2r, rotType));
	devm.setFromEuler(euler.set(0, -angle * d2r, 0));
	rotm.multiply(devm).multiply(eyem); // rot = (rot x dev) x eye
	yawm.setFromAxisAngle(Y_AXIS, lon); // let dragging turn you around while using the gyro
	camera.quaternion.copy(yawm.multiply(rotm));
};

const enableMotion = async () => {
	// iOS 13+ needs an explicit permission request from a user gesture
	if (typeof DeviceOrientationEvent?.requestPermission === "function") {
		try {
			if (await DeviceOrientationEvent.requestPermission() !== "granted") {
				say("Motion access denied");
				return;
			}
		} catch (err) {
			say("Motion access denied");
			return;
		}
	}
	window.addEventListener("deviceorientation", gyroSensor);
	$("motion").hidden = true;
};
if (typeof DeviceOrientationEvent?.requestPermission === "function") {
	$("motion").hidden = false;
	$("motion").addEventListener("click", enableMotion);
} else if ("DeviceOrientationEvent" in window) {
	enableMotion();
}

// [panorama texture]
let tex;
const video = $("video");
const img = $("img");
if (isVideo) {
	const sources = ext ? [src] : [`${src}.mp4`, `${src}.webm`];
	for (const file of sources) {
		const source = document.createElement("source");
		source.src = file;
		source.type = `video/${file.split(".").pop().replace("ogv", "ogg")}`;
		video.appendChild(source);
	}
	// A failing <source> fires "error" on that element and the browser moves
	// on to the next one, so only complain once no source is left.
	video.addEventListener("error", () => setTimeout(() => {
		if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
			say(`Could not load ${sources.join(" / ")}`);
		}
	}), true);
	tex = new THREE.VideoTexture(video);
	tex.minFilter = THREE.LinearFilter;
	tex.generateMipmaps = false;
	const playVideo = async () => {
		try {
			await video.play();
			$("play").hidden = true;
			say("");
		} catch (err) {
			if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) {
				say(`Playback failed: ${err.message}`);
			} else {
				// still picking a source or buffering, try again when playable
				say("Loading…");
				video.addEventListener("canplay", playVideo, { once: true });
			}
		}
	};
	$("play").addEventListener("click", playVideo);
	video.addEventListener("play", () => { $("play").hidden = true; });
	video.addEventListener("pause", () => { $("play").hidden = false; });
} else {
	$("play").hidden = true;
	img.src = ext ? src : `${src}.jpg`;
	tex = new THREE.Texture(img);
	if (img.complete && img.naturalWidth) tex.needsUpdate = true;
	img.addEventListener("load", () => { tex.needsUpdate = true; });
	img.addEventListener("error", () => say(`Could not load ${img.src}`));
}

// [material]
let mat;
if (raw) {
	// Raw 360fly footage goes through our own shader, which passes the sampled
	// values straight to the screen, so the texture stays in its native color
	// space and no decode/encode round trip happens (same look as before).
	mat = new THREE.ShaderMaterial({
		uniforms: { map: { value: tex } },
		vertexShader,
		fragmentShader,
	});
} else {
	tex.colorSpace = THREE.SRGBColorSpace;
	mat = new THREE.MeshBasicMaterial({ map: tex });
}

// [panorama space matched with the style of the panorama image]
const geom = new THREE.SphereGeometry(500, 64, 64); // sphere type 64 splines
//const geom = new THREE.SphereGeometry(500, 64, 32, 0, 2 * Math.PI, 0, 0.5 * Math.PI); // dome type
//const geom = new THREE.CylinderGeometry(500, 500, 500, 64); // tube type
geom.scale(1, 1, -1); // surface inside
const scene = new THREE.Scene();
scene.add(new THREE.Mesh(geom, mat));

// [fullscreen and cardboard]
const docEl = document.documentElement;
const requestFullscreen = docEl.requestFullscreen || docEl.webkitRequestFullscreen;
if (requestFullscreen) {
	$("fullscreen").addEventListener("click", async () => {
		try {
			await requestFullscreen.call(docEl);
			await screen.orientation?.lock?.("landscape").catch(() => {});
		} catch (err) {
			say(`Fullscreen failed: ${err.message}`);
		}
	});
	document.addEventListener("fullscreenchange", () => {
		$("fullscreen").hidden = !!document.fullscreenElement;
	});
} else {
	$("fullscreen").hidden = true; // iPhone Safari has no fullscreen for pages
}

const setCardboard = (on) => {
	cardboard = on;
	$("vr").textContent = on ? "Exit cardboard" : "Cardboard (side by side)";
	renderer.setScissorTest(false);
	renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
};
$("vr").addEventListener("click", () => setCardboard(!cardboard));
setCardboard(cardboard);

// [play animation]
renderer.setAnimationLoop(() => {
	if (cardboard) {
		effect.render(scene, camera);
	} else {
		renderer.render(scene, camera);
	}
});
