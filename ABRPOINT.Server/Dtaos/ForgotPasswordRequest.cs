namespace ABRPOINT.Server.Dtaos
{
    public class ForgotPasswordRequest
    {
        public string Utimail { get; set; } = string.Empty;
    }

    public class ResetPasswordWithCodeRequest
    {
        public string Utimail { get; set; } = string.Empty;
        public string Code { get; set; } = string.Empty;
        public string NewPassword { get; set; } = string.Empty;
    }

    public class AdminResetPasswordRequest
    {
        public string NewPassword { get; set; } = string.Empty;
    }
}