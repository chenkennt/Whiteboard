// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Threading;

namespace Microsoft.Azure.SignalR.Samples.Whiteboard
{
    public class Diagram
    {
        public class Shape
        {
            public string Kind { get; set; }

            public string Color { get; set; }

            public int Width { get; set; }

            public List<int> Data { get; set; }
        }

        private int totalUsers = 0;

        public byte[] Background { get; set; }

        public string BackgroundContentType { get; set; }

        public string BackgroundId { get; set; }

        public ConcurrentDictionary<string, Shape> Shapes { get; } = new ConcurrentDictionary<string, Shape>();

        public int UserEnter()
        {
            return Interlocked.Increment(ref totalUsers);
        }

        public int UserLeave()
        {
            return Interlocked.Decrement(ref totalUsers);
        }
    }
}
