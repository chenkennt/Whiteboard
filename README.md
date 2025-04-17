# Whiteboard: Real Time Collaboration using Azure SignalR Service

This is a sample project to demonstrate how to build a web application for real time collaboration using Azure, ASP.NET Core and other related technologies. This sample application includes the following features:

* A whiteboard that anyone can paint on it and others can see you paint in real time
* Painting features:
  1. Basic paint tools (freehand, line, rectangle, circle, ellipse) with customizable color and stroke thickness
  2. Upload a background image
  3. Pan and zoom canvas
  4. Undo and redo
  5. Touch support for mobile devices
* Real time chat

This application is based on the following technologies:

* For frontend: HTML5/javascript, bootstrap and vue.js
* For backend: ASP.NET Core (for SignalR version), or node.js + express.js (for websocket version)
* For realtime communication: WebSocket, SignalR and Azure SignalR Service

## Build and run locally

### SignalR version

This application has two versions, the SignalR [version](SignalR/) is built on top of ASP.NET Core SignalR and Azure SignalR Service. You can build and run it as a normal ASP.NET Core application:

1. Create an Azure SignalR Service instance
2. Go to Access control (IAM) tab on portal, add "SignalR App Server" role to your own Azure account
3. Set connection string
   ```
   set Azure__SignalR__ConnectionString=Endpoint=https://<resource_name>.service.signalr.net;Type=azure;
   ```
4. Make sure you log into Azure using Azure CLI
5. Build and run the application locally

   ```
   dotnet build
   dotnet run
   ```

> Alternatively you can also use access key based connection string to authenticate with Azure (which may be simpler but less secure than using Entra ID):
> 1. Go to portal and copy connection string from Connection strings tab
> 2. Save it to .NET secret store
>    ```
>    dotnet user-secrets set Azure:SignalR:ConnectionString "<your connection string>"
>    ```

Open multiple windows on http://localhost:5000/, when you paint in one window, others will see the update immediately.

> You can also run it without Azure SignalR Service (Azure SignalR Service is used mainly for scalability considerations). To remove Azure SignalR Service dependency:
>
> 1. Open [Startup.cs](Startup.cs), in `ConfigureServices()` change
>    ```cs
>    services.AddSignalR().AddAzureSignalR();
>    ```
>    to
>    ```cs
>    services.AddSignalR();
>    ```
> 2. [Optional] Remove the corresponding Azure SignalR dependency from `Whiteboard.csproj`.

### WebSocket version

If you're not familiar with SignalR or cannot use this technology for some reason, you can still build the same application as long as you're familiar with WebSocket technology. WebSocket [version](websocket/) shows to how to do that in WebSocket.

> This version is based on an experimental feature in Azure SignalR Service called serverless WebSocket which allows you to build WebSocket applications in a serverless fashion. Basically Azure SignalR Service converts WebSocket connections into HTTP requests (WebHook) so you don't need to maintain WebSocket connections in your severless application (which is usually not possible in serverless world).

To build and run it locally:

1. Get a connection string to Azure SignalR Service and set it as environment variable:
   ```
   set Azure__SignalR__ConnectionString=<your connection string>
   ```

2. Then run the application:
   ```
   npm install
   npm start
   ```

3. Now you need a public accessible endpoint so that Azure SignalR Service can invoke you. We can use [ngrok](https://www.ngrok.com/) to achieve it. Install ngrok and use the following command to start it:
   ```
   ngrok http 8080
   ```
   Now you can see a public endpoint created by ngrok (something like https://abc.ngrok.io), set corresponding upstream urls in Azure SignalR Service.
   > This feature is still in private preview. Check out this [repo](https://github.com/Azure/azure-signalr-vnext-features) for more information about this feature and how to get private preview access.

Now your application will be available at: http://localhost:8080

## Deploy to Azure

1. To deploy the application to Azure Web App, first package it into a zip file:

   * For SignalR version:
     ```
     dotnet build
     dotnet publish -c Release
     ```
     Then package all files under `bin/Release/net9.0/publish` to a zip file.
   * For WebSocket version, just run `npm install` and then package all files into a zip file.

2. Then use the following command to deploy it to Azure Web App:

   ```
   az webapp deployment source config-zip --src <path_to_zip_file> -n <app_name> -g <resource_group_name>
   ```

3. Set Azure SignalR Service connection string in the application settings. You can do it through portal or using Azure CLI:
   ```
   az webapp config appsettings set --resource-group <resource_group_name> --name <app_name> \
      --setting Azure__SignalR__ConnectionString="Endpoint=https://<resource_name>.service.signalr.net;Type=azure;"
   ```
   And add "SignalR App Server" role to your web app instance

   > You can also use access key based connection string but it's highly unrecommended

4. Also update corresponding upstream urls if you're using WebSocket version.

Now your whiteboard is running in Azure at `https://<app_name>.azurewebsites.net`. Enjoy!

## Interact with Large Language Model

[Model Context Protocol](https://github.com/modelcontextprotocol) (MCP) is an open protocol that enables seamless integration between LLM applications and external data sources and tools. With MCP we can expose the painting capability of whiteboard to LLM so it can draw the picture for you!

[SignalRMCP](SignalRMCP/) is a MCP server implementation that exposes hub methods from the whiteboard SignalR hub so LLM can directly operate on the whiteboard.

To install the MCP server:

1. Install dependencies

   ```
   npm install
   ```

2. The MCP server will by default connect to local server (http://localhost:5000). If your whiteboard is not running locally, set the endpoint in WHITEBOARD_ENDPOINT environment variable or `.env` file

3. Configure the MCP server in your LLM app (like Claude Desktop or GitHub Copilot in VS Code):

   ```json
   "mcpServers": {
     "Whiteboard": {
       "command": "node",
         "args": [
           "<path-to-SignalRMCP-project>/index.js"
         ]
      }
    }
   ```

4. Now open your favorite LLM app and ask it to paint something on whiteboard, you'll see it paint in real time.