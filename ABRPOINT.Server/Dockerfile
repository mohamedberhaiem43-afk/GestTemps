# Consultez https://aka.ms/customizecontainer pour savoir comment personnaliser votre conteneur de débogage et comment Visual Studio utilise ce Dockerfile pour générer vos images afin d’accélérer le débogage.

# Cet index est utilisé lors de l’exécution à partir de VS en mode rapide (par défaut pour la configuration de débogage)
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
#USER $APP_UID
WORKDIR /app
EXPOSE 8080
EXPOSE 8081


# Cette phase est utilisée pour générer le projet de service
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
ARG BUILD_CONFIGURATION=Release
WORKDIR /src

# ✅ Installer Node.js (nécessaire pour les projets .esproj)
RUN apt-get update && apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && node -v && npm -v

COPY ["abrpoint.client/nuget.config", "abrpoint.client/"]
COPY ["ABRPOINT.Server/ABRPOINT.Server.csproj", "ABRPOINT.Server/"]
COPY ["abrpoint.client/abrpoint.client.esproj", "abrpoint.client/"]
RUN dotnet restore "./ABRPOINT.Server/ABRPOINT.Server.csproj"
COPY . .
WORKDIR "/src/ABRPOINT.Server"
RUN dotnet build "./ABRPOINT.Server.csproj" -c $BUILD_CONFIGURATION -o /app/build

# Cette étape permet de publier le projet de service à copier dans la phase finale
FROM build AS publish
ARG BUILD_CONFIGURATION=Release
# ✅ Désactiver HTTPS dev certificate avant le publish
ENV DOCKER_BUILD=true
ENV ASPNETCORE_ENVIRONMENT=Production
ENV NODE_ENV=production
RUN dotnet publish "./ABRPOINT.Server.csproj" -c $BUILD_CONFIGURATION -o /app/publish /p:UseAppHost=false

# Cette phase est utilisée en production ou lors de l’exécution à partir de VS en mode normal (par défaut quand la configuration de débogage n’est pas utilisée)
FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "ABRPOINT.Server.dll"]
