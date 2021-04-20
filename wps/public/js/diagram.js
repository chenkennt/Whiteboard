var Diagram = function (element, tools) {
  var id;
  var shapes = {};
  var past = [], future = [];
  var timestamp = 0;
  var buffer = [];
  var background;
  var scale = 1;
  var offset = [0, 0];

  var shapeUpdateCallback = shapePatchCallback = shapeRemoveCallback = clearCallback = historyChangeCallback = () => { };

  function generateId() {
    return Math.floor((1 + Math.random()) * 0x100000000).toString(16).substring(1);
  }

  function tryNotify(c) {
    var t = new Date().getTime();
    if (t - timestamp < 250) return;
    c();
    timestamp = t;
  }

  function historyChange() {
    historyChangeCallback(past.length > 0, future.length > 0);
  }

  function applyStyle(e, c, w) {
    return e.fill('none').stroke({ color: c, width: w, linecap: 'round' });
  }

  function translate(x, y) {
    return [offset[0] + x / scale , offset[1] + y / scale];
  }

  function startShape(k, c, w, x, y) {
    if (id) return;
    id = generateId();
    [x, y] = translate(x, y);
    var m = { kind: k, color: c, width: w, data: tools[k].start(x, y) };
    shapes[id] = { view: applyStyle(tools[k].draw(element, m.data), c, w), model: m };
    future = [];
    past.push(id);
    historyChange();
    shapeUpdateCallback(id, m);
  }

  function drawShape(x, y) {
    if (!id) return;
    [x, y] = translate(x, y);
    var s = shapes[id];
    var t = tools[s.model.kind];
    var d = t.move(x, y, s.model.data);
    t.update(s.view, s.model.data);
    if (d) {
      buffer = buffer.concat(d);
      tryNotify(() => {
        shapePatchCallback(id, buffer);
        buffer = [];
      });
    } else tryNotify(() => shapeUpdateCallback(id, s.model));
  }

  function endShape() {
    if (!id) return;
    if (buffer.length > 0) {
      shapePatchCallback(id, buffer);
      buffer = [];
    } else shapeUpdateCallback(id, shapes[id].model);
    id = null;
  }

  function updateShape(i, m) {
    if (shapes[i]) tools[m.kind].update(shapes[i].view, shapes[i].model.data = m.data);
    else shapes[i] = { view: applyStyle(tools[m.kind].draw(element, m.data), m.color, m.width), model: m };
  }

  function patchShape(i, d) {
    if (shapes[i]) tools[shapes[i].model.kind].update(shapes[i].view, shapes[i].model.data = shapes[i].model.data.concat(d));
  }

  function removeShape(i) {
    if (!shapes[i]) return;
    shapes[i].view.remove();
    delete shapes[i];
  }

  function clear() {
    removeAll();
    clearCallback();
  }

  function removeAll() {
    id = null;
    shapes = {};
    past = [], future = [];
    timestamp = 0;
    buffer = [];
    background = null;
    element.clear();
    historyChange();
  }

  function updateBackground(file) {
    if (background) background.remove();
    background = element.image(file).back();
  }

  function resizeViewbox(w, h) {
    var v = element.viewbox();
    element.viewbox(v.x, v.y, w / scale, h / scale);
  }

  function pan(dx, dy) {
    var v = element.viewbox();
    offset = [v.x + dx / scale, v.y + dy / scale];
    element.viewbox(offset[0], offset[1], v.width, v.height);
  }

  function zoom(r) {
    scale *= r;
    var v = element.viewbox();
    element.viewbox(v.x, v.y, v.width / r, v.height / r);
  }

  function undo() {
    var i = past.pop();
    if (!i) return;
    future.push(shapes[i].model);
    removeShape(i);
    shapeRemoveCallback(i);
    historyChange();
  }

  function redo() {
    var m = future.pop();
    if (!m) return;
    var i = generateId();
    updateShape(i, m);
    shapeUpdateCallback(i, m);
    past.push(i);
    historyChange();
  }

  return {
    startShape: startShape,
    drawShape: drawShape,
    endShape: endShape,
    updateShape: updateShape,
    patchShape: patchShape,
    removeShape: removeShape,
    clear: clear,
    removeAll: removeAll,
    updateBackground: updateBackground,
    resizeViewbox: resizeViewbox,
    pan: pan,
    zoom: zoom,
    undo: undo,
    redo: redo,
    onShapeUpdate: c => shapeUpdateCallback = c,
    onShapeRemove: c => shapeRemoveCallback = c,
    onShapePatch: c => shapePatchCallback = c,
    onClear: c => clearCallback = c,
    onHistoryChange: c => historyChangeCallback = c
  };
};
