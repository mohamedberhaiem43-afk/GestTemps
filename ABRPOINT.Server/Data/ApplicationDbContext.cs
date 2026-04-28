using ABRPOINT.Server.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace ABRPOINT.Server.Data;

public partial class ApplicationDbContext : DbContext
{

    public ApplicationDbContext()
    {
    }

    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    public virtual DbSet<Absence> Absences { get; set; }

    public virtual DbSet<Aide> Aides { get; set; }

    public virtual DbSet<Allaitement> Allaitements { get; set; }

    public virtual DbSet<Anomalie> Anomalies { get; set; }

    public virtual DbSet<Article> Articles { get; set; }

    public virtual DbSet<Autoriser> Autorisers { get; set; }

    public virtual DbSet<Avance> Avances { get; set; }

    public virtual DbSet<Banque> Banques { get; set; }

    public virtual DbSet<Billet> Billets { get; set; }

    public virtual DbSet<Calendsoc> Calendsocs { get; set; }

    public virtual DbSet<Categorie> Categories { get; set; }

    public virtual DbSet<Cloture> Clotures { get; set; }

    public virtual DbSet<Cnss> Cnsses { get; set; }

    public virtual DbSet<Coltable> Coltables { get; set; }

    public virtual DbSet<Compenser> Compensers { get; set; }

    public virtual DbSet<Conge> Conges { get; set; }

    public virtual DbSet<Congenon> Congenons { get; set; }

    public virtual DbSet<Contrat> Contrats { get; set; }

    public virtual DbSet<Contrat2> Contrat2s { get; set; }

    public virtual DbSet<Defaut> Defauts { get; set; }

    public virtual DbSet<Demconge> Demconges { get; set; }

    public virtual DbSet<Direction> Directions { get; set; }

    public virtual DbSet<Dmpoint> Dmpoints { get; set; }

    public virtual DbSet<Dmpresence> Dmpresences { get; set; }

    public virtual DbSet<Donne> Donnes { get; set; }

    public virtual DbSet<Echelle> Echelles { get; set; }

    public virtual DbSet<Empaff> Empaffs { get; set; }

    public virtual DbSet<Empcat> Empcats { get; set; }

    public virtual DbSet<Empchg> Empchgs { get; set; }

    public virtual DbSet<Empchoisie> Empchoisies { get; set; }

    public virtual DbSet<Empgrh> Empgrhs { get; set; }

    public virtual DbSet<Employe> Employes { get; set; }

    public virtual DbSet<Emprnd> Emprnds { get; set; }

    public virtual DbSet<Empuser> Empusers { get; set; }

    public virtual DbSet<Ferier> Feriers { get; set; }

    public virtual DbSet<Fonction> Fonctions { get; set; }

    public virtual DbSet<Grille> Grilles { get; set; }

    public virtual DbSet<Hsalaire> Hsalaires { get; set; }

    public virtual DbSet<Lcalendsoc> Lcalendsocs { get; set; }

    public virtual DbSet<Lcategorie> Lcategories { get; set; }

    public virtual DbSet<Lcontrat> Lcontrats { get; set; }

    public virtual DbSet<Lferier> Lferiers { get; set; }

    public virtual DbSet<Lmotifpoint> Lmotifpoints { get; set; }

    public virtual DbSet<Lplanhoraire> Lplanhoraires { get; set; }

    public virtual DbSet<Lpointjour> Lpointjours { get; set; }

    public virtual DbSet<Lpointmoi> Lpointmois { get; set; }

    public virtual DbSet<Lposte> Lpostes { get; set; }

    public virtual DbSet<Lpret> Lprets { get; set; }

    public virtual DbSet<Lregleremp> Lregleremps { get; set; }

    public virtual DbSet<Lsalaire> Lsalaires { get; set; }

    public virtual DbSet<Mission> Missions { get; set; }

    public virtual DbSet<Modeopr> Modeoprs { get; set; }

    public virtual DbSet<Module> Modules { get; set; }

    public virtual DbSet<Moduser> Modusers { get; set; }

    public virtual DbSet<Motifpoint> Motifpoints { get; set; }

