using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace ABRPOINT.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddRttFieldsToEmployeAndSolde : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "conadrdep",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "conamdep",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "conamret",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "concod",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "condat",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "condep",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "condepense",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "condest",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "conjour",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "conmodep",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "conmotif",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "connbjour",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "conref",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "conresp",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "conret",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "consanc",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "contransp",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "CreatedAt",
                table: "AuditLog");

            migrationBuilder.DropColumn(
                name: "DeletedAt",
                table: "AuditLog");

            migrationBuilder.DropColumn(
                name: "RetentionDate",
                table: "AuditLog");

            migrationBuilder.RenameColumn(
                name: "conmnt",
                table: "mission",
                newName: "misbudget");

            migrationBuilder.AlterColumn<string>(
                name: "villib",
                table: "ville",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(20)",
                oldMaxLength: 20,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "vilcod",
                table: "ville",
                type: "nvarchar(6)",
                maxLength: 6,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(2)",
                oldMaxLength: 2);

            migrationBuilder.AddColumn<float>(
                name: "cetjours",
                table: "solde",
                type: "real",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "socville",
                table: "Societe",
                type: "nvarchar(60)",
                maxLength: 60,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "parcetdatelim",
                table: "parametre",
                type: "nvarchar(5)",
                maxLength: 5,
                nullable: true);

            migrationBuilder.AddColumn<float>(
                name: "parcetmaxjours",
                table: "parametre",
                type: "real",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "parmodemp",
                table: "parametre",
                type: "nvarchar(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "missionid",
                table: "notedefrais",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AlterColumn<string>(
                name: "soccod",
                table: "mission",
                type: "nvarchar(6)",
                maxLength: 6,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(2)",
                oldMaxLength: 2,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "empcod",
                table: "mission",
                type: "nvarchar(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(12)",
                oldMaxLength: 12,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "abscod",
                table: "mission",
                type: "nvarchar(4)",
                maxLength: 4,
                nullable: false,
                defaultValue: "",
                oldClrType: typeof(string),
                oldType: "nvarchar(6)",
                oldMaxLength: 6,
                oldNullable: true);

            migrationBuilder.AddColumn<int>(
                name: "id",
                table: "mission",
                type: "int",
                nullable: false,
                defaultValue: 0)
                .Annotation("SqlServer:Identity", "1, 1");

            migrationBuilder.AddColumn<DateTime>(
                name: "misdatedeb",
                table: "mission",
                type: "datetime",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<DateTime>(
                name: "misdatefin",
                table: "mission",
                type: "datetime",
                nullable: false,
                defaultValue: new DateTime(1, 1, 1, 0, 0, 0, 0, DateTimeKind.Unspecified));

            migrationBuilder.AddColumn<string>(
                name: "misdest",
                table: "mission",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "misetat",
                table: "mission",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Pending");

            migrationBuilder.AddColumn<string>(
                name: "misnote",
                table: "mission",
                type: "nvarchar(500)",
                maxLength: 500,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "misobj",
                table: "mission",
                type: "nvarchar(150)",
                maxLength: 150,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<string>(
                name: "vilcod",
                table: "employe",
                type: "nvarchar(6)",
                maxLength: 6,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(4)",
                oldMaxLength: 4,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "vilcod",
                table: "empaff",
                type: "nvarchar(6)",
                maxLength: 6,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(4)",
                oldMaxLength: 4,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "vilcod",
                table: "contrat2",
                type: "nvarchar(6)",
                maxLength: 6,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(4)",
                oldMaxLength: 4,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "vilcod",
                table: "contrat",
                type: "nvarchar(6)",
                maxLength: 6,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(4)",
                oldMaxLength: 4,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "emptel",
                table: "contrat",
                type: "varchar(256)",
                unicode: false,
                maxLength: 256,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(256)",
                oldMaxLength: 256,
                oldNullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_mission",
                table: "mission",
                column: "id");

            migrationBuilder.CreateTable(
                name: "notification_preferences",
                columns: table => new
                {
                    np_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    uticod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    enabled = table.Column<bool>(type: "bit", nullable: false),
                    push_enabled = table.Column<bool>(type: "bit", nullable: false),
                    inapp_enabled = table.Column<bool>(type: "bit", nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification_preferences", x => x.np_id);
                });

            migrationBuilder.CreateTable(
                name: "notification_user_settings",
                columns: table => new
                {
                    uticod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    quiet_enabled = table.Column<bool>(type: "bit", nullable: false),
                    quiet_mode = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    quiet_start = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    quiet_end = table.Column<string>(type: "nvarchar(5)", maxLength: 5, nullable: false),
                    updated_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notification_user_settings", x => x.uticod);
                });

            migrationBuilder.CreateTable(
                name: "notifications",
                columns: table => new
                {
                    notif_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    uticod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    title = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    body = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: false),
                    category = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    data_json = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    read_at = table.Column<DateTime>(type: "datetime2", nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_notifications", x => x.notif_id);
                });

            migrationBuilder.CreateTable(
                name: "push_reminder_log",
                columns: table => new
                {
                    prl_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    empcod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    type = table.Column<string>(type: "nvarchar(10)", maxLength: 10, nullable: false),
                    for_date = table.Column<DateTime>(type: "datetime2", nullable: false),
                    sent_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    created_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_push_reminder_log", x => x.prl_id);
                });

            migrationBuilder.CreateTable(
                name: "push_tokens",
                columns: table => new
                {
                    pt_id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    uticod = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: false),
                    soccod = table.Column<string>(type: "nvarchar(15)", maxLength: 15, nullable: true),
                    token = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    platform = table.Column<string>(type: "nvarchar(20)", maxLength: 20, nullable: true),
                    device_id = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    created_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    last_seen_at = table.Column<DateTime>(type: "datetime2", nullable: false),
                    active = table.Column<bool>(type: "bit", nullable: false),
                    deleted_at = table.Column<DateTime>(type: "datetime", nullable: true),
                    retention_date = table.Column<DateTime>(type: "datetime", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_push_tokens", x => x.pt_id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_notedefrais_missionid",
                table: "notedefrais",
                column: "missionid");

            migrationBuilder.CreateIndex(
                name: "IX_mission_soccod_empcod",
                table: "mission",
                columns: new[] { "soccod", "empcod" });

            migrationBuilder.AddForeignKey(
                name: "FK_notedefrais_mission_missionid",
                table: "notedefrais",
                column: "missionid",
                principalTable: "mission",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_notedefrais_mission_missionid",
                table: "notedefrais");

            migrationBuilder.DropTable(
                name: "notification_preferences");

            migrationBuilder.DropTable(
                name: "notification_user_settings");

            migrationBuilder.DropTable(
                name: "notifications");

            migrationBuilder.DropTable(
                name: "push_reminder_log");

            migrationBuilder.DropTable(
                name: "push_tokens");

            migrationBuilder.DropIndex(
                name: "IX_notedefrais_missionid",
                table: "notedefrais");

            migrationBuilder.DropPrimaryKey(
                name: "PK_mission",
                table: "mission");

            migrationBuilder.DropIndex(
                name: "IX_mission_soccod_empcod",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "cetjours",
                table: "solde");

            migrationBuilder.DropColumn(
                name: "socville",
                table: "Societe");

            migrationBuilder.DropColumn(
                name: "parcetdatelim",
                table: "parametre");

            migrationBuilder.DropColumn(
                name: "parcetmaxjours",
                table: "parametre");

            migrationBuilder.DropColumn(
                name: "parmodemp",
                table: "parametre");

            migrationBuilder.DropColumn(
                name: "missionid",
                table: "notedefrais");

            migrationBuilder.DropColumn(
                name: "id",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "misdatedeb",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "misdatefin",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "misdest",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "misetat",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "misnote",
                table: "mission");

            migrationBuilder.DropColumn(
                name: "misobj",
                table: "mission");

            migrationBuilder.RenameColumn(
                name: "misbudget",
                table: "mission",
                newName: "conmnt");

            migrationBuilder.AlterColumn<string>(
                name: "villib",
                table: "ville",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(100)",
                oldMaxLength: 100,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "vilcod",
                table: "ville",
                type: "nvarchar(2)",
                maxLength: 2,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "nvarchar(6)",
                oldMaxLength: 6);

            migrationBuilder.AlterColumn<string>(
                name: "soccod",
                table: "mission",
                type: "nvarchar(2)",
                maxLength: 2,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(6)",
                oldMaxLength: 6);

            migrationBuilder.AlterColumn<string>(
                name: "empcod",
                table: "mission",
                type: "nvarchar(12)",
                maxLength: 12,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(12)",
                oldMaxLength: 12);

            migrationBuilder.AlterColumn<string>(
                name: "abscod",
                table: "mission",
                type: "nvarchar(6)",
                maxLength: 6,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(4)",
                oldMaxLength: 4);

            migrationBuilder.AddColumn<string>(
                name: "conadrdep",
                table: "mission",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "conamdep",
                table: "mission",
                type: "nvarchar(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "conamret",
                table: "mission",
                type: "nvarchar(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "concod",
                table: "mission",
                type: "nvarchar(10)",
                maxLength: 10,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "condat",
                table: "mission",
                type: "datetime",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "condep",
                table: "mission",
                type: "datetime",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "condepense",
                table: "mission",
                type: "char(100)",
                unicode: false,
                fixedLength: true,
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "condest",
                table: "mission",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "conjour",
                table: "mission",
                type: "nvarchar(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "conmodep",
                table: "mission",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "conmotif",
                table: "mission",
                type: "nvarchar(50)",
                maxLength: 50,
                nullable: true);

            migrationBuilder.AddColumn<float>(
                name: "connbjour",
                table: "mission",
                type: "real",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "conref",
                table: "mission",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "conresp",
                table: "mission",
                type: "nvarchar(15)",
                maxLength: 15,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "conret",
                table: "mission",
                type: "datetime",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "consanc",
                table: "mission",
                type: "nvarchar(1)",
                maxLength: 1,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "contransp",
                table: "mission",
                type: "nvarchar(100)",
                maxLength: 100,
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "vilcod",
                table: "employe",
                type: "nvarchar(4)",
                maxLength: 4,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(6)",
                oldMaxLength: 6,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "vilcod",
                table: "empaff",
                type: "nvarchar(4)",
                maxLength: 4,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(6)",
                oldMaxLength: 6,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "vilcod",
                table: "contrat2",
                type: "nvarchar(4)",
                maxLength: 4,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(6)",
                oldMaxLength: 6,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "vilcod",
                table: "contrat",
                type: "nvarchar(4)",
                maxLength: 4,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "nvarchar(6)",
                oldMaxLength: 6,
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "emptel",
                table: "contrat",
                type: "nvarchar(256)",
                maxLength: 256,
                nullable: true,
                oldClrType: typeof(string),
                oldType: "varchar(256)",
                oldUnicode: false,
                oldMaxLength: 256,
                oldNullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "CreatedAt",
                table: "AuditLog",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "DeletedAt",
                table: "AuditLog",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "RetentionDate",
                table: "AuditLog",
                type: "datetime2",
                nullable: true);
        }
    }
}
