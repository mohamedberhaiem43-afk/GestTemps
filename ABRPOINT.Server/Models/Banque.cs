using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("banque")]
public partial class Banque
{
    [Column("bancod")]
    [StringLength(6)]
    public string? Bancod { get; set; }

    [Column("banlib")]
    [StringLength(20)]
    public string? Banlib { get; set; }

    [Column("banadr")]
    [StringLength(30)]
    public string? Banadr { get; set; }

    [Column("bantel")]
    [StringLength(20)]
    public string? Bantel { get; set; }

    [Column("banfax")]
    [StringLength(20)]
    public string? Banfax { get; set; }

    [Column("bancpt")]
    [StringLength(25)]
    public string? Bancpt { get; set; }
}
