const jwt = require('jsonwebtoken');
const axios = require('axios');

function parseConnectionString(connString) {
  const pattern = /^Endpoint=(.*);AccessKey=(.*);Version=1.0;$/;
  let matches = pattern.exec(connString);
  return {
    endpoint: matches[1],
    accessKey: matches[2]
  };
}

function generateToken(url, key) {
  return "Bearer " + jwt.sign({}, key, {
    audience: url,
    expiresIn: "1h",
    algorithm: "HS256"
  });
}

async function invokeService(connectionInfo, method, path, name, data) {
  console.log(`${method} ${path}`);
  let url = `${connectionInfo.endpoint}/ws/api/v1/${path}`;
  let headers = {
    'Authorization': generateToken(url, connectionInfo.accessKey)
  };
  let payload = null;
  if (name) {
    headers['Content-Type'] = 'text/plain';
    payload = JSON.stringify({
      name: name,
      data: data
    });
  }
  try {
    let res;
    switch (method) {
      case 'post': res = await axios.post(url, payload, { headers: headers }); break;
      case 'put': res = await axios.put(url, payload, { headers: headers }); break;
    }
    console.log(res.status);
  } catch (error) {
    console.log(error);
  }
}

function AzureWebsocket(connString, hubName, handlers) {
  this._connectionInfo = parseConnectionString(connString);
  this._hubName = hubName;
  this._handlers = handlers;
}

AzureWebsocket.prototype.parseEvent = function (headers) {
  let query = {};
  for (let p of new URLSearchParams(headers['x-asrs-client-query']).entries()) {
    query[p[0]] = p[1];
  }
  return {
    connectionId: headers['x-asrs-connection-id'],
    userId: headers['x-asrs-user-id'],
    query: query,
    socket: this
  };
};

AzureWebsocket.prototype.send = async function (name, data) {
  await invokeService(this._connectionInfo, 'post', `hubs/${this._hubName}`, name, data);
};

AzureWebsocket.prototype.sendToConneciton = async function (connectionId, name, data) {
  await invokeService(this._connectionInfo, 'post', `hubs/${this._hubName}/connections/${connectionId}`, name, data);
};

AzureWebsocket.prototype.addToGroup = async function (connectionId, groupName) {
  await invokeService(this._connectionInfo, 'put', `hubs/${this._hubName}/groups/${groupName}/connections/${connectionId}`);
};

AzureWebsocket.prototype.sendToGroup = async function (groupName, name, data) {
  await invokeService(this._connectionInfo, 'post', `hubs/${this._hubName}/groups/${groupName}`, name, data);
};

AzureWebsocket.prototype.sendToUser = async function (userId, name, data) {
  await invokeService(this._connectionInfo, 'post', `hubs/${this._hubName}/users/${userId}`, name, data);
};

AzureWebsocket.prototype.onConnected = async function (headers) {
  let res = {
    headers: {}
  };
  let context = this.parseEvent(headers);
  res.body = await this._handlers.onConnected(context);
  if (context.userId) res.headers['x-asrs-user-id'] = context.userId;
  console.log(`${context.connectionId} connected`);
  return res;
};

AzureWebsocket.prototype.onDisconnected = async function (headers) {
  let context = this.parseEvent(headers);
  await this._handlers.onDisconnected(context);
  console.log(`${context.connectionId} disconnected`);
};

AzureWebsocket.prototype.onMessage = async function (headers, body) {
  let context = this.parseEvent(headers);
  let obj = JSON.parse(body);
  console.log(`${obj.name} received`);
  if (this._handlers[obj.name]) return await this._handlers[obj.name](context, obj.data);
  else throw `unrecognized message: ${body}`;
};

AzureWebsocket.prototype.getEndpoint = function () {
  return `ws${this._connectionInfo.endpoint.slice(4)}/ws/client/hubs/${this._hubName}`;
};

module.exports = AzureWebsocket;
