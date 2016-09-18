var core = {};

core.lastUpdate = null;
core.deltaAccumulator = 0;
core.lastFrame = null;
core.thisFrame = null;
core.frameTime = null;
core.pads = null;
core.padIndex = null;
core.rawAcceleration = 0;
core.rawVelocity = 0;
core.rawWork = 0;
core.sessionWork = 0;
core.friction = 0.998;
core.ups = 50;

core.stars = [];

core.redraw = function() {
  var canvas = core.canvas;
  var context = core.context;

  var w = canvas.width;
  var h = canvas.height;

  context.fillStyle = "#000000";
  context.fillRect(0, 0, w, h);

  context.lineWidth = 1;
  var forward = (core.rawVelocity > 0);
  for (var ii = 0; ii < core.stars.length; ii++) {
    var star = core.stars[ii];

    var size = core.rawVelocity * star.z * 3;
    if (forward) {
      size = Math.max(1, size);
    } else {
      size = Math.min(-1, size);
    }

    context.strokeStyle = 'rgba(255, 255, 255, ' + star.z + ')';
    context.beginPath();
    context.moveTo(star.x, star.y);
    context.lineTo(star.x, star.y + size);
    context.closePath();
    context.stroke();
  }

  core.updateGamepads();
  core.updateFPS();
};

core.step = function() {
  var canvas = core.canvas;
  var context = core.context;

  var w = canvas.width;
  var h = canvas.height;

  if (core.padIndex === null) {
    return;
  }

  core.rawAcceleration = 3 * (core.input.axes[1] / core.ups);
  core.rawWork += Math.abs(core.rawAcceleration);
  core.sessionWork += Math.abs(core.rawAcceleration);
  core.rawVelocity += core.rawAcceleration;
  core.rawVelocity = core.rawVelocity * core.friction;

  while (core.stars.length < 32) {
    core.stars.push(
      {
        x: Math.random() * w,
        y: Math.random() * h,
        z: Math.random()
      });
  }

  var forward = (core.rawVelocity > 0);
  for (var ii = 0; ii < core.stars.length; ii++) {
    core.stars[ii].y += (core.rawVelocity * core.stars[ii].z);
    if (forward && core.stars[ii].y > h) {
      core.stars[ii].y -= h;
    }
    if (!forward && core.stars[ii].y < 0) {
      core.stars[ii].y += h;
    }
  }

};

core.update = function(step) {
  var should_redraw = false;
  var ii;

  if (!step) {
    should_redraw = true;
  } else {
    if (core.lastUpdate === null) {
      core.lastUpdate = step;
    }

    var delta = (step - core.lastUpdate) + core.deltaAccumulator;
    core.lastUpdate = step;

    core.pads = (navigator.getGamepads && navigator.getGamepads()) || [];

    core.padIndex = null;
    for (ii = 0; ii < core.pads.length; ii++) {
      if (core.padIndex === null) {
        core.padIndex = ii;
      }
      if (core.pads[ii].id.match('/vJoy/')) {
        core.padIndex = ii;
        break;
      }
    }

    core.readInput();

    var did_step = false;
    var step_ticks = (1000 / core.ups);
    while (delta > step_ticks) {
      did_step = true;

      core.step();

      delta -= step_ticks;
    }

    core.deltaAccumulator = delta;
  }

  if (did_step) {
    core.lastFrame = core.thisFrame;
    core.thisFrame = step;

    should_redraw = true;
  }

  if (should_redraw) {
    core.redraw();
  }

  window.requestAnimationFrame(core.update);
};

core.updateGamepads = function() {
  var canvas = core.canvas;
  var context = core.context;

  var w = canvas.width;
  var h = canvas.height;

  var pads = core.pads || [];

  if (!pads.length) {
    context.font = '11px Verdana';
    context.fillStyle = 'rgba(255, 0, 255, 0.8)';
    context.fillText('Press pad buttons to activate controls.', 10, h - 12);
    return;
  }

  var margin = 16;
  var spacing = 16;
  var pad_x = 40;
  var pad_y = 32;

  for (var ii = 0; ii < pads.length; ii++) {
    var draw_x = (margin + ((spacing + pad_x) * ii));
    var draw_y = h - (margin + pad_y);

    context.fillStyle = 'rgba(20, 20, 20, 0.70)';
    context.fillRect(draw_x, draw_y, pad_x, pad_y);

    if (core.padIndex !== null && ii == core.padIndex) {
      context.strokeStyle = 'rgba(255, 255, 255, 1)';
    } else {
      context.strokeStyle = 'rgba(40, 40, 40, 0.90)';
    }

    context.lineWidth = 2;
    context.strokeRect(draw_x, draw_y, pad_x, pad_y);
  }

  core.drawGamepadCluster(
    48,
    80,
    [
      core.input.buttons[14] || core.input.buttons[4],
      core.input.buttons[12] || core.input.buttons[7],
      core.input.buttons[11] || core.input.buttons[5],
      core.input.buttons[13] || core.input.buttons[6],
      (core.input.axes[5] > 0.5)
    ]);

  core.drawGamepadCluster(
    128,
    80,
    [
      core.input.buttons[0],
      core.input.buttons[3],
      core.input.buttons[1],
      core.input.buttons[2],
      (core.input.axes[2] > 0.5)
    ]);

  core.drawGamepadAxis(
    192,
    64,
    core.input.axes[1]);

  core.drawGamepadAxis(
    224,
    64,
    core.input.axes[0]);

};

