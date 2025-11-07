using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("article")]
public partial class Article
{
    [Column("artcod")]
    [StringLength(20)]
    public string? Artcod { get; set; }

    [Column("soccod")]
    [StringLength(50)]
    public string? Soccod { get; set; }

    [Column("artlib")]
    [StringLength(160)]
    public string? Artlib { get; set; }

    [Column("artimg")]
    [StringLength(12)]
    public string? Artimg { get; set; }

    [Column("artean")]
    [StringLength(20)]
    public string? Artean { get; set; }

    [Column("artqemb")]
    public float? Artqemb { get; set; }
}
