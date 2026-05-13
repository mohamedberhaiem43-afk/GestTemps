using System.Text.Json;

namespace ABRPOINT.Server.Middleware;

/// <summary>
/// SEC — Capture toute exception non gérée et renvoie une réponse générique au client,
/// avec un correlation ID. Le détail (type, message, stack trace) est logué côté serveur
/// uniquement.
///
/// Avant : ~30 controllers renvoyaient `ex.Message` directement, exposant les noms de
/// tables SQL, chemins de fichier, "Login failed for user 'sa'", etc. Cela aide un
/// attaquant à cartographier le backend.
///
/// Ce middleware ne masque PAS les exceptions transformées en ProblemDetails par le
/// pipeline ASP.NET (validation 400, 401, 404 explicites) ni les `return StatusCode(...)`
/// déjà gérés par les controllers — il intercepte uniquement les exceptions qui
/// remontent sans avoir été interceptées.
/// </summary>
public sealed class GlobalExceptionHandler
{
    private readonly RequestDelegate _next;
    private readonly ILogger<GlobalExceptionHandler> _log;

    public GlobalExceptionHandler(RequestDelegate next, ILogger<GlobalExceptionHandler> log)
    {
        _next = next;
        _log = log;
    }

    public async Task Invoke(HttpContext ctx)
    {
        try
        {
            await _next(ctx);
        }
        catch (Exception ex)
        {
            var correlationId = ctx.TraceIdentifier;
            _log.LogError(ex,
                "Unhandled exception {ExceptionType} on {Method} {Path} (correlationId={CorrelationId})",
                ex.GetType().Name, ctx.Request.Method, ctx.Request.Path, correlationId);

            if (ctx.Response.HasStarted)
            {
                // Trop tard pour rewrite la response : on logue et on laisse mourir.
                return;
            }

            ctx.Response.Clear();
            ctx.Response.StatusCode = StatusCodes.Status500InternalServerError;
            ctx.Response.ContentType = "application/json; charset=utf-8";

            // Payload générique. Le correlationId permet au support de retrouver la trace
            // serveur sans exposer le détail au client.
            var payload = JsonSerializer.Serialize(new
            {
                message = "Une erreur interne est survenue. Si le problème persiste, contactez le support.",
                correlationId,
            });
            await ctx.Response.WriteAsync(payload);
        }
    }
}