    public virtual DbSet<Nation> Nations { get; set; }

    public virtual DbSet<Opbarre> Opbarres { get; set; }

    public virtual DbSet<Operation> Operations { get; set; }

    public virtual DbSet<Paieuser> Paieusers { get; set; }

    public virtual DbSet<Paquet> Paquets { get; set; }

    public virtual DbSet<Parametre> Parametres { get; set; }

    public virtual DbSet<Paramsite> Paramsites { get; set; }

    public virtual DbSet<Parapprent> Parapprents { get; set; }

    public virtual DbSet<Parposte> Parpostes { get; set; }

    public virtual DbSet<Parpostsite> Parpostsites { get; set; }

    public virtual DbSet<Partranche> Partranches { get; set; }

    public virtual DbSet<Partranchsite> Partranchsites { get; set; }

    public virtual DbSet<Planhoraire> Planhoraires { get; set; }

    public virtual DbSet<Pointacce> Pointacces { get; set; }

    public virtual DbSet<Pointdroit> Pointdroits { get; set; }

    public virtual DbSet<Pointeuse> Pointeuses { get; set; }

    public virtual DbSet<Pointheure> Pointheures { get; set; }

    public virtual DbSet<Pointmoisj> Pointmoisjs { get; set; }

    public virtual DbSet<Pointsemainej> Pointsemainejs { get; set; }

    public virtual DbSet<Pointuser> Pointusers { get; set; }

    public virtual DbSet<Poste> Postes { get; set; }

    public virtual DbSet<Postemploye> Postemployes { get; set; }

    public virtual DbSet<Postesite> Postesites { get; set; }

    public virtual DbSet<Presence> Presences { get; set; }

    public virtual DbSet<Presencej> Presencejs { get; set; }

    public virtual DbSet<Pret> Prets { get; set; }

    public virtual DbSet<Probarre> Probarres { get; set; }

    public virtual DbSet<Qualif> Qualifs { get; set; }

    public virtual DbSet<Qualjrl> Qualjrls { get; set; }

    public virtual DbSet<Qualmen> Qualmens { get; set; }

    public virtual DbSet<Regleremp> Regleremps { get; set; }

    public virtual DbSet<Rendjour> Rendjours { get; set; }

    public virtual DbSet<Repo> Repos { get; set; }

    public virtual DbSet<Rndbareme> Rndbaremes { get; set; }

    public virtual DbSet<Rubrique> Rubriques { get; set; }

    public virtual DbSet<Rubtype> Rubtypes { get; set; }

    public virtual DbSet<Salaire> Salaires { get; set; }

    public virtual DbSet<Sanction> Sanctions { get; set; }

    public virtual DbSet<Section> Sections { get; set; }

    public virtual DbSet<Semaine> Semaines { get; set; }

    public virtual DbSet<Service> Services { get; set; }

    public virtual DbSet<Site> Sites { get; set; }

    public virtual DbSet<Societe> Societes { get; set; }

    public virtual DbSet<Socsage> Socsages { get; set; }

    public virtual DbSet<Socuser> Socusers { get; set; }

    public virtual DbSet<Solde> Soldes { get; set; }

    public virtual DbSet<Soldecmp> Soldecmps { get; set; }

    public virtual DbSet<Suivemp> Suivemps { get; set; }

    public virtual DbSet<SuvCalend> SuvCalends { get; set; }

    public virtual DbSet<TAmort> TAmorts { get; set; }

    public virtual DbSet<TPret> TPrets { get; set; }

    public virtual DbSet<TRemboursement> TRemboursements { get; set; }

    public virtual DbSet<TSal> TSals { get; set; }

    public virtual DbSet<TTyperemb> TTyperembs { get; set; }

    public virtual DbSet<Titre> Titres { get; set; }

    public virtual DbSet<Tmpclp651021> Tmpclp651021s { get; set; }

    public virtual DbSet<Utilisateur> Utilisateurs { get; set; }

    public virtual DbSet<RefreshToken> RefreshTokens { get; set; }

    public virtual DbSet<Role> Roles { get; set; }

