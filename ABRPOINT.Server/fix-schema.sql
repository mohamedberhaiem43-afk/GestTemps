BEGIN TRANSACTION;
GO

ALTER TABLE [partranche] DROP CONSTRAINT [PK_partranche];
GO

DECLARE @var0 sysname;
SELECT @var0 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[utilisateur]') AND [c].[name] = N'uticod');
IF @var0 IS NOT NULL EXEC(N'ALTER TABLE [utilisateur] DROP CONSTRAINT [' + @var0 + '];');
ALTER TABLE [utilisateur] ALTER COLUMN [uticod] nvarchar(20) NOT NULL;
GO

DECLARE @var1 sysname;
SELECT @var1 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[socuser]') AND [c].[name] = N'uticod');
IF @var1 IS NOT NULL EXEC(N'ALTER TABLE [socuser] DROP CONSTRAINT [' + @var1 + '];');
ALTER TABLE [socuser] ALTER COLUMN [uticod] nvarchar(20) NOT NULL;
GO

DECLARE @var2 sysname;
SELECT @var2 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Societe]') AND [c].[name] = N'socreg');
IF @var2 IS NOT NULL EXEC(N'ALTER TABLE [Societe] DROP CONSTRAINT [' + @var2 + '];');
ALTER TABLE [Societe] ALTER COLUMN [socreg] int NULL;
GO

DECLARE @var3 sysname;
SELECT @var3 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[Societe]') AND [c].[name] = N'socmois');
IF @var3 IS NOT NULL EXEC(N'ALTER TABLE [Societe] DROP CONSTRAINT [' + @var3 + '];');
ALTER TABLE [Societe] ALTER COLUMN [socmois] int NULL;
GO

DECLARE @var4 sysname;
SELECT @var4 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[rubrique]') AND [c].[name] = N'vartype');
IF @var4 IS NOT NULL EXEC(N'ALTER TABLE [rubrique] DROP CONSTRAINT [' + @var4 + '];');
ALTER TABLE [rubrique] ALTER COLUMN [vartype] nvarchar(5) NULL;
GO

DECLARE @var5 sysname;
SELECT @var5 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[rubrique]') AND [c].[name] = N'rubtype');
IF @var5 IS NOT NULL EXEC(N'ALTER TABLE [rubrique] DROP CONSTRAINT [' + @var5 + '];');
ALTER TABLE [rubrique] ALTER COLUMN [rubtype] nvarchar(5) NULL;
GO

DECLARE @var6 sysname;
SELECT @var6 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[refresh_tokens]') AND [c].[name] = N'expires_at');
IF @var6 IS NOT NULL EXEC(N'ALTER TABLE [refresh_tokens] DROP CONSTRAINT [' + @var6 + '];');
ALTER TABLE [refresh_tokens] ALTER COLUMN [expires_at] datetime2 NOT NULL;
GO

DECLARE @var7 sysname;
SELECT @var7 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[refresh_tokens]') AND [c].[name] = N'created_at');
IF @var7 IS NOT NULL EXEC(N'ALTER TABLE [refresh_tokens] DROP CONSTRAINT [' + @var7 + '];');
ALTER TABLE [refresh_tokens] ALTER COLUMN [created_at] datetime2 NOT NULL;
GO

ALTER TABLE [qualif] ADD [catcod] nvarchar(10) NULL;
GO

DECLARE @var8 sysname;
SELECT @var8 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[presence]') AND [c].[name] = N'totcmp');
IF @var8 IS NOT NULL EXEC(N'ALTER TABLE [presence] DROP CONSTRAINT [' + @var8 + '];');
ALTER TABLE [presence] ALTER COLUMN [totcmp] real NULL;
GO

DECLARE @var9 sysname;
SELECT @var9 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[presence]') AND [c].[name] = N'presem');
IF @var9 IS NOT NULL EXEC(N'ALTER TABLE [presence] DROP CONSTRAINT [' + @var9 + '];');
ALTER TABLE [presence] ALTER COLUMN [presem] real NULL;
GO

DECLARE @var10 sysname;
SELECT @var10 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[presence]') AND [c].[name] = N'prerepas');
IF @var10 IS NOT NULL EXEC(N'ALTER TABLE [presence] DROP CONSTRAINT [' + @var10 + '];');
ALTER TABLE [presence] ALTER COLUMN [prerepas] real NULL;
GO

