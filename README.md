# Whiteboard: Real Time Collaboration with Azure SignalR Service

Whiteboard is an application that allows multiple users to collaborate and chat in real time. The application includes the following features:

* A whiteboard that anyone can paint on it and others can see your painting in real time
* Painting features:
  1. Basic paint tools (freehand, line, rectangle, circle, ellipse), color and stroke thickness
  2. Upload a background image
  3. Pan and zoom canvas
  4. Undo and redo
  5. Touch support for mobile devices
* Real time chat

This application is built based on HTML5, bootstrap, vue.js (for frontend), ASP.NET Core and Azure SignalR Service (for backend and real time communication).

## Build and Run

To build and run the application locally:

1. Create an Azure SignalR Service instance
2. Get connection string
3. Build and run the application locally

   ```
   dotnet build
   dotnet user-secrets set Azure:SignalR:ConnectionString "<your connection string>"
   dotnet run
   ```

Open multiple windows on http://localhost:5000/, when you paint in one window, others will see the update immediately.

> Though it's recommended to use Azure SignalR Service for real time communication (especially if you host it on Azure), you can also change the application to host SignalR runtime by yourself with the following changes:
>
> 1. Open [Startup.cs](Startup.cs), in `ConfigureServices()` change
>    ```cs
>    services.AddSignalR().AddAzureSignalR();
>    ```
>    to
>    ```cs
>    services.AddSignalR();
>    ```
> 2. In `Configure()`, change
>    ```cs
>    app.UseAzureSignalR(routes =>
>    ```
>    to
>    ```
>    app.UseSignalR(routes =>
>    ```

## Deploy to Azure

To deploy the application to Azure Web App you need to first build the application into a container (a [Dockerfile](Dockerfile) is already available at the root of the repo):

```
docker build -t whiteboard .
```

To test the container locally:

```
docker run -p 5000:80 -e Azure__SignalR__ConnectionString="<connection_string>" whiteboard
```

Then push the container into a docker registry:

```
docker login <docker_registry>
docker tag whiteboard <docker_registry>/whiteboard
docker push <docker_registry>/whiteboard
```

Then create a web app and update its container settings:

```
az group create --name <resource_group_name> --location CentralUS
az appservice plan create --name <plan_name> --resource-group <resource_group_name> --sku S1 --is-linux
az webapp create \
   --resource-group <resource_group_name> --plan <plan_name> --name <app_name> \
   --deployment-container-image-name nginx
az webapp config container set \
   --resource-group <resource_group_name> --name <app_name> \
   --docker-custom-image-name <docker_registry>/whiteboard \
   --docker-registry-server-url https://<docker_registry> \
   --docker-registry-server-user <docker_registry_name> \
   --docker-registry-server-password <docker_registry_password>
az webapp config appsettings set --resource-group <resource_group_name> --name <app_name> --setting PORT=80
az webapp config appsettings set --resource-group <resource_group_name> --name <app_name> \
   --setting Azure__SignalR__ConnectionString="<connection_string>"
```

Now your whiteboard is running in Azure at `https://<app_name>.azurewebsites.net`.
