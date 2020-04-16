async function processWithTrace(func) {
  let start = new Date();
  let message = await func();
  let end = new Date();
  traces.push(`[${start} +${end - start}ms] ${message}`);
}

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

async function invokeService(connectionInfo, method, path, obj) {
  console.log(`${method} ${path}`);
  let url = `${connectionInfo.endpoint}/ws/api/v1/${path}`;
  let headers = {
    'Authorization': generateToken(url, connectionInfo.accessKey)
  };
  let payload = null;
  if (obj) {
    headers['Content-Type'] = 'text/plain';
    payload = JSON.stringify(obj);
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

function AzureWebsocket(connString, hubName) {
  this._connectionInfo = parseConnectionString(connString);
  this._hubName = hubName;
}

AzureWebSocket.prototype.send = async function (name, data) {
  await invokeService(this._connectionInfo, 'post', `hubs/${this._hubName}`, {
    name: name,
    data: data
  });
};
AzureWebSocket.prototype.sendToConneciton = async function (connectionId, name, data) {
  await invokeService(this._connectionInfo, 'post', `hubs/${this._hubName}/connections/${connectionId}`, {
    name: name,
    data: data
  });
};
AzureWebSocket.prototype.addToGroup = async function (connectionId, groupName) {
  await invokeService(this._connectionInfo, 'put', `hubs/${this._hubName}/groups/${groupName}/connections/${connectionId}`);
};
AzureWebSocket.prototype.sendToGroup = async function (groupName, name, data) {
  await invokeService(this._connectionInfo, 'post', `hubs/${this._hubName}/groups/${groupName}`, {
    name: name,
    data: data
  });
};
AzureWebsocket.prototype.sendToUser = async function (userId, name, data) {
  await invokeService(this._connectionInfo, 'post', `hubs/${this._hubName}/users/${userId}`, {
    name: name,
    data: data
  });
};

module.exports = {
  create: (connString, hubName) => new AzureWebSocket(connString, hubName)
};

function initialize(app, hubName, handlers, connectionString) {
  function parseEvent(req) {
    let query = {};
    for (let p of new URLSearchParams(req.header('x-asrs-client-query')).entries()) {
      query[p[0]] = p[1];
    }
    return {
      connectionId: req.header('x-asrs-connection-id'),
      userId: req.header('x-asrs-user-id'),
      query: query,
      send: send,
      sendToConnection: sendToConneciton,
      sendToGroup: sendToGroup,
      sendToUser: sendToUser,
      addToGroup: addToGroup
    };
  }

  const connectionInfo = parseConnectionString(connectionString);
  app
    .get(`/${hubName}`, (req, res) => {
      res.send(`ws${connectionInfo.endpoint.slice(4)}/ws/client/hubs/${hubName}`);
    })
    .post('/background/upload', async (req, res) => {
      diagram.background = {
        id: Math.random().toString(36).substr(2, 8),
        data: req.files['file'].data,
        contentType: req.files['file'].mimetype
      };
      await send('backgroundUpdated', diagram.background.id)
      res.send();
    })
    .get('/background/:id', (req, res) => {
      if (diagram.background && diagram.background.id === req.params.id) {
        res.type(diagram.background.contentType);
        res.send(diagram.background.data);
      } else res.status(404).send();
    })
    .post(`/${hubName}/connect`, async (req, res) => {
      await processWithTrace(async () => {
        let context = parseEvent(req);
        let content = await handlers.onConnected(context);
        if (context.userId) res.header('x-asrs-user-id', context.userId);
        if (content) res.send(content);
        else res.status(204).send();
        return `${context.connectionId} connected`;
      });
    })
    .post(`/${hubName}/disconnect`, async (req, res) => {
      await processWithTrace(async () => {
        let context = parseEvent(req);
        await handlers.onDisconnected(context);
        res.send();
        return `${context.connectionId} disconnected`;
      });
    })
    .post(`/${hubName}/message`, async (req, res) => {
      await processWithTrace(async () => {
        let context = parseEvent(req);
        let obj = JSON.parse(req.body);
        if (handlers[obj.name]) await handlers[obj.name](context, obj.data);
        res.send();
        return `received ${obj.name} from ${context.connectionId}`;
      });
    })
    .get('/debug', (req, res) => {
      res.send(JSON.stringify(traces));
    });
}