DECLARE @var11 sysname;
SELECT @var11 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[presence]') AND [c].[name] = N'predouche');
IF @var11 IS NOT NULL EXEC(N'ALTER TABLE [presence] DROP CONSTRAINT [' + @var11 + '];');
ALTER TABLE [presence] ALTER COLUMN [predouche] real NULL;
GO

DECLARE @var12 sysname;
SELECT @var12 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[presence]') AND [c].[name] = N'preavantsort');
IF @var12 IS NOT NULL EXEC(N'ALTER TABLE [presence] DROP CONSTRAINT [' + @var12 + '];');
ALTER TABLE [presence] ALTER COLUMN [preavantsort] real NULL;
GO

DECLARE @var13 sysname;
SELECT @var13 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[presence]') AND [c].[name] = N'preavantent');
IF @var13 IS NOT NULL EXEC(N'ALTER TABLE [presence] DROP CONSTRAINT [' + @var13 + '];');
ALTER TABLE [presence] ALTER COLUMN [preavantent] real NULL;
GO

DECLARE @var14 sysname;
SELECT @var14 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[presence]') AND [c].[name] = N'preapressort');
IF @var14 IS NOT NULL EXEC(N'ALTER TABLE [presence] DROP CONSTRAINT [' + @var14 + '];');
ALTER TABLE [presence] ALTER COLUMN [preapressort] real NULL;
GO

DECLARE @var15 sysname;
SELECT @var15 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[presence]') AND [c].[name] = N'preapresent');
IF @var15 IS NOT NULL EXEC(N'ALTER TABLE [presence] DROP CONSTRAINT [' + @var15 + '];');
ALTER TABLE [presence] ALTER COLUMN [preapresent] real NULL;
GO

DECLARE @var16 sysname;
SELECT @var16 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[poste]') AND [c].[name] = N'minhjourven');
IF @var16 IS NOT NULL EXEC(N'ALTER TABLE [poste] DROP CONSTRAINT [' + @var16 + '];');
ALTER TABLE [poste] ALTER COLUMN [minhjourven] int NULL;
GO

DECLARE @var17 sysname;
SELECT @var17 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[poste]') AND [c].[name] = N'minhjoursam');
IF @var17 IS NOT NULL EXEC(N'ALTER TABLE [poste] DROP CONSTRAINT [' + @var17 + '];');
ALTER TABLE [poste] ALTER COLUMN [minhjoursam] int NULL;
GO

DECLARE @var18 sysname;
SELECT @var18 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[poste]') AND [c].[name] = N'minhjourmer');
IF @var18 IS NOT NULL EXEC(N'ALTER TABLE [poste] DROP CONSTRAINT [' + @var18 + '];');
ALTER TABLE [poste] ALTER COLUMN [minhjourmer] int NULL;
GO

DECLARE @var19 sysname;
SELECT @var19 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[poste]') AND [c].[name] = N'minhjourmar');
IF @var19 IS NOT NULL EXEC(N'ALTER TABLE [poste] DROP CONSTRAINT [' + @var19 + '];');
ALTER TABLE [poste] ALTER COLUMN [minhjourmar] int NULL;
GO

DECLARE @var20 sysname;
SELECT @var20 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[poste]') AND [c].[name] = N'minhjourlun');
IF @var20 IS NOT NULL EXEC(N'ALTER TABLE [poste] DROP CONSTRAINT [' + @var20 + '];');
ALTER TABLE [poste] ALTER COLUMN [minhjourlun] int NULL;
GO

DECLARE @var21 sysname;
SELECT @var21 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[poste]') AND [c].[name] = N'minhjourjeu');
IF @var21 IS NOT NULL EXEC(N'ALTER TABLE [poste] DROP CONSTRAINT [' + @var21 + '];');
ALTER TABLE [poste] ALTER COLUMN [minhjourjeu] int NULL;
GO

DECLARE @var22 sysname;
SELECT @var22 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[poste]') AND [c].[name] = N'minhjourdim');
IF @var22 IS NOT NULL EXEC(N'ALTER TABLE [poste] DROP CONSTRAINT [' + @var22 + '];');
ALTER TABLE [poste] ALTER COLUMN [minhjourdim] int NULL;
GO

