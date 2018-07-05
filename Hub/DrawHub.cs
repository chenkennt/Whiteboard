// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.AspNetCore.SignalR;
using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Drawing;
using System.Threading.Tasks;
using System.Linq;

namespace Microsoft.Azure.SignalR.Samples.Whiteboard
{
    public class DrawHub : Hub
    {
        public class Shape
        {
            public string Kind { get; set; }

            public string Color { get; set; }

            public int Width { get; set; }

            public List<int> Data { get; set; }

        }

        static ConcurrentDictionary<string, Shape> shapes = new ConcurrentDictionary<string, Shape>();

        public override Task OnConnectedAsync()
        {
            return Task.WhenAll(shapes.AsEnumerable().Select(l => Clients.Client(Context.ConnectionId).SendAsync("ShapeUpdated", l.Key, l.Value)));
        }

        public async Task PatchShape(string id, List<int> data)
        {
            shapes[id].Data.AddRange(data);
            await Clients.Others.SendAsync("ShapePatched", id, data);
        }

        public async Task UpdateShape(string id, Shape shape)
        {
            shapes[id] = shape;
            await Clients.Others.SendAsync("ShapeUpdated", id, shape);
        }

        public async Task RemoveShape(string id)
        {
            shapes.Remove(id, out _);
            await Clients.Others.SendAsync("ShapeRemoved", id);
        }

        public async Task Clear()
        {
            shapes.Clear();
            await Clients.Others.SendAsync("Clear");
        }
    }
}
