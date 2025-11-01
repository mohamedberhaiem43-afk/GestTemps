using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("t_typeremb")]
public partial class TTyperemb
{
    public int? No { get; set; }

    public int? NoPret { get; set; }

    public double? MontantEspece { get; set; }

    public double? MontantBultin { get; set; }
}
