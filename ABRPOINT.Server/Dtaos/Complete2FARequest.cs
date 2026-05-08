namespace ABRPOINT.Server.Dtaos
{
    public class Complete2FARequest
    {
        // SEC AI : token signé court (5 min, purpose="2fa-pending") émis par /connect après
        // validation du mot de passe — sans ce token, /complete-2fa-login peut être attaqué
        // directement (l'attaquant brute-force seulement le code TOTP 6 chiffres). Le serveur
        // dérive l'Uticod du token, plus depuis le body (qui reste accepté en transition).
        public string TwoFactorToken { get; set; } = string.Empty;
        public string Uticod { get; set; } = string.Empty;
        public string Company { get; set; } = string.Empty;
        public string Usersit { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
    }
}
