var core = {};

core.lastUpdate = null;
core.deltaAccumulator = 0;
core.lastFrame = null;
core.thisFrame = null;
core.frameTime = null;
core.pads = null;
core.padIndex = null;

core.redraw = function() {
  var canvas = core.canvas;
  var context = core.context;

  var w = canvas.width;
  var h = canvas.height;

  context.fillStyle = "#000000";
  context.fillRect(0, 0, w, h);

  core.updateGamepads();
  core.updateFPS();
};

core.step = function() {

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
    var step_ticks = 20;
    while (delta > step_ticks) {
      did_step = true;

      core.step();

      delta -= 20;
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
      core.input.buttons[14],
      core.input.buttons[12],
      core.input.buttons[11],
      core.input.buttons[13],
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
  context.lineWidth = 2;
  context.fillRect(x - (bar_w/2), rect_y, bar_w, rect_h);
  context.strokeRect(x - (bar_w/2), y - bar_h, bar_w, bar_h * 2);

  // if (core.padIndex !== null && ii == core.padIndex) {
  //   context.strokeStyle = 'rgba(255, 255, 255, 1)';
  // } else {
  //   context.strokeStyle = 'rgba(40, 40, 40, 0.90)';
  // }


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
    core.input.axes[ii] = pad.axes[ii] || 0;
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
  }
};

window.onresize = function() {
  var canvas = core.canvas;

  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

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




  window.onresize();
};

