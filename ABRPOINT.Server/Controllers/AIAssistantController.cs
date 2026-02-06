using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Interfaces;
using Microsoft.AspNetCore.Mvc;
using Microsoft.SemanticKernel;
using Microsoft.SemanticKernel.Connectors.OpenAI;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace ABRPOINT.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class AIAssistantController:ControllerBase
    {
        private readonly Kernel _kernel;

        public AIAssistantController(Kernel kernel)
        {
            _kernel = kernel;
        }
        [HttpPost("chat")]
        public async Task<IActionResult> Chat([FromBody] ChatRequest request)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(request?.NewMessage))
                {
                    return BadRequest(new { error = "Le message ne peut pas être vide" });
                }
                var executionSettings = new OpenAIPromptExecutionSettings
                {
                    ToolCallBehavior = ToolCallBehavior.AutoInvokeKernelFunctions,
                    Temperature = 0.7,
                    MaxTokens = 2000
                };
                var prompt = request.NewMessage.ToLower();

                // ⭐ Détection de requête PRÉSENCE DÉTAILLÉE
                if (prompt.Contains("présence") || prompt.Contains("presence") ||
                    prompt.Contains("etat") || prompt.Contains("état") ||
                    prompt.Contains("détail") || prompt.Contains("detail") ||
                    prompt.Contains("journée") || prompt.Contains("journee"))
                {
                    try
                    {
                        var parameters = ExtractPresenceParameters(request.NewMessage);

                        var presenceArgs = new KernelArguments
                        {
                            ["soccod"] = parameters.Soccod,
                            ["empcods"] = string.Join(",", parameters.Empcods),
                            ["dateDebut"] = parameters.DateDebut,
                            ["dateFin"] = parameters.DateFin
                        };

                        var result = await _kernel.InvokeAsync(
                            pluginName: "Presence",
                            functionName: "GetEtatPeriodique",
                            arguments: presenceArgs
                        );

                        var presenceData = result.GetValue<IEnumerable<PresenceDto>>()?.ToList();

                        if (presenceData == null || presenceData.Count == 0)
                        {
                            return Ok(new
                            {
                                response = $"❌ Aucune présence trouvée pour l'employé {string.Join(", ", parameters.Empcods)} du {parameters.DateDebut} au {parameters.DateFin}"
                            });
                        }

                        // Grouper par employé
                        var groupedByEmployee = presenceData.GroupBy(p => p.Empcod).ToList();

                        var summary = groupedByEmployee.Select(group => new
                        {
                            //Employé = group.First().Emplib,
                            Matricule = group.First().Empmat,
                            CodeEmployé = group.Key,
                            Période = $"{parameters.DateDebut} au {parameters.DateFin}",
                            NombreJours = group.Count(),
                            Statistiques = new
                            {
                                JoursPointés = group.Count(p => !string.IsNullOrEmpty(p.Preentmatup)),
                                JoursRepos = group.Count(p => p.Prerepos == "1"),
                                JoursAbsence = group.Count(p => !string.IsNullOrEmpty(p.Etat) &&
                                                                p.Etat != "J.Repos" &&
                                                                p.Prerepos != "1"),
                                TotalHeures = group.Sum(p => p.TotalHeure ?? 0),
                                TotalRetards = group.Sum(p =>
                                {
                                    if (string.IsNullOrEmpty(p.Totret)) return 0;
                                    var parts = p.Totret.Split(':');
                                    if (parts.Length == 2 &&
                                        int.TryParse(parts[0], out int hours) &&
                                        int.TryParse(parts[1], out int mins))
                                        return hours * 60 + mins;
                                    return 0;
                                })
                            },
                            Détails = group.Select(p => new
                            {
                                Date = p.Predat?.ToString("dd/MM/yyyy"),
                                Jour = p.Jour,
                                Entrée1 = p.Preentmatup,
                                Sortie1 = p.Presortmatup,
                                Entrée2 = p.Preentamidiup,
                                Sortie2 = p.Presortamidiup,
                                TotalHeures = p.Tothre,
                                Retard = p.Totret,
                                État = p.Etat,
                                Observation = p.Preobs,
                                Repos = p.Prerepos == "1" ? "Oui" : "Non"
                            }).Take(10).ToList() // Limiter à 10 jours pour éviter surcharge
                        }).ToList();

                        var formattingPrompt = $@"L'utilisateur demande l'état périodique de présence détaillé.

Données trouvées :
{JsonSerializer.Serialize(summary, new JsonSerializerOptions { WriteIndented = true })}

Présente ces informations de manière claire et professionnelle en français.
Fournis un résumé avec :
- Le nombre total de jours dans la période
- Les jours pointés vs jours de repos
- Les absences
- Le total d'heures travaillées
- Les retards (en heures et minutes)
- Un aperçu des 10 premiers jours de détail

Utilise des emojis et un formatage markdown pour rendre la réponse attractive.";

                        var formattingArgs = new KernelArguments
                        {
                            ["prompt"] = formattingPrompt
                        };

                        var finalResponse = await _kernel.InvokeAsync(
                            pluginName: "Gemini",
                            functionName: "GenerateResponse",
                            arguments: formattingArgs
                        );

                        var responseText = finalResponse.GetValue<string>();

                        if (string.IsNullOrWhiteSpace(responseText) || responseText == "Pas de réponse")
                        {
                            // Fallback manuel
                            var firstGroup = groupedByEmployee.First();
                            var stats = firstGroup.Select(g => g).ToList();
                            var totalRetardMinutes = stats.Sum(p =>
                            {
                                if (string.IsNullOrEmpty(p.Totret)) return 0;
                                var parts = p.Totret.Split(':');
                                if (parts.Length == 2 &&
                                    int.TryParse(parts[0], out int hours) &&
                                    int.TryParse(parts[1], out int mins))
                                    return hours * 60 + mins;
                                return 0;
                            });

                            responseText = $@"📊 **État périodique de présence**

👤 ** ({firstGroup.First().Empmat})
📅 Période : {parameters.DateDebut} au {parameters.DateFin}

📈 **Statistiques :**
✅ Jours pointés : {stats.Count(p => !string.IsNullOrEmpty(p.Preentmatup))}
🏖️ Jours de repos : {stats.Count(p => p.Prerepos == "1")}
❌ Jours d'absence : {stats.Count(p => !string.IsNullOrEmpty(p.Etat) && p.Etat != "J.Repos" && p.Prerepos != "1")}
⏱️ Total heures : {stats.Sum(p => p.TotalHeure ?? 0):F2}h
⏰ Total retards : {totalRetardMinutes / 60}h {totalRetardMinutes % 60}min

📋 **Aperçu des 10 premiers jours :**
{string.Join("\n", stats.Take(10).Select(p => $"• {p.Predat?.ToString("dd/MM")} : {p.Preentmatup} - {p.Presortmatup} | {p.Tothre} | {(p.Prerepos == "1" ? "Repos" : p.Etat ?? "Présent")}"))}";
                        }

                        return Ok(new
                        {
                            response = responseText,
                            metadata = new
                            {
                                recordsFound = presenceData.Count,
                                employees = groupedByEmployee.Count,
                                period = $"{parameters.DateDebut} - {parameters.DateFin}"
                            }
                        });
                    }
                    catch (Exception presenceEx)
                    {
                        return Ok(new { response = $"❌ Erreur présence : {presenceEx.Message}" });
                    }
                }

                // ⭐ Détection de requête pointage (code existant)
                if (prompt.Contains("pointage") || prompt.Contains("employe") || prompt.Contains("employé"))
                {
                    try
                    {
                        var parameters = ExtractParametersManually(request.NewMessage);
                        // ⭐ Appel du plugin Pointage
                        var pointageArgs = new KernelArguments
                        {
                            ["soccod"] = parameters.Soccod,
                            ["empcods"] = parameters.Empcods,
                            ["mois"] = parameters.Mois,
                            ["annee"] = parameters.Annee,
                            ["semaine"] = parameters.Semaine ?? "0"
                        };

                        var result = await _kernel.InvokeAsync(
                            pluginName: "Pointage",
                            functionName: "GetPointageMois",
                            arguments: pointageArgs
                        );

                        var pointageData = result.GetValue<List<PointageMois>>();


                        if (pointageData == null || pointageData.Count == 0)
                        {
                            return Ok(new
                            {
                                response = $"❌ Aucun pointage trouvé pour l'employé {string.Join(", ", parameters.Empcods)} en {parameters.Mois}/{parameters.Annee}"
                            });
                        }

                        // ⭐ Extraire uniquement les données essentielles pour Gemini
                        var summary = pointageData.Select(p => new
                        {
                            Employé = p.EmpLib,
                            Matricule = p.EmpMat,
                            Régime = p.EmpReg,
                            Résumé = p.heuresSupplementairesResultats?.FirstOrDefault() != null ? new
                            {
                                HeuresNormales = p.heuresSupplementairesResultats[0].HeuresNormales,
                                HeuresSup = p.heuresSupplementairesResultats[0].HreSupSemaine,
                                Retard = p.heuresSupplementairesResultats[0].Retard,
                                TotalHeures = p.heuresSupplementairesResultats[0].Tothre,
                                JoursPointés = p.heuresSupplementairesResultats[0].NbJourPointer,
                                JoursRepos = p.heuresSupplementairesResultats[0].JourRepos
                            } : null
                        }).ToList();


                        // ⭐ Créer un prompt concis pour Gemini
                        var formattingPrompt = $@"L'utilisateur demande le pointage de l'employé pour {parameters.Mois}/{parameters.Annee}.

Données trouvées :
{JsonSerializer.Serialize(summary, new JsonSerializerOptions { WriteIndented = true })}

Présente ces informations de manière claire et professionnelle en français. 
Mets en évidence : les heures normales, les heures supplémentaires, les retards, et le total d'heures.";

                        var formattingArgs = new KernelArguments
                        {
                            ["prompt"] = formattingPrompt
                        };

                        var finalResponse = await _kernel.InvokeAsync(
                            pluginName: "Gemini",
                            functionName: "GenerateResponse",
                            arguments: formattingArgs
                        );

                        var responseText = finalResponse.GetValue<string>();

                        // ⭐ Vérifier si Gemini a retourné quelque chose
                        if (string.IsNullOrWhiteSpace(responseText) || responseText == "Pas de réponse")
                        {
                            // Fallback : créer une réponse manuelle
                            var firstRecord = pointageData.First();
                            var stats = firstRecord.heuresSupplementairesResultats?.FirstOrDefault();

                            responseText = $@"📊 **Pointage de {firstRecord.EmpLib} ({firstRecord.EmpMat})**
Période : {parameters.Mois}/{parameters.Annee}

✅ Heures normales : {stats?.HeuresNormales ?? 0}h
⏱️ Heures supplémentaires : {stats?.HreSupSemaine ?? 0}h
⏰ Retards : {stats?.Retard ?? 0} minutes
📈 Total heures : {stats?.Tothre ?? 0}h
📅 Jours pointés : {stats?.NbJourPointer ?? 0}
🏖️ Jours de repos : {stats?.JourRepos ?? 0}";
                        }

                        return Ok(new
                        {
                            response = responseText,
                            metadata = new
                            {
                                recordsFound = pointageData.Count,
                                employee = string.Join(", ", parameters.Empcods),
                                period = $"{parameters.Mois}/{parameters.Annee}"
                            }
                        });
                    }
                    catch (Exception pointageEx)
                    {
                        return Ok(new { response = $"❌ Erreur : {pointageEx.Message}" });
                    }
                }

                var normalArgs = new KernelArguments
                {
                    ["prompt"] = request.NewMessage
                };

                var normalResponse = await _kernel.InvokeAsync(
                    pluginName: "Gemini",
                    functionName: "GenerateResponse",
                    arguments: normalArgs
                );

                var normalText = normalResponse.GetValue<string>();

                if (string.IsNullOrWhiteSpace(normalText) || normalText == "Pas de réponse")
                {
                    normalText = "Désolé, je n'ai pas pu générer de réponse. Pouvez-vous reformuler votre question ?";
                }

                return Ok(new { response = normalText });


            }
            catch (Exception ex)
            {
                return Ok(new
                {
                    response = $"❌ Une erreur s'est produite : {ex.Message}"
                });
            }
        }

        private PresenceParameters ExtractPresenceParameters(string message)
        {
            var moisFrancais = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase)
            {
                { "janvier", 1 },
                { "février", 2 }, { "fevrier", 2 },
                { "mars", 3 },
                { "avril", 4 },
                { "mai", 5 },
                { "juin", 6 },
                { "juillet", 7 },
                { "août", 8 }, { "aout", 8 },
                { "septembre", 9 },
                { "octobre", 10 },
                { "novembre", 11 },
                { "décembre", 12 }, { "decembre", 12 }
            };

            var parameters = new PresenceParameters
            {
                Soccod = "01",
                Empcods = new List<string>(),
                DateDebut = DateTime.Now.ToString("yyyy-MM-dd"),
                DateFin = DateTime.Now.ToString("yyyy-MM-dd")
            };
            var dateUniqueMatch = Regex.Match(
                message,
                @"(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})",
                RegexOptions.IgnoreCase
            );
            if (dateUniqueMatch.Success)
            {
                int jour = int.Parse(dateUniqueMatch.Groups[1].Value);
                string moisTexte = dateUniqueMatch.Groups[2].Value;
                int annee = int.Parse(dateUniqueMatch.Groups[3].Value);

                if (moisFrancais.TryGetValue(moisTexte, out int mois))
                {
                    var date = new DateTime(annee, mois, jour);
                    parameters.DateDebut = date.ToString("yyyy-MM-dd");
                    parameters.DateFin = date.ToString("yyyy-MM-dd");
                }
            }

            // Extraction du code employé
            var employeMatch = Regex.Match(
                message,
                @"(?:employe[é]?\s*[:\s]*)?(\d{5,6})",
                RegexOptions.IgnoreCase
            );

            if (employeMatch.Success)
            {
                parameters.Empcods.Add(employeMatch.Groups[1].Value);
            }

            // Extraction des dates (format flexible)
            var dateRangeMatch = Regex.Match(
                message,
                @"(?:du|depuis)\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})\s*(?:au|jusqu'au|à)\s*(\d{1,2})[/-](\d{1,2})[/-](\d{4})",
                RegexOptions.IgnoreCase
            );

            if (dateRangeMatch.Success)
            {
                try
                {
                    var debut = new DateTime(
                        int.Parse(dateRangeMatch.Groups[3].Value),
                        int.Parse(dateRangeMatch.Groups[2].Value),
                        int.Parse(dateRangeMatch.Groups[1].Value)
                    );
                    var fin = new DateTime(
                        int.Parse(dateRangeMatch.Groups[6].Value),
                        int.Parse(dateRangeMatch.Groups[5].Value),
                        int.Parse(dateRangeMatch.Groups[4].Value)
                    );
                    parameters.DateDebut = debut.ToString("yyyy-MM-dd");
                    parameters.DateFin = fin.ToString("yyyy-MM-dd");
                }
                catch { }
            }
            else
            {
                // Détection mois/année
                var moisMatch = Regex.Match(message, @"(?:mois|en)\s*(\d{1,2})\s*/?\s*(\d{4})?", RegexOptions.IgnoreCase);
                if (moisMatch.Success)
                {
                    int mois = int.Parse(moisMatch.Groups[1].Value);
                    int annee = moisMatch.Groups[2].Success ? int.Parse(moisMatch.Groups[2].Value) : DateTime.Now.Year;

                    parameters.DateDebut = new DateTime(annee, mois, 1).ToString("yyyy-MM-dd");
                    parameters.DateFin = new DateTime(annee, mois, DateTime.DaysInMonth(annee, mois)).ToString("yyyy-MM-dd");
                }
            }

            if (parameters.Empcods.Count == 0)
            {
                parameters.Empcods.Add("ALL");
            }
            return parameters;
        }
        private PointageParameters ExtractParametersManually(string message)
        {
            var parameters = new PointageParameters
            {
                Soccod = "01",
                Empcods = new List<string>(),
                Mois = DateTime.Now.ToString("MM"),
                Annee = DateTime.Now.ToString("yyyy"),
                Semaine = "0"
            };

            // Extraction du code employé (plus permissive)
            var employeMatch = System.Text.RegularExpressions.Regex.Match(
                message,
                @"(?:employe[é]?\s*[:\s]*)?(\d{5,6})",
                System.Text.RegularExpressions.RegexOptions.IgnoreCase
            );

            if (employeMatch.Success)
            {
                parameters.Empcods.Add(employeMatch.Groups[1].Value);
            }

            // Extraction du mois
            var moisMatch = System.Text.RegularExpressions.Regex.Match(
                message,
                @"mois\s*[:\s]*(\d{1,2})|(?:^|\s)(\d{1,2})(?=/|\s+20)"
            );

            if (moisMatch.Success)
            {
                var moisValue = moisMatch.Groups[1].Success ? moisMatch.Groups[1].Value : moisMatch.Groups[2].Value;
                parameters.Mois = moisValue.PadLeft(2, '0');
            }

            // Extraction de l'année
            var anneeMatch = System.Text.RegularExpressions.Regex.Match(message, @"\b(20\d{2})\b");
            if (anneeMatch.Success)
            {
                parameters.Annee = anneeMatch.Groups[1].Value;
            }

            if (parameters.Empcods.Count == 0)
            {
                parameters.Empcods.Add("ALL");
            }

            Console.WriteLine($"[DEBUG] Extracted: Emp={string.Join(",", parameters.Empcods)}, Month={parameters.Mois}, Year={parameters.Annee}");

            return parameters;
        }


    }
    public class PresenceParameters
    {
        public string Soccod { get; set; } = "01";
        public List<string> Empcods { get; set; } = new List<string>();
        public string DateDebut { get; set; } = "";
        public string DateFin { get; set; } = "";

    }

    // Models
    public class ChatRequest
    {
        public List<ChatMessage> Messages { get; set; } = new();
        public string NewMessage { get; set; } = string.Empty;
        public string Query { get; set; } = string.Empty;
    }
    public class PointageParameters
    {
        public string Soccod { get; set; } = "01";
        public List<string> Empcods { get; set; } = new List<string>();
        public string Mois { get; set; } = "";
        public string Annee { get; set; } = "";
        public string? Semaine { get; set; } = "0";
    }
    public class ChatMessage
    {
        public string Role { get; set; } = string.Empty;
        public string Content { get; set; } = string.Empty;
    }
    public class PresenceStatistics
    {
        public int TotalEmployees { get; set; }
        public int PresentToday { get; set; }
        public int AbsentToday { get; set; }
        public int TotalRetards { get; set; }
        public decimal AttendanceRate { get; set; }
    }

    public class AbsenceInfo
    {
        public string EmployeeName { get; set; } = string.Empty;
        public DateTime Date { get; set; }
        public string Motif { get; set; } = string.Empty;
    }

    public class GlobalStatistics
    {
        public int TotalEmployees { get; set; }
        public decimal AverageMonthlyAttendance { get; set; }
        public decimal TotalHoursThisMonth { get; set; }
    }
}

