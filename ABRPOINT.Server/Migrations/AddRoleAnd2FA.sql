-- Migration: Add Role/2FA columns to Utilisateur + Create Roles and RolePermissions tables
-- Run this script against your database

-- 1. Add 2FA and Role columns to Utilisateur table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'UTILISATEUR' AND COLUMN_NAME = 'UTIROLE')
BEGIN
    ALTER TABLE UTILISATEUR ADD UTIROLE VARCHAR(50) NULL DEFAULT 'standard';
END

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'UTILISATEUR' AND COLUMN_NAME = 'UTITWOFACTORENABLED')
BEGIN
    ALTER TABLE UTILISATEUR ADD UTITWOFACTORENABLED VARCHAR(1) NULL DEFAULT '0';
END

IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'UTILISATEUR' AND COLUMN_NAME = 'UTITWOFACTORSECRET')
BEGIN
    ALTER TABLE UTILISATEUR ADD UTITWOFACTORSECRET VARCHAR(255) NULL;
END

-- 2. Create roles table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'roles')
BEGIN
    CREATE TABLE roles (
        role_id INT IDENTITY(1,1) PRIMARY KEY,
        role_name VARCHAR(100) NOT NULL,
        role_description VARCHAR(255) NULL,
        role_color VARCHAR(20) NULL DEFAULT '#64748b',
        role_is_system BIT NULL DEFAULT 0,
        role_created_at DATETIME NULL DEFAULT GETUTCDATE()
    );

    -- Insert default system roles
    INSERT INTO roles (role_name, role_description, role_color, role_is_system) VALUES
    ('Administrateur', 'Accès complet à toutes les fonctionnalités', '#f59e0b', 1),
    ('Responsable RH', 'Gestion des employés, congés et paie', '#3b82f6', 1),
    ('Superviseur Pointage', 'Supervision du pointage et des présences', '#10b981', 1),
    ('Manager', 'Consultation et validation', '#8b5cf6', 1),
    ('Utilisateur Standard', 'Accès limité en consultation', '#64748b', 1);
END

-- 3. Create role_permissions table
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'role_permissions')
BEGIN
    CREATE TABLE role_permissions (
        rp_id INT IDENTITY(1,1) PRIMARY KEY,
        rp_role_id INT NOT NULL,
        rp_module VARCHAR(100) NOT NULL,
        rp_consult VARCHAR(1) NULL DEFAULT '0',
        rp_add VARCHAR(1) NULL DEFAULT '0',
        rp_modify VARCHAR(1) NULL DEFAULT '0',
        rp_delete VARCHAR(1) NULL DEFAULT '0',
        FOREIGN KEY (rp_role_id) REFERENCES roles(role_id) ON DELETE CASCADE
    );

    -- Insert default permissions for each role
    -- Administrateur: full access
    INSERT INTO role_permissions (rp_role_id, rp_module, rp_consult, rp_add, rp_modify, rp_delete) VALUES
    (1, 'Absences et Sanctions', '1', '1', '1', '1'),
    (1, 'Pointage et Temps', '1', '1', '1', '1'),
    (1, 'Gestion Employés', '1', '1', '1', '1'),
    (1, 'Contrats et Avenants', '1', '1', '1', '1'),
    (1, 'Paie et Rémunération', '1', '1', '1', '1');

    -- Responsable RH: Absences, Employés, Contrats, Paie
    INSERT INTO role_permissions (rp_role_id, rp_module, rp_consult, rp_add, rp_modify, rp_delete) VALUES
    (2, 'Absences et Sanctions', '1', '1', '1', '1'),
    (2, 'Pointage et Temps', '1', '0', '0', '0'),
    (2, 'Gestion Employés', '1', '1', '1', '1'),
    (2, 'Contrats et Avenants', '1', '1', '1', '0'),
    (2, 'Paie et Rémunération', '1', '1', '1', '0');

    -- Superviseur Pointage: Pointage, Absences consultation
    INSERT INTO role_permissions (rp_role_id, rp_module, rp_consult, rp_add, rp_modify, rp_delete) VALUES
    (3, 'Absences et Sanctions', '1', '1', '1', '0'),
    (3, 'Pointage et Temps', '1', '1', '1', '1'),
    (3, 'Gestion Employés', '1', '0', '0', '0'),
    (3, 'Contrats et Avenants', '1', '0', '0', '0'),
    (3, 'Paie et Rémunération', '1', '0', '0', '0');

    -- Manager: Consultation only, some add
    INSERT INTO role_permissions (rp_role_id, rp_module, rp_consult, rp_add, rp_modify, rp_delete) VALUES
    (4, 'Absences et Sanctions', '1', '1', '0', '0'),
    (4, 'Pointage et Temps', '1', '0', '0', '0'),
    (4, 'Gestion Employés', '1', '1', '0', '0'),
    (4, 'Contrats et Avenants', '1', '0', '0', '0'),
    (4, 'Paie et Rémunération', '1', '0', '0', '0');

    -- Utilisateur Standard: consultation only
    INSERT INTO role_permissions (rp_role_id, rp_module, rp_consult, rp_add, rp_modify, rp_delete) VALUES
    (5, 'Absences et Sanctions', '1', '0', '0', '0'),
    (5, 'Pointage et Temps', '1', '0', '0', '0'),
    (5, 'Gestion Employés', '1', '0', '0', '0'),
    (5, 'Contrats et Avenants', '0', '0', '0', '0'),
    (5, 'Paie et Rémunération', '0', '0', '0', '0');
END

-- 4. Create role_pointdroit table (role-based pointeuse access)
IF NOT EXISTS (SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'role_pointdroit')
BEGIN
    CREATE TABLE role_pointdroit (
        rpd_id INT IDENTITY(1,1) PRIMARY KEY,
        rpd_role_id INT NOT NULL,
        rpd_poicod VARCHAR(10) NOT NULL,
        rpd_soccod VARCHAR(10) NOT NULL,
        rpd_lire VARCHAR(1) NULL DEFAULT '0',
        rpd_purger VARCHAR(1) NULL DEFAULT '0',
        rpd_config VARCHAR(1) NULL DEFAULT '0',
        FOREIGN KEY (rpd_role_id) REFERENCES roles(role_id) ON DELETE CASCADE
    );

    CREATE INDEX IX_role_pointdroit_role_soccod ON role_pointdroit(rpd_role_id, rpd_soccod);
END
