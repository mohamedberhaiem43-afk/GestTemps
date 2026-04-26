using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ABRPOINT.Server.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "~TMPCLP651021",
                columns: table => new
                {
                    uticod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    predat = table.Column<DateTime>(type: "datetime", nullable: true),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    empmat = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    sercod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    codposte = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    preentmat = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortmat = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentamidi = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortamidi = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentmatup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortmatup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentamidiup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortamidiup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentsup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortsup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentasup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortasup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentsupup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortsupup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentasupup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortasupup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presem = table.Column<int>(type: "int", nullable: true),
                    prerepos = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    prerepas = table.Column<int>(type: "int", nullable: true),
                    preretmate = table.Column<DateTime>(type: "datetime", nullable: true),
                    preretmats = table.Column<DateTime>(type: "datetime", nullable: true),
                    preretame = table.Column<DateTime>(type: "datetime", nullable: true),
                    preretams = table.Column<DateTime>(type: "datetime", nullable: true),
                    preretmateup = table.Column<DateTime>(type: "datetime", nullable: true),
                    preretmatsup = table.Column<DateTime>(type: "datetime", nullable: true),
                    preretameup = table.Column<DateTime>(type: "datetime", nullable: true),
                    preretamsup = table.Column<DateTime>(type: "datetime", nullable: true),
                    preavantent = table.Column<int>(type: "int", nullable: true),
                    preapresent = table.Column<int>(type: "int", nullable: true),
                    preavantsort = table.Column<int>(type: "int", nullable: true),
                    preapressort = table.Column<int>(type: "int", nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    empreg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    empcharge = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    preobs = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    dmdate = table.Column<DateTime>(type: "datetime", nullable: true),
                    catcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    tothre = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    tothabs = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    tothsup = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    tothnuit = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    optimise = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    totcmp = table.Column<int>(type: "int", nullable: true),
                    emptype = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    nbhjour = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    totnuit = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    catcod1 = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    nbhsem = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    hferie = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    rubtype = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    soccod1 = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    tothabs1 = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    tothaut = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    tothrepas = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    tothavance = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    tothsup1 = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    tothretrepas = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    preobs1 = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    optimise1 = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    totcmp1 = table.Column<double>(type: "float", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "absence",
                columns: table => new
                {
                    abscod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: false),
                    abslib = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    abscng = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    abssanc = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    abspayer = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    absaut = table.Column<int>(type: "int", nullable: true),
                    abspar = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    absrepos = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    rubcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    absferier = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    absunite = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_absence", x => new { x.soccod, x.abscod });
                });

            migrationBuilder.CreateTable(
                name: "aide",
                columns: table => new
                {
                    modcod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    modzone = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    modhelp = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "allaitement",
                columns: table => new
                {
                    concod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    condat = table.Column<DateTime>(type: "datetime", nullable: true),
                    conjour = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    condep = table.Column<DateTime>(type: "datetime", nullable: true),
                    conret = table.Column<DateTime>(type: "datetime", nullable: true),
                    lundi = table.Column<float>(type: "real", nullable: true),
                    mardi = table.Column<float>(type: "real", nullable: true),
                    mercredi = table.Column<float>(type: "real", nullable: true),
                    jeudi = table.Column<float>(type: "real", nullable: true),
                    vendredi = table.Column<float>(type: "real", nullable: true),
                    samedi = table.Column<float>(type: "real", nullable: true),
                    dimanche = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_allaitement", x => new { x.soccod, x.concod });
                });

            migrationBuilder.CreateTable(
                name: "anomalie",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    anodat = table.Column<DateTime>(type: "datetime", nullable: true),
                    motif = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    modcod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    uticod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "article",
                columns: table => new
                {
                    artcod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    artlib = table.Column<string>(type: "nvarchar(160)", maxLength: 160, nullable: true),
                    artimg = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    artean = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    artqemb = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "AuditLog",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Uticod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    Action = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    TableName = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DateAction = table.Column<DateTime>(type: "datetime2", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DeletedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    RetentionDate = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AuditLog", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "autoriser",
                columns: table => new
                {
                    concod = table.Column<string>(type: "nchar(10)", fixedLength: true, maxLength: 10, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    condat = table.Column<DateTime>(type: "datetime", nullable: true),
                    conjour = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    condep = table.Column<DateTime>(type: "datetime", nullable: true),
                    conamdep = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    conret = table.Column<DateTime>(type: "datetime", nullable: true),
                    conamret = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    abscod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    conmotif = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    consanc = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    connbjour = table.Column<float>(type: "real", nullable: true),
                    conref = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    conaffecte = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_autoriser", x => x.concod);
                });

            migrationBuilder.CreateTable(
                name: "banque",
                columns: table => new
                {
                    bancod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    banlib = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    banadr = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    bantel = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    banfax = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    bancpt = table.Column<string>(type: "nvarchar(25)", maxLength: 25, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "billet",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    predat = table.Column<DateTime>(type: "datetime", nullable: true),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    empmat = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    motif = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "calendsoc",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    cal_an = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    cal_mois = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    cal_sem = table.Column<int>(type: "int", nullable: false),
                    caltype = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    cal_nbh = table.Column<float>(type: "real", nullable: true),
                    cal_trav = table.Column<float>(type: "real", nullable: true),
                    cal_hjour = table.Column<float>(type: "real", nullable: true),
                    cal_houv = table.Column<float>(type: "real", nullable: true),
                    callib = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    cal_hsem = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_calendsoc", x => new { x.soccod, x.cal_an, x.cal_mois, x.cal_sem });
                });

            migrationBuilder.CreateTable(
                name: "categorie",
                columns: table => new
                {
                    catcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: false),
                    catlib = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    cathsup = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    catperiode = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    catsem2 = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    catsem3 = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    catsem4 = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    catsem5 = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    catsem6 = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    catsem7 = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    catsem8 = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    catsem9 = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    catsem10 = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    catsem11 = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    catsem12 = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_categorie", x => new { x.catcod, x.soccod });
                });

            migrationBuilder.CreateTable(
                name: "cloture",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    annee = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    mois = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    titcod = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    clodat = table.Column<DateTime>(type: "datetime", nullable: true),
                    clousr = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "cnss",
                columns: table => new
                {
                    cnscod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    cnslib = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    cnspat = table.Column<float>(type: "real", nullable: true),
                    cnsemp = table.Column<float>(type: "real", nullable: true),
                    cnsirpp = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    accsoc = table.Column<float>(type: "real", nullable: true),
                    accemp = table.Column<float>(type: "real", nullable: true),
                    cnstype = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    cnsexp = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "coltable",
                columns: table => new
                {
                    latable = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    champs = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    typech = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    taille = table.Column<int>(type: "int", nullable: true),
                    Description = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    tablelier = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    editer = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    Abréviation = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "compenser",
                columns: table => new
                {
                    concod = table.Column<string>(type: "nchar(10)", fixedLength: true, maxLength: 10, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    condat = table.Column<DateTime>(type: "datetime", nullable: true),
                    concmp = table.Column<DateTime>(type: "datetime", nullable: true),
                    conjour = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    condep = table.Column<DateTime>(type: "datetime", nullable: true),
                    conamdep = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    conret = table.Column<DateTime>(type: "datetime", nullable: true),
                    conamret = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    abscod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    conmotif = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    consanc = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    connbjour = table.Column<double>(type: "float", nullable: true),
                    conref = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    conaffecte = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_compenser", x => new { x.concod, x.soccod });
                });

            migrationBuilder.CreateTable(
                name: "conge",
                columns: table => new
                {
                    concod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    condat = table.Column<DateTime>(type: "datetime", nullable: true),
                    conjour = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    condep = table.Column<DateTime>(type: "datetime", nullable: true),
                    conamdep = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    conret = table.Column<DateTime>(type: "datetime", nullable: true),
                    conamret = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    abscod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    conadr = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    contel = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    condg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    conrefus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    connbjour = table.Column<float>(type: "real", nullable: true),
                    conref = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    consolde = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_conge", x => new { x.soccod, x.concod });
                });

            migrationBuilder.CreateTable(
                name: "congenon",
                columns: table => new
                {
                    concod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "contrat",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    concod = table.Column<string>(type: "nvarchar(9)", maxLength: 9, nullable: false),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    condat = table.Column<DateTime>(type: "datetime", nullable: true),
                    contype = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    sercod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    empreg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    catcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    vilcod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    empadr = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    emppost = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    emptel = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    empemb = table.Column<DateTime>(type: "datetime", nullable: true),
                    empsort = table.Column<DateTime>(type: "datetime", nullable: true),
                    condg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    empmotif = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    empdcin = table.Column<DateTime>(type: "datetime", nullable: true),
                    empacin = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    quacod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    empech = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: true),
                    empelon = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    empcat = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    empscat = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    cnscod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    empsbase = table.Column<float>(type: "real", nullable: true),
                    empsbrut = table.Column<float>(type: "real", nullable: true),
                    socresp = table.Column<string>(type: "nvarchar(80)", maxLength: 80, nullable: true),
                    dircod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    empcontrat = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    conmois = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_contrat", x => new { x.soccod, x.concod });
                });

            migrationBuilder.CreateTable(
                name: "contrat2",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    concod = table.Column<string>(type: "nvarchar(9)", maxLength: 9, nullable: true),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    condat = table.Column<DateTime>(type: "datetime", nullable: true),
                    contype = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    sercod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    empreg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    catcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    vilcod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    empadr = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    emppost = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    emptel = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    empemb = table.Column<DateTime>(type: "datetime", nullable: true),
                    empsort = table.Column<DateTime>(type: "datetime", nullable: true),
                    condg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    empmotif = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    empdcin = table.Column<DateTime>(type: "datetime", nullable: true),
                    empacin = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    quacod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    empech = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: true),
                    empelon = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    empcat = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    empscat = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    cnscod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    empsbase = table.Column<float>(type: "real", nullable: true),
                    empsbrut = table.Column<float>(type: "real", nullable: true),
                    socresp = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    dircod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    empcontrat = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    conmois = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "defaut",
                columns: table => new
                {
                    defcod = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: true),
                    deflib = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "demande_autorisation",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    soccod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    concod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    condat = table.Column<DateTime>(type: "datetime", nullable: true),
                    condep = table.Column<DateTime>(type: "datetime", nullable: true),
                    conret = table.Column<DateTime>(type: "datetime", nullable: true),
                    connbjour = table.Column<float>(type: "real", nullable: true),
                    conmotif = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    statut = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    date_demande = table.Column<DateTime>(type: "datetime", nullable: true),
                    traite_par = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    date_traitement = table.Column<DateTime>(type: "datetime", nullable: true),
                    commentaire = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    abscod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_demande_autorisation", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "demconge",
                columns: table => new
                {
                    concod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    condat = table.Column<DateTime>(type: "datetime", nullable: true),
                    conjour = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    condep = table.Column<DateTime>(type: "datetime", nullable: true),
                    conamdep = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    conret = table.Column<DateTime>(type: "datetime", nullable: true),
                    conamret = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    abscod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    conadr = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    contel = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    condg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    conrefus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    connbjour = table.Column<float>(type: "real", nullable: true),
                    conref = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    consolde = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_demconge", x => new { x.soccod, x.concod });
                });

            migrationBuilder.CreateTable(
                name: "direction",
                columns: table => new
                {
                    dircod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    dirlib = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    dirloc = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    dirtitre = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    dirresp = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    dirrespar = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    diremail = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_direction", x => new { x.dircod, x.soccod });
                });

            migrationBuilder.CreateTable(
                name: "dmpoint",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: false),
                    dmdat = table.Column<DateTime>(type: "datetime", nullable: false),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    dmpnt = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    dmhre = table.Column<DateTime>(type: "datetime", nullable: true),
                    dmsem = table.Column<int>(type: "int", nullable: true),
                    dmlue = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    dmtype = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_dmpoint", x => new { x.empcod, x.soccod, x.dmdat });
                });

            migrationBuilder.CreateTable(
                name: "dmpresence",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    dmdat = table.Column<DateTime>(type: "datetime", nullable: true),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    dmpnt = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    dmhre = table.Column<DateTime>(type: "datetime", nullable: true),
                    dmsem = table.Column<int>(type: "int", nullable: true),
                    dmlue = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    dmtype = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "documentvault",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: false),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    docname = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: false),
                    doctype = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    docpath = table.Column<string>(type: "nvarchar(1024)", maxLength: 1024, nullable: false),
                    docsize = table.Column<long>(type: "bigint", nullable: false),
                    docdate = table.Column<DateTime>(type: "datetime", nullable: false),
                    issigned = table.Column<bool>(type: "bit", nullable: false),
                    signaturedate = table.Column<DateTime>(type: "datetime", nullable: true),
                    signaturepath = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    status = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_documentvault", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "donne",
                columns: table => new
                {
                    doncod = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    doncle1 = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    doncle2 = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    doncle3 = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    doncle4 = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "echelle",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    griech01 = table.Column<float>(type: "real", nullable: true),
                    griech02 = table.Column<float>(type: "real", nullable: true),
                    griech03 = table.Column<float>(type: "real", nullable: true),
                    griech04 = table.Column<float>(type: "real", nullable: true),
                    griech05 = table.Column<float>(type: "real", nullable: true),
                    griech06 = table.Column<float>(type: "real", nullable: true),
                    griech07 = table.Column<float>(type: "real", nullable: true),
                    griech08 = table.Column<float>(type: "real", nullable: true),
                    griech09 = table.Column<float>(type: "real", nullable: true),
                    griech10 = table.Column<float>(type: "real", nullable: true),
                    griech11 = table.Column<float>(type: "real", nullable: true),
                    griech12 = table.Column<float>(type: "real", nullable: true),
                    griech13 = table.Column<float>(type: "real", nullable: true),
                    griech14 = table.Column<float>(type: "real", nullable: true),
                    griech15 = table.Column<float>(type: "real", nullable: true),
                    griech16 = table.Column<float>(type: "real", nullable: true),
                    griech17 = table.Column<float>(type: "real", nullable: true),
                    griech18 = table.Column<float>(type: "real", nullable: true),
                    griech19 = table.Column<float>(type: "real", nullable: true),
                    griech20 = table.Column<float>(type: "real", nullable: true),
                    griech21 = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "empaff",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    emplib = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    heuredeb = table.Column<int>(type: "int", nullable: true),
                    empmat = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    heurefin = table.Column<int>(type: "int", nullable: true),
                    affdate = table.Column<DateTime>(type: "datetime", nullable: true),
                    empsexe = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    sercod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    empdu = table.Column<DateTime>(type: "datetime", nullable: true),
                    empfonc = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    empau = table.Column<DateTime>(type: "datetime", nullable: true),
                    empreg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    catcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    socaff = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    empnbp = table.Column<float>(type: "real", nullable: true),
                    sitaff = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    foncod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    natcod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    quacod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    vilcod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    empadr = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    emptel = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    empmob = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "empcat",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    catdeb = table.Column<DateTime>(type: "datetime", nullable: true),
                    catfin = table.Column<DateTime>(type: "datetime", nullable: true),
                    catcod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "empchg",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    empref = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    empdat = table.Column<DateTime>(type: "datetime", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "empchoisie",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: false),
                    uticod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    emplib = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_empchoisie", x => new { x.empcod, x.soccod });
                });

            migrationBuilder.CreateTable(
                name: "empgrh",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    emplib = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    soclib = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "employe",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: false),
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    emplib = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    empmat = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    empsexe = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    sercod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    empfonc = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    empreg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    catcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    empnbp = table.Column<int>(type: "int", nullable: true),
                    natcod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    vilcod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    empadr = table.Column<string>(type: "varchar(100)", unicode: false, maxLength: 100, nullable: true),
                    emptel = table.Column<string>(type: "varchar(256)", unicode: false, maxLength: 256, nullable: true),
                    empmob = table.Column<string>(type: "text", nullable: true),
                    empemb = table.Column<DateTime>(type: "datetime", nullable: true),
                    empsort = table.Column<DateTime>(type: "datetime", nullable: true),
                    empmotif = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    actif = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    empdnais = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    emplnais = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    empcin = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    empdcin = table.Column<DateTime>(type: "datetime", nullable: true),
                    empacin = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    empsbase = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    empsbrut = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    empdir = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    emptype = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    empniv = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    emplibar = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    empadrar = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    empfoncar = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    foncod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    quacod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    empmaxhre = table.Column<double>(type: "float", nullable: true),
                    empoptim = table.Column<DateTime>(type: "datetime", nullable: true),
                    dircod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    empretraite = table.Column<DateTime>(type: "datetime", nullable: true),
                    caltype = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    empmaxjour = table.Column<double>(type: "float", nullable: true),
                    empretard = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    empemail = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    empresp = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    empsnet = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    empcontrat = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    empsitfam = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    empech = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: true),
                    empelon = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    empcat = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    empscat = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    empnuit = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    empminhjour = table.Column<double>(type: "float", nullable: true),
                    emppanier = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    seccod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    poscod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    empferepos = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    empcmp = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_employe", x => new { x.empcod, x.soccod, x.sitcod });
                });

            migrationBuilder.CreateTable(
                name: "emprnd",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    rnddate = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    annee = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    mois = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    rubcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    rndnote = table.Column<double>(type: "float", nullable: true),
                    rndvaleur = table.Column<double>(type: "float", nullable: true),
                    nbhprod = table.Column<double>(type: "float", nullable: true),
                    nbhpre = table.Column<double>(type: "float", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "empuser",
                columns: table => new
                {
                    ntable = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    nchamps = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    paie = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    point = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "ferier",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: false),
                    ferdate = table.Column<DateTime>(type: "datetime", nullable: false),
                    annee = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    fermotif = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    ferfixe = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    fertype = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    ferheure = table.Column<float>(type: "real", nullable: true),
                    fernpaye = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    fertrv = table.Column<DateTime>(type: "datetime", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ferier", x => new { x.soccod, x.ferdate });
                });

            migrationBuilder.CreateTable(
                name: "fonction",
                columns: table => new
                {
                    foncod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    fonlib = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    fontype = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    fonpqual = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    fonpchoix = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_fonction", x => new { x.soccod, x.foncod });
                });

            migrationBuilder.CreateTable(
                name: "grille",
                columns: table => new
                {
                    catcod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    grireg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    grideb = table.Column<DateTime>(type: "datetime", nullable: true),
                    grifin = table.Column<DateTime>(type: "datetime", nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    griech01 = table.Column<float>(type: "real", nullable: true),
                    griech02 = table.Column<float>(type: "real", nullable: true),
                    griech03 = table.Column<float>(type: "real", nullable: true),
                    griech04 = table.Column<float>(type: "real", nullable: true),
                    griech05 = table.Column<float>(type: "real", nullable: true),
                    griech06 = table.Column<float>(type: "real", nullable: true),
                    griech07 = table.Column<float>(type: "real", nullable: true),
                    griech08 = table.Column<float>(type: "real", nullable: true),
                    griech09 = table.Column<float>(type: "real", nullable: true),
                    griech10 = table.Column<float>(type: "real", nullable: true),
                    griech11 = table.Column<float>(type: "real", nullable: true),
                    griech12 = table.Column<float>(type: "real", nullable: true),
                    griech13 = table.Column<float>(type: "real", nullable: true),
                    griech14 = table.Column<float>(type: "real", nullable: true),
                    griech15 = table.Column<float>(type: "real", nullable: true),
                    griech16 = table.Column<float>(type: "real", nullable: true),
                    griech17 = table.Column<float>(type: "real", nullable: true),
                    griech18 = table.Column<float>(type: "real", nullable: true),
                    griech19 = table.Column<float>(type: "real", nullable: true),
                    griech20 = table.Column<float>(type: "real", nullable: true),
                    griech21 = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "hsalaire",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    salannee = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    salmois = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    saltit = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    salmat = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    salacc = table.Column<float>(type: "real", nullable: true),
                    saldatac = table.Column<DateTime>(type: "datetime", nullable: true),
                    salmens = table.Column<float>(type: "real", nullable: true),
                    saldat = table.Column<DateTime>(type: "datetime", nullable: true),
                    salreg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    salnbj = table.Column<float>(type: "real", nullable: true),
                    saljfer = table.Column<float>(type: "real", nullable: true),
                    salconge = table.Column<float>(type: "real", nullable: true),
                    salcsf = table.Column<float>(type: "real", nullable: true),
                    salallait = table.Column<float>(type: "real", nullable: true),
                    saldep = table.Column<float>(type: "real", nullable: true),
                    salhs25 = table.Column<float>(type: "real", nullable: true),
                    salhs50 = table.Column<float>(type: "real", nullable: true),
                    salhs75 = table.Column<float>(type: "real", nullable: true),
                    salhs100 = table.Column<float>(type: "real", nullable: true),
                    salacc2 = table.Column<float>(type: "real", nullable: true),
                    salnbh = table.Column<float>(type: "real", nullable: true),
                    salabs = table.Column<float>(type: "real", nullable: true),
                    salnjabs = table.Column<float>(type: "real", nullable: true),
                    saljcpl = table.Column<float>(type: "real", nullable: true),
                    salacd = table.Column<float>(type: "real", nullable: true),
                    salsem = table.Column<float>(type: "real", nullable: true),
                    salhbg = table.Column<float>(type: "real", nullable: true),
                    salnuit = table.Column<float>(type: "real", nullable: true),
                    salret = table.Column<float>(type: "real", nullable: true),
                    salssld = table.Column<float>(type: "real", nullable: true),
                    salmal = table.Column<float>(type: "real", nullable: true),
                    joudeb = table.Column<DateTime>(type: "datetime", nullable: true),
                    joufin = table.Column<DateTime>(type: "datetime", nullable: true),
                    salpoint = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    saljnfer = table.Column<float>(type: "real", nullable: true),
                    saljfertrv = table.Column<float>(type: "real", nullable: true),
                    salrnd = table.Column<float>(type: "real", nullable: true),
                    salhfertrv = table.Column<float>(type: "real", nullable: true),
                    salhfer2trv = table.Column<float>(type: "real", nullable: true),
                    salhimp = table.Column<float>(type: "real", nullable: true),
                    salhreptrv = table.Column<float>(type: "real", nullable: true),
                    saljreptrv = table.Column<float>(type: "real", nullable: true),
                    salhfer = table.Column<float>(type: "real", nullable: true),
                    salhabs = table.Column<float>(type: "real", nullable: true),
                    salpanier = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "lcalendsoc",
                columns: table => new
                {
                    cal_date = table.Column<DateTime>(type: "datetime", nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    caltype = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    cal_an = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    cal_mois = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    cal_sem = table.Column<int>(type: "int", nullable: true),
                    cal_nbh = table.Column<float>(type: "real", nullable: true),
                    cal_trav = table.Column<float>(type: "real", nullable: true),
                    cal_col = table.Column<int>(type: "int", nullable: true),
                    cal_row = table.Column<int>(type: "int", nullable: true),
                    motif = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    payer = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lcalendsoc", x => new { x.soccod, x.caltype, x.cal_date });
                });

            migrationBuilder.CreateTable(
                name: "lcategorie",
                columns: table => new
                {
                    ordre = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    catcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    codposte = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    catdu = table.Column<DateTime>(type: "datetime", nullable: true),
                    catau = table.Column<DateTime>(type: "datetime", nullable: true),
                    catfixe = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    cat25de = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    cat25a = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    cattaux25 = table.Column<float>(type: "real", nullable: true),
                    catjour25 = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    cat50de = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    cat50a = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    cattaux50 = table.Column<float>(type: "real", nullable: true),
                    catjour50 = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    cat75de = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    cat75a = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    cattaux75 = table.Column<float>(type: "real", nullable: true),
                    catjour75 = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    cat100de = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    cat100a = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    cattaux100 = table.Column<float>(type: "real", nullable: true),
                    catjour100 = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    cat100rde = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    cat100ra = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    cattauxr100 = table.Column<float>(type: "real", nullable: true),
                    catjourr100 = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lcategorie", x => x.ordre);
                });

            migrationBuilder.CreateTable(
                name: "lcontrat",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    concod = table.Column<string>(type: "nvarchar(9)", maxLength: 9, nullable: false),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    rubcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    rublib = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    rubmnt = table.Column<double>(type: "float", nullable: true),
                    rubunite = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lcontrat", x => new { x.soccod, x.concod, x.empcod });
                });

            migrationBuilder.CreateTable(
                name: "lferier",
                columns: table => new
                {
                    dircod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    ferdate = table.Column<DateTime>(type: "datetime", nullable: true),
                    fertype = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "lmotifpoint",
                columns: table => new
                {
                    concod = table.Column<string>(type: "char(10)", unicode: false, fixedLength: true, maxLength: 10, nullable: true),
                    soccod = table.Column<string>(type: "char(10)", unicode: false, fixedLength: true, maxLength: 10, nullable: true),
                    motcod = table.Column<string>(type: "char(12)", unicode: false, fixedLength: true, maxLength: 12, nullable: true),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    qte = table.Column<double>(type: "float", nullable: true),
                    motmnt = table.Column<double>(type: "float", nullable: true),
                    mottotal = table.Column<double>(type: "float", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "lplanhoraire",
                columns: table => new
                {
                    plandate = table.Column<DateTime>(type: "datetime", nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    planan = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    planmois = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    plansem = table.Column<int>(type: "int", nullable: true),
                    plancat = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    planposte = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    plantrav = table.Column<float>(type: "real", nullable: true),
                    plancol = table.Column<int>(type: "int", nullable: true),
                    planrow = table.Column<int>(type: "int", nullable: true),
                    motif = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    payer = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "lpointjour",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    saljour = table.Column<DateTime>(type: "datetime", nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    salacc = table.Column<float>(type: "real", nullable: true),
                    salnbj = table.Column<float>(type: "real", nullable: true),
                    salnbh = table.Column<float>(type: "real", nullable: true),
                    salabs = table.Column<float>(type: "real", nullable: true),
                    salnjabs = table.Column<float>(type: "real", nullable: true),
                    saljcpl = table.Column<float>(type: "real", nullable: true),
                    saljfer = table.Column<float>(type: "real", nullable: true),
                    salconge = table.Column<float>(type: "real", nullable: true),
                    salcsf = table.Column<float>(type: "real", nullable: true),
                    salallait = table.Column<float>(type: "real", nullable: true),
                    saldep = table.Column<float>(type: "real", nullable: true),
                    salhs25 = table.Column<float>(type: "real", nullable: true),
                    salhs50 = table.Column<float>(type: "real", nullable: true),
                    salhs75 = table.Column<float>(type: "real", nullable: true),
                    salhs100 = table.Column<float>(type: "real", nullable: true),
                    salacd = table.Column<float>(type: "real", nullable: true),
                    salsem = table.Column<float>(type: "real", nullable: true),
                    salhbg = table.Column<float>(type: "real", nullable: true),
                    salnuit = table.Column<float>(type: "real", nullable: true),
                    salret = table.Column<float>(type: "real", nullable: true),
                    salssld = table.Column<float>(type: "real", nullable: true),
                    salmal = table.Column<float>(type: "real", nullable: true),
                    saljnfer = table.Column<float>(type: "real", nullable: true),
                    saljfertrv = table.Column<float>(type: "real", nullable: true),
                    salrnd = table.Column<float>(type: "real", nullable: true),
                    salhfertrv = table.Column<float>(type: "real", nullable: true),
                    salhfer2trv = table.Column<float>(type: "real", nullable: true),
                    salhimp = table.Column<float>(type: "real", nullable: true),
                    salhreptrv = table.Column<float>(type: "real", nullable: true),
                    saljreptrv = table.Column<float>(type: "real", nullable: true),
                    salhfer = table.Column<float>(type: "real", nullable: true),
                    salrepos = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    salrepas = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "lpointmois",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    annee = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    mois = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    rubcod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    rubtype = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    rublib = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    vartype = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    rubregime = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    rubnbr = table.Column<double>(type: "float", nullable: true),
                    empmat = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "lposte",
                columns: table => new
                {
                    codposte = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: false),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    posjour = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    poshredeb = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    poshrefin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    postaux = table.Column<float>(type: "real", nullable: true),
                    postxrepos = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_lposte", x => new { x.codposte, x.soccod });
                });

            migrationBuilder.CreateTable(
                name: "lpret",
                columns: table => new
                {
                    precod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    preannee = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    premois = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    titcod = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    premnt = table.Column<float>(type: "real", nullable: true),
                    fchannee = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    fchmois = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    fchtit = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "lregleremp",
                columns: table => new
                {
                    ligne = table.Column<int>(type: "int", nullable: true),
                    cheordre = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    chetype = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    faccod = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    codsite = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    facreg = table.Column<double>(type: "float", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "lsalaire",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    annee = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    mois = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    jour = table.Column<DateTime>(type: "datetime", nullable: true),
                    rubcod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    rubregime = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    tothre = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    rubnbr = table.Column<double>(type: "float", nullable: true),
                    nbhjour = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    empmat = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    motif = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    rubtype = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "mission",
                columns: table => new
                {
                    concod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    condat = table.Column<DateTime>(type: "datetime", nullable: true),
                    conjour = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    condep = table.Column<DateTime>(type: "datetime", nullable: true),
                    conamdep = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    conret = table.Column<DateTime>(type: "datetime", nullable: true),
                    conamret = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    abscod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    conmotif = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    consanc = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    connbjour = table.Column<float>(type: "real", nullable: true),
                    conref = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    contransp = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    conmnt = table.Column<double>(type: "float", nullable: true),
                    conmodep = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    conadrdep = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    condest = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    conresp = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    condepense = table.Column<string>(type: "char(100)", unicode: false, fixedLength: true, maxLength: 100, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "modeopr",
                columns: table => new
                {
                    artcod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    opecod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    opeordre = table.Column<int>(type: "int", nullable: true),
                    artqte = table.Column<double>(type: "float", nullable: true),
                    arttemps = table.Column<double>(type: "float", nullable: true),
                    artmethode = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "module",
                columns: table => new
                {
                    modcod = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    modlib = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    appcod = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: true),
                    modsais = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    modupd = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    modsupp = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    modconsult = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    description = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "moduser",
                columns: table => new
                {
                    ordre = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    modcod = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    uticod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    appcod = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: true),
                    modsais = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    modupd = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    modsupp = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    modconsult = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    description = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_moduser", x => x.ordre);
                });

            migrationBuilder.CreateTable(
                name: "motifpoint",
                columns: table => new
                {
                    motcod = table.Column<string>(type: "char(12)", unicode: false, fixedLength: true, maxLength: 12, nullable: true),
                    soccod = table.Column<string>(type: "char(10)", unicode: false, fixedLength: true, maxLength: 10, nullable: true),
                    mottype = table.Column<string>(type: "char(1)", unicode: false, fixedLength: true, maxLength: 1, nullable: true),
                    motlib = table.Column<string>(type: "char(50)", unicode: false, fixedLength: true, maxLength: 50, nullable: true),
                    motmnt = table.Column<double>(type: "float", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "nation",
                columns: table => new
                {
                    natcod = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: false),
                    natlib = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_nation", x => x.natcod);
                });

            migrationBuilder.CreateTable(
                name: "notedefrais",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: false),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    titre = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    categorie = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    montant = table.Column<double>(type: "float", nullable: false),
                    projet = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    datedepense = table.Column<DateTime>(type: "datetime", nullable: false),
                    justificatif = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    etat = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notedefrais", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "opbarre",
                columns: table => new
                {
                    codbarre = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(25)", maxLength: 25, nullable: true),
                    proj = table.Column<string>(type: "nvarchar(25)", maxLength: 25, nullable: true),
                    numpaq = table.Column<string>(type: "nvarchar(25)", maxLength: 25, nullable: true),
                    opcod = table.Column<string>(type: "nvarchar(25)", maxLength: 25, nullable: true),
                    phcod = table.Column<string>(type: "nvarchar(25)", maxLength: 25, nullable: true),
                    opduree = table.Column<string>(type: "nvarchar(25)", maxLength: 25, nullable: true),
                    unite = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    phtype = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "operation",
                columns: table => new
                {
                    opecod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    opelib = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    opemethode = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    opetemps = table.Column<double>(type: "float", nullable: true),
                    opepiece = table.Column<double>(type: "float", nullable: true),
                    opetype = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "paieuser",
                columns: table => new
                {
                    dircod = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    uticod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    exercice = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "paquet",
                columns: table => new
                {
                    num = table.Column<string>(type: "nvarchar(25)", maxLength: 25, nullable: true),
                    proj = table.Column<string>(type: "nvarchar(25)", maxLength: 25, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(25)", maxLength: 25, nullable: true),
                    artbarre = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    artcod = table.Column<string>(type: "nvarchar(25)", maxLength: 25, nullable: true),
                    qtepaq = table.Column<int>(type: "int", nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(25)", maxLength: 25, nullable: true),
                    date = table.Column<DateTime>(type: "datetime", nullable: true),
                    qteproj = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "parametre",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    paie = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    point = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    separe = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    longbdg = table.Column<short>(type: "smallint", nullable: true),
                    ncom = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    vitesse = table.Column<float>(type: "real", nullable: true),
                    parite = table.Column<float>(type: "real", nullable: true),
                    nbdigit = table.Column<int>(type: "int", nullable: true),
                    xonoff = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    arrondi = table.Column<int>(type: "int", nullable: true),
                    nbhconge = table.Column<float>(type: "real", nullable: true),
                    nbhrepos = table.Column<int>(type: "int", nullable: true),
                    nbhferier = table.Column<int>(type: "int", nullable: true),
                    fertrv = table.Column<int>(type: "int", nullable: true),
                    joudeb = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    moisdeb = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    joufin = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    moisfin = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    hsuphebd = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    nbhtr1 = table.Column<float>(type: "real", nullable: true),
                    tauxtr1 = table.Column<float>(type: "real", nullable: true),
                    nbhtr2 = table.Column<float>(type: "real", nullable: true),
                    tauxtr2 = table.Column<float>(type: "real", nullable: true),
                    nbhtr3 = table.Column<float>(type: "real", nullable: true),
                    tauxtr3 = table.Column<float>(type: "real", nullable: true),
                    nbhtr4 = table.Column<float>(type: "real", nullable: true),
                    tauxtr4 = table.Column<float>(type: "real", nullable: true),
                    billet = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    minuit = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parsom = table.Column<int>(type: "int", nullable: true),
                    parecart = table.Column<int>(type: "int", nullable: true),
                    nbhdemij = table.Column<double>(type: "float", nullable: true),
                    arrhsup = table.Column<int>(type: "int", nullable: true),
                    parnuit = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    nuitdeb = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    nuitfin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    arrhsortie = table.Column<int>(type: "int", nullable: true),
                    arrhsmajore = table.Column<int>(type: "int", nullable: true),
                    arrhentree = table.Column<int>(type: "int", nullable: true),
                    arrhemajore = table.Column<int>(type: "int", nullable: true),
                    moinsrepas = table.Column<int>(type: "int", nullable: true),
                    ajustupd = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    sansferie = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    affech = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parsem = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    planhoraire = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    jourrepos = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    optimise = table.Column<DateTime>(type: "datetime", nullable: true),
                    repasnuit = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    dtepres = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parferabs = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    pardroitnbj = table.Column<float>(type: "real", nullable: true),
                    parancemp = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    hsuphebdm = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    nbhtr1M = table.Column<float>(type: "real", nullable: true),
                    tauxtr1M = table.Column<float>(type: "real", nullable: true),
                    nbhtr2M = table.Column<float>(type: "real", nullable: true),
                    tauxtr2M = table.Column<float>(type: "real", nullable: true),
                    nbhtr3M = table.Column<float>(type: "real", nullable: true),
                    tauxtr3M = table.Column<float>(type: "real", nullable: true),
                    nbhtr4M = table.Column<float>(type: "real", nullable: true),
                    tauxtr4M = table.Column<float>(type: "real", nullable: true),
                    nbhmax1 = table.Column<float>(type: "real", nullable: true),
                    tauxmax1 = table.Column<float>(type: "real", nullable: true),
                    nbhmax2 = table.Column<float>(type: "real", nullable: true),
                    tauxmax2 = table.Column<float>(type: "real", nullable: true),
                    nbhmax1m = table.Column<float>(type: "real", nullable: true),
                    tauxmax1m = table.Column<float>(type: "real", nullable: true),
                    nbhmax2m = table.Column<float>(type: "real", nullable: true),
                    tauxmax2m = table.Column<float>(type: "real", nullable: true),
                    parelimftrv = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parmaxfer = table.Column<int>(type: "int", nullable: true),
                    parminhjour = table.Column<int>(type: "int", nullable: true),
                    parmaxhjour = table.Column<int>(type: "int", nullable: true),
                    parpostlundi = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    paiearrondi = table.Column<float>(type: "real", nullable: true),
                    parcadre = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parmaitrise = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parexec = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parjhnlibre = table.Column<float>(type: "real", nullable: true),
                    parjhslibre = table.Column<float>(type: "real", nullable: true),
                    parjhnfixe = table.Column<float>(type: "real", nullable: true),
                    parjhsfixe = table.Column<float>(type: "real", nullable: true),
                    parreptrv = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parmanuel = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parpaquet = table.Column<double>(type: "float", nullable: true),
                    parreperiod = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parscomplet = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    pardecimal = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parallaite = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    parpresence = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parsaisconge = table.Column<double>(type: "float", nullable: true),
                    parnrepas = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parabsconge = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parhnuitspec = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    nuitsdeb = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    nuitsfin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    parretabs = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_parametre", x => x.soccod);
                });

            migrationBuilder.CreateTable(
                name: "paramsite",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    sitcod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    paie = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    point = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    separe = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    longbdg = table.Column<short>(type: "smallint", nullable: true),
                    ncom = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    vitesse = table.Column<int>(type: "int", nullable: true),
                    parite = table.Column<int>(type: "int", nullable: true),
                    nbdigit = table.Column<int>(type: "int", nullable: true),
                    xonoff = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    arrondi = table.Column<int>(type: "int", nullable: true),
                    nbhconge = table.Column<int>(type: "int", nullable: true),
                    nbhrepos = table.Column<int>(type: "int", nullable: true),
                    nbhferier = table.Column<int>(type: "int", nullable: true),
                    fertrv = table.Column<int>(type: "int", nullable: true),
                    joudeb = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    moisdeb = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    joufin = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    moisfin = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    hsuphebd = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    nbhtr1 = table.Column<float>(type: "real", nullable: true),
                    tauxtr1 = table.Column<float>(type: "real", nullable: true),
                    nbhtr2 = table.Column<float>(type: "real", nullable: true),
                    tauxtr2 = table.Column<float>(type: "real", nullable: true),
                    nbhtr3 = table.Column<float>(type: "real", nullable: true),
                    tauxtr3 = table.Column<float>(type: "real", nullable: true),
                    nbhtr4 = table.Column<float>(type: "real", nullable: true),
                    tauxtr4 = table.Column<float>(type: "real", nullable: true),
                    billet = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    minuit = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parsom = table.Column<int>(type: "int", nullable: true),
                    parecart = table.Column<int>(type: "int", nullable: true),
                    nbhdemij = table.Column<double>(type: "float", nullable: true),
                    arrhsup = table.Column<int>(type: "int", nullable: true),
                    parnuit = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    nuitdeb = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    nuitfin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    arrhsortie = table.Column<int>(type: "int", nullable: true),
                    arrhsmajore = table.Column<int>(type: "int", nullable: true),
                    arrhentree = table.Column<int>(type: "int", nullable: true),
                    arrhemajore = table.Column<int>(type: "int", nullable: true),
                    moinsrepas = table.Column<int>(type: "int", nullable: true),
                    ajustupd = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    sansferie = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    affech = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parsem = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    planhoraire = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    jourrepos = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    optimise = table.Column<DateTime>(type: "datetime", nullable: true),
                    repasnuit = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    dtepres = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parferabs = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    pardroitnbj = table.Column<float>(type: "real", nullable: true),
                    parancemp = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    hsuphebdm = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    nbhtr1M = table.Column<float>(type: "real", nullable: true),
                    tauxtr1M = table.Column<float>(type: "real", nullable: true),
                    nbhtr2M = table.Column<float>(type: "real", nullable: true),
                    tauxtr2M = table.Column<float>(type: "real", nullable: true),
                    nbhtr3M = table.Column<float>(type: "real", nullable: true),
                    tauxtr3M = table.Column<float>(type: "real", nullable: true),
                    nbhtr4M = table.Column<float>(type: "real", nullable: true),
                    tauxtr4M = table.Column<float>(type: "real", nullable: true),
                    nbhmax1 = table.Column<float>(type: "real", nullable: true),
                    tauxmax1 = table.Column<float>(type: "real", nullable: true),
                    nbhmax2 = table.Column<float>(type: "real", nullable: true),
                    tauxmax2 = table.Column<float>(type: "real", nullable: true),
                    nbhmax1m = table.Column<float>(type: "real", nullable: true),
                    tauxmax1m = table.Column<float>(type: "real", nullable: true),
                    nbhmax2m = table.Column<float>(type: "real", nullable: true),
                    tauxmax2m = table.Column<float>(type: "real", nullable: true),
                    parelimftrv = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parmaxfer = table.Column<int>(type: "int", nullable: true),
                    parminhjour = table.Column<int>(type: "int", nullable: true),
                    parmaxhjour = table.Column<int>(type: "int", nullable: true),
                    parpostlundi = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    paiearrondi = table.Column<float>(type: "real", nullable: true),
                    parcadre = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parmaitrise = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parexec = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parjhnlibre = table.Column<float>(type: "real", nullable: true),
                    parjhslibre = table.Column<float>(type: "real", nullable: true),
                    parjhnfixe = table.Column<float>(type: "real", nullable: true),
                    parjhsfixe = table.Column<float>(type: "real", nullable: true),
                    parreptrv = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parmanuel = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parpaquet = table.Column<double>(type: "float", nullable: true),
                    parreperiod = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parscomplet = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    pardecimal = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parallaite = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    parpresence = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parsaisconge = table.Column<double>(type: "float", nullable: true),
                    parnrepas = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    parabsconge = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    parhnuitspec = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    nuitsdeb = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    nuitsfin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    parretabs = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "parapprent",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    parmois = table.Column<int>(type: "int", nullable: true),
                    partaux = table.Column<float>(type: "real", nullable: true),
                    parmnt = table.Column<double>(type: "float", nullable: true),
                    parrub = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "parposte",
                columns: table => new
                {
                    codposte = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    posjour = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    poshredeb = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    poshrefin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    postaux = table.Column<float>(type: "real", nullable: true),
                    postxrepos = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "parpostsite",
                columns: table => new
                {
                    codposte = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    posjour = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    poshredeb = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    poshrefin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    postaux = table.Column<float>(type: "real", nullable: true),
                    postxrepos = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "partranche",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: false),
                    caltype = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: false),
                    empreg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: false),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    partranche1 = table.Column<float>(type: "real", nullable: true),
                    partaux1 = table.Column<float>(type: "real", nullable: true),
                    partranche2 = table.Column<float>(type: "real", nullable: true),
                    partaux2 = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_partranche", x => new { x.soccod, x.caltype, x.empreg });
                });

            migrationBuilder.CreateTable(
                name: "partranchsite",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    caltype = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    empreg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    partranche1 = table.Column<float>(type: "real", nullable: true),
                    partaux1 = table.Column<float>(type: "real", nullable: true),
                    partranche2 = table.Column<float>(type: "real", nullable: true),
                    partaux2 = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "planhoraire",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    plandate = table.Column<DateTime>(type: "datetime", nullable: true),
                    plancat = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    planposte = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    planrepos = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "pointacce",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    predat = table.Column<DateTime>(type: "datetime", nullable: true),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    ordreent = table.Column<int>(type: "int", nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    ordresort = table.Column<int>(type: "int", nullable: true),
                    empmat = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    entree = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    sortie = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    duree = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    pntentree = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    pntsortie = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    predatent = table.Column<DateTime>(type: "datetime", nullable: true),
                    predatsort = table.Column<DateTime>(type: "datetime", nullable: true),
                    valider = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "pointdroit",
                columns: table => new
                {
                    poicod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    uticod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    purger = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    lire = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    config = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pointdroit", x => new { x.poicod, x.soccod, x.uticod });
                });

            migrationBuilder.CreateTable(
                name: "pointeuse",
                columns: table => new
                {
                    poicod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: false),
                    poilib = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    poiadrip1 = table.Column<int>(type: "int", nullable: true),
                    poiadrip2 = table.Column<int>(type: "int", nullable: true),
                    poiadrip3 = table.Column<int>(type: "int", nullable: true),
                    poiadrip4 = table.Column<int>(type: "int", nullable: true),
                    poiport = table.Column<int>(type: "int", nullable: true),
                    poietat = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    poicom = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    Poipwd = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_pointeuse", x => new { x.poicod, x.soccod });
                });

            migrationBuilder.CreateTable(
                name: "pointheure",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    pointdat = table.Column<DateTime>(type: "datetime", nullable: true),
                    numheure = table.Column<int>(type: "int", nullable: true),
                    nbminute = table.Column<float>(type: "real", nullable: true),
                    foncod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    quacod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "pointmoisj",
                columns: table => new
                {
                    modcod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    uticod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    empmat = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    emplib = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    empreg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    preconge = table.Column<float>(type: "real", nullable: true),
                    pre25hre = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    pre50hre = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    pre75 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    pre100 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    totret = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    tothre = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    allait = table.Column<int>(type: "int", nullable: true),
                    jours = table.Column<float>(type: "real", nullable: true),
                    j01 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j02 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j03 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j04 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j05 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j06 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j07 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j08 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j09 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j10 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j11 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j12 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j13 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j14 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j15 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j16 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j17 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j18 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j19 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j20 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j21 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j22 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j23 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j24 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j25 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j26 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j27 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j28 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j29 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j30 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j31 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j32 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j33 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j34 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j35 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j36 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j37 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j38 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j39 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j40 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    j41 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    c01 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c02 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c03 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c04 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c05 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c06 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c07 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c08 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c09 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c10 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c11 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c12 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c13 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c14 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c15 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c16 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c17 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c18 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c19 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c20 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c21 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c22 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c23 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c24 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c25 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c26 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c27 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c28 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c29 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c30 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c31 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c32 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c33 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c34 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c35 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c36 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c37 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c38 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c39 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c40 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    c41 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    annee = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    mois = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    chantier = table.Column<int>(type: "int", nullable: true),
                    semaine1 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    semaine2 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    semaine3 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    semaine4 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    semaine5 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    totsem = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    absnj = table.Column<float>(type: "real", nullable: true),
                    renvoi = table.Column<float>(type: "real", nullable: true),
                    absjust = table.Column<float>(type: "real", nullable: true),
                    nsemaine = table.Column<int>(type: "int", nullable: true),
                    tothren = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: true),
                    totcsf = table.Column<float>(type: "real", nullable: true),
                    totfer = table.Column<float>(type: "real", nullable: true),
                    totrepos = table.Column<float>(type: "real", nullable: true),
                    totnuit = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    sitlib = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    tothrep = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: true),
                    tothfertrv = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: true),
                    tothfer2trv = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: true),
                    totimp = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: true),
                    jourabs = table.Column<double>(type: "float", nullable: true),
                    jfertrv = table.Column<double>(type: "float", nullable: true),
                    tothabs = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: true),
                    tothaut = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: true),
                    preconga = table.Column<float>(type: "real", nullable: true),
                    preabsa = table.Column<float>(type: "real", nullable: true),
                    rephaut = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: true),
                    rephret = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: true),
                    abspaye = table.Column<double>(type: "float", nullable: true),
                    jourequis = table.Column<double>(type: "float", nullable: true),
                    tothauta = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: true),
                    tothreta = table.Column<string>(type: "nvarchar(7)", maxLength: 7, nullable: true),
                    empnuit = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    totjpanier = table.Column<double>(type: "float", nullable: true),
                    totjpoint = table.Column<double>(type: "float", nullable: true),
                    totjnuit = table.Column<double>(type: "float", nullable: true),
                    empsbase = table.Column<double>(type: "float", nullable: true),
                    totjact = table.Column<double>(type: "float", nullable: true),
                    totjaj = table.Column<double>(type: "float", nullable: true),
                    totjfm = table.Column<double>(type: "float", nullable: true),
                    totjart = table.Column<double>(type: "float", nullable: true),
                    totjmal = table.Column<double>(type: "float", nullable: true),
                    totjanj = table.Column<double>(type: "float", nullable: true),
                    totjcss = table.Column<double>(type: "float", nullable: true),
                    totjmap = table.Column<double>(type: "float", nullable: true),
                    tothferie = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    tothcsf = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    tothconge = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    hallait = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    caltype = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    semaine6 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    catcod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    cathsup = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    empniv = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    tothart = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    totjdouche = table.Column<double>(type: "float", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "pointsemainej",
                columns: table => new
                {
                    modcod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    uticod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    jours = table.Column<float>(type: "real", nullable: true),
                    annee = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    mois = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    semaine1 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    semaine2 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    semaine3 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    semaine4 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    semaine5 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    semaine6 = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    totsem = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    caltype = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    semaine1d = table.Column<DateTime>(type: "datetime", nullable: true),
                    semaine2d = table.Column<DateTime>(type: "datetime", nullable: true),
                    semaine3d = table.Column<DateTime>(type: "datetime", nullable: true),
                    semaine4d = table.Column<DateTime>(type: "datetime", nullable: true),
                    semaine5d = table.Column<DateTime>(type: "datetime", nullable: true),
                    semaine6d = table.Column<DateTime>(type: "datetime", nullable: true),
                    semaine6f = table.Column<DateTime>(type: "datetime", nullable: true),
                    semaine1n = table.Column<float>(type: "real", nullable: true),
                    semaine2n = table.Column<float>(type: "real", nullable: true),
                    semaine3n = table.Column<float>(type: "real", nullable: true),
                    semaine4n = table.Column<float>(type: "real", nullable: true),
                    semaine5n = table.Column<float>(type: "real", nullable: true),
                    semaine6n = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "pointuser",
                columns: table => new
                {
                    TEMPLATEID = table.Column<int>(type: "int", nullable: false),
                    USERID = table.Column<int>(type: "int", nullable: false),
                    FINGERID = table.Column<int>(type: "int", nullable: false),
                    TEMPLATE = table.Column<byte[]>(type: "image", nullable: false),
                    TEMPLATE2 = table.Column<byte[]>(type: "image", nullable: true),
                    BITMAPPICTURE = table.Column<byte[]>(type: "image", nullable: true),
                    BITMAPPICTURE2 = table.Column<byte[]>(type: "image", nullable: true),
                    BITMAPPICTURE3 = table.Column<byte[]>(type: "image", nullable: true),
                    BITMAPPICTURE4 = table.Column<byte[]>(type: "image", nullable: true),
                    USETYPE = table.Column<short>(type: "smallint", nullable: true),
                    TEMPLATE3 = table.Column<byte[]>(type: "image", nullable: true),
                    EMACHINENUM = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: true),
                    TEMPLATE1 = table.Column<byte[]>(type: "image", nullable: true),
                    Flag = table.Column<short>(type: "smallint", nullable: true),
                    DivisionFP = table.Column<short>(type: "smallint", nullable: true),
                    TEMPLATE4 = table.Column<byte[]>(type: "image", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "poste",
                columns: table => new
                {
                    codposte = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: false),
                    libposte = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    avantent = table.Column<int>(type: "int", nullable: true),
                    apresent = table.Column<int>(type: "int", nullable: true),
                    avantsort = table.Column<int>(type: "int", nullable: true),
                    apressort = table.Column<int>(type: "int", nullable: true),
                    retsanc = table.Column<int>(type: "int", nullable: true),
                    retmin = table.Column<int>(type: "int", nullable: true),
                    retsancam = table.Column<int>(type: "int", nullable: true),
                    retminam = table.Column<int>(type: "int", nullable: true),
                    avabon = table.Column<int>(type: "int", nullable: true),
                    avamn = table.Column<int>(type: "int", nullable: true),
                    avabonam = table.Column<int>(type: "int", nullable: true),
                    avamnam = table.Column<int>(type: "int", nullable: true),
                    lunhdmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    lunhfmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    lunhdam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    lunhfam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    lunrepos = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    lunrepas = table.Column<int>(type: "int", nullable: true),
                    marhdmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    marhfmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    marhdam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    marhfam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    marrepos = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    marrepas = table.Column<int>(type: "int", nullable: true),
                    merhdmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    merhfmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    merhdam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    merhfam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    merrepos = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    merrepas = table.Column<int>(type: "int", nullable: true),
                    jeuhdmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    jeuhfmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    jeuhdam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    jeuhfam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    jeurepos = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    jeurepas = table.Column<int>(type: "int", nullable: true),
                    venhdmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    venhfmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    venhdam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    venhfam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    venrepos = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    venrepas = table.Column<int>(type: "int", nullable: true),
                    samhdmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhfmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhdam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhfam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samrepos = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    samrepas = table.Column<int>(type: "int", nullable: true),
                    dimhdmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    dimhfmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    dimhdam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    dimhfam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    dimrepos = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    dimrepas = table.Column<int>(type: "int", nullable: true),
                    lunhdrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    lunhfrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    marhdrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    marhfrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    merhdrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    merhfrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    jeuhdrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    jeuhfrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    venhdrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    venhfrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhdrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhfrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    dimhdrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    dimhfrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    lunhdematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    lunhfematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    marhdematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    marhfematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    merhdematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    merhfematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    jeuhdematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    jeuhfematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    venhdematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    venhfematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhdematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhfematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    dimhdematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    dimhfematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    lunhdeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    lunhfeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    marhdeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    marhfeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    merhdeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    merhfeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    jeuhdeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    jeuhfeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    venhdeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    venhfeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhdeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhfeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    dimhdeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    dimhfeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    arrondi = table.Column<int>(type: "int", nullable: true),
                    arrhsup = table.Column<int>(type: "int", nullable: true),
                    arrhsortie = table.Column<int>(type: "int", nullable: true),
                    arrhsmajore = table.Column<int>(type: "int", nullable: true),
                    arrhentree = table.Column<int>(type: "int", nullable: true),
                    arrhemajore = table.Column<int>(type: "int", nullable: true),
                    maxhrelun = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    maxhremar = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    maxhremer = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    maxhrejeu = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    maxhreven = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    maxhresam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    maxhredim = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    minhjourlun = table.Column<int>(type: "int", nullable: true),
                    minhdemijourlun = table.Column<int>(type: "int", nullable: true),
                    minhjourmar = table.Column<int>(type: "int", nullable: true),
                    minhdemijourmar = table.Column<int>(type: "int", nullable: true),
                    minhjourmer = table.Column<int>(type: "int", nullable: true),
                    minhdemijourmer = table.Column<int>(type: "int", nullable: true),
                    minhjourjeu = table.Column<int>(type: "int", nullable: true),
                    minhdemijourjeu = table.Column<int>(type: "int", nullable: true),
                    minhjourven = table.Column<int>(type: "int", nullable: true),
                    minhdemijourven = table.Column<int>(type: "int", nullable: true),
                    minhjoursam = table.Column<int>(type: "int", nullable: true),
                    minhdemijoursam = table.Column<int>(type: "int", nullable: true),
                    minhjourdim = table.Column<int>(type: "int", nullable: true),
                    minhdemijourdim = table.Column<int>(type: "int", nullable: true),
                    lundouche = table.Column<float>(type: "real", nullable: true),
                    mardouche = table.Column<float>(type: "real", nullable: true),
                    merdouche = table.Column<float>(type: "real", nullable: true),
                    jeudouche = table.Column<float>(type: "real", nullable: true),
                    vendouche = table.Column<float>(type: "real", nullable: true),
                    samdouche = table.Column<float>(type: "real", nullable: true),
                    dimdouche = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_poste", x => new { x.soccod, x.codposte });
                });

            migrationBuilder.CreateTable(
                name: "postemploye",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    catdeb = table.Column<DateTime>(type: "datetime", nullable: true),
                    catfin = table.Column<DateTime>(type: "datetime", nullable: true),
                    codposte = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    avantent = table.Column<int>(type: "int", nullable: true),
                    apresent = table.Column<int>(type: "int", nullable: true),
                    avantsort = table.Column<int>(type: "int", nullable: true),
                    apressort = table.Column<int>(type: "int", nullable: true),
                    retsanc = table.Column<int>(type: "int", nullable: true),
                    retmin = table.Column<int>(type: "int", nullable: true),
                    retsancam = table.Column<int>(type: "int", nullable: true),
                    retminam = table.Column<int>(type: "int", nullable: true),
                    avabon = table.Column<int>(type: "int", nullable: true),
                    avamn = table.Column<int>(type: "int", nullable: true),
                    avabonam = table.Column<int>(type: "int", nullable: true),
                    avamnam = table.Column<int>(type: "int", nullable: true),
                    hredmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hrefmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hredam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hrefam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    jourrepos = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: true),
                    hrerepas = table.Column<int>(type: "int", nullable: true),
                    samhdmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhfmat = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhdam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhfam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samrepos = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    samrepas = table.Column<int>(type: "int", nullable: true),
                    hredrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hrefrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhdrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhfrep = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hredematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hrefematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhdematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhfematin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hredeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hrefeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhdeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    samhfeamidi = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    maxhre = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    maxhresam = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    minhjour = table.Column<int>(type: "int", nullable: true),
                    minhdemijour = table.Column<int>(type: "int", nullable: true),
                    minhjoursam = table.Column<int>(type: "int", nullable: true),
                    minhdemijoursam = table.Column<int>(type: "int", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "postesite",
                columns: table => new
                {
                    code = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    nature = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "presence",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    predat = table.Column<DateTime>(type: "datetime", nullable: false),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    empmat = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    sercod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    codposte = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    preentmat = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortmat = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentamidi = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortamidi = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentmatup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortmatup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentamidiup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortamidiup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentsup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortsup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentasup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortasup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentsupup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortsupup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentasupup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortasupup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presem = table.Column<float>(type: "real", nullable: true),
                    prerepos = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    prerepas = table.Column<float>(type: "real", nullable: true),
                    preretmate = table.Column<DateTime>(type: "datetime", nullable: true),
                    preretmats = table.Column<DateTime>(type: "datetime", nullable: true),
                    preretame = table.Column<DateTime>(type: "datetime", nullable: true),
                    preretams = table.Column<DateTime>(type: "datetime", nullable: true),
                    preretmateup = table.Column<DateTime>(type: "datetime", nullable: true),
                    preretmatsup = table.Column<DateTime>(type: "datetime", nullable: true),
                    preretameup = table.Column<DateTime>(type: "datetime", nullable: true),
                    preretamsup = table.Column<DateTime>(type: "datetime", nullable: true),
                    preavantent = table.Column<float>(type: "real", nullable: true),
                    preapresent = table.Column<float>(type: "real", nullable: true),
                    preavantsort = table.Column<float>(type: "real", nullable: true),
                    preapressort = table.Column<float>(type: "real", nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    empreg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    empcharge = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    preobs = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    dmdate = table.Column<DateTime>(type: "datetime", nullable: true),
                    catcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    tothre = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    tothabs = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    tothsup = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    tothnuit = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    optimise = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    totcmp = table.Column<float>(type: "real", nullable: true),
                    predouche = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_presence", x => new { x.empcod, x.predat });
                });

            migrationBuilder.CreateTable(
                name: "presencej",
                columns: table => new
                {
                    modcod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    uticod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    predat = table.Column<DateTime>(type: "datetime", nullable: true),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    empmat = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    sercod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    codposte = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    preentmat = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortmat = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentamidi = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortamidi = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentmatup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortmatup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentamidiup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortamidiup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentsup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortsup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentasup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortasup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentsupup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortsupup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preentasupup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presortasupup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    presem = table.Column<float>(type: "real", nullable: true),
                    prerepos = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    prerepas = table.Column<float>(type: "real", nullable: true),
                    preretmate = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preretmats = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preretame = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preretams = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preretmateup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preretmatsup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preretameup = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    preretamsup = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    preavantent = table.Column<float>(type: "real", nullable: true),
                    preapresent = table.Column<float>(type: "real", nullable: true),
                    preavantsort = table.Column<float>(type: "real", nullable: true),
                    preapressort = table.Column<float>(type: "real", nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    empreg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    empcharge = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    preobs = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    dmdate = table.Column<DateTime>(type: "datetime", nullable: true),
                    catcod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    tothre = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    tothabs = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    tothsup = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    tothnuit = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    optimise = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    totcmp = table.Column<float>(type: "real", nullable: true),
                    preconge = table.Column<float>(type: "real", nullable: true),
                    pre25hre = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    pre50hre = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    pre75 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    pre100 = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    totret = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    allait = table.Column<float>(type: "real", nullable: true),
                    motif = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    nbhre = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    emptype = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    nbhjour = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    nbhsem = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    tothaut = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    hferie = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    rubtype = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    tothrepas = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    tothavance = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    tothretrepas = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    jourtrv = table.Column<float>(type: "real", nullable: true),
                    emplib = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    hentm = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hsortm = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    henta = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hsorta = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    retsanc = table.Column<float>(type: "real", nullable: true),
                    retmin = table.Column<float>(type: "real", nullable: true),
                    retsancam = table.Column<float>(type: "real", nullable: true),
                    retminam = table.Column<float>(type: "real", nullable: true),
                    avabon = table.Column<float>(type: "real", nullable: true),
                    avamn = table.Column<float>(type: "real", nullable: true),
                    avabonam = table.Column<float>(type: "real", nullable: true),
                    avamnam = table.Column<float>(type: "real", nullable: true),
                    nbhmaxjour = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hdrepas = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hfrepas = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hentmdeb = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hentadeb = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hentmfin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hentafin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hconge = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    habsj = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    jouralt = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    repas = table.Column<float>(type: "real", nullable: true),
                    jourfer = table.Column<float>(type: "real", nullable: true),
                    empemb = table.Column<DateTime>(type: "datetime", nullable: true),
                    empsort = table.Column<DateTime>(type: "datetime", nullable: true),
                    jourreptrv = table.Column<float>(type: "real", nullable: true),
                    hrepostrv = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    nbhrepos = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    hallait = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    tothcmp = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    tothplus = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    nbjabs = table.Column<float>(type: "real", nullable: true),
                    nbhabs = table.Column<string>(type: "nvarchar(8)", maxLength: 8, nullable: true),
                    abscng = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    abspayer = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    abssanc = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "pret",
                columns: table => new
                {
                    precod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    empcod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    predat = table.Column<DateTime>(type: "datetime", nullable: true),
                    rubcod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    predeb = table.Column<DateTime>(type: "datetime", nullable: true),
                    prefin = table.Column<DateTime>(type: "datetime", nullable: true),
                    premnt = table.Column<float>(type: "real", nullable: true),
                    preret = table.Column<float>(type: "real", nullable: true),
                    condg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    conrefus = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "probarre",
                columns: table => new
                {
                    artcod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    clicod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    arttaille = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    artclr = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    qte = table.Column<int>(type: "int", nullable: true),
                    artean = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    artref = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    artlib = table.Column<string>(type: "nvarchar(250)", maxLength: 250, nullable: true),
                    artprix = table.Column<double>(type: "float", nullable: true),
                    artcodac = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    gender = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "qualif",
                columns: table => new
                {
                    quacod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    qualib = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    catcod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_qualif", x => new { x.quacod, x.soccod });
                });

            migrationBuilder.CreateTable(
                name: "qualjrl",
                columns: table => new
                {
                    ordre = table.Column<int>(type: "int", nullable: true),
                    empcod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    quadate = table.Column<DateTime>(type: "datetime", nullable: true),
                    moncod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    artcod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    defcod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    nombre = table.Column<float>(type: "real", nullable: true),
                    nbpcontrole = table.Column<float>(type: "real", nullable: true),
                    nbpaccepte = table.Column<float>(type: "real", nullable: true),
                    quaobs = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "qualmens",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    annee = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    mois = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    rubcod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    titcod = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    montant = table.Column<float>(type: "real", nullable: true),
                    rubsigne = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    nbpcontrole = table.Column<float>(type: "real", nullable: true),
                    nbprefuse = table.Column<float>(type: "real", nullable: true),
                    nbpaccepte = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "refresh_tokens",
                columns: table => new
                {
                    id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    uticod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    token = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    expires_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    revoked = table.Column<bool>(type: "bit", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_refresh_tokens", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "regleremp",
                columns: table => new
                {
                    regordre = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    idamortis = table.Column<int>(type: "int", nullable: true),
                    nopret = table.Column<int>(type: "int", nullable: true),
                    datecheance = table.Column<DateTime>(type: "datetime", nullable: true),
                    pretmnt = table.Column<int>(type: "int", nullable: true),
                    regech = table.Column<DateTime>(type: "datetime", nullable: true),
                    regdat = table.Column<DateTime>(type: "datetime", nullable: true),
                    regmnt = table.Column<double>(type: "float", nullable: true),
                    regref = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    regtype = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    regtit = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    reglib = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "rendjour",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    rnddate = table.Column<DateTime>(type: "datetime", nullable: true),
                    artcod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    opecod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    opeordre = table.Column<int>(type: "int", nullable: true),
                    totpre = table.Column<double>(type: "float", nullable: true),
                    artqte = table.Column<double>(type: "float", nullable: true),
                    rndtemps = table.Column<double>(type: "float", nullable: true),
                    rndprod = table.Column<double>(type: "float", nullable: true),
                    rndpre = table.Column<double>(type: "float", nullable: true),
                    artmethode = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "repos",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    predat = table.Column<DateTime>(type: "datetime", nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    prerepos = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    motif = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    hredeb = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    hrefin = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    nbheure = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "rndbareme",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    bartype = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    ordre = table.Column<int>(type: "int", nullable: true),
                    barinf = table.Column<double>(type: "float", nullable: true),
                    barsup = table.Column<double>(type: "float", nullable: true),
                    barabs = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    barrub = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    barmnt = table.Column<double>(type: "float", nullable: true),
                    barpabs = table.Column<double>(type: "float", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "roles",
                columns: table => new
                {
                    role_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    role_name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    role_description = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    role_color = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    role_is_system = table.Column<bool>(type: "bit", nullable: false),
                    role_created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_roles", x => x.role_id);
                });

            migrationBuilder.CreateTable(
                name: "rubrique",
                columns: table => new
                {
                    rubcod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    rubtype = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    rublib = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    rubregime = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    vartype = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: true),
                    rubunite = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    rubtaux = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_rubrique", x => new { x.rubcod, x.soccod });
                });

            migrationBuilder.CreateTable(
                name: "rubtype",
                columns: table => new
                {
                    rubtype = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    rublib = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "salaire",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    salannee = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    salmois = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    saltit = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    salmat = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    salacc = table.Column<float>(type: "real", nullable: true),
                    saldatac = table.Column<DateTime>(type: "datetime", nullable: true),
                    salmens = table.Column<float>(type: "real", nullable: true),
                    saldat = table.Column<DateTime>(type: "datetime", nullable: true),
                    salreg = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    salnbj = table.Column<float>(type: "real", nullable: true),
                    saljfer = table.Column<float>(type: "real", nullable: true),
                    salconge = table.Column<float>(type: "real", nullable: true),
                    salcsf = table.Column<float>(type: "real", nullable: true),
                    salallait = table.Column<float>(type: "real", nullable: true),
                    saldep = table.Column<float>(type: "real", nullable: true),
                    salhs25 = table.Column<float>(type: "real", nullable: true),
                    salhs50 = table.Column<float>(type: "real", nullable: true),
                    salhs75 = table.Column<float>(type: "real", nullable: true),
                    salhs100 = table.Column<float>(type: "real", nullable: true),
                    salacc2 = table.Column<float>(type: "real", nullable: true),
                    salnbh = table.Column<float>(type: "real", nullable: true),
                    salabs = table.Column<float>(type: "real", nullable: true),
                    salnjabs = table.Column<float>(type: "real", nullable: true),
                    saljcpl = table.Column<float>(type: "real", nullable: true),
                    salacd = table.Column<float>(type: "real", nullable: true),
                    salsem = table.Column<float>(type: "real", nullable: true),
                    salhbg = table.Column<float>(type: "real", nullable: true),
                    salnuit = table.Column<float>(type: "real", nullable: true),
                    salret = table.Column<float>(type: "real", nullable: true),
                    salssld = table.Column<float>(type: "real", nullable: true),
                    salmal = table.Column<float>(type: "real", nullable: true),
                    joudeb = table.Column<DateTime>(type: "datetime", nullable: true),
                    joufin = table.Column<DateTime>(type: "datetime", nullable: true),
                    salpoint = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    saljnfer = table.Column<float>(type: "real", nullable: true),
                    saljfertrv = table.Column<float>(type: "real", nullable: true),
                    salrnd = table.Column<float>(type: "real", nullable: true),
                    salhfertrv = table.Column<float>(type: "real", nullable: true),
                    salhfer2trv = table.Column<float>(type: "real", nullable: true),
                    salhimp = table.Column<float>(type: "real", nullable: true),
                    salhreptrv = table.Column<float>(type: "real", nullable: true),
                    saljreptrv = table.Column<float>(type: "real", nullable: true),
                    salhfer = table.Column<float>(type: "real", nullable: true),
                    salhabs = table.Column<float>(type: "real", nullable: true),
                    salpanier = table.Column<float>(type: "real", nullable: true),
                    saldouche = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "sanction",
                columns: table => new
                {
                    concod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    condat = table.Column<DateTime>(type: "datetime", nullable: true),
                    conjour = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    condep = table.Column<DateTime>(type: "datetime", nullable: true),
                    conamdep = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    conret = table.Column<DateTime>(type: "datetime", nullable: true),
                    conamret = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    abscod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    conmotif = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    consanc = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    connbjour = table.Column<float>(type: "real", nullable: true),
                    conref = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sanction", x => new { x.soccod, x.concod });
                });

            migrationBuilder.CreateTable(
                name: "section",
                columns: table => new
                {
                    seccod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: false),
                    seclib = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    sectype = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    effectif = table.Column<int>(type: "int", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_section", x => new { x.seccod, x.soccod });
                });

            migrationBuilder.CreateTable(
                name: "semaine",
                columns: table => new
                {
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    annee = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    semcod = table.Column<int>(type: "int", nullable: true),
                    semdeb = table.Column<DateTime>(type: "datetime", nullable: true),
                    semfin = table.Column<DateTime>(type: "datetime", nullable: true),
                    semnbheure = table.Column<float>(type: "real", nullable: true),
                    semnbh1 = table.Column<float>(type: "real", nullable: true),
                    semtaux1 = table.Column<float>(type: "real", nullable: true),
                    semnbh2 = table.Column<float>(type: "real", nullable: true),
                    semtaux2 = table.Column<float>(type: "real", nullable: true),
                    semtaux3 = table.Column<float>(type: "real", nullable: true),
                    semconge = table.Column<float>(type: "real", nullable: true),
                    semferie = table.Column<float>(type: "real", nullable: true),
                    semrepos = table.Column<float>(type: "real", nullable: true),
                    semhjdemi = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "service",
                columns: table => new
                {
                    sercod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: false),
                    serlib = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    serloc = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    effectif = table.Column<int>(type: "int", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_service", x => new { x.sercod, x.soccod });
                });

            migrationBuilder.CreateTable(
                name: "site",
                columns: table => new
                {
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    sitlib = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    sitadr = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    sittel = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    sitfax = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    sitemail = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    sitmois = table.Column<int>(type: "int", nullable: true),
                    sitconge = table.Column<float>(type: "real", nullable: true),
                    sitsoc = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    sitpaie = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    sitcongem = table.Column<float>(type: "real", nullable: true),
                    sitsanch = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    sitsancm = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_site", x => new { x.sitcod, x.soccod });
                });

            migrationBuilder.CreateTable(
                name: "Societe",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    soclib = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    socresp = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    socadr = table.Column<string>(type: "nvarchar(40)", maxLength: 40, nullable: true),
                    soctel = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    socfax = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    socemail = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    socccb = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    soctva = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    soctva1 = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    soctva2 = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    soctva3 = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    soctva000 = table.Column<string>(type: "nvarchar(3)", maxLength: 3, nullable: true),
                    socreg = table.Column<int>(type: "int", nullable: true),
                    socmois = table.Column<int>(type: "int", nullable: true),
                    soctype = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    socpresence = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    sochsup = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    socmere = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    socsmig = table.Column<double>(type: "float", nullable: true),
                    soclibar = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    socadrar = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    socrespar = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    socimg = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Societe", x => x.soccod);
                });

            migrationBuilder.CreateTable(
                name: "socsage",
                columns: table => new
                {
                    SOC_COD = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    SOC_LIB = table.Column<string>(type: "nvarchar(255)", maxLength: 255, nullable: true),
                    BASESQL = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "socuser",
                columns: table => new
                {
                    soccod = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: false),
                    uticod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    exercice = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_socuser", x => new { x.soccod, x.uticod, x.sitcod });
                });

            migrationBuilder.CreateTable(
                name: "solde",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: false),
                    annee = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    conge = table.Column<float>(type: "real", nullable: true),
                    empconge = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_solde", x => new { x.empcod, x.soccod });
                });

            migrationBuilder.CreateTable(
                name: "soldecmp",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    heure = table.Column<double>(type: "float", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "suivemp",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    date = table.Column<DateTime>(type: "datetime", nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    paqcod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    presence = table.Column<int>(type: "int", nullable: true),
                    panne = table.Column<int>(type: "int", nullable: true),
                    temprod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    rend = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    mois = table.Column<int>(type: "int", nullable: true),
                    annee = table.Column<int>(type: "int", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "suv_calend",
                columns: table => new
                {
                    cal_date = table.Column<DateTime>(type: "datetime", nullable: true),
                    cal_an = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    cal_mois = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    cal_sem = table.Column<int>(type: "int", nullable: true),
                    cal_nbh = table.Column<int>(type: "int", nullable: true),
                    cal_trav = table.Column<int>(type: "int", nullable: true),
                    cal_col = table.Column<int>(type: "int", nullable: true),
                    cal_row = table.Column<int>(type: "int", nullable: true),
                    motif = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    payer = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "t_amorts",
                columns: table => new
                {
                    IdAmortis = table.Column<int>(type: "int", nullable: true),
                    NoPret = table.Column<int>(type: "int", nullable: true),
                    NoEcheance = table.Column<int>(type: "int", nullable: true),
                    DateEcheance = table.Column<DateTime>(type: "datetime", nullable: true),
                    MontantCapitalDu = table.Column<double>(type: "float", nullable: true),
                    MontantDesInterets = table.Column<double>(type: "float", nullable: true),
                    InteretsIntercalaires = table.Column<double>(type: "float", nullable: true),
                    Annuite = table.Column<double>(type: "float", nullable: true),
                    CapitalAmorti = table.Column<double>(type: "float", nullable: true),
                    NombreDeReports = table.Column<int>(type: "int", nullable: true),
                    DateEcheancePrevue = table.Column<DateTime>(type: "datetime", nullable: true),
                    FlagagePret = table.Column<int>(type: "int", nullable: true),
                    EcartArrondiSurEcheance = table.Column<double>(type: "float", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "t_pret",
                columns: table => new
                {
                    IdPret = table.Column<int>(type: "int", nullable: true),
                    NoPret = table.Column<int>(type: "int", nullable: true),
                    NumSalarie = table.Column<int>(type: "int", nullable: true),
                    TypeDePret = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    LibelleDuPret = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    NoDeDecision = table.Column<int>(type: "int", nullable: true),
                    DateDecision = table.Column<DateTime>(type: "datetime", nullable: true),
                    DureeDuPret = table.Column<int>(type: "int", nullable: true),
                    PeriodiciteEcheance = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    NbPaliers = table.Column<int>(type: "int", nullable: true),
                    DatePremiereEcheance = table.Column<DateTime>(type: "datetime", nullable: true),
                    MontantEcheance = table.Column<double>(type: "float", nullable: true),
                    MontantDuPret = table.Column<int>(type: "int", nullable: true),
                    NbEcheance = table.Column<int>(type: "int", nullable: true),
                    TauxTva = table.Column<float>(type: "real", nullable: true),
                    DifferentielMontant = table.Column<double>(type: "float", nullable: true),
                    EtabPreteur = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    GarantieSalarie = table.Column<double>(type: "float", nullable: true),
                    ObjetPret = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    DateDeblocage = table.Column<DateTime>(type: "datetime", nullable: true),
                    Franchise = table.Column<int>(type: "int", nullable: true),
                    Bareme = table.Column<int>(type: "int", nullable: true),
                    FinFranchise = table.Column<DateTime>(type: "datetime", nullable: true),
                    PretDebloque = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    PretSolde = table.Column<double>(type: "float", nullable: true),
                    DateProchaineEcheance = table.Column<DateTime>(type: "datetime", nullable: true),
                    MontantAmortissement = table.Column<double>(type: "float", nullable: true),
                    NbEcheancesRestantes = table.Column<int>(type: "int", nullable: true),
                    MontantRestant = table.Column<double>(type: "float", nullable: true),
                    TauxInteret = table.Column<float>(type: "real", nullable: true),
                    ModePaiement = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    DateRemboursementAnticipe = table.Column<DateTime>(type: "datetime", nullable: true),
                    MontantGarantie = table.Column<double>(type: "float", nullable: true),
                    RubriqueRemboursement = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    TypeDeTable = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    FlagInfosGenerales = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    CalculAutomatique = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "t_remboursement",
                columns: table => new
                {
                    IdAmortis = table.Column<int>(type: "int", nullable: true),
                    NoPret = table.Column<int>(type: "int", nullable: true),
                    NoEcheance = table.Column<int>(type: "int", nullable: true),
                    DateEcheance = table.Column<DateTime>(type: "datetime", nullable: true),
                    MontantCapitalDu = table.Column<double>(type: "float", nullable: true),
                    MontantDesInterets = table.Column<double>(type: "float", nullable: true),
                    InteretsIntercalaires = table.Column<double>(type: "float", nullable: true),
                    Annuite = table.Column<double>(type: "float", nullable: true),
                    CapitalAmorti = table.Column<double>(type: "float", nullable: true),
                    NombreDeReports = table.Column<int>(type: "int", nullable: true),
                    DateEcheancePrevue = table.Column<DateTime>(type: "datetime", nullable: true),
                    FlagagePret = table.Column<int>(type: "int", nullable: true),
                    EcartArrondiSurEcheance = table.Column<double>(type: "float", nullable: true),
                    TypeRemboursement = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    DateRemboursement = table.Column<DateTime>(type: "datetime", nullable: true),
                    NoQuittnce = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "t_sal",
                columns: table => new
                {
                    SA_CompteurNumero = table.Column<int>(type: "int", nullable: true),
                    MatriculeSalarie = table.Column<int>(type: "int", nullable: true),
                    Civilite = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: true),
                    Nom = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    NomJeuneFille = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    Prenom = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    Prenom2 = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "t_typeremb",
                columns: table => new
                {
                    No = table.Column<int>(type: "int", nullable: true),
                    NoPret = table.Column<int>(type: "int", nullable: true),
                    MontantEspece = table.Column<double>(type: "float", nullable: true),
                    MontantBultin = table.Column<double>(type: "float", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "titre",
                columns: table => new
                {
                    titcod = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    titlib = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: true),
                    titsens = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    titarrondi = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    tittype = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                });

            migrationBuilder.CreateTable(
                name: "utilisateur",
                columns: table => new
                {
                    uticod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    utinom = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    utiprn = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    utimps = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    utiactif = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    utiadm = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: true),
                    Utimail = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    utiimg = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    utirole = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    uti2fa_enabled = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    uti2fa_secret = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    UtiResetCode = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    UtiResetCodeExpiry = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_utilisateur", x => x.uticod);
                });

            migrationBuilder.CreateTable(
                name: "ville",
                columns: table => new
                {
                    vilcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: false),
                    villib = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ville", x => x.vilcod);
                });

            migrationBuilder.CreateTable(
                name: "avance",
                columns: table => new
                {
                    empcod = table.Column<string>(type: "nvarchar(12)", maxLength: 12, nullable: true),
                    soccod = table.Column<string>(type: "nvarchar(6)", maxLength: 6, nullable: true),
                    sitcod = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    annee = table.Column<string>(type: "nvarchar(4)", maxLength: 4, nullable: true),
                    mois = table.Column<string>(type: "nvarchar(2)", maxLength: 2, nullable: true),
                    niveau = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    titcod = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: true),
                    montant = table.Column<float>(type: "real", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.ForeignKey(
                        name: "FK_avance_employe_empcod_soccod_sitcod",
                        columns: x => new { x.empcod, x.soccod, x.sitcod },
                        principalTable: "employe",
                        principalColumns: new[] { "empcod", "soccod", "sitcod" });
                });

            migrationBuilder.CreateTable(
                name: "role_permissions",
                columns: table => new
                {
                    rp_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    rp_role_id = table.Column<int>(type: "int", nullable: false),
                    rp_module = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    rp_consult = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    rp_add = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    rp_modify = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    rp_delete = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_role_permissions", x => x.rp_id);
                    table.ForeignKey(
                        name: "FK_role_permissions_roles_rp_role_id",
                        column: x => x.rp_role_id,
                        principalTable: "roles",
                        principalColumn: "role_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "role_pointdroit",
                columns: table => new
                {
                    rpd_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    rpd_role_id = table.Column<int>(type: "int", nullable: false),
                    rpd_poicod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    rpd_soccod = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    rpd_lire = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: false),
                    rpd_purger = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: false),
                    rpd_config = table.Column<string>(type: "nvarchar(1)", maxLength: 1, nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_role_pointdroit", x => x.rpd_id);
                    table.ForeignKey(
                        name: "FK_role_pointdroit_roles_rpd_role_id",
                        column: x => x.rpd_role_id,
                        principalTable: "roles",
                        principalColumn: "role_id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_avance_empcod_soccod_sitcod",
                table: "avance",
                columns: new[] { "empcod", "soccod", "sitcod" });

            migrationBuilder.CreateIndex(
                name: "IX_role_permissions_rp_role_id",
                table: "role_permissions",
                column: "rp_role_id");

            migrationBuilder.CreateIndex(
                name: "IX_role_pointdroit_rpd_role_id",
                table: "role_pointdroit",
                column: "rpd_role_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "~TMPCLP651021");

            migrationBuilder.DropTable(
                name: "absence");

            migrationBuilder.DropTable(
                name: "aide");

            migrationBuilder.DropTable(
                name: "allaitement");

            migrationBuilder.DropTable(
                name: "anomalie");

            migrationBuilder.DropTable(
                name: "article");

            migrationBuilder.DropTable(
                name: "AuditLog");

            migrationBuilder.DropTable(
                name: "autoriser");

            migrationBuilder.DropTable(
                name: "avance");

            migrationBuilder.DropTable(
                name: "banque");

            migrationBuilder.DropTable(
                name: "billet");

            migrationBuilder.DropTable(
                name: "calendsoc");

            migrationBuilder.DropTable(
                name: "categorie");

            migrationBuilder.DropTable(
                name: "cloture");

            migrationBuilder.DropTable(
                name: "cnss");

            migrationBuilder.DropTable(
                name: "coltable");

            migrationBuilder.DropTable(
                name: "compenser");

            migrationBuilder.DropTable(
                name: "conge");

            migrationBuilder.DropTable(
                name: "congenon");

            migrationBuilder.DropTable(
                name: "contrat");

            migrationBuilder.DropTable(
                name: "contrat2");

            migrationBuilder.DropTable(
                name: "defaut");

            migrationBuilder.DropTable(
                name: "demande_autorisation");

            migrationBuilder.DropTable(
                name: "demconge");

            migrationBuilder.DropTable(
                name: "direction");

            migrationBuilder.DropTable(
                name: "dmpoint");

            migrationBuilder.DropTable(
                name: "dmpresence");

            migrationBuilder.DropTable(
                name: "documentvault");

            migrationBuilder.DropTable(
                name: "donne");

            migrationBuilder.DropTable(
                name: "echelle");

            migrationBuilder.DropTable(
                name: "empaff");

            migrationBuilder.DropTable(
                name: "empcat");

            migrationBuilder.DropTable(
                name: "empchg");

            migrationBuilder.DropTable(
                name: "empchoisie");

            migrationBuilder.DropTable(
                name: "empgrh");

            migrationBuilder.DropTable(
                name: "emprnd");

            migrationBuilder.DropTable(
                name: "empuser");

            migrationBuilder.DropTable(
                name: "ferier");

            migrationBuilder.DropTable(
                name: "fonction");

            migrationBuilder.DropTable(
                name: "grille");

            migrationBuilder.DropTable(
                name: "hsalaire");

            migrationBuilder.DropTable(
                name: "lcalendsoc");

            migrationBuilder.DropTable(
                name: "lcategorie");

            migrationBuilder.DropTable(
                name: "lcontrat");

            migrationBuilder.DropTable(
                name: "lferier");

            migrationBuilder.DropTable(
                name: "lmotifpoint");

            migrationBuilder.DropTable(
                name: "lplanhoraire");

            migrationBuilder.DropTable(
                name: "lpointjour");

            migrationBuilder.DropTable(
                name: "lpointmois");

            migrationBuilder.DropTable(
                name: "lposte");

            migrationBuilder.DropTable(
                name: "lpret");

            migrationBuilder.DropTable(
                name: "lregleremp");

            migrationBuilder.DropTable(
                name: "lsalaire");

            migrationBuilder.DropTable(
                name: "mission");

            migrationBuilder.DropTable(
                name: "modeopr");

            migrationBuilder.DropTable(
                name: "module");

            migrationBuilder.DropTable(
                name: "moduser");

            migrationBuilder.DropTable(
                name: "motifpoint");

            migrationBuilder.DropTable(
                name: "nation");

            migrationBuilder.DropTable(
                name: "notedefrais");

            migrationBuilder.DropTable(
                name: "opbarre");

            migrationBuilder.DropTable(
                name: "operation");

            migrationBuilder.DropTable(
                name: "paieuser");

            migrationBuilder.DropTable(
                name: "paquet");

            migrationBuilder.DropTable(
                name: "parametre");

            migrationBuilder.DropTable(
                name: "paramsite");

            migrationBuilder.DropTable(
                name: "parapprent");

            migrationBuilder.DropTable(
                name: "parposte");

            migrationBuilder.DropTable(
                name: "parpostsite");

            migrationBuilder.DropTable(
                name: "partranche");

            migrationBuilder.DropTable(
                name: "partranchsite");

            migrationBuilder.DropTable(
                name: "planhoraire");

            migrationBuilder.DropTable(
                name: "pointacce");

            migrationBuilder.DropTable(
                name: "pointdroit");

            migrationBuilder.DropTable(
                name: "pointeuse");

            migrationBuilder.DropTable(
                name: "pointheure");

            migrationBuilder.DropTable(
                name: "pointmoisj");

            migrationBuilder.DropTable(
                name: "pointsemainej");

            migrationBuilder.DropTable(
                name: "pointuser");

            migrationBuilder.DropTable(
                name: "poste");

            migrationBuilder.DropTable(
                name: "postemploye");

            migrationBuilder.DropTable(
                name: "postesite");

            migrationBuilder.DropTable(
                name: "presence");

            migrationBuilder.DropTable(
                name: "presencej");

            migrationBuilder.DropTable(
                name: "pret");

            migrationBuilder.DropTable(
                name: "probarre");

            migrationBuilder.DropTable(
                name: "qualif");

            migrationBuilder.DropTable(
                name: "qualjrl");

            migrationBuilder.DropTable(
                name: "qualmens");

            migrationBuilder.DropTable(
                name: "refresh_tokens");

            migrationBuilder.DropTable(
                name: "regleremp");

            migrationBuilder.DropTable(
                name: "rendjour");

            migrationBuilder.DropTable(
                name: "repos");

            migrationBuilder.DropTable(
                name: "rndbareme");

            migrationBuilder.DropTable(
                name: "role_permissions");

            migrationBuilder.DropTable(
                name: "role_pointdroit");

            migrationBuilder.DropTable(
                name: "rubrique");

            migrationBuilder.DropTable(
                name: "rubtype");

            migrationBuilder.DropTable(
                name: "salaire");

            migrationBuilder.DropTable(
                name: "sanction");

            migrationBuilder.DropTable(
                name: "section");

            migrationBuilder.DropTable(
                name: "semaine");

            migrationBuilder.DropTable(
                name: "service");

            migrationBuilder.DropTable(
                name: "site");

            migrationBuilder.DropTable(
                name: "Societe");

            migrationBuilder.DropTable(
                name: "socsage");

            migrationBuilder.DropTable(
                name: "socuser");

            migrationBuilder.DropTable(
                name: "solde");

            migrationBuilder.DropTable(
                name: "soldecmp");

            migrationBuilder.DropTable(
                name: "suivemp");

            migrationBuilder.DropTable(
                name: "suv_calend");

            migrationBuilder.DropTable(
                name: "t_amorts");

            migrationBuilder.DropTable(
                name: "t_pret");

            migrationBuilder.DropTable(
                name: "t_remboursement");

            migrationBuilder.DropTable(
                name: "t_sal");

            migrationBuilder.DropTable(
                name: "t_typeremb");

            migrationBuilder.DropTable(
                name: "titre");

            migrationBuilder.DropTable(
                name: "utilisateur");

            migrationBuilder.DropTable(
                name: "ville");

            migrationBuilder.DropTable(
                name: "employe");

            migrationBuilder.DropTable(
                name: "roles");
        }
    }
}
