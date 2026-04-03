using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using Microsoft.EntityFrameworkCore;

namespace ABRPOINT.Server.Models;

[Keyless]
[Table("pointuser")]
public partial class Pointuser
{
    [Column("TEMPLATEID")]
    public int Templateid { get; set; }

    [Column("USERID")]
    public int Userid { get; set; }

    [Column("FINGERID")]
    public int Fingerid { get; set; }

    [Column("TEMPLATE", TypeName = "image")]
    public byte[] Template { get; set; } = null!;

    [Column("TEMPLATE2", TypeName = "image")]
    public byte[]? Template2 { get; set; }

    [Column("BITMAPPICTURE", TypeName = "image")]
    public byte[]? Bitmappicture { get; set; }

    [Column("BITMAPPICTURE2", TypeName = "image")]
    public byte[]? Bitmappicture2 { get; set; }

    [Column("BITMAPPICTURE3", TypeName = "image")]
    public byte[]? Bitmappicture3 { get; set; }

    [Column("BITMAPPICTURE4", TypeName = "image")]
    public byte[]? Bitmappicture4 { get; set; }

    [Column("USETYPE")]
    public short? Usetype { get; set; }

    [Column("TEMPLATE3", TypeName = "image")]
    public byte[]? Template3 { get; set; }

    [Column("EMACHINENUM")]
    [StringLength(3)]
    public string? Emachinenum { get; set; }

    [Column("TEMPLATE1", TypeName = "image")]
    public byte[]? Template1 { get; set; }

    public short? Flag { get; set; }

    [Column("DivisionFP")]
    public short? DivisionFp { get; set; }

    [Column("TEMPLATE4", TypeName = "image")]
    public byte[]? Template4 { get; set; }
}
