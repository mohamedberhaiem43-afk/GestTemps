using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Table("service")]
public partial class Service : BaseEntity
{
    [Column("sercod")]
    [StringLength(4)]
    public string? Sercod { get; set; }

    [Column("soccod")]
    [StringLength(6)]
    public string? Soccod { get; set; }

    [Column("serlib")]
    [StringLength(30)]
    public string? Serlib { get; set; }

    [Column("serloc")]
    [StringLength(1)]
    public string? Serloc { get; set; }

    // Localisation (texte libre) du service — distincte de Serloc qui est un flag O/N
    // « service externe ». Ajoutée pour l'écran Structure organisationnelle.
    [Column("serlieu")]
    [StringLength(60)]
    public string? Serlieu { get; set; }

    [Column("seremail")]
    [StringLength(256)]
    public string? Seremail { get; set; }

    [Column("effectif")]
    public int? Effectif { get; set; }
}
