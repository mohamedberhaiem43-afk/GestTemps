# ABRPOINT Secure Token Implementation - CRITICAL NEXT STEPS

## 🚨 IMMEDIATE ACTION REQUIRED

### 1. Create RefreshToken Database Table
**Choose ONE method:**

**Option A: Entity Framework (Recommended)**
```powershell
cd ABRPOINT.Server
dotnet ef migrations add AddRefreshTokenTable
dotnet ef database update
```

**Option B: Direct SQL**
Execute this SQL script on your database:
```sql
CREATE TABLE [refresh_tokens] (
    [id] int NOT NULL IDENTITY,
    [uticod] nvarchar(20) NOT NULL,
    [token] nvarchar(500) NOT NULL,
    [expires_at] datetime2 NOT NULL,
    [created_at] datetime2 NOT NULL DEFAULT (getutcdate()),
    [revoked] bit NOT NULL DEFAULT 0,
    CONSTRAINT [PK_refresh_tokens] PRIMARY KEY ([id]),
    CONSTRAINT [FK_refresh_tokens_Utilisateur_uticod] FOREIGN KEY ([uticod])
        REFERENCES [Utilisateur] ([Uticod])
);

CREATE INDEX [IX_RefreshToken_UserToken] ON [refresh_tokens] ([uticod], [token], [revoked]);
```

---

## ✅ What's Been Done

### Server-Side (C#)
- ✅ Program.cs: Enabled token lifetime validation
- ✅ RefreshToken.cs: Model created
- ✅ UtilisateursController.cs: Updated endpoints
  - POST /Utilisateurs/connect → Sets httpOnly cookies
  - POST /Utilisateurs/refresh → Reads tokens from cookies
  - POST /Utilisateurs/logout → Revokes tokens

### Client-Side (React/TypeScript)
- ✅ apiInstance.ts: Token refresh interceptor added
- ✅ apiClient.ts: Token refresh interceptor added
- ✅ Login.tsx: Updated to use cookies
- ✅ Navigation.tsx: Logout calls server endpoint

### Hooks & Components - Partially Updated
- ✅ useGetDemConges.ts
- ✅ useGetDemCongesByPeriode.tsx
- ✅ useGetSolde.ts
- ✅ useGetPointagesInvalides.ts
- ✅ Pays.tsx

⏳ Still need updating: ~48 files (see API_REFACTORING_GUIDE.md)

---

## 📋 Next Steps (In Order)

### Step 1: Create Database Table ⚠️ CRITICAL
```
Time: 5 minutes
Run the SQL script above or use EF migrations
Without this, refresh endpoint will return 401
```

### Step 2: Update Remaining Hooks (High Priority)
```
Time: 30-45 minutes
Use patterns from API_REFACTORING_GUIDE.md
Focus on: congeHooks, soldeCongeHooks, absenceHooks, employeHooks
```

### Step 3: Update Components (Medium Priority)
```
Time: 30-45 minutes
Update: DonneeDeBase components, Filter components, Report components
```

### Step 4: Remove All localStorage Token References
```
Time: 15 minutes
Verify no more localStorage.getItem('authToken') exists
Use grep command in API_REFACTORING_GUIDE.md
```

### Step 5: Testing
```
Time: 20 minutes
1. Login - Should receive  cookies
2. Make API call - Should auto-refresh on 401
3. Token expiry - After 30 min, should refresh automatically
4. Logout - Should revoke tokens
```

---

## 📊 Remaining Work Summary

| Category | Count | Status | Effort |
|----------|-------|--------|--------|
| Remaining axios hooks | 30+ | ⏳ Pending | 30-45 min |
| Remaining components | 15+ | ⏳ Pending | 30-45 min |
| localStorage cleanup | 48 files | ⏳ Pending | 5 min |
| Total refactoring | 48 files | ⏳ Pending | 1-1.5 hours |

---

## 🎯 Success Criteria

After completing all steps:
```
✅ No 401 errors on login
✅ API calls succeed with httpOnly cookies
✅ Token automatically refreshes on 401
✅ All API calls use apiInstance or apiClient
✅ No localStorage.getItem('authToken') remaining
✅ Tokens inaccessible to JavaScript (XSS safe)
✅ Logout revokes all tokens on server
```

---

## 📚 Reference Files

- **Implementation Details**: `SECURE_TOKEN_IMPLEMENTATION.md`
- **Migration Guide**: `API_REFACTORING_GUIDE.md`
- **Useful Helper**: `hooks/useApi.ts` (Created as centralized API hook)

---

## ⚠️ Common Issues

### Issue: 401 on Refresh Endpoint
**Cause**: refresh_tokens table doesn't exist
**Solution**: Create the table using SQL script above

### Issue: Cookies Not Sent
**Ensure**: All axios calls use `apiInstance` with `withCredentials: true`
**Check**: Network tab → request headers should have Cookie

### Issue: Still Getting 401 After Login
**Check**: login endpoint returns user data with cookies set
**Debug**: Open DevTools → Application tab → Cookies
**Verify**: accessToken & refreshToken cookies are present

---

## Commands to Verify Progress

```bash
# Check remaining axios imports
grep -r "import axios" abrpoint.client/src --include="*.tsx" --include="*.ts" | wc -l
# Should be: 0 (or only in API setup files)

# Check remaining localStorage authToken
grep -r "localStorage.getItem.*authToken" abrpoint.client/src --include="*.tsx" --include="*.ts" | wc -l
# Should be: 0

# Check remaining hardcoded URLs
grep -r "https://localhost:7189" abrpoint.client/src --include="*.tsx" --include="*.ts" | wc -l
# Should be: 0
```

---

## Questions & Troubleshooting

1. **"After login, why do I still get 401?"**
   - Create the refresh_tokens table first
   - Check cookies were set (DevTools → Application)
   - Verify refresh endpoint can read refreshToken cookie

2. **"How do I know token refresh is working?"**
   - Make an API call 30+ minutes after login
   - Watch Network tab - should see POST to /Utilisateurs/refresh
   - Then the original request retries automatically

3. **"Can I test token refresh without waiting 30 min?"**
   - Set token expiry to 1 minute in GenerateJwtToken()
   - Make an API call after token expires
   - Watch Network tab for automatic refresh

4. **"Why is a component still not working after updating?"**
   - Verify import path is correct: `../../components/API/apiInstance`
   - Check that old axios import is removed
   - Clear browser cache (Ctrl+Shift+Delete)
   - Rebuild the app

---

## Files Created for You

1. `C:\Users\Dell\.claude\projects\d--ABRPOINT-newfeatures\memory\SECURE_TOKEN_IMPLEMENTATION.md` - Technical implementation details
2. `d:\ABRPOINT-newfeatures\API_REFACTORING_GUIDE.md` - Comprehensive migration patterns and file list
3. `d:\ABRPOINT-newfeatures\abrpoint.client\src\hooks\useApi.ts` - Helper hook (optional, for future use)

---

## Priority Order for Remaining Updates

1. **🔴 CRITICAL**: Create refresh_tokens table (blocks everything)
2. **🟠 HIGH**: Update Login.tsx Societes/Sites fetch
3. **🟠 HIGH**: Update core congeHooks (causing dashboard errors)
4. **🟡 MEDIUM**: Update remaining hooks (30+ files)
5. **🟢 LOW**: Update utility components

Once table is created and critical files updated, everything should work!
