
window.addEventListener("DOMContentLoaded", () => {
window.rye_cfg = {
  scaleX: 1,
  scaleY: 1,
  particle_mass: 1,
  particle_charge: 1,
  frequency: 1,
  speed_factor: 0.00001,
  delay_interval: 100, 
  charges: [],};
const canvas = document.querySelector('#container');
window.rescaleCanvas = function() {
  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  window.rye_cfg.scaleY = canvas.width / canvas.height;
}
window.addEventListener("resize", function(ev) {
  console.log("resize")
  window.rescaleCanvas()
})
window.rescaleCanvas()
let canvas_to_world = (x, y) => ({
    x: window.rye_cfg.scaleY * (x / canvas.clientWidth),
    y: 1-(window.rye_cfg.scaleX * (y / canvas.clientHeight)),
})
canvas.onclick = function(ev) {
	ev.preventDefault();
  	var rect = ev.target.getBoundingClientRect();
	let pos = canvas_to_world(ev.x - rect.left, ev.y - rect.top);
	window.worker.postMessage({
		action: "add",
		charge: {
      x: pos.x,
      y: pos.y,
			vx: 0,
			vy: 0,
			q: window.rye_cfg.particle_charge,
      m: window.rye_cfg.particle_mass,
      show: 1,
		}
	})
}
canvas.oncontextmenu = function(ev) {
  ev.preventDefault()
  // Find closest 
  var rect = ev.target.getBoundingClientRect();
  let pos = canvas_to_world(ev.x - rect.left, ev.y - rect.top);
  let arr = []
  for (q of rye_cfg.charges) {
    let r = ((q.x - pos.x) ** 2 + (q.y - pos.y) ** 2) ** 0.5
    arr.push([q, r])
  }
  arr.sort((a, b) => a[1] > b[1])
  if (arr[0] !== undefined) {
    arr[0][0].show = 1 - arr[0][0].show
    window.worker.postMessage({
      action: "change",
      charge: arr[0][0]
    })
  }
}
main();

//
// Start here
//
function main() {
  const gl = canvas.getContext('webgl');
  // If we don't have a GL context, give up now

  if (!gl) {
    alert('Unable to initialize WebGL. Your browser or machine may not support it.');
    return;
  }

  // Vertex shader program

  const vsSource = `
    attribute vec4 aVertexPosition;

    uniform mat4 uModelViewMatrix;
    uniform mat4 uProjectionMatrix;

    void main() {
      // We don't need the projection:
      //gl_Position = uProjectionMatrix * uModelViewMatrix * aVertexPosition;

      // Instead we pass through each vertex position as-is:
      gl_Position = aVertexPosition;
    }
  `;

  // Fragment shader program

  const fsSource = `
    precision mediump float;

    // Require resolution (canvas size) as an input
    uniform vec3 uResolution;

    uniform vec4 charges[64];
    uniform int charges_len;
      
    uniform float uTime;
    uniform float uStartTime;
    uniform float scaleX;
    uniform float scaleY;
    uniform float frequency;
    uniform int display_mode;

    float potential(float charge, float distance) {
      return (cos(frequency * distance) * charge) / (4. * 3.14 * distance);
    }
    float delta_potential(float charge, float x, float w) {
      return charge * (w * x * sin(w * x) + cos(w * x)) / (4. * 3.14 * x * x);
    }

    float display_linear(float p) {
      return (p);
    }
    float display_sqrt(float p) {
      return sqrt(p);
    }
    float display_log(float p) {
      return log(p + 1.);
    }

    void main() {

      // Calculate relative coordinates (uv)
      vec2 uv = gl_FragCoord.xy / uResolution.xy;
      uv.x *= scaleX;
      uv.x *= scaleY;
      float p = 0.0;
      for (int i = 0; i < 64; i++) {
        if (i >= charges_len) {
          break;
        }
        vec4 q = charges[i];
        float r = sqrt(pow(q.x - uv.x, 2.) + pow(q.y - uv.y, 2.));
        if (q.z == 0. && r < 0.005) {
          gl_FragColor = vec4(0., 0., 0., 1.0);
          return;
        }
        p += potential(q.w, r) * q.z;
      }
      float scale_p;
      if (p >= 0.) {
        scale_p = p;
      } else {
        scale_p = -p;
      }
      if (display_mode == 0) {
          scale_p = display_linear(scale_p);
      } else if (display_mode == 1)  {
          scale_p = display_sqrt(scale_p);
      } else {
          scale_p = display_log(scale_p);
      }
      if (p > 0.) {
        gl_FragColor = vec4(1.0, 1.0 - scale_p, 1.0 - scale_p, 1.0);
      } else {
        gl_FragColor = vec4(1.0 - (scale_p), 1.0 - (scale_p), 1.0, 1.0);
      }
    }
  `;  

  // Initialize a shader program; this is where all the lighting
  // for the vertices and so forth is established.
  const shaderProgram = initShaderProgram(gl, vsSource, fsSource);

  // Collect all the info needed to use the shader program.
  // Look up which attribute our shader program is using
  // for aVertexPosition and look up uniform locations.
  const programInfo = {
    program: shaderProgram,
    attribLocations: {
      vertexPosition: gl.getAttribLocation(shaderProgram, 'aVertexPosition'),
    },
    uniformLocations: {
      projectionMatrix: gl.getUniformLocation(shaderProgram, 'uProjectionMatrix'),
      modelViewMatrix: gl.getUniformLocation(shaderProgram, 'uModelViewMatrix'),
      resolution: gl.getUniformLocation(shaderProgram, 'uResolution'),
      charges: gl.getUniformLocation(shaderProgram, 'charges'),
      charges_len: gl.getUniformLocation(shaderProgram, 'charges_len'),
      scaleX: gl.getUniformLocation(shaderProgram, 'scaleX'),
      scaleY: gl.getUniformLocation(shaderProgram, 'scaleY'),
      frequency: gl.getUniformLocation(shaderProgram, 'frequency'),
      display_mode: gl.getUniformLocation(shaderProgram, 'display_mode'),
    },
  };

  // Here's where we call the routine that builds all the
  // objects we'll be drawing.
  const buffers = initBuffers(gl);

  // Draw the scene
  window.redrawScene = () => {
    drawScene(gl, programInfo, buffers)
  };
  window.redrawScene();

}

//
// initBuffers
//
// Initialize the buffers we'll need. For this demo, we just
// have one object -- a simple two-dimensional square.
//
function initBuffers(gl) {

  // Create a buffer for the square's positions.

  const positionBuffer = gl.createBuffer();

  // Select the positionBuffer as the one to apply buffer
  // operations to from here out.

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);

  // Now create an array of positions for the square.

  const positions = [
     1.0,  1.0,
    -1.0,  1.0,
     1.0, -1.0,
    -1.0, -1.0,
  ];

  // Now pass the list of positions into WebGL to build the
  // shape. We do this by creating a Float32Array from the
  // JavaScript array, then use it to fill the current buffer.

  gl.bufferData(gl.ARRAY_BUFFER,
                new Float32Array(positions),
                gl.STATIC_DRAW);

  return {
    position: positionBuffer,
  };
}

//
// Draw the scene.
//
function drawScene(gl, programInfo, buffers) {
  gl.clearColor(0.0, 0.0, 0.0, 1.0);  // Clear to black, fully opaque
  gl.clearDepth(1.0);                 // Clear everything
  gl.enable(gl.DEPTH_TEST);           // Enable depth testing
  gl.depthFunc(gl.LEQUAL);            // Near things obscure far things

  // Clear the canvas before we start drawing on it.

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  // Create a perspective matrix, a special matrix that is
  // used to simulate the distortion of perspective in a camera.
  // Our field of view is 45 degrees, with a width/height
  // ratio that matches the display size of the canvas
  // and we only want to see objects between 0.1 units
  // and 100 units away from the camera.

  const fieldOfView = 45 * Math.PI / 180;   // in radians
  const aspect = gl.canvas.clientWidth / gl.canvas.clientHeight;
  const zNear = 0.1;
  const zFar = 100.0;
  const projectionMatrix = mat4.create();


  // note: glmatrix.js always has the first argument
  // as the destination to receive the result.
  mat4.perspective(projectionMatrix,
                   fieldOfView,
                   aspect,
                   zNear,
                   zFar);

  // Set the drawing position to the "identity" point, which is
  // the center of the scene.
  const modelViewMatrix = mat4.create();

  // Now move the drawing position a bit to where we want to
  // start drawing the square.

  mat4.translate(modelViewMatrix,     // destination matrix
                 modelViewMatrix,     // matrix to translate
                 [-0.0, 0.0, -6]);  // amount to translate

  // Tell WebGL how to pull out the positions from the position
  // buffer into the vertexPosition attribute.
  {
    const numComponents = 2;
    const type = gl.FLOAT;
    const normalize = false;
    const stride = 0;
    const offset = 0;
    gl.bindBuffer(gl.ARRAY_BUFFER, buffers.position);
    gl.vertexAttribPointer(
        programInfo.attribLocations.vertexPosition,
        numComponents,
        type,
        normalize,
        stride,
        offset);
    gl.enableVertexAttribArray(
        programInfo.attribLocations.vertexPosition);
  }

  // Tell WebGL to use our program when drawing

  gl.useProgram(programInfo.program);

  // Set the shader uniforms

  gl.uniformMatrix4fv(
      programInfo.uniformLocations.projectionMatrix,
      false,
      projectionMatrix);
  gl.uniformMatrix4fv(
      programInfo.uniformLocations.modelViewMatrix,
      false,
      modelViewMatrix);

  gl.uniform3f(programInfo.uniformLocations.resolution, canvas.width, canvas.height, 1.0);  
  window.update_uniforms = () => {
    let v = [];
    for (charge of window.rye_cfg.charges) {
      v.push(charge.x);
      v.push(charge.y);
      v.push(charge.show);
      v.push(charge.q);
    }

    if (rye_cfg.charges.length != 0) {
      gl.uniform4fv(programInfo.uniformLocations.charges, 
        v,
      );  
    }
    gl.uniform1i(programInfo.uniformLocations.charges_len, window.rye_cfg.charges.length); 
    gl.uniform1f(programInfo.uniformLocations.scaleX, window.rye_cfg.scaleX); 
    gl.uniform1f(programInfo.uniformLocations.scaleY, window.rye_cfg.scaleY); 
    gl.uniform1f(programInfo.uniformLocations.frequency, window.rye_cfg.frequency); 
    gl.uniform1i(programInfo.uniformLocations.display_mode, {"linear": 0, "sqrt": 1, "log": 2}[window.rye_cfg.display_mode]); 
  };
  {
    const offset = 0;
    const vertexCount = 4;
    gl.drawArrays(gl.TRIANGLE_STRIP, offset, vertexCount);
  }
}

//
// Initialize a shader program, so WebGL knows how to draw our data
//
function initShaderProgram(gl, vsSource, fsSource) {
  const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
  const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);

  // Create the shader program

  const shaderProgram = gl.createProgram();
  gl.attachShader(shaderProgram, vertexShader);
  gl.attachShader(shaderProgram, fragmentShader);
  gl.linkProgram(shaderProgram);

  // If creating the shader program failed, alert

  if (!gl.getProgramParameter(shaderProgram, gl.LINK_STATUS)) {
    alert('Unable to initialize the shader program: ' + gl.getProgramInfoLog(shaderProgram));
    return null;
  }

  return shaderProgram;
}

