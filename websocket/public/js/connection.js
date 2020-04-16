function Connection(url) {
  this._socket = new WebSocket(url);
  this._socket.onopen = e => {
    if (this._callbacks['connected']) this._callbacks['connected'](e);
  };
  this._socket.onclose = e => {
    if (this._callbacks['disconnected']) this._callbacks['disconnected'](e);
  };
  this._callbacks = {};
  this._socket.onmessage = e => {
    let list = JSON.parse(e.data);
    if (!Array.isArray(list)) list = [list];
    list.forEach(obj => {
      if (this._callbacks[obj.name]) this._callbacks[obj.name](obj.data);
      else throw `unrecognized message: ${e.data}`;
    });
  };
}

Connection.prototype.send = function(name, data) {
  this._socket.send(JSON.stringify({
    name: name,
    data: data
  }));
};

Connection.prototype.on = function(name, callback) {
  this._callbacks[name] = callback;
};
