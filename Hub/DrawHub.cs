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
        public class Line
        {
            public List<int> Data { get; set; }

            public string Color { get; set; }

            public int Width { get; set; }
        }

        static ConcurrentDictionary<string, Line> lines = new ConcurrentDictionary<string, Line>();

        public override Task OnConnectedAsync()
        {
            return Task.WhenAll(lines.AsEnumerable().Select(l => Clients.Client(Context.ConnectionId).SendAsync("LineUpdated", l.Key, l.Value)));
        }

        public async Task UpdateLine(string id, Line line)
        {
            lines[id] = line;
            await Clients.Others.SendAsync("LineUpdated", id, line);
        }

        public async Task Clear()
        {
            lines.Clear();
            await Clients.Others.SendAsync("Clear");
        }
    }
}