DECLARE @var23 sysname;
SELECT @var23 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[poste]') AND [c].[name] = N'minhdemijourven');
IF @var23 IS NOT NULL EXEC(N'ALTER TABLE [poste] DROP CONSTRAINT [' + @var23 + '];');
ALTER TABLE [poste] ALTER COLUMN [minhdemijourven] int NULL;
GO

DECLARE @var24 sysname;
SELECT @var24 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[poste]') AND [c].[name] = N'minhdemijoursam');
IF @var24 IS NOT NULL EXEC(N'ALTER TABLE [poste] DROP CONSTRAINT [' + @var24 + '];');
ALTER TABLE [poste] ALTER COLUMN [minhdemijoursam] int NULL;
GO

DECLARE @var25 sysname;
SELECT @var25 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[poste]') AND [c].[name] = N'minhdemijourmer');
IF @var25 IS NOT NULL EXEC(N'ALTER TABLE [poste] DROP CONSTRAINT [' + @var25 + '];');
ALTER TABLE [poste] ALTER COLUMN [minhdemijourmer] int NULL;
GO

DECLARE @var26 sysname;
SELECT @var26 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[poste]') AND [c].[name] = N'minhdemijourmar');
IF @var26 IS NOT NULL EXEC(N'ALTER TABLE [poste] DROP CONSTRAINT [' + @var26 + '];');
ALTER TABLE [poste] ALTER COLUMN [minhdemijourmar] int NULL;
GO

DECLARE @var27 sysname;
SELECT @var27 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[poste]') AND [c].[name] = N'minhdemijourlun');
IF @var27 IS NOT NULL EXEC(N'ALTER TABLE [poste] DROP CONSTRAINT [' + @var27 + '];');
ALTER TABLE [poste] ALTER COLUMN [minhdemijourlun] int NULL;
GO

DECLARE @var28 sysname;
SELECT @var28 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[poste]') AND [c].[name] = N'minhdemijourjeu');
IF @var28 IS NOT NULL EXEC(N'ALTER TABLE [poste] DROP CONSTRAINT [' + @var28 + '];');
ALTER TABLE [poste] ALTER COLUMN [minhdemijourjeu] int NULL;
GO

DECLARE @var29 sysname;
SELECT @var29 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[poste]') AND [c].[name] = N'minhdemijourdim');
IF @var29 IS NOT NULL EXEC(N'ALTER TABLE [poste] DROP CONSTRAINT [' + @var29 + '];');
ALTER TABLE [poste] ALTER COLUMN [minhdemijourdim] int NULL;
GO

DECLARE @var30 sysname;
SELECT @var30 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[partranche]') AND [c].[name] = N'caltype');
IF @var30 IS NOT NULL EXEC(N'ALTER TABLE [partranche] DROP CONSTRAINT [' + @var30 + '];');
UPDATE [partranche] SET [caltype] = N'' WHERE [caltype] IS NULL;
ALTER TABLE [partranche] ALTER COLUMN [caltype] nvarchar(6) NOT NULL;
ALTER TABLE [partranche] ADD DEFAULT N'' FOR [caltype];
GO

DECLARE @var31 sysname;
SELECT @var31 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[moduser]') AND [c].[name] = N'uticod');
IF @var31 IS NOT NULL EXEC(N'ALTER TABLE [moduser] DROP CONSTRAINT [' + @var31 + '];');
ALTER TABLE [moduser] ALTER COLUMN [uticod] nvarchar(20) NULL;
GO

DECLARE @var32 sysname;
SELECT @var32 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[employe]') AND [c].[name] = N'empminhjour');
IF @var32 IS NOT NULL EXEC(N'ALTER TABLE [employe] DROP CONSTRAINT [' + @var32 + '];');
ALTER TABLE [employe] ALTER COLUMN [empminhjour] float NULL;
GO

DECLARE @var33 sysname;
SELECT @var33 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[employe]') AND [c].[name] = N'emplib');
IF @var33 IS NOT NULL EXEC(N'ALTER TABLE [employe] DROP CONSTRAINT [' + @var33 + '];');
ALTER TABLE [employe] ALTER COLUMN [emplib] nvarchar(100) NULL;
GO

DECLARE @var34 sysname;
SELECT @var34 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[employe]') AND [c].[name] = N'empfonc');
IF @var34 IS NOT NULL EXEC(N'ALTER TABLE [employe] DROP CONSTRAINT [' + @var34 + '];');
ALTER TABLE [employe] ALTER COLUMN [empfonc] nvarchar(40) NULL;
GO

DECLARE @var35 sysname;
SELECT @var35 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[employe]') AND [c].[name] = N'empadr');
IF @var35 IS NOT NULL EXEC(N'ALTER TABLE [employe] DROP CONSTRAINT [' + @var35 + '];');
ALTER TABLE [employe] ALTER COLUMN [empadr] varchar(100) NULL;
GO

DECLARE @var36 sysname;
SELECT @var36 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[empaff]') AND [c].[name] = N'empnbp');
IF @var36 IS NOT NULL EXEC(N'ALTER TABLE [empaff] DROP CONSTRAINT [' + @var36 + '];');
ALTER TABLE [empaff] ALTER COLUMN [empnbp] real NULL;
GO

DECLARE @var37 sysname;
SELECT @var37 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[calendsoc]') AND [c].[name] = N'soccod');
IF @var37 IS NOT NULL EXEC(N'ALTER TABLE [calendsoc] DROP CONSTRAINT [' + @var37 + '];');
UPDATE [calendsoc] SET [soccod] = N'' WHERE [soccod] IS NULL;
ALTER TABLE [calendsoc] ALTER COLUMN [soccod] nvarchar(4) NOT NULL;
ALTER TABLE [calendsoc] ADD DEFAULT N'' FOR [soccod];
GO

DECLARE @var38 sysname;
SELECT @var38 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[calendsoc]') AND [c].[name] = N'cal_sem');
IF @var38 IS NOT NULL EXEC(N'ALTER TABLE [calendsoc] DROP CONSTRAINT [' + @var38 + '];');
UPDATE [calendsoc] SET [cal_sem] = 0 WHERE [cal_sem] IS NULL;
ALTER TABLE [calendsoc] ALTER COLUMN [cal_sem] int NOT NULL;
ALTER TABLE [calendsoc] ADD DEFAULT 0 FOR [cal_sem];
GO

DECLARE @var39 sysname;
SELECT @var39 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[calendsoc]') AND [c].[name] = N'cal_mois');
IF @var39 IS NOT NULL EXEC(N'ALTER TABLE [calendsoc] DROP CONSTRAINT [' + @var39 + '];');
UPDATE [calendsoc] SET [cal_mois] = N'' WHERE [cal_mois] IS NULL;
ALTER TABLE [calendsoc] ALTER COLUMN [cal_mois] nvarchar(2) NOT NULL;
ALTER TABLE [calendsoc] ADD DEFAULT N'' FOR [cal_mois];
GO

DECLARE @var40 sysname;
SELECT @var40 = [d].[name]
FROM [sys].[default_constraints] [d]
INNER JOIN [sys].[columns] [c] ON [d].[parent_column_id] = [c].[column_id] AND [d].[parent_object_id] = [c].[object_id]
WHERE ([d].[parent_object_id] = OBJECT_ID(N'[calendsoc]') AND [c].[name] = N'cal_an');
IF @var40 IS NOT NULL EXEC(N'ALTER TABLE [calendsoc] DROP CONSTRAINT [' + @var40 + '];');
UPDATE [calendsoc] SET [cal_an] = N'' WHERE [cal_an] IS NULL;
ALTER TABLE [calendsoc] ALTER COLUMN [cal_an] nvarchar(4) NOT NULL;
ALTER TABLE [calendsoc] ADD DEFAULT N'' FOR [cal_an];
GO

ALTER TABLE [partranche] ADD CONSTRAINT [PK_partranche] PRIMARY KEY ([soccod], [caltype], [empreg]);
GO

ALTER TABLE [calendsoc] ADD CONSTRAINT [PK_calendsoc] PRIMARY KEY ([soccod], [cal_an], [cal_mois], [cal_sem]);
GO

INSERT INTO [__EFMigrationsHistory] ([MigrationId], [ProductVersion])
VALUES (N'20260405092638_FixDatabaseSchemaIssues', N'8.0.7');
GO

COMMIT;
GO

