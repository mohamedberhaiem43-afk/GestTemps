using ABRPOINT.Server.Dtaos;
using ABRPOINT.Server.Models;
using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Mvc;
using System.ComponentModel;
using System.Data;
using System.Drawing;
using System.Globalization;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml;

namespace ABRPOINT.Helper
{
    public static class GenericMethodes
    {
        public static string GetMsgException(Exception ex)
        {
            while (ex.InnerException != null) ex = ex.InnerException;
            var msg = ex.InnerException is null ? ex.Message : ex.InnerException.Message;
            return msg;
        }
        public static bool IsValidHHmm(string input)
        {
            return TimeSpan.TryParse(input, out _);
        }
        // Helper method for formatting Empmat
        public static string FormatEmpmat(string empmat, short? requiredLength)
        {
            // Handle null or empty empmat
            if (string.IsNullOrWhiteSpace(empmat))
            {
                return string.Empty; // or generate a default value
            }

            // Extract numeric part only
            string numericPart = new string(empmat.Where(char.IsDigit).ToArray());

            // If no numeric characters found, return empty or handle as needed
            if (string.IsNullOrEmpty(numericPart))
            {
                return string.Empty;
            }

            // Parse to integer and format with leading zeros
            if (long.TryParse(numericPart, out long empmatNumber))
            {
                // Use long to handle larger numbers
                return empmatNumber.ToString($"D{requiredLength}");
            }

            // Fallback: if parsing fails, pad the original numeric string
            return numericPart.Length <= requiredLength
                ? numericPart.PadLeft((int)requiredLength, '0')
                : numericPart; // If longer than required, keep as is or truncate based on business rules
        }
        public static EmpparamPointageMois EnrichEmpparamWithPoste(EmpparamPointageMois baseParam, DateTime date, string codPoste, Dictionary<string, Poste> postesCache)
        {
            // Cloner les paramètres de base
            var enriched = new EmpparamPointageMois
            {
                Emppanier = baseParam.Emppanier,
                Empmaxhre = baseParam.Empmaxhre,
                Empmaxjour = baseParam.Empmaxjour,
                Empminhjour = baseParam.Empminhjour
            };

            // Enrichir avec les paramètres du poste si disponible
            if (!string.IsNullOrEmpty(codPoste) &&
                postesCache.TryGetValue(codPoste, out var poste))
            {
                var dayOfWeek = date.DayOfWeek;

                switch (dayOfWeek)
                {
                    case DayOfWeek.Monday:
                        enriched.PosteMaxhre = poste.Maxhrelun;
                        enriched.PosteMinhJour = poste.Minhjourlun;
                        enriched.PosteMinhDemiJour = poste.Minhdemijourlun;
                        break;
                    case DayOfWeek.Tuesday:
                        enriched.PosteMaxhre = poste.Maxhremar;
                        enriched.PosteMinhJour = poste.Minhjourmar;
                        enriched.PosteMinhDemiJour = poste.Minhdemijourmar;
                        break;
                    case DayOfWeek.Wednesday:
                        enriched.PosteMaxhre = poste.Maxhremer;
                        enriched.PosteMinhJour = poste.Minhjourmer;
                        enriched.PosteMinhDemiJour = poste.Minhdemijourmer;
                        break;
                    case DayOfWeek.Thursday:
                        enriched.PosteMaxhre = poste.Maxhrejeu;
                        enriched.PosteMinhJour = poste.Minhjourjeu;
                        enriched.PosteMinhDemiJour = poste.Minhdemijourjeu;
                        break;
                    case DayOfWeek.Friday:
                        enriched.PosteMaxhre = poste.Maxhreven;
                        enriched.PosteMinhJour = poste.Minhjourven;
                        enriched.PosteMinhDemiJour = poste.Minhdemijourven;
                        break;
                    case DayOfWeek.Saturday:
                        enriched.PosteMaxhre = poste.Maxhresam;
                        enriched.PosteMinhJour = poste.Minhjoursam;
                        enriched.PosteMinhDemiJour = poste.Minhdemijoursam;
                        break;
                    case DayOfWeek.Sunday:
                        enriched.PosteMaxhre = poste.Maxhredim;
                        enriched.PosteMinhJour = poste.Minhjourdim;
                        enriched.PosteMinhDemiJour = poste.Minhdemijourdim;
                        break;
                }
            }

            return enriched;
        }
        public static double journeeTime(float dayworkhours, EmpparamPointageMois empparam)
        {
            // PRIORITÉ 1: Utiliser les paramètres de l'employé (comportement actuel)
            if (empparam.Empminhjour != 0)
            {
                if (dayworkhours <= empparam.Empminhjour && dayworkhours > 1)
                    return 0.5;
                else
                    return 1;
            }
            // PRIORITÉ 2: Utiliser les paramètres du poste si disponibles
            if (empparam.PosteMinhJour.HasValue && empparam.PosteMinhDemiJour.HasValue)
            {
                if (dayworkhours >= empparam.PosteMinhJour.Value)
                    return 1; // Journée complète
                else if (dayworkhours >= empparam.PosteMinhDemiJour.Value)
                    return 0.5; // Demi-journée
                else
                    return 0; // Pas de journée comptée
            }

            return 1;
        }
        public static float CalculateHoursWithLimits(Presence presence, EmpparamPointageMois empparam)
        {
            float actualHours = 0;
            if (!string.IsNullOrEmpty(presence.Tothre))
                actualHours = (float)GenericMethodes.ConvertHHmmToDouble(presence.Tothre);

            // Limite 1: Maximum de l'employé (si configuré)
            if (empparam.Empmaxhre != 0)
                actualHours = MathF.Min(actualHours, (float)empparam.Empmaxhre);

            // Limite 2: Maximum du poste pour ce jour (si configuré)
            if (!string.IsNullOrEmpty(empparam.PosteMaxhre) &&
                float.TryParse(empparam.PosteMaxhre, out var maxPosteHours))
            {
                actualHours = MathF.Min(actualHours, maxPosteHours);
            }

            // Plancher à 0 : si la donnée stockée est négative (corruption d'un ancien calcul)
            // on évite de la propager au PDF et à l'affichage état périodique.
            if (actualHours < 0) actualHours = 0;
            return actualHours;
        }
        public static string GetElementText(byte? element)
        {
            if (!element.HasValue) return string.Empty; // Handle null case

            var elementRubriqueMap = new Dictionary<byte, string>
            {
                { 0, "Montant salarial" },
                { 1, "Montant patronal" },
                { 2, "Plafond" },
                { 3, "Plancher" },
                { 4, "Rapport B" },
                { 5, "Rapport C" },
                { 6, "Assiette annuelle" },
                { 7, "Assiette de calcul" }
            };

            return elementRubriqueMap.TryGetValue(element.Value, out var text) ? text : string.Empty;
        }
        public static bool NotPresent(Presence presence)
        {
            if (string.IsNullOrEmpty(presence?.Tothre) || (!string.IsNullOrEmpty(presence?.Tothre) && GenericMethodes.ConvertHHmmToDouble(presence?.Tothre) < 1)) return true;
            return (string.IsNullOrEmpty(presence?.Preentmatup) && string.IsNullOrEmpty(presence?.Presortmatup) &&
                string.IsNullOrEmpty(presence?.Preentamidiup) && string.IsNullOrEmpty(presence?.Presortamidiup)) || presence == null;
        }
        public static (string?, string?, string?, string?) GetStartsWorkDay(DateTime? date, Poste poste)
        {
            var dayOfWeek = date?.DayOfWeek ?? DateTime.Now.DayOfWeek;

            string? morningStartTime = dayOfWeek switch
            {
                DayOfWeek.Monday => poste?.Lunhdmat,
                DayOfWeek.Tuesday => poste?.Marhdmat,
                DayOfWeek.Wednesday => poste?.Merhdmat,
                DayOfWeek.Thursday => poste?.Jeuhdmat,
                DayOfWeek.Friday => poste?.Venhdmat,
                DayOfWeek.Saturday => poste?.Samhdmat,
                DayOfWeek.Sunday => poste?.Dimhdmat,
                _ => null
            };
            string? morningEndTime = dayOfWeek switch
            {
                DayOfWeek.Monday => poste?.Lunhfmat,
                DayOfWeek.Tuesday => poste?.Marhfmat,
                DayOfWeek.Wednesday => poste?.Merhfmat,
                DayOfWeek.Thursday => poste?.Jeuhfmat,
                DayOfWeek.Friday => poste?.Venhfmat,
                DayOfWeek.Saturday => poste?.Samhfmat,
                DayOfWeek.Sunday => poste?.Dimhfmat,
                _ => null
            };
            string? eveningStartTime = dayOfWeek switch
            {
                DayOfWeek.Monday => poste?.Lunhdam,
                DayOfWeek.Tuesday => poste?.Marhdam,
                DayOfWeek.Wednesday => poste?.Merhdam,
                DayOfWeek.Thursday => poste?.Jeuhdam,
                DayOfWeek.Friday => poste?.Venhdam,
                DayOfWeek.Saturday => poste?.Samhdam,
                DayOfWeek.Sunday => poste?.Dimhdam,
                _ => null
            };
            string? eveningEndTime = dayOfWeek switch
            {
                DayOfWeek.Monday => poste?.Lunhfam,
                DayOfWeek.Tuesday => poste?.Marhfam,
                DayOfWeek.Wednesday => poste?.Merhfam,
                DayOfWeek.Thursday => poste?.Jeuhfam,
                DayOfWeek.Friday => poste?.Venhfam,
                DayOfWeek.Saturday => poste?.Samhfam,
                DayOfWeek.Sunday => poste?.Dimhfam,
                _ => null
            };

            return (morningStartTime, morningEndTime, eveningStartTime, eveningEndTime);
        }
        public static string? GetReposWorkDay(DateTime? date, Poste poste)
        {
            var dayOfWeek = date?.DayOfWeek ?? DateTime.Now.DayOfWeek;

            string? repas = dayOfWeek switch
            {
                DayOfWeek.Monday => poste?.Lunrepos,
                DayOfWeek.Tuesday => poste?.Marrepos,
                DayOfWeek.Wednesday => poste?.Merrepos,
                DayOfWeek.Thursday => poste?.Jeurepos,
                DayOfWeek.Friday => poste?.Venrepos,
                DayOfWeek.Saturday => poste?.Samrepos,
                DayOfWeek.Sunday => poste?.Dimrepos,
                _ => null
            };

            return repas;
        }
        public static int? GetRepasWorkDay(DateTime? date, Poste poste)
        {
            var dayOfWeek = date?.DayOfWeek ?? DateTime.Now.DayOfWeek;

            int? repas = dayOfWeek switch
            {
                DayOfWeek.Monday => poste?.Lunrepas,
                DayOfWeek.Tuesday => poste?.Marrepas,
                DayOfWeek.Wednesday => poste?.Merrepas,
                DayOfWeek.Thursday => poste?.Jeurepas,
                DayOfWeek.Friday => poste?.Venrepas,
                DayOfWeek.Saturday => poste?.Samrepas,
                DayOfWeek.Sunday => poste?.Dimrepas,
                _ => null
            };

            return repas;
        }
        public static float? GetDoucheWorkDay(DateTime? date, Poste poste)
        {
            var dayOfWeek = date?.DayOfWeek ?? DateTime.Now.DayOfWeek;

            float? repas = dayOfWeek switch
            {
                DayOfWeek.Monday => poste?.Lundouche,
                DayOfWeek.Tuesday => poste?.Mardouche,
                DayOfWeek.Wednesday => poste?.Merdouche,
                DayOfWeek.Thursday => poste?.Jeudouche,
                DayOfWeek.Friday => poste?.Vendouche,
                DayOfWeek.Saturday => poste?.Samdouche,
                DayOfWeek.Sunday => poste?.Dimdouche,
                _ => null
            };

            return repas;
        }
        public static bool IsValid(Presence presence)
        {
            int actions = 0;
            if (!string.IsNullOrEmpty(presence?.Preentmatup) && !string.IsNullOrEmpty(presence?.Presortmatup))
                actions++;
            if (!string.IsNullOrEmpty(presence?.Preentamidiup) && !string.IsNullOrEmpty(presence?.Presortamidiup))
                actions++;
            if (actions == 0) return false;
            return actions != 0 || presence?.Prerepos == "1";
        }
        public static bool IsValid1(Presence presence)
        {
            int actions = 0;
            if (!string.IsNullOrEmpty(presence?.Preentmatup) && !string.IsNullOrEmpty(presence?.Presortmatup))
                actions++;
            if (!string.IsNullOrEmpty(presence?.Preentamidiup) && !string.IsNullOrEmpty(presence?.Presortamidiup))
                actions++;
            if (actions == 0) return false;
            return actions != 0 && presence?.Prerepos == "0";
        }
        public static bool IsPresent(Presence presence)
        {
            int actions = 0;
            if (!string.IsNullOrEmpty(presence?.Preentmatup) && !string.IsNullOrEmpty(presence?.Presortmatup))
                actions++;
            if (!string.IsNullOrEmpty(presence?.Preentamidiup) && !string.IsNullOrEmpty(presence?.Presortamidiup))
                actions++;
            if (actions == 0) return false;
            return actions != 0;
        }
        public static bool IsValid3(Presence presence)
        {
            int actions = 0;
            if (!string.IsNullOrEmpty(presence?.Preentmatup) && !string.IsNullOrEmpty(presence?.Presortmatup))
                actions++;
            if (!string.IsNullOrEmpty(presence?.Preentamidiup) && !string.IsNullOrEmpty(presence?.Presortamidiup))
                actions++;
            if (actions == 0 && presence?.Prerepos == "0") return true;
            return actions != 0 && presence?.Prerepos == "0";
        }
        public static void GetDateTimeFromString(string intervalDate, out DateTime date1, out DateTime date2, out bool b1, out bool b2)
        {
            try
            {
                string start = null, end = null;
                if (!string.IsNullOrEmpty(intervalDate))
                {
                    string date_range = intervalDate;
                    string[] dates = date_range.Split(" - ");
                    start = dates[0].ToString();
                    end = dates[1].ToString();
                }
                b1 = DateTime.TryParse(start, out date1);
                b2 = DateTime.TryParse(end, out date2);

                if (!b1)
                {
                    start = "01/" + start;
                    end = "01/" + end;
                }
                b1 = DateTime.TryParse(start, out date1);
                b2 = DateTime.TryParse(end, out date2);
            }
            catch (Exception e)
            {
                throw;
            }
        }
        public static string GetStringFromList(List<int> list)
        {
            string val = "";
            foreach (var item in list)
            {
                if (list.IndexOf(item) == 0)
                    val = item.ToString();
                else if (list.IndexOf(item) == list.Count - 1)
                    val += item.ToString();
                else
                    val += item + ",";
            }
            return val;
        }

