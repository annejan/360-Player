# 360-Player

HTML5 360° still and video player, built on [three.js](https://threejs.org/) (r186).

Plays equirectangular (2:1) panoramas as well as raw, unprocessed footage from
a 360fly camera (square fisheye, 360×240°) straight from the camera, without
any post-processing. Works with mouse, touch, device orientation sensors and
Google Cardboard style side-by-side viewers.

## Running

It is a static page with ES modules, so serve the directory over HTTP (modules
do not load from `file://`):

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

Device orientation and fullscreen need a secure context (`https://` or
`localhost`) on current phones.

## Usage

Everything is configured through query parameters:

| Parameter | Values               | Default   | Meaning                                                          |
|-----------|----------------------|-----------|------------------------------------------------------------------|
| `src`     | base name or file    | `dak-raw` | `name` loads `name.mp4` + `name.webm` (or `name.jpg` for images) |
| `type`    | `video`, `image`     | `video`   | what `src` refers to when it has no extension                    |
| `mode`    | `raw`, `equirect`, `cylinder` | `raw` | raw 360fly fisheye, equirectangular, or a cylinder for planar panoramas |
| `vr`      | `1`                  | off       | start in side-by-side cardboard mode                             |

Examples:

- `index.html` – the raw 360fly rooftop video
- `index.html?src=sitting-low` – a smaller video
- `index.html?src=standing&type=image` – a still
- `index.html?src=pano.jpg&mode=equirect` – an equirectangular still
- `index.html?src=panoramas/kerk.jpg&mode=cylinder` – a planar panorama strip

## Cylinder mode

Planar panoramas are wide strips (5:1 up to 15:1) that go all the way round
but not up and down. `mode=cylinder` wraps them round a cylinder as high as
the strip is, so nothing is stretched, and keeps the view inside the strip:
you look up and down and zoom only as far as the picture goes.

## Gallery

`gallery.html` lists the videos and the panoramas in `panoramas/` (planar
panoramas from hacker camps and congresses: CCC 2011, OHM2013, X2012 and
more), with thumbnails in `thumbs/`. The panoramas are scaled to at most 8192
pixels wide, the largest texture most phones take.

## Controls

- Video **starts automatically, muted** (that is all browsers allow without a
  tap). **Unmute** appears when the clip has sound; **Play** appears only if
  the browser blocked autoplay.
- **Drag** (mouse, touch or pen) to look around, **scroll** to zoom.
- **Motion control** follows the phone's orientation. iOS asks for permission
  the first time; tap *Enable motion control*. Dragging still turns you around
  while the gyro is active.
- **Fullscreen** goes fullscreen and tries to lock to landscape.
- **Cardboard** renders side by side for Cardboard style viewers.

## Development

No build step. `vendor/three/` holds an unmodified copy of the three.js module
build and the `StereoEffect` addon; to upgrade, copy `build/three.module.js`,
`build/three.core.js` and `examples/jsm/effects/StereoEffect.js` from a newer
`three` npm package.

## Credits

Based on code from [bellbind](https://gist.github.com/bellbind/d2be9cc09bf6241f255d),
with shader ideas from [this Stack Overflow answer](http://stackoverflow.com/a/21742418/395588).

MIT licensed, see [LICENSE](LICENSE). three.js is MIT licensed, see
[vendor/three/LICENSE](vendor/three/LICENSE).
