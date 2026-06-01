using System.Text.Json;
using System.Text.RegularExpressions;
using ABRPOINT.Server.Data;
using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Provisioning;

/// <summary>
/// Seed des MODÈLES DE DOCUMENTS par défaut (RagLetterTemplate) pour une société, plus les
/// liaisons <c>signature_template_map</c> correspondantes. Objectif : qu'un tenant fraîchement
/// créé (ou existant en rattrapage) dispose immédiatement d'une structure pour chaque document
/// courant — contrat, titre/demande de congé, autorisation de sortie, certificat/attestation de
/// travail, visite médicale, attestation de salaire — afin que la génération de courrier ET le
/// parcours de signature ne se bloquent pas faute de modèle configuré.
///
/// Le corps utilise les placeholders <c>{{variable}}</c> hydratés par
/// <see cref="ABRPOINT.Server.Services.Rag.LetterGenerationService"/> (emplib, soclib, condep…) et
/// les ancres de signature <c>[Signature_Collaborateur]</c> / <c>[Signature_Approbateur_1]</c>
/// tamponnées par <c>PdfSignatureStamper</c>.
///
/// IDEMPOTENT : un modèle n'est créé que si la société n'a pas déjà un modèle du même nom ; une
/// liaison n'est créée que si la société n'a pas déjà une liaison pour ce <c>source_type</c>
/// (on ne touche donc jamais une grille personnalisée par l'admin). Le seeder gère son propre
/// SaveChanges (nécessaire pour récupérer l'id auto-généré du modèle avant de créer la liaison).
/// Utilisé au provisioning (cf. <see cref="ProvisioningService"/>) ET en rattrapage via
/// <c>POST /api/Roles/seed-system</c>.
/// </summary>
public static class DefaultLetterTemplateSeeder
{
    private static readonly Regex PlaceholderRegex =
        new(@"{{\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*}}", RegexOptions.Compiled);

    private sealed record TemplateDef(string Name, string Category, string Description, string Body);