        public static string GetCorrecteName(string fichier)
        {
            if (fichier is null) return fichier;

            fichier = fichier.Trim();

            fichier = fichier.Replace("<", "");
            fichier = fichier.Replace(">", "");
            fichier = fichier.Replace(":", "");
            fichier = fichier.Replace("«", "");
            fichier = fichier.Replace("|", "");
            fichier = fichier.Replace("?", "");
            fichier = fichier.Replace("*", "");
            fichier = fichier.Replace(".", "");

            return fichier;
        }
        public static float? ConvertHHmmToDouble(string time)
        {
            if (string.IsNullOrWhiteSpace(time))
                return null;

            var parts = time.Split(':');
            if (parts.Length != 2)
                return null;

            if (int.TryParse(parts[0], out int hours) && int.TryParse(parts[1], out int minutes))
            {
                return hours + (minutes / 60f);
            }

            return null;
        }


        public static double ConvertTimeToDecimal(string time)
        {
            var parts = time.Split(':');
            int hours = int.Parse(parts[0]);
            int minutes = int.Parse(parts[1]);
            return double.Parse($"{hours}.{minutes:D2}", System.Globalization.CultureInfo.InvariantCulture);
        }


        public static string? GetPropertyValue(Poste poste, string propertyName)
        {
            var prop = typeof(Poste).GetProperty(ToPascalCase(propertyName));
            return prop?.GetValue(poste)?.ToString();
        }