    public virtual DbSet<RolePermission> RolePermissions { get; set; }

    public virtual DbSet<RolePointdroit> RolePointdroits { get; set; }

    public virtual DbSet<Ville> Villes { get; set; }
    public virtual DbSet<NoteDeFrais> NoteDeFrais { get; set; }
    public virtual DbSet<DocumentVault> DocumentVaults { get; set; }
    public virtual DbSet<DemandeAutorisation> DemandeAutorisations { get; set; }
    public virtual DbSet<AuditLog> AuditLogs { get; set; }
    public virtual DbSet<PushToken> PushTokens { get; set; }
    public virtual DbSet<PushReminderLog> PushReminderLogs { get; set; }
    public virtual DbSet<Notification> Notifications { get; set; }
    public virtual DbSet<NotificationPreference> NotificationPreferences { get; set; }
    public virtual DbSet<NotificationUserSettings> NotificationUserSettings { get; set; }

    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        var auditEntries = CollectAuditEntries();
        OnBeforeSave();
        var result = base.SaveChanges(acceptAllChangesOnSuccess);
        SaveAuditEntriesSafe(auditEntries);
        return result;
    }

    public override async Task<int> SaveChangesAsync(bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        var auditEntries = CollectAuditEntries();
        OnBeforeSave();
        var result = await base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
        await SaveAuditEntriesSafeAsync(auditEntries, cancellationToken);
        return result;
    }

    private List<AuditLog> CollectAuditEntries()
    {
        var auditEntries = new List<AuditLog>();
        foreach (var entry in ChangeTracker.Entries().Where(e => e.Entity is not AuditLog && e.Entity is BaseEntity && e.State != EntityState.Detached && e.State != EntityState.Unchanged))
        {
            var audit = new AuditLog
            {
                Action = entry.State.ToString(),
                TableName = entry.Metadata.GetTableName(),
                DateAction = DateTime.UtcNow,
            };

            // Try to extract Uticod from the entity if it has a Uticod property
            if (entry.Entity is Utilisateur utilEntity)
            {
                audit.Uticod = utilEntity.Uticod;
            }
            else
            {
                var uticodProp = entry.Entity.GetType().GetProperty("Uticod");
                if (uticodProp != null)
                {
                    audit.Uticod = uticodProp.GetValue(entry.Entity)?.ToString();
                }
            }

            auditEntries.Add(audit);
        }
        return auditEntries;
    }

    private void SaveAuditEntriesSafe(List<AuditLog> auditEntries)
    {
        if (!auditEntries.Any()) return;
        try
        {
            AuditLogs.AddRange(auditEntries);
            base.SaveChanges(true);
        }
        catch
        {
            // Audit logging should never break the main operation
            // Detach failed audit entries from change tracker
            foreach (var audit in auditEntries)
            {
                Entry(audit).State = EntityState.Detached;
            }
        }
    }

    private async Task SaveAuditEntriesSafeAsync(List<AuditLog> auditEntries, CancellationToken cancellationToken)
    {
        if (!auditEntries.Any()) return;
        try
        {
            AuditLogs.AddRange(auditEntries);
            await base.SaveChangesAsync(true, cancellationToken);
        }
        catch
        {
            // Audit logging should never break the main operation
            // Detach failed audit entries from change tracker
            foreach (var audit in auditEntries)
            {
                Entry(audit).State = EntityState.Detached;
            }
        }
    }

    private void OnBeforeSave()
    {
        foreach (var entry in ChangeTracker.Entries<BaseEntity>())
        {
            switch (entry.State)
            {
                case EntityState.Added:
                    entry.Entity.CreatedAt ??= DateTime.UtcNow;
                    break;
                case EntityState.Deleted:
                    // Soft delete: mark as deleted instead of actually deleting
                    entry.State = EntityState.Modified;
                    entry.Entity.DeletedAt = DateTime.UtcNow;
                    break;
            }
        }
    }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Explicit table mapping for Societe
        modelBuilder.Entity<Societe>(entity =>
        {
            entity.ToTable("Societe"); // exact table name in your database
            entity.HasKey(e => e.Soccod); // or whatever the primary key is
        });
        modelBuilder.Entity<Direction>(entity =>
        {
            entity.HasKey(e => new { e.Dircod, e.Soccod });
        });
        modelBuilder.Entity<Service>(entity =>
        {
            entity.HasKey(s => new { s.Sercod, s.Soccod });
        });
       
        modelBuilder.Entity<Section>(entity =>
        {
            entity.HasKey(s => new { s.Seccod, s.Soccod });
        });
        modelBuilder.Entity<Site>(entity =>
        {
            entity.HasKey(s => new { s.Sitcod, s.Soccod });
        });
        modelBuilder.Entity<Fonction>(entity =>
        {
            entity.HasKey(s => new { s.Soccod, s.Foncod });
        }); 
        modelBuilder.Entity<Absence>(entity =>
        {
            entity.HasKey(s => new { s.Soccod, s.Abscod });
        });
        modelBuilder.Entity<Qualif>(entity =>
        {
            entity.HasKey(s => new { s.Quacod, s.Soccod });
        }); 
        modelBuilder.Entity<Ferier>(entity =>
        {
            entity.HasKey(s => new { s.Soccod, s.Ferdate });
        });

        //modelBuilder.Entity<Employe>(entity =>
        //{
        //    entity.Property(e => e.Parmois).IsFixedLength();
        //});
        modelBuilder.Entity<Compenser>(entity =>
        {
            entity.Property(e => e.Concod).IsFixedLength();
        });
        modelBuilder.Entity<Autoriser>(entity =>
        {
            entity.Property(e => e.Concod).IsFixedLength();
        }); 
        modelBuilder.Entity<Allaitement>(entity =>
        {
            entity.HasKey(s => new { s.Soccod, s.Concod });
        }); 
        modelBuilder.Entity<Poste>(entity =>
        {
            entity.HasKey(s => new { s.Soccod, s.Codposte });
        });

        modelBuilder.Entity<Demconge>(entity =>
        {
            entity.HasKey(s => new { s.Soccod, s.Concod });
        });
        modelBuilder.Entity<Conge>(entity =>
        {
            entity.HasKey(s => new { s.Soccod, s.Concod });
        }); 
        modelBuilder.Entity<Sanction>(entity =>
        {
            entity.HasKey(s => new { s.Soccod, s.Concod });
        });
        modelBuilder.Entity<Lmotifpoint>(entity =>
        {
            entity.Property(e => e.Concod).IsFixedLength();
            entity.Property(e => e.Motcod).IsFixedLength();
            entity.Property(e => e.Soccod).IsFixedLength();
        });

        modelBuilder.Entity<Mission>(entity =>
        {
            entity.Property(e => e.Condepense).IsFixedLength();
        });

        modelBuilder.Entity<Motifpoint>(entity =>
        {
            entity.Property(e => e.Motcod).IsFixedLength();
            entity.Property(e => e.Motlib).IsFixedLength();
            entity.Property(e => e.Mottype).IsFixedLength();
            entity.Property(e => e.Soccod).IsFixedLength();
        });

        // Apply soft-delete global query filter for all BaseEntity types
        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            if (typeof(BaseEntity).IsAssignableFrom(entityType.ClrType))
            {
                modelBuilder.Entity(entityType.ClrType).HasQueryFilter(
                    GenerateSoftDeleteFilter(entityType.ClrType));
            }
        }

        OnModelCreatingPartial(modelBuilder);
    }

    partial void OnModelCreatingPartial(ModelBuilder modelBuilder);

    private static System.Linq.Expressions.LambdaExpression GenerateSoftDeleteFilter(Type entityType)
    {
        var param = System.Linq.Expressions.Expression.Parameter(entityType, "e");
        var deletedAtProp = System.Linq.Expressions.Expression.PropertyOrField(param, "DeletedAt");
        var nullConst = System.Linq.Expressions.Expression.Constant(null, typeof(DateTime?));
        var condition = System.Linq.Expressions.Expression.Equal(deletedAtProp, nullConst);
        return System.Linq.Expressions.Expression.Lambda(condition, param);
    }
}