    // 8 modèles métier demandés. La catégorie (≤ 20 car.) sert à les retrouver pour la liaison
    // signature et à matcher TryGenerateCongeLetterPdfAsync (catégorie contenant « cong »).
    private static readonly TemplateDef[] Templates =
    {
        new("Contrat de travail", "contrat", "Modèle par défaut de contrat de travail.",
@"CONTRAT DE TRAVAIL

Entre les soussignés :
{{soclib}}, dont le siège est situé {{socadr}} {{socville}}, représentée par sa Direction (ci-après « l'Employeur »),

et

{{emplib}}, demeurant {{empadr}}, titulaire de la pièce d'identité n° {{empcin}} (ci-après « le Salarié »),

il a été convenu ce qui suit :

Article 1 — Engagement
Le Salarié est engagé en qualité de {{empfonc}} à compter du {{empdebut}}, dans le cadre d'un contrat de type {{contype}}.

Article 2 — Fonctions
Le Salarié exercera les fonctions correspondant à son poste, sous l'autorité de l'Employeur.

Fait à {{socville}}, le {{today}}.

L'Employeur : {{soclib}}
[Signature_Approbateur_1]

Le Salarié : {{emplib}}
[Signature_Collaborateur]"),

        new("Titre de congé", "conge", "Modèle par défaut de titre de congé.",
@"TITRE DE CONGÉ

{{soclib}}
Référence : {{conref}}

Nous attestons que {{emplib}} (matricule {{empmat}}), occupant le poste de {{empfonc}}, bénéficie d'un congé de type {{abslib}} du {{condep}} au {{conret}}, soit {{connbjour}} jour(s).

Fait à {{socville}}, le {{today}}.

Le Responsable
[Signature_Approbateur_1]

Le Salarié : {{emplib}}
[Signature_Collaborateur]"),

        new("Demande de congé", "demande_conge", "Modèle par défaut de demande de congé.",
@"DEMANDE DE CONGÉ

Je soussigné(e) {{emplib}} (matricule {{empmat}}), {{empfonc}}, sollicite l'autorisation de m'absenter au titre d'un congé {{abslib}} du {{condep}} au {{conret}}, soit {{connbjour}} jour(s).

Motif / référence : {{conref}}

Fait à {{socville}}, le {{today}}.

Le Salarié : {{emplib}}
[Signature_Collaborateur]

Avis du Responsable
[Signature_Approbateur_1]"),

        new("Autorisation de sortie", "autorisation", "Modèle par défaut d'autorisation de sortie.",
@"AUTORISATION DE SORTIE

{{soclib}}

{{emplib}} (matricule {{empmat}}), {{empfonc}}, est autorisé(e) à s'absenter du lieu de travail le {{condep}} (retour prévu : {{conret}}).

Motif : {{conref}}

Fait à {{socville}}, le {{today}}.

Le Responsable
[Signature_Approbateur_1]

Le Salarié : {{emplib}}
[Signature_Collaborateur]"),

        new("Certificat de travail", "certificat", "Modèle par défaut de certificat de travail.",
@"CERTIFICAT DE TRAVAIL

Je soussigné, représentant de {{soclib}}, sis {{socadr}} {{socville}}, certifie que {{emplib}} (matricule {{empmat}}) a été employé(e) au sein de notre entreprise en qualité de {{empfonc}}, du {{empemb}} au {{empfin}}.

{{emplib}} est libre de tout engagement envers notre société.

Le présent certificat est délivré pour servir et valoir ce que de droit.

Fait à {{socville}}, le {{today}}.

{{soclib}}
[Signature_Approbateur_1]"),

        new("Attestation de travail", "attestation", "Modèle par défaut d'attestation de travail.",
@"ATTESTATION DE TRAVAIL

Je soussigné, représentant de {{soclib}}, atteste que {{emplib}} (matricule {{empmat}}) fait partie de notre effectif depuis le {{empemb}}, en qualité de {{empfonc}}, dans le cadre d'un contrat de type {{contype}}.

La présente attestation est délivrée à l'intéressé(e) pour servir et valoir ce que de droit.

Fait à {{socville}}, le {{today}}.

{{soclib}}
[Signature_Approbateur_1]"),

        new("Visite médicale", "visite_medicale", "Modèle par défaut de convocation à la visite médicale.",
@"CONVOCATION À LA VISITE MÉDICALE

{{soclib}}

{{emplib}} (matricule {{empmat}}), {{empfonc}}, est convoqué(e) à une visite médicale dans le cadre du suivi de santé au travail.

Nous vous remercions de bien vouloir vous présenter à la date qui vous sera communiquée.

Fait à {{socville}}, le {{today}}.

Le Service RH
[Signature_Approbateur_1]

Le Salarié : {{emplib}}
[Signature_Collaborateur]"),

        new("Attestation de salaire", "attestation_salaire", "Modèle par défaut d'attestation de salaire.",
@"ATTESTATION DE SALAIRE

Je soussigné, représentant de {{soclib}}, atteste que {{emplib}} (matricule {{empmat}}), occupant le poste de {{empfonc}}, perçoit une rémunération au titre de son contrat de type {{contype}} en vigueur depuis le {{empemb}}.

La présente attestation est établie à la demande de l'intéressé(e) pour faire valoir ce que de droit.

Fait à {{socville}}, le {{today}}.

{{soclib}}
[Signature_Approbateur_1]"),
    };

    // Liaisons signature par défaut : type de demande signable → catégorie de modèle à rendre.
    // Seuls les source_type réellement portés par le workflow de signature sont mappés.
    private static readonly (string SourceType, string Category)[] Maps =
    {
        ("DemConge", "conge"),
        ("DemandeAutorisation", "autorisation"),
        ("DemandeAbsence", "visite_medicale"),
        ("Teletravail", "autorisation"),
        ("Manual", "contrat"),
    };

    /// <summary>
    /// Crée les modèles + liaisons manquants pour la société. Retourne (modèles créés, liaisons créées).
    /// </summary>
    public static async Task<(int Templates, int Maps)> SeedAsync(ApplicationDbContext db, string soccod, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(soccod)) return (0, 0);

        // 1. Modèles manquants (idempotent par nom, insensible à la casse).
        var existingNames = await db.RagLetterTemplates
            .Where(t => t.Soccod == soccod)
            .Select(t => t.Name)
            .ToListAsync(ct);
        var existing = new HashSet<string>(existingNames, StringComparer.OrdinalIgnoreCase);

        var templatesCreated = 0;
        foreach (var def in Templates)
        {
            if (existing.Contains(def.Name)) continue;
            db.RagLetterTemplates.Add(new RagLetterTemplate
            {
                Soccod = soccod,
                Name = def.Name,
                Description = def.Description,
                Category = def.Category,
                BodyHtml = def.Body,
                PlaceholdersJson = JsonSerializer.Serialize(ExtractPlaceholders(def.Body)),
                CreatedAt = DateTime.UtcNow,
            });
            templatesCreated++;
        }
        // SaveChanges nécessaire ICI : la liaison ci-dessous référence l'id auto-généré du modèle.
        if (templatesCreated > 0) await db.SaveChangesAsync(ct);

        // 2. Liaisons signature_template_map manquantes (idempotent par source_type pour la société).
        var bySoc = await db.RagLetterTemplates
            .Where(t => t.Soccod == soccod)
            .Select(t => new { t.Id, t.Category })
            .ToListAsync(ct);
        var existingMapTypes = await db.SignatureTemplateMaps
            .Where(m => m.Soccod == soccod)
            .Select(m => m.SourceType)
            .ToListAsync(ct);
        var mapped = new HashSet<string>(existingMapTypes, StringComparer.OrdinalIgnoreCase);

        var mapsCreated = 0;
        foreach (var (sourceType, category) in Maps)
        {
            if (mapped.Contains(sourceType)) continue;
            var tpl = bySoc.FirstOrDefault(t => string.Equals(t.Category, category, StringComparison.OrdinalIgnoreCase));
            if (tpl == null) continue; // modèle absent (ex. supprimé par l'admin) → on ne force pas
            db.SignatureTemplateMaps.Add(new SignatureTemplateMap
            {
                Soccod = soccod,
                SourceType = sourceType,
                TemplateKind = "letter",
                TemplateRef = tpl.Id.ToString(),
            });
            mapsCreated++;
        }
        if (mapsCreated > 0) await db.SaveChangesAsync(ct);

        return (templatesCreated, mapsCreated);
    }

    private static List<string> ExtractPlaceholders(string body)
    {
        if (string.IsNullOrEmpty(body)) return new List<string>();
        return PlaceholderRegex.Matches(body)
            .Select(m => m.Groups[1].Value)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .OrderBy(x => x)
            .ToList();
    }
}