        public static int? GetNullableInt(Poste poste, string propertyName)
        {
            var prop = typeof(Poste).GetProperty(ToPascalCase(propertyName));
            return prop?.GetValue(poste) as int?;
        }

        public static float? GetNullableFloat(Poste poste, string propertyName)
        {
            var prop = typeof(Poste).GetProperty(ToPascalCase(propertyName));
            return prop?.GetValue(poste) as float?;
        }

        public static string ToPascalCase(string input)
        {
            if (string.IsNullOrWhiteSpace(input)) return input;
            return char.ToUpper(input[0]) + input.Substring(1);
        }

        public static string IncrementCode(string code)
        {
            char[] codeArray = code.ToCharArray();

            int length = codeArray.Length - 1;
            bool inc = true;

            while (length >= 0 && inc)
            {
                if (Char.IsDigit(codeArray[length]))
                {
                    if (codeArray[length] == '9')
                    {
                        codeArray[length] = '0';
                        length--;
                    }
                    else
                    {
                        codeArray[length] = Convert.ToChar(Convert.ToInt32(codeArray[length]) + 1);
                        inc = false;
                    }
                }
                else
                {
                    if (codeArray[length] == 'Z')
                    {
                        codeArray[length] = 'A';
                        length--;
                    }
                    else
                    {
                        if (codeArray[length] >= 'A' && codeArray[length] <= 'Z')
                            codeArray[length] = Convert.ToChar(Convert.ToInt32(codeArray[length]) + 1);

                        inc = false;
                    }
                }
            }

            code = string.Empty;

            for (int i = 0; i < codeArray.Length; i++)
                code += codeArray[i];

            return code;
        }

