using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("t_sal")]
public partial class TSal : BaseEntity
{
    [Column("SA_CompteurNumero")]
    public int? SaCompteurNumero { get; set; }

    public int? MatriculeSalarie { get; set; }

    [StringLength(10)]
    public string? Civilite { get; set; }

    [StringLength(60)]
    public string? Nom { get; set; }

    [StringLength(60)]
    public string? NomJeuneFille { get; set; }

    [StringLength(60)]
    public string? Prenom { get; set; }

    [StringLength(60)]
    public string? Prenom2 { get; set; }
}
