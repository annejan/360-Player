/**
 *    360 panorama viewer for stills and video in either postprocessed (2:1) or square circle 360*240°
 *    2016 Anne Jan Brouwer
 *
 *    Based on code from https://gist.github.com/bellbind/d2be9cc09bf6241f255d
 *    With some shader stuff from http://stackoverflow.com/a/21742418/395588
 */

//[sphere panorama control]
window.addEventListener("load", function () {
    "use strict";
    var w = window.innerWidth, h = window.innerHeight;
    //[prepare screen]
    var renderer = new THREE.WebGLRenderer();
    renderer.setSize(w, h);
    var view = document.getElementById("container");
    view.appendChild(renderer.domElement);
    
    //[prepare camera]
    var camera = new THREE.PerspectiveCamera(75, w / h, 1, 1000);
    camera.position.set(0, 0, 0);
    camera.up.set(0, 1, 0);
    camera.lookAt(new THREE.Vector3(0, 0, -1));
    
    // [camera rotation by mouse]
    var lon = 0;
    var lat = 0;
    var gyroMouse = function (ev) {
        var mx = ev.movementX || ev.mozMovementX || ev.webkitMovementX || 0;
        var my = ev.movementY || ev.mozMovementY || ev.webkitMovementY || 0;
        lat = Math.min(Math.max(-Math.PI / 2, lat - my * 0.01), Math.PI / 2);
        lon = lon - mx * 0.01;
        
        var rotm = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(lat, lon, 0, "YXZ"));
        camera.quaternion.copy(rotm);
    };
    view.addEventListener("mousedown", function (ev) {
        view.addEventListener("mousemove", gyroMouse, false);
    }, false);
    view.addEventListener("mouseup", function (ev) {
        view.removeEventListener("mousemove", gyroMouse, false);
    }, false);
    
    // [camera rotation by direct gyro sensor angles on tablets]
    // see: http://mdn.io/Detecting_device_orientation
    // (work on android firefox and iOS Safari)
    var eyem = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-Math.PI / 2, 0, 0));
    var d2r = Math.PI / 180;
    var getOrientation = function () {
        // W3C DeviceOrientation Event Specification (Draft)
        if (window.screen.orientation) return window.screen.orientation.angle;
        // Safari
        if (typeof window.orientation === "number") return window.orientation;
        // workaround for android firefox
        if (window.screen.mozOrientation) return {
            "portrait-primary": 0,
            "portrait-secondary": 180,
            "landscape-primary": 90,
            "landscape-secondary": 270,
        }[window.screen.mozOrientation];
        // otherwise
        return 0;
    };
    var gyroSensor = function (ev) {
        ev.preventDefault();
        var angle = getOrientation();
        var alpha = ev.alpha || 0;
        var beta = ev.beta || 0;
        var gamma = ev.gamma || 0;
        if (alpha === 0 && beta === 0 && gamma === 0) return;
    //    document.getElementById("log").innerHTML = "g=" + ev.gamma + 
    //        ", b=" + ev.beta + ", a=" + ev.alpha + ", o=" + angle;
        // on android chrome: bug as beta may become NaN
        
        // device rot axis order Z-X-Y as alpha, beta, gamma
        // portrait mode Z=rear->front(screen), X=left->right, Y=near->far(cam)
        // => map Z-X-Y to 3D world axes as:
        // - portrait  => y-x-z
        // - landscape => y-z-x
        var rotType = (angle === 0 || angle === 180) ? "YXZ" : "YZX";
        var rotm = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(beta * d2r, alpha * d2r, -gamma * d2r, rotType));
        var devm = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, -angle * d2r, 0));
        rotm.multiply(devm).multiply(eyem); //rot = (rot x dev) x eye
        camera.quaternion.copy(rotm);
    };
    window.addEventListener("deviceorientation", gyroSensor, false);
   
    if (video) { 
        //[panorama video texture]
        video = document.getElementById( 'video' );
//        video.autoplay = true;
//        video.width = 1024;
//        video.height = 1024;
        video.loop = true;
        video.preload = "auto";
        var tex = new THREE.VideoTexture( video );
        tex.minFilter = THREE.LinearFilter; 
    } else {
    //[panorama image texture]
        var img = document.getElementById("img");
        var tex = new THREE.Texture(img);
        img.addEventListener("load", function () {
            tex.needsUpdate = true;
        }, false);
    }

    if (raw) { 
        // for raw 360fly images
        var uniforms = {
            "texture": { type: "t", value: tex }	
        };

        // material
        var mat = new THREE.ShaderMaterial( {
            uniforms		: uniforms,
            vertexShader	: document.getElementById( 'vertex_shader' ).textContent,
            fragmentShader	: document.getElementById( 'fragment_shader' ).textContent
        } );
    } else {
        var mat = new THREE.MeshBasicMaterial({map: tex});
    }

    //[panorama space matched with the style of panorama image]
    var geom = new THREE.SphereGeometry(500, 64, 64); // sphere type 64 splines
    //var geom = new THREE.SphereGeometry(
    //    500, 64, 32, 0, 2*Math.PI, 0, 0.5*Math.PI); // dome type
    //var geom = new THREE.CylinderGeometry(500, 500, 500, 64); // tube type
    geom.applyMatrix(new THREE.Matrix4().makeScale(1, 1, -1)); //surface inside
    var obj = new THREE.Mesh(geom, mat);
    
    //[create scene]
    scene = new THREE.Scene();
    scene.add(obj);
    
    //[play animation]
    var loop = function loop() {
        requestAnimationFrame(loop);
        renderer.clear();
        renderer.render(scene, camera);
    };
    loop();
}, false);
