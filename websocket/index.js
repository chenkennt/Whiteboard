const express = require('express');
const bodyParser = require('body-parser');
const fileUpload = require('express-fileupload');
const app = express();
const AzureWebsocket = require('./azure-websocket.js');

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
    await context.socket.send('userUpdated', ++diagram.users);
    res.push({
      name: 'userUpdated',
      data: diagram.users
    });
    return res;
  },
  onDisconnected: async context => {
    if (--diagram.users < 0) diagram.users = 0;
    await context.socket.send('userUpdated', diagram.users);
  },
  patchShape: async (context, [author, id, data]) => {
    diagram.shapes[id].data = diagram.shapes[id].data.concat(data);
    await context.socket.send('shapePatched', [author, id, data]);
  },
  updateShape: async (context, [author, id, shape]) => {
    diagram.shapes[id] = shape;
    await context.socket.send('shapeUpdated', [author, id, shape]);
  },
  removeShape: async (context, [author, id]) => {
    delete diagram.shapes[id];
    await context.socket.send('shapeRemoved', [author, id]);
  },
  clear: async (context, author) => {
    diagram.shapes = {};
    diagram.background = null;
    await context.socket.send('clear', author);
  },
  sendMessage: async (context, [author, name, message]) => {
    await context.socket.send("newMessage", [author, name, message]);
  }
};

const port = 8080;
const connectionString = process.env.Azure__SignalR__ConnectionString;
const hubName = 'draw';

let socket = new AzureWebsocket(connectionString, hubName, handlers);

app.use(bodyParser.text());
app.use(fileUpload());
app
  .get(`/${hubName}`, (req, res) => res.send(socket.getEndpoint()))
  .post('/background/upload', async (req, res) => {
    diagram.background = {
      id: Math.random().toString(36).substr(2, 8),
      data: req.files['file'].data,
      contentType: req.files['file'].mimetype
    };
    await socket.send('backgroundUpdated', diagram.background.id);
    res.send();
  })
  .get('/background/:id', (req, res) => {
    if (diagram.background && diagram.background.id === req.params.id) {
      res.type(diagram.background.contentType);
      res.send(diagram.background.data);
    } else res.status(404).send();
  })
  .post(`/${hubName}/connect`, async (req, res) => {
    let ret = await socket.onConnected(req.headers);
    for (let n in ret.headers) res.header(n, ret.headers[n]);
    res.send(ret.body);
  })
  .post(`/${hubName}/disconnect`, async (req, res) => {
    await socket.onDisconnected(req.headers);
    res.send();
  })
  .post(`/${hubName}/message`, async (req, res) => {
    let body = await socket.onMessage(req.headers, req.body);
    res.send(body);
  });

app.use(express.static('public'));
app.listen(port, () => console.log('app started'));