        public static DataTable ListToDataTable<T>(this IEnumerable<T> data)
        {
            PropertyDescriptorCollection properties = TypeDescriptor.GetProperties(typeof(T));
            DataTable table = new DataTable();
            foreach (PropertyDescriptor prop in properties)
                table.Columns.Add(prop.Name, Nullable.GetUnderlyingType(prop.PropertyType) ?? prop.PropertyType);
            foreach (T item in data)
            {
                DataRow row = table.NewRow();
                foreach (PropertyDescriptor prop in properties)
                    row[prop.Name] = prop.GetValue(item) ?? DBNull.Value;
                table.Rows.Add(row);
            }
            return table;
        }

        public static List<T> ConvertDataTableToList<T>(DataTable dt)
        {
            List<T> data = new List<T>();
            foreach (DataRow row in dt.Rows)
            {
                T item = GetItem<T>(row);
                data.Add(item);
            }
            return data;
        }

        private static T GetItem<T>(DataRow dr)
        {
            Type temp = typeof(T);
            T obj = Activator.CreateInstance<T>();

            foreach (DataColumn column in dr.Table.Columns)
            {
                foreach (PropertyInfo pro in temp.GetProperties())
                {
                    if (pro.Name == column.ColumnName)
                        pro.SetValue(obj, dr[column.ColumnName], null);
                    else
                        continue;
                }
            }
            return obj;
        }

