# Setting Up the Secure Token System - Database Migration

## Method 1: Using SQL Script (FASTEST - Recommended)

### Step 1: Run SQL Script
1. Open SQL Server Management Studio (SSMS)
2. Connect to your ABRPOINT database
3. Open the script: `CREATE_REFRESH_TOKENS_TABLE.sql`
4. Execute it (F5)
5. You should see: "refresh_tokens table created successfully"

**The script creates:**
- `refresh_tokens` table with proper schema
- Foreign key constraint to `Utilisateur` table
- Indexes for performance on critical columns

---

## Method 2: Using Entity Framework Core Migrations (Alternative)

If you prefer using EF Core migrations:

### Step 1: Create Migration
```bash
cd ABRPOINT.Server
dotnet ef migrations add AddRefreshTokenTable
```

### Step 2: Apply Migration
```bash
dotnet ef database update
```

### Step 3: Verify
The migration creates the same table structure as the SQL script.

---

## Method 3: Manual T-SQL (If script doesn't work)

If the provided script has issues, run this minimal version:

```sql
CREATE TABLE refresh_tokens (
    id INT PRIMARY KEY IDENTITY(1,1),
    uticod NVARCHAR(20) NOT NULL,
    token NVARCHAR(500) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at DATETIME NOT NULL DEFAULT GETUTCDATE(),
    revoked BIT NOT NULL DEFAULT 0,
    CONSTRAINT FK_RT_User FOREIGN KEY (uticod) REFERENCES Utilisateur(Uticod)
);

CREATE INDEX IX_RT_UserToken ON refresh_tokens(uticod, token, revoked);
CREATE INDEX IX_RT_ExpiresAt ON refresh_tokens(expires_at);
```

---

## Verification Steps

After running any method, verify the table was created:

### In SQL Server:
```sql
-- Check if table exists
SELECT * FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'refresh_tokens'

-- Check table structure
EXEC sp_help 'refresh_tokens'

-- Check indexes
SELECT * FROM sys.indexes WHERE object_id = OBJECT_ID('refresh_tokens')
```

### In your app:
1. **Clear browser cache and cookies**
2. **Restart the .NET server** (IMPORTANT!)
3. **Log in again** - you should see tokens being set in httpOnly cookies
4. Open **DevTools → Application → Cookies** → Should see `accessToken` and `refreshToken`
5. Try accessing protected routes - should work without 401 errors

---

## Expected Results After Setup

✅ **Login Flow:**
- User logs in → Server sets httpOnly cookies
- Browser automatically includes cookies in API requests
- No token visible in localStorage

✅ **API Requests:**
- All requests include cookies automatically
- Refresh interceptor handles 401 → auto-refresh → retry

✅ **Security:**
- JavaScript cannot access tokens (httpOnly protection)
- Tokens expire in 30 minutes (access token)
- Automatic refresh every 30 minutes
- Logout revokes all tokens server-side

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Still getting 401 errors | Restart server, clear browser cache, check if refresh_tokens table exists |
| Tokens not set as cookies | Ensure server is HTTPS (or localhost), check browser cookie settings |
| Token refresh failing | Verify refresh_tokens table has data, check server logs for errors |
| "Table not found" error | Run the SQL script or EF migration |

