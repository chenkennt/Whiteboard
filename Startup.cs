// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license. See LICENSE file in the project root for full license information.

using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace Microsoft.Azure.SignalR.Samples.Whiteboard
{
    public class TestClass
    {
        public string Message;
    }

    public class Startup
    {
        public Startup(IConfiguration configuration)
        {
            Configuration = configuration;
        }

        public IConfiguration Configuration { get; }

        public void ConfigureServices(IServiceCollection services)
        {
            services.AddMvc();
            services.AddSignalR();
            services.AddSingleton<TestClass>();
        }

        public void Configure(IApplicationBuilder app)
        {
            app.UseMvc();
            app.UseFileServer();
            app.UseSignalR(routes =>
            {
                routes.MapHub<DrawHub>("/draw");
            });
        }
    }
}