//
// creates a shader of the given type, uploads the source and
// compiles it.
//
function loadShader(gl, type, source) {
  const shader = gl.createShader(type);

  // Send the source to the shader object

  gl.shaderSource(shader, source);

  // Compile the shader program

  gl.compileShader(shader);

  // See if it compiled successfully

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    alert('An error occurred compiling the shaders: ' + gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

const worker = new Worker("/js/rye_worker.js");
worker.onmessage = ((e) => {
  window.rye_cfg.charges = e.data.charges;
  window.update_uniforms()
  window.redrawScene()
  })
rye_cfg.last_time = Date.now()
let f = () => {
 let now_time = Date.now()
 let delta = now_time - rye_cfg.last_time
 rye_cfg.last_time = now_time
 worker.postMessage({ action: "tick", dt: delta * rye_cfg.speed_factor, scaleX: rye_cfg.scaleX, scaleY: rye_cfg.scaleY, frequency: rye_cfg.frequency, edge: rye_cfg.edge })
 window.setTimeout(f, rye_cfg.delay_interval)
};
window.setTimeout(f, rye_cfg.delay_interval)
window.worker = worker;

function make_f_event_listener(sel, field, calc, show) {
  if (show === undefined) {
    show = (x) => x.toExponential(2)
  }
  var f = () => {
    let value = calc(document.querySelector("#" + sel))
    console.log(value)
    document.querySelector("#" + sel + "-val").innerText = show(value);
    rye_cfg[field] = value;
  }
  f()

  document.querySelector("#" + sel).addEventListener("input", f)
}
make_f_event_listener("particle-charge", "particle_charge", (x) => parseFloat(x.value))
make_f_event_listener("particle-mass", "particle_mass", (x) => Math.exp(parseFloat(x.value)))
make_f_event_listener("frequency", "frequency", (x) => parseFloat(x.value))
make_f_event_listener("delay-interval", "delay_interval", (x) => Math.exp(x.value))
make_f_event_listener("speed-factor", "speed_factor", (x) => Math.exp(x.value))
make_f_event_listener("display-mode", "display_mode", (x) => x.value, (x) => x)
make_f_event_listener("edge-mode", "edge", (x) => x.checked, (x) => x)
})