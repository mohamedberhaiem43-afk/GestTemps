using ABRPOINT.Server.Tenancy;

namespace ABRPOINT.Server.Provisioning;

/// <summary>
/// Provisioning d'un nouveau tenant SaaS :
///   1. Création physique de la base SQL (CREATE DATABASE).
///   2. Application des migrations EF Core sur cette nouvelle base.
///   3. Seed initial : Societe, Site, Utilisateur admin, Socuser, Modules, Permissions.
///   4. Drop de la base en cas d'échec (rollback).
///
/// Conçu pour être appelé depuis SignupController dans une transaction master.
/// </summary>
public interface IProvisioningService
{
    Task CreateDatabaseAsync(string dbName, CancellationToken ct = default);
    Task RunMigrationsAsync(string dbName, CancellationToken ct = default);
    Task SeedInitialAsync(Tenant tenant, ProvisioningSeedRequest seed, CancellationToken ct = default);
    Task DropDatabaseAsync(string dbName, CancellationToken ct = default);
}

public sealed record ProvisioningSeedRequest(
    string CompanyName,
    string AdminFirstName,
    string AdminLastName,
    string AdminEmail,
    string AdminPassword,
    // Hash BCrypt du code OTP de vérification email (6 chiffres) généré par le caller
    // avant l'appel. Pré-rempli dans la colonne uti_email_verif_code de l'admin "AD"
    // dès la création. Null = pas de vérification (legacy / tests). Le caller envoie
    // ensuite l'email contenant le code en clair.
    string? EmailVerifCodeHash = null,
    // Expiration absolue du code ci-dessus (UTC). Lue par /Utilisateurs/verify-email pour
    // refuser les codes périmés. Convention : DateTime.UtcNow.AddMinutes(15).
    DateTime? EmailVerifCodeExpiry = null);
