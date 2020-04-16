// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.AspNetCore.SignalR;
using System.Collections.Generic;
using System.Threading.Tasks;
using System.Linq;
using System;

namespace Microsoft.Azure.SignalR.Samples.Whiteboard
{
    public class DrawHub : Hub
    {
        private Diagram diagram;

        public DrawHub(Diagram diagram)
        {
            this.diagram = diagram;
        }
        public override Task OnConnectedAsync()
        {
            var t = Task.WhenAll(diagram.Shapes.AsEnumerable().Select(l => Clients.Client(Context.ConnectionId).SendAsync("ShapeUpdated", l.Key, l.Value)));
            if (diagram.Background != null) t = t.ContinueWith(_ => Clients.Client(Context.ConnectionId).SendAsync("BackgroundUpdated", diagram.BackgroundId));
            return t.ContinueWith(_ => Clients.All.SendAsync("UserUpdated", diagram.UserEnter()));
        }

        public override Task OnDisconnectedAsync(Exception exception)
        {
            return Clients.All.SendAsync("UserUpdated", diagram.UserLeave());
        }

        public async Task PatchShape(string id, List<int> data)
        {
            diagram.Shapes[id].Data.AddRange(data);
            await Clients.Others.SendAsync("ShapePatched", id, data);
        }

        public async Task UpdateShape(string id, Diagram.Shape shape)
        {
            diagram.Shapes[id] = shape;
            await Clients.Others.SendAsync("ShapeUpdated", id, shape);
        }

        public async Task RemoveShape(string id)
        {
            diagram.Shapes.Remove(id, out _);
            await Clients.Others.SendAsync("ShapeRemoved", id);
        }

        public async Task Clear()
        {
            diagram.Shapes.Clear();
            diagram.Background = null;
            await Clients.Others.SendAsync("Clear");
        }

        public async Task SendMessage(string name, string message)
        {
            await Clients.Others.SendAsync("NewMessage", name, message);
        }
    }
}
