const WebSocket = require('ws');
const { WebPubSubServiceClient } = require('@azure/web-pubsub');

const connectionString = process.argv[2];
const sendInterval = 250;
const drawSpeed = 40;
const drawChance = process.argv[4];
const left = 0, right = 1000, top = 0, bottom = 1000;
const minClients = process.argv[3], maxClients = process.argv[3];
const testInterval = 30;
const serviceClient = new WebPubSubServiceClient(connectionString, 'draw');

const generateId = () => Math.random().toString(36).substr(2, 8);

const shapes = {};
let startTime = new Date();
let shapesSent = 0, shapesReceived = 0, allShapesReceived = 0, totalLatency = 0, latency = [], timeReceived = [];
let totalPoints = 0;
let clients = 0;
let lastConnectTime;

function updateShape(ws, author, i, m) {
  ws.send(JSON.stringify({
    name: 'updateShape',
    data: [author, i, m]
  }));
}

function patchShape(ws, author, i, d) {
  ws.send(JSON.stringify({
    name: 'patchShape',
    data: [author, i, d]
  }));
}

function generatePoint() {
  return [left + Math.round(Math.random() * (right - left)), top + Math.round(Math.random() * (bottom - top))];
}

function randomWalk(p) {
  const maxDistance = 10;
  const generate = (v, min, max) => Math.max(min, Math.min(max, v + Math.round(Math.random() * maxDistance * 2) - maxDistance));
  return [generate(p[0], left, right), generate(p[1], top, bottom)];
}

async function testOne(id) {
  let { url } = await serviceClient.getAuthenticationToken();
  let ws = new WebSocket(url);
  let currentShape = null;
  const author = generateId();
  lastConnectTime = new Date();
  function draw() {
    if (Math.random() > drawChance) return;
    if (currentShape && Math.random() > 0.8) currentShape = null;
    if (!currentShape) {
      currentShape = [generateId(), {
        kind: 'polyline',
        color: 'black',
        width: 1,
        data: generatePoint()
      }];
      shapes[currentShape[0]] = new Date();
      updateShape(ws, author, currentShape[0], currentShape[1]);
      shapesSent++;
      totalPoints++;
    }

    let buf = [];
    let p = currentShape[1].data.slice(-2);
    for (let i = 0; i < drawSpeed; i++) {
      buf = buf.concat(p = randomWalk(p));
      totalPoints++;
    }
    currentShape[1].data = currentShape[1].data.concat(buf);
    patchShape(ws, author, currentShape[0], buf);
  }

  ws.onopen = () => {
    console.log(`client #${id} connected`);
    setInterval(draw, sendInterval);
  };
  ws.onmessage = e => {
    let data = JSON.parse(e.data);
    if (data.name === 'shapeUpdated') allShapesReceived++;
    if (data.name === 'shapeUpdated' && data.data[0] === author) {
      let id = data.data[1];
      if (shapes[id]) {
        shapesReceived++;
        let d = new Date();
        let i = Math.floor((d - startTime) / 10000);
        totalLatency += d - shapes[id];
        latency[i] = (latency[i] || 0) + (d - shapes[id]);
        timeReceived[i] = (timeReceived[i] || 0) + 1;
      }
    }
  }
  ws.onerror = onclose = e => {
    console.log(`client #${id} closed`);
    console.log(e);
  }
}

function test() {
  for (; clients < minClients; clients++) testOne(clients);
  if (clients < maxClients && new Date() - lastConnectTime >= testInterval * 1000) testOne(clients++);
  let l = latency.slice(-6).reduce((a, i) => a + i, 0) / timeReceived.slice(-6).reduce((a, i) => a + i, 0);
  console.log(`time: ${(new Date() - startTime) / 1000}, sent: ${shapesSent}/${totalPoints}, received: ${shapesReceived}, latency: ${l.toFixed(2)}ms`);
}

async function main() {
  let { url } = await serviceClient.getAuthenticationToken();
  let ws = new WebSocket(url);
  ws.onopen = () => {
    ws.send(JSON.stringify({
      name: 'clear',
      data: generateId()
    }));
    setInterval(test, 1000);
  }
}

main();