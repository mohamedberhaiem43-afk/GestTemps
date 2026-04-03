# API Refactoring Migration Guide

## Status
✅ Already Updated:
- `useGetDemConges.ts`
- `useGetDemCongesByPeriode.tsx`
- `useGetSolde.ts`
- `useGetPointagesInvalides.ts`
- `Pays.tsx`

⏳ Remaining: ~48 files

---

## Migration Patterns

### Pattern 1: Simple GET Hooks

**Before**:
```typescript
import axios from "axios";
import { useQuery } from "react-query";

const useGetData = () => {
    const token = localStorage.getItem('authToken');
    const headers = { Authorization: `Bearer ${token}` };

    return useQuery({
        queryKey: ["data"],
        queryFn: async () => {
            const response = await axios.get(
                `${import.meta.env.VITE_REACT_APP_API_URL}/Data`,
                { headers }
            );
            return response.data;
        }
    })
}
```

**After**:
```typescript
import { useQuery } from "react-query";
import apiInstance from "../../components/API/apiInstance";

const useGetData = () => {
    return useQuery({
        queryKey: ["data"],
        queryFn: async () => {
            const response = await apiInstance.get('/Data');
            return response.data;
        }
    })
}
```

**Changes**:
- Remove: `import axios from "axios"`
- Remove: `const token = localStorage.getItem('authToken')`
- Remove: `const headers = {...}`
- Add: `import apiInstance from "../../components/API/apiInstance"`
- Replace: `axios.get(env_url + endpoint, { headers })`
- With: `apiInstance.get(endpoint)` (NO baseURL needed)

---

### Pattern 2: POST with Request Body

**Before**:
```typescript
import axios from "axios";

const token = localStorage.getItem('authToken');
const headers = { Authorization: `Bearer ${token}` };

await axios.post(
    `${import.meta.env.VITE_REACT_APP_API_URL}/Dashboard/calculate`,
    requestData,
    { headers }
);
```

**After**:
```typescript
import apiInstance from "../../components/API/apiInstance";

await apiInstance.post('/Dashboard/calculate', requestData);
```

---

### Pattern 3: PUT Requests

**Before**:
```typescript
import axios from "axios";

const token = localStorage.getItem('authToken');
const headers = { Authorization: `Bearer ${token}` };

await axios.put(
    `${import.meta.env.VITE_REACT_APP_API_URL}/Pays`,
    payload,
    { headers }
);
```

**After**:
```typescript
import apiInstance from "../../components/API/apiInstance";

await apiInstance.put('/Pays', payload);
```

---

### Pattern 4: DELETE Requests

**Before**:
```typescript
import axios from "axios";

const token = localStorage.getItem('authToken');
const headers = { Authorization: `Bearer ${token}` };

await axios.delete(
    `${import.meta.env.VITE_REACT_APP_API_URL}/Pays/${id}`,
    { headers }
);
```

**After**:
```typescript
import apiInstance from "../../components/API/apiInstance";

await apiInstance.delete(`/Pays/${id}`);
```

---

### Pattern 5: Remove Hardcoded URLs

**Before**:
```typescript
await axios.post('https://localhost:7189/api/Data', payload, { headers });
```

**After**:
```typescript
await apiInstance.post('/Data', payload);
```

---

## Files to Update by Category

### 🔴 Critical (Do First)
1. `components/Login/Login.tsx` - Login fetch for Societes/Sites
2. `components/navigation/Navigation.tsx` - Any remaining axios calls

### 🟠 High Priority (Hooks)
3. `hooks/congeHooks/useGetTitreConge.ts`
4. `hooks/congeHooks/useAddBulkConges.ts`
5. `hooks/congeHooks/useAddConge.ts`
6. `hooks/congeHooks/useDeleteTitreConge.ts`
7. `hooks/congeHooks/useAcceptDemConge.ts`
8. `hooks/congeHooks/useUpdateConge.ts`
9. `hooks/congeHooks/useGetTitreCongeById.ts`
10. `hooks/absenceHooks/useGetAllAbsence.ts`
11. `hooks/absenceHooks/useGetAbsenceLibs.ts`
12. `hooks/absenceHooks/useAddAbsence.ts`
13. `hooks/absenceHooks/useUpdateAbsence.ts`
14. `hooks/soldeCongeHooks/useAddSolde.ts`
15. `hooks/soldeCongeHooks/useUpdateSolde.ts`
16. `hooks/soldeCongeHooks/useDeleteSolde.ts`
17. `hooks/employeHooks/useGetEmployee.ts`
18. `hooks/userHooks/useAddUser.ts`
19. `hooks/contratHooks/useGetContrats.ts`
20. `hooks/contratHooks/useRenouvellementContrat.ts`

### 🟡 Medium Priority (Filters & Reports)
21. `components/PreparationPaie/PointageDuMois/PointageDuMois.tsx`
22. `components/PreparationPaie/PointageDuMois/FilterPointageMois.tsx`
23. `components/Pointeuse/SaisiePointeuse.tsx`
24. `components/Pointeuse/EtatPeriodique/FilterPeriode.tsx`
25. `components/Pointeuse/EtatPeriodique/FilterEtatPeriodique.tsx`
26. `components/Pointeuse/EtatPeriodique/EmpPeriodique.tsx`
27. `components/Etats/EtatPresence/FilterPresence.tsx`
28. `components/Etats/EtatRetard/FilterRetard.tsx`
29. `components/Etats/CahierConge/FilterCahierConge.tsx`
30. `components/Etats/EchanceContrat/EcheanceContrat.tsx`

### 🟡 Medium Priority (Data Management)
31. `components/DonneeDeBase/Service/Service.tsx`
32. `components/DonneeDeBase/Direction/Direction.tsx`
33. `components/DonneeDeBase/Fonction/FonctionList.tsx`
34. `components/DonneeDeBase/Ville/Ville.tsx`
35. `components/DonneeDeBase/Section/Section.tsx`

### 🟢 Lower Priority (Utility Hooks)
36+. All remaining hooks in: `paysHooks/`, `siteHooks/`, `societeHooks/`, `serviceHooks/`, `fonctionHooks/`, `lcategoriesHooks/`, `posteHooks/`, etc.

---

## Quick Search & Replace

### VS Code: Find & Replace Across Project

**Search Pattern 1: Remove localStorage tokens**
```
const token = localStorage.getItem\('authToken'\);[\s\S]*?const headers = \{ Authorization: `Bearer \$\{token\}` \};
```
Replace with: (nothing - delete these lines)

**Search Pattern 2: Replace axios imports**
```
import axios from ['"]axios['"];
```
Replace with:
```
import apiInstance from '../../components/API/apiInstance';
```

**Search Pattern 3: Replace hardcoded URL + axios.get**
```
axios\.get\(\`\$\{import\.meta\.env\.VITE_REACT_APP_API_URL\}\/([^`]+)\`[^)]*\)
```
Replace with:
```
apiInstance.get('/$1')
```

---

## Testing After Updates

After updating each file, test:

1. ✅ Component/hook loads without errors
2. ✅ API call succeeds (check Network tab)
3. ✅ Token refresh happens automatically on 401
4. ✅ No more localStorage.[getItem/setItem] for 'authToken'

---

## Verification Checklist

Run this grep command to find remaining issues:

```bash
# Find remaining direct axios imports
grep -r "import axios" abrpoint.client/src --include="*.tsx" --include="*.ts" | grep -v node_modules

# Find remaining localStorage authToken
grep -r "localStorage.getItem.*authToken" abrpoint.client/src --include="*.tsx" --include="*.ts"

# Find remaining hardcoded localhost URLs
grep -r "https://localhost:7189" abrpoint.client/src --include="*.tsx" --include="*.ts"
```

All should return empty when migration is complete.