core.drawGamepadCluster = function(stick_x, stick_y, pressed) {
  var canvas = core.canvas;
  var context = core.context;

  var w = canvas.width;
  var h = canvas.height;

  var r = 20;

  var x = (w - stick_x);
  var y = (h - stick_y);

  core.drawGamepadButton(x + 0, y - r, pressed[0]);
  core.drawGamepadButton(x + r, y + 0, pressed[1]);
  core.drawGamepadButton(x + 0, y + r, pressed[2]);
  core.drawGamepadButton(x - r, y + 0, pressed[3]);
  core.drawGamepadButton(x + 0, y + (2.5 * r), pressed[4]);
};

core.drawGamepadButton = function(x, y, pressed) {
  var canvas = core.canvas;
  var context = core.context;

  if (pressed) {
    context.fillStyle = 'rgba(40, 255, 40, 0.5)';
    context.strokeStyle = 'rgba(80, 255, 80, 0.5)';
  } else {
    context.fillStyle = 'rgba(40, 40, 40, 0.5)';
    context.strokeStyle = 'rgba(80, 80, 80, 0.5)';
  }

  context.beginPath();
  context.arc(x, y, 8, 0, 2 * Math.PI, true);
  context.stroke();
  context.fill();
};

core.drawGamepadAxis = function(axis_x, axis_y, value) {
  var canvas = core.canvas;
  var context = core.context;

  var w = canvas.width;
  var h = canvas.height;

  var bar_w = 16;
  var bar_h = 40;

  var x = (w - axis_x);
  var y = (h - axis_y);

  if (value > 0) {
    var rect_y = y - (value * bar_h);
    var rect_h = (value * bar_h);
  } else {
    var rect_y = y;
    var rect_h = -(value * bar_h);
  }

  context.fillStyle = 'rgba(255, 255, 255, 1)';
  context.strokeStyle = 'rgba(80, 80, 80, 0.5)';
  context.fillRect(x - (bar_w/2), rect_y, bar_w, rect_h);
  context.lineWidth = 2;
  context.strokeRect(x - (bar_w/2), y - bar_h, bar_w, bar_h * 2);

};

core.readInput = function() {
  var ii;

  core.input = {
    buttons: [],
    axes: []
  };

  if (core.padIndex === null) {
    return;
  }

  var pad = core.pads[core.padIndex];
  for (ii = 0; ii < 16; ii++) {
    var button = pad.buttons[ii];
    if (!button) {
      core.input.buttons[ii] = false;
    } else {
      core.input.buttons[ii] = !!button.pressed;
    }
  }

  for (ii = 0; ii < 8; ii++) {
    var value = pad.axes[ii] || 0;

    if (Math.abs(value) < 0.1) {
      value = 0;
    }

    core.input.axes[ii] = value;
  }

};

core.updateFPS = function() {
  if (!core.lastFrame) {
    return;
  }

  var frametime = (core.thisFrame - core.lastFrame);
  if (core.frameTime === null) {
    core.frameTime = frametime;
  } else {
    core.frameTime = (0.95 * core.frameTime) + (0.05 * frametime);
  }

  if (core.frameTime) {
    var fps = Math.round(1000 / core.frameTime);
    var context = core.context;

    context.font = '11px Verdana';
    context.fillStyle = 'rgba(255, 255, 255, 0.66)';
    context.fillText(fps + ' FPS', 10, 24);

    var life_work = parseInt(core.rawWork, 10);
    var local_work = parseInt(core.sessionWork, 10)
    context.fillText(life_work + ' Lifetime Work', 10, 40);
    context.fillText(local_work + ' Session Work', 10, 56);

    var raw_velocity = parseInt(core.rawVelocity);
    context.fillText(raw_velocity + ' Raw Velocity', 10, 72);
  }
};

window.onresize = function() {
  var canvas = core.canvas;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  core.stars = [];

  core.update();
};

window.onload = function() {
  core.canvas = document.getElementById('canvas');
  core.context = (function() {
    var attributes = {
      alpha: false
    };

    var context = core.canvas.getContext('2d', attributes);
    return context;
  })();

  var saved;
  try {
    saved = JSON.parse(localStorage.getItem('saved-game')) || {};
  } catch (exception) {
    saved = {};
  }

  core.rawWork = saved.rawWork || 0;

  setInterval(core.save, 1000);

  window.onresize();
};

core.save = function() {
  var data = {
    rawWork: core.rawWork
  };

  localStorage.setItem('saved-game', JSON.stringify(data));
};