CREATE TABLE [dbo].[notedefrais] (
    [id] [int] IDENTITY(1,1) NOT NULL,
    [soccod] [nvarchar](6) NOT NULL,
    [empcod] [nvarchar](12) NOT NULL,
    [titre] [nvarchar](100) NOT NULL,
    [categorie] [nvarchar](50) NOT NULL,
    [montant] [float] NOT NULL,
    [projet] [nvarchar](100) NULL,
    [datedepense] [datetime] NOT NULL,
    [justificatif] [nvarchar](255) NULL,
    [etat] [nvarchar](20) NOT NULL,
    [createdat] [datetime] NOT NULL,
 CONSTRAINT [PK_notedefrais] PRIMARY KEY CLUSTERED 
(
    [id] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]
GO

ALTER TABLE [dbo].[notedefrais] ADD  CONSTRAINT [DF_notedefrais_etat]  DEFAULT (N'Pending') FOR [etat]
GO

ALTER TABLE [dbo].[notedefrais] ADD  CONSTRAINT [DF_notedefrais_createdat]  DEFAULT (getdate()) FOR [createdat]
GO
