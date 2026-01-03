# TradeZZZ Development Workflow

## Full-Stack Per Feature Approach

Every feature includes **backend + frontend + tests** in a single commit. No more "catch-up" frontend work.

---

## The Workflow

### 1. Plan the Feature

Before coding, identify:

```
Feature: [Name]

Backend:
- [ ] API endpoint(s) needed
- [ ] Service methods
- [ ] Test cases

Frontend:
- [ ] Hook in useApi.ts
- [ ] UI component(s)
- [ ] User interaction flow
```

### 2. Backend First (TDD)

```bash
# Create test file
touch src/[feature]/[Feature].test.ts

# Write failing tests
npm test -- --watch src/[feature]/[Feature].test.ts

# Implement until tests pass
# Keep tests running during development
```

**Test Pattern:**
```typescript
describe('[Feature]', () => {
  it('should_[expected_behavior]_when_[condition]', async () => {
    // Arrange
    // Act
    // Assert
  });
});
```

### 3. Frontend Second

**Step 3a: Add a client-side API hook**

```typescript
// Example: client-side API hook in the frontend app

export function use[Feature]() {
  const api = useApi();
  const [data, setData] = useState<[Type] | null>(null);

  const fetch[Feature] = useCallback(async () => {
    const result = await api.get<[Type]>('/api/[feature]');
    if (result.success && result.data) {
      setData(result.data);
    }
    return result;
  }, [api]);

  const create[Item] = useCallback(async (input: [InputType]) => {
    const result = await api.post<[Type]>('/api/[feature]', input);
    if (result.success) {
      await fetch[Feature]();
    }
    return result;
  }, [api, fetch[Feature]]);

  return {
    data,
    loading: api.loading,
    error: api.error,
    fetch[Feature],
    create[Item],
  };
}
```

**Step 3b: Create/Update UI Component (Next.js client component)**

```typescript
// Example: feature tab component

import { use[Feature] } from '../../hooks/useApi';

export function [Feature]Tab() {
  const { data, loading, fetch[Feature], create[Item] } = use[Feature]();

  useEffect(() => {
    fetch[Feature]();
  }, [fetch[Feature]]);

  if (loading) {
    return <Loader />;
  }

  return (
    <div>
      {/* UI implementation */}
    </div>
  );
}
```

**Step 3c: Wire to Dashboard (if new tab)**

```typescript
// Dashboard routing / tabs (frontend app)

import { [Feature]Tab } from './[feature]/[Feature]Tab';

// In the render:
{activeTab === '[feature]' && <[Feature]Tab />}
```

### 4. Integration Test

```bash
# Terminal 1: Start API server
npm run dev:api

# Terminal 2: Start UI server
npm run dev:ui

# Open browser to http://localhost:5173
# Test the feature manually
```

### 5. Verify Build

```bash
# Build UI
npm run build:ui

# Run all tests
npm test
```

### 6. Commit

```bash
git add -A
git commit -m "$(cat <<'EOF'
[Feature]: [Short description]

Backend:
- [What API endpoints added]
- [What services implemented]

Frontend:
- [What hooks added]
- [What UI components created/updated]

Tests: [count] passing

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>
EOF
)"

git push
```

---

## Directory Structure

```
src/
├── api/
│   └── routes/
│       └── [feature].routes.ts    # API endpoints
│
├── [feature]/
│   ├── [Feature]Service.ts        # Business logic
│   └── [Feature].test.ts          # Tests
│
└── ui/
    ├── hooks/
    │   └── useApi.ts              # Add hook here
    │
    └── components/
        └── [feature]/
            └── [Feature]Tab.tsx   # UI component
```

---

## Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Route file | `[feature].routes.ts` | `exchanges.routes.ts` |
| Service | `[Feature]Service.ts` | `ExchangeService.ts` |
| Test file | `[Feature].test.ts` | `Exchange.test.ts` |
| Hook | `use[Feature]()` | `useExchanges()` |
| Component | `[Feature]Tab.tsx` | `ExchangesTab.tsx` |

---

## API Hook Template

Every domain gets a hook in `useApi.ts`:

```typescript
export interface [Item] {
  id: string;
  // ... fields
}

export function use[Feature]() {
  const api = useApi();
  const [[items], set[Items]] = useState<[Item][]>([]);

  // Fetch all
  const fetch[Items] = useCallback(async () => {
    const result = await api.get<[Item][]>('/api/[feature]');
    if (result.success && result.data) {
      set[Items](result.data);
    }
    return result;
  }, [api]);

  // Create
  const add[Item] = useCallback(async (data: Omit<[Item], 'id'>) => {
    const result = await api.post<[Item]>('/api/[feature]', data);
    if (result.success) {
      await fetch[Items]();
    }
    return result;
  }, [api, fetch[Items]]);

  // Update
  const update[Item] = useCallback(async (id: string, data: Partial<[Item]>) => {
    const result = await api.put<[Item]>(`/api/[feature]/${id}`, data);
    if (result.success) {
      await fetch[Items]();
    }
    return result;
  }, [api, fetch[Items]]);

  // Delete
  const delete[Item] = useCallback(async (id: string) => {
    const result = await api.del(`/api/[feature]/${id}`);
    if (result.success) {
      await fetch[Items]();
    }
    return result;
  }, [api, fetch[Items]]);

  return {
    [items],
    loading: api.loading,
    error: api.error,
    fetch[Items],
    add[Item],
    update[Item],
    delete[Item],
  };
}
```

---

## Route Template (Clerk-Compatible)

```typescript
// src/api/routes/[feature].routes.ts

import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// In-memory storage (replace with DB in production)
const items = new Map<string, Item>();

// List all
router.get('/', authMiddleware, (req: Request, res: Response) => {
  const userId = req.user!.id;
  const userItems = Array.from(items.values())
    .filter(item => item.userId === userId);

  res.json({ success: true, data: userItems });
});

// Get one
router.get('/:id', authMiddleware, (req: Request, res: Response) => {
  const userId = req.user!.id;
  const item = items.get(req.params.id);

  if (!item || item.userId !== userId) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }

  res.json({ success: true, data: item });
});

// Create
router.post('/', authMiddleware, (req: Request, res: Response) => {
  const userId = req.user!.id;
  const item = {
    id: `item_${Date.now()}`,
    userId,
    ...req.body,
    createdAt: new Date()
  };

  items.set(item.id, item);
  res.status(201).json({ success: true, data: item });
});

// Update
router.put('/:id', authMiddleware, (req: Request, res: Response) => {
  const userId = req.user!.id;
  const item = items.get(req.params.id);

  if (!item || item.userId !== userId) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }

  const updated = { ...item, ...req.body, updatedAt: new Date() };
  items.set(item.id, updated);
  res.json({ success: true, data: updated });
});

// Delete
router.delete('/:id', authMiddleware, (req: Request, res: Response) => {
  const userId = req.user!.id;
  const item = items.get(req.params.id);

  if (!item || item.userId !== userId) {
    return res.status(404).json({ success: false, error: 'Not found' });
  }

  items.delete(req.params.id);
  res.json({ success: true, message: 'Deleted' });
});

export default router;
```

---

## Checklist Before Commit

- [ ] Tests written and passing
- [ ] API endpoint implemented
- [ ] Hook added to useApi.ts
- [ ] UI component created/updated
- [ ] Manually tested in browser
- [ ] `npm run build:ui` succeeds
- [ ] `npm test` passes

---

## Common Patterns

### Modal Form

```typescript
function Add[Item]Modal({ onAdd, onClose }) {
  const [form, setForm] = useState({ /* fields */ });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const result = await onAdd(form);
    setSubmitting(false);
    if (result.success) {
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <form onSubmit={handleSubmit}>
        {/* Form fields */}
        <button type="submit" disabled={submitting}>
          {submitting ? <Loader /> : 'Save'}
        </button>
      </form>
    </div>
  );
}
```

### Card with Actions

```typescript
function [Item]Card({ item, onTest, onDelete }) {
  return (
    <div className="bg-[#12121a]/80 border border-indigo-900/30 rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <span className="font-semibold">{item.name}</span>
        <span className={`px-2 py-1 rounded text-xs ${
          item.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
        }`}>
          {item.status}
        </span>
      </div>
      <div className="flex gap-2">
        <button onClick={onTest}>Test</button>
        <button onClick={onDelete}>Delete</button>
      </div>
    </div>
  );
}
```

---

## Troubleshooting

### CORS Issues
Ensure `server.new.ts` has:
```typescript
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
```

### Auth Token Not Sent
Check hook uses `getToken()`:
```typescript
const { getToken } = useAuth();
const token = await getToken();
```

### API Returns 401
Check route has `authMiddleware`:
```typescript
router.get('/', authMiddleware, (req, res) => { ... });
```

### Component Not Rendering
Check import in Dashboard.tsx and tab routing:
```typescript
{activeTab === '[feature]' && <[Feature]Tab />}
```

---

**Remember**: Every commit should deliver a complete, testable feature.