        public static byte[] GetImageFromPath(string path)
        {
            if (!File.Exists(path))
                return null;
            else
            {
                FileStream stream = new FileStream(path, FileMode.Open);
                using (MemoryStream ms = new MemoryStream())
                {
                    stream.CopyTo(ms);
                    stream.Close();
                    return ms.ToArray();
                }
            }
        }
        public static Image GetImage(string path)
        {
            if (!File.Exists(path))
                return null;

            try
            {
                return System.Drawing.Image.FromFile(path);
            }
            catch
            {
                return null;
            }
        }
        public static IEnumerable<Tuple<DateTime, DateTime>> SplitDateRange(DateTime start, DateTime end, int dayChunkSize)
        {
            DateTime chunkEnd;
            while ((chunkEnd = start.AddDays(dayChunkSize)) < end)
            {
                yield return Tuple.Create(start, chunkEnd);
                start = chunkEnd;
            }
            yield return Tuple.Create(start, end);
        }

        public static string RemoveSpecialCharactersWithoutAddressSign(this string str)
        {
            StringBuilder sb = new StringBuilder();
            foreach (char c in str)
            {
                if (c == '@' || (c >= '0' && c <= '9') || (c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || c == '.' || c == '_')
                {
                    sb.Append(c);
                }
            }
            return sb.ToString();
        }

        public static bool IsValidEmail(string email)
        {
            if (string.IsNullOrWhiteSpace(email))
                return false;

            try
            {
                // Normalize the domain
                email = Regex.Replace(email, @"(@)(.+)$", DomainMapper,
                                      RegexOptions.None, TimeSpan.FromMilliseconds(200));

                // Examines the domain part of the email and normalizes it.
                string DomainMapper(Match match)
                {
                    // Use IdnMapping class to convert Unicode domain names.
                    var idn = new IdnMapping();

                    // Pull out and process domain name (throws ArgumentException on invalid)
                    string domainName = idn.GetAscii(match.Groups[2].Value);

                    return match.Groups[1].Value + domainName;
                }
            }
            catch (RegexMatchTimeoutException e)
            {
                return false;
            }
            catch (ArgumentException e)
            {
                return false;
            }

            try
            {
                return Regex.IsMatch(email,
                    @"^[^@\s]+@[^@\s]+\.[^@\s]+$",
                    RegexOptions.IgnoreCase, TimeSpan.FromMilliseconds(250));
            }
            catch (RegexMatchTimeoutException)
            {
                return false;
            }
        }

        public static IEnumerable<DateTime> EachDay(DateTime from, DateTime thru, int addDays)
        {
            for (var day = from; day.Date <= thru.Date; day = day.AddDays(addDays))
                yield return day;
        }

        public static IEnumerable<DateTime> EachMonth(DateTime from, DateTime thru, int addMonths)
        {
            for (var month = from; month.Date <= thru.Date || month.Month == thru.Month; month = month.AddMonths(addMonths))
                yield return month;
        }

        public static IEnumerable<DateTime> EachYear(DateTime from, DateTime thru, int addYears)
        {
            for (var year = from; year.Date <= thru.Date || year.Year == thru.Year; year = year.AddYears(addYears))
                yield return year;
        }

        public static IEnumerable<DateTime> EachDayTo(this DateTime dateFrom, DateTime dateTo, int addDays)
        {
            return EachDay(dateFrom, dateTo, addDays);
        }

        public static IEnumerable<DateTime> EachMonthTo(this DateTime dateFrom, DateTime dateTo, int addMonths)
        {
            return EachMonth(dateFrom, dateTo, addMonths);
        }

        public static IEnumerable<DateTime> EachYearTo(this DateTime dateFrom, DateTime dateTo, int addYears)
        {
            return EachYear(dateFrom, dateTo, addYears);
        }

        public static DateTime StartOfWeek(this DateTime dt, DayOfWeek startOfWeek)
        {
            int diff;
            var d = dt.DayOfWeek - startOfWeek;
            if (d >= 0)
            {
                diff = (7 + d) % 7;
            }
            else
            {
                diff = d;
            }
            var x = dt.AddDays(-1 * diff).Date;
            return x;
        }

        public static string? ConvertDoubleToHHmm(float? absheure)
        {
            if (!absheure.HasValue)
                return null;

            // Handle negative values
            bool isNegative = absheure.Value < 0;
            float absoluteValue = Math.Abs(absheure.Value);

            // Extract hours and minutes
            int hours = (int)absoluteValue;
            int minutes = (int)Math.Round((absoluteValue - hours) * 60);

            // Handle rounding edge case (59.5 minutes rounds to 60)
            if (minutes >= 60)
            {
                hours += 1;
                minutes = 0;
            }

            // Format with optional negative sign
            string sign = isNegative ? "-" : "";
            return $"{sign}{hours:D2}:{minutes:D2}";
        }

    }
}
 
