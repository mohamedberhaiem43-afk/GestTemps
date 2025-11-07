using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("socsage")]
public partial class Socsage
{
    [Column("SOC_COD")]
    [StringLength(10)]
    public string? SocCod { get; set; }

    [Column("SOC_LIB")]
    [StringLength(255)]
    public string? SocLib { get; set; }

    [Column("BASESQL")]
    [StringLength(200)]
    public string? Basesql { get; set; }
}
