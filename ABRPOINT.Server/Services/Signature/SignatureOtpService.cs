using System.Security.Cryptography;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Interfaces;
using ABRPOINT.Server.Services;
using Microsoft.EntityFrameworkCore;
using OtpNet;

namespace ABRPOINT.Server.Services.Signature;

/// <summary>
/// Authentification du signataire au moment de signer (niveau de garantie « avancé ») :
///   • OTP email (code 6 chiffres BCrypt-hashé, expiry court, anti-bruteforce) — stockage DÉDIÉ
///     (uti_sign_otp_*) distinct de la vérif email du signup ;
///   • TOTP (réutilise le secret 2FA chiffré du compte, Otp.NET).
/// La méthode réellement utilisée est journalisée dans signature_action.auth_method.
/// </summary>
public interface ISignatureOtpService
{
    /// <summary>Envoie un OTP de signature par email au compte <paramref name="empcod"/>.
    /// Renvoie l'email masqué (UX) ou lève si pas d'email / compte introuvable.</summary>
    Task<string> SendEmailOtpAsync(string empcod, CancellationToken ct = default);

    /// <summary>Vérifie le code pour la méthode ('email' | 'totp'). Idempotent côté échec
    /// (incrémente le compteur, invalide après 5 essais pour l'email).</summary>
    Task<bool> VerifyAsync(string empcod, string code, string method, CancellationToken ct = default);
}

public sealed class SignatureOtpService : ISignatureOtpService
{
    private const int CodeLifetimeMinutes = 10;
    private const int MaxAttempts = 5;

    private readonly ApplicationDbContext _db;
    private readonly TwoFactorSecretProtector _totpProtector;
    private readonly IEmailService? _email;
    private readonly ILogger<SignatureOtpService> _log;

    public SignatureOtpService(
        ApplicationDbContext db,
        TwoFactorSecretProtector totpProtector,
        ILogger<SignatureOtpService> log,
        IEmailService? email = null)
    {
        _db = db;
        _totpProtector = totpProtector;
        _email = email;
        _log = log;
    }

    public async Task<string> SendEmailOtpAsync(string empcod, CancellationToken ct = default)
    {
        var user = await _db.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == empcod, ct)
                   ?? throw new KeyNotFoundException("Compte introuvable.");
        if (string.IsNullOrWhiteSpace(user.Utimail))
            throw new InvalidOperationException("Aucune adresse email enregistrée pour ce signataire.");

        var code = GenerateNumericCode(6);
        user.UtiSignOtpCode = BCrypt.Net.BCrypt.HashPassword(code);
        user.UtiSignOtpExpiry = DateTime.UtcNow.AddMinutes(CodeLifetimeMinutes);
        user.UtiSignOtpAttempts = 0;
        await _db.SaveChangesAsync(ct);

        if (_email is null)
        {
            // DEV (pas de SMTP) : on logue le code pour permettre les tests.
            _log.LogInformation("[DEV] OTP de signature pour {Email} : {Code} (valide {Min}min).", user.Utimail, code, CodeLifetimeMinutes);
        }
        else
        {
            try
            {
                var safeCode = System.Net.WebUtility.HtmlEncode(code);
                var inner =
                    "<p>Bonjour,</p>" +
                    "<p>Voici votre code à usage unique pour <strong>signer électroniquement</strong> votre document :</p>" +
                    $@"<table role=""presentation"" cellpadding=""0"" cellspacing=""0"" border=""0"" width=""100%"" style=""margin:20px 0;"">
  <tr><td style=""background:#f0f6ff;border:1px solid #cdd9ee;border-radius:14px;padding:24px;text-align:center;"">
    <div style=""font-family:'Courier New',monospace;font-size:36px;font-weight:800;letter-spacing:10px;color:#0040a1;"">{safeCode}</div>
    <p style=""margin:8px 0 0;color:#64748b;font-size:12px;"">Valable {CodeLifetimeMinutes} minutes.</p>
  </td></tr></table>" +
                    "<p style=\"color:#64748b;font-size:13px;\">Si vous n'êtes pas à l'origine de cette signature, ignorez cet email.</p>";
                var subject = $"Code de signature {EmailTemplates.BrandName} : {code}";
                var body = EmailTemplates.Wrap("Code de signature", $"Votre code de signature : {code} (valable {CodeLifetimeMinutes} min).", inner);
                await _email.SendEmailAsync(user.Utimail, subject, body);
            }
            catch (Exception ex)
            {
                // Le code est déjà stocké → l'utilisateur peut renvoyer ou contacter le support.
                _log.LogWarning(ex, "Envoi OTP signature échoué pour {Email}.", user.Utimail);
            }
        }

        return MaskEmail(user.Utimail!);
    }

    public async Task<bool> VerifyAsync(string empcod, string code, string method, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(code)) return false;
        var user = await _db.Utilisateurs.FirstOrDefaultAsync(u => u.Uticod == empcod, ct);
        if (user is null) return false;

        if (string.Equals(method, "totp", StringComparison.OrdinalIgnoreCase))
        {
            if (user.UtiTwoFactorEnabled != "1" || string.IsNullOrEmpty(user.UtiTwoFactorSecret)) return false;
            var rawSecret = _totpProtector.Unprotect(user.UtiTwoFactorSecret);
            if (string.IsNullOrEmpty(rawSecret)) return false;
            var totp = new Totp(Base32Encoding.ToBytes(rawSecret));
            return totp.VerifyTotp(code, out _, new VerificationWindow(1, 1));
        }

        // Email OTP
        if (string.IsNullOrEmpty(user.UtiSignOtpCode)) return false;
        if (!user.UtiSignOtpExpiry.HasValue || user.UtiSignOtpExpiry.Value < DateTime.UtcNow) return false;
        if ((user.UtiSignOtpAttempts ?? 0) >= MaxAttempts) return false;

        var ok = BCrypt.Net.BCrypt.Verify(code, user.UtiSignOtpCode);
        if (ok)
        {
            user.UtiSignOtpCode = null; // usage unique
            user.UtiSignOtpExpiry = null;
            user.UtiSignOtpAttempts = 0;
        }
        else
        {
            user.UtiSignOtpAttempts = (user.UtiSignOtpAttempts ?? 0) + 1;
            if (user.UtiSignOtpAttempts >= MaxAttempts) user.UtiSignOtpCode = null; // brûlé après 5 essais
        }
        await _db.SaveChangesAsync(ct);
        return ok;
    }

    private static string GenerateNumericCode(int digits)
    {
        var max = (int)Math.Pow(10, digits);
        var n = RandomNumberGenerator.GetInt32(0, max);
        return n.ToString().PadLeft(digits, '0');
    }

    private static string MaskEmail(string email)
    {
        var at = email.IndexOf('@');
        if (at <= 1) return "***" + (at >= 0 ? email[at..] : "");
        return email[0] + new string('*', Math.Min(4, at - 1)) + email[(at - 1)..];
    }
}
