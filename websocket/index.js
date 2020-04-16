const axios = require('axios');
const jwt = require('jsonwebtoken');
const express = require('express');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const app = express();

let traces = [];

function initialize(app, hubName, handlers, connectionString) {
  async function processWithTrace(func) {
    let start = new Date();
    let message = await func();
    let end = new Date();
    traces.push(`[${start} +${end - start}ms] ${message}`);
  }

  function generateToken(url, key) {
    return "Bearer " + jwt.sign({}, key, {
      audience: url,
      expiresIn: "1h",
      algorithm: "HS256"
    });
  }

  function parseConnectionString(connString) {
    const pattern = /^Endpoint=(.*);AccessKey=(.*);Version=1.0;$/;
    let matches = pattern.exec(connString);
    return {
      endpoint: matches[1],
      accessKey: matches[2]
    };
  }

  async function invokeService(method, url, obj) {
    console.log(`${method} ${url}`);
    url = `${connectionInfo.endpoint}/ws/api/v1/${url}`;
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

  let sendToConneciton = async (connectionId, name, data) => await invokeService('post', `hubs/${hubName}/connections/${connectionId}`, {
    name: name,
    data: data
  });
  let send = async (name, data) => await invokeService('post', `hubs/${hubName}`, {
    name: name,
    data: data
  });
  let addToGroup = async (connectionId, groupName) => await invokeService('put', `hubs/${hubName}/groups/${groupName}/connections/${connectionId}`);
  let sendToGroup = async (groupName, name, data) => await invokeService('post', `hubs/${hubName}/groups/${groupName}`, {
    name: name,
    data: data
  });
  let sendToUser = async (userId, name, data) => await invokeService('post', `hubs/${hubName}/users/${userId}`, {
    name: name,
    data: data
  });

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

let diagram = {
  shapes: {},
  background: null,
  users: 0
};

let handlers = {
  onConnected: async context => {
    let res = [];
    for (var i in diagram.shapes)
      res.push({
        name: 'shapeUpdated',
        data: [null, i, diagram.shapes[i]]
      });
    if (diagram.background) res.push({
      name: 'backgroundUpdated',
      data: diagram.background.id
    });
    await context.send('userUpdated', ++diagram.users);
    res.push({
      name: 'userUpdated',
      data: diagram.users
    });
    return res;
  },
  onDisconnected: async context => {
    await context.send('userUpdated', --diagram.users);
  },
  patchShape: async (context, [author, id, data]) => {
    diagram.shapes[id].data = diagram.shapes[id].data.concat(data);
    await context.send('shapePatched', [author, id, data]);
  },
  updateShape: async (context, [author, id, shape]) => {
    diagram.shapes[id] = shape;
    await context.send('shapeUpdated', [author, id, shape]);
  },
  removeShape: async (context, [author, id]) => {
    delete diagram.shapes[id];
    await context.send('shapeRemoved', [author, id]);
  },
  clear: async (context, author) => {
    diagram.shapes = {};
    diagram.background = null;
    await context.send('clear', author);
  },
  sendMessage: async (context, [author, name, message]) => {
    await context.send("newMessage", [author, name, message]);
  }
};

const port = 8080;
const connectionString = process.env.Azure__SignalR__ConnectionString;
const hubName = 'draw';

app.use(bodyParser.text());
app.use(fileUpload());
initialize(app, hubName, handlers, connectionString);
app.use(express.static('public'));
app.listen(port, () => console.log('app started'));
