-- Create refresh_tokens table for secure token implementation
-- Run this SQL script on your ABRPOINT database

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='refresh_tokens' AND xtype='U')
BEGIN
    CREATE TABLE refresh_tokens (
        id INT PRIMARY KEY IDENTITY(1,1),
        uticod NVARCHAR(20) NOT NULL,
        token NVARCHAR(500) NOT NULL UNIQUE,
        expires_at DATETIME NOT NULL,
        created_at DATETIME NOT NULL DEFAULT GETUTCDATE(),
        revoked BIT NOT NULL DEFAULT 0,
        CONSTRAINT FK_RefreshToken_User FOREIGN KEY (uticod) REFERENCES Utilisateur(Uticod) ON DELETE CASCADE
    );

    -- Create indexes for efficient queries
    CREATE INDEX IX_RefreshToken_UserToken ON refresh_tokens(uticod, token, revoked);
    CREATE INDEX IX_RefreshToken_ExpiresAt ON refresh_tokens(expires_at);
    CREATE INDEX IX_RefreshToken_Revoked ON refresh_tokens(revoked);

    PRINT 'refresh_tokens table created successfully'
END
ELSE
BEGIN
    PRINT 'refresh_tokens table already exists'
END
