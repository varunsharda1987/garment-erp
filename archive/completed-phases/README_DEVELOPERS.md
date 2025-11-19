# Garment ERP - Developer Guide

**Welcome to the Garment ERP System!** 👋

This guide will help you get started with development on this production-grade ERP system.

---

## 🚀 Quick Start

### 1. Setup

```bash
# Install dependencies
cd frontend && npm install
cd ../backend && npm install

# Start development servers
cd frontend && npm run dev  # Frontend: http://localhost:5173
cd backend && npm run dev   # Backend: http://localhost:5000
```

### 2. Read These Documents (MANDATORY)

**Start Here:**
1. **[CODING_STANDARDS.md](./CODING_STANDARDS.md)** ⭐ **MOST IMPORTANT**
   - THE single source of truth for all development
   - Mandatory patterns and components
   - Code review checklist
   - **Read this before writing any code!**

2. **[PRODUCTION_GRADE_COMPONENTS.md](./PRODUCTION_GRADE_COMPONENTS.md)**
   - Complete guide to all common components
   - Usage examples
   - Best practices

3. **[SYSTEM_WIDE_STANDARDS_COMPLETE.md](./SYSTEM_WIDE_STANDARDS_COMPLETE.md)**
   - System-wide implementation summary
   - Component list
   - Migration guide

### 3. Review Example Implementations

**Before creating anything new, check these:**
- `frontend/src/pages/CustomerList.tsx` - List page with all patterns
- `frontend/src/pages/CustomerList.refactored.example.tsx` - Refactored version using DataTable
- `frontend/src/pages/CustomerForm.tsx` - Form page with shared validators

---

## 📁 Project Structure

```
garment-erp/
├── frontend/                    # React + TypeScript frontend
│   ├── src/
│   │   ├── components/         # Reusable components ⭐
│   │   │   ├── ui/            # Base UI (shadcn/ui)
│   │   │   ├── form/          # Form fields (EmailField, PhoneField, etc.)
│   │   │   ├── DataTable.tsx  # Reusable data table
│   │   │   ├── Pagination.tsx # Pagination component
│   │   │   └── ...            # Other common components
│   │   ├── pages/             # Page components
│   │   ├── services/          # API service layers
│   │   ├── stores/            # Zustand state management
│   │   ├── types/             # TypeScript types
│   │   └── lib/               # Utilities ⭐
│   │       ├── validators.ts          # Shared validators
│   │       └── api-error-handler.ts   # Error handling
│   └── package.json
│
├── backend/                     # Node.js + Express backend
│   ├── src/
│   │   ├── controllers/       # Request handlers
│   │   ├── routes/            # Route definitions
│   │   ├── services/          # Business logic
│   │   ├── middleware/        # Express middleware
│   │   └── utils/             # Utilities
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   └── package.json
│
└── Documentation/ ⭐
    ├── CODING_STANDARDS.md                      # Read this first!
    ├── PRODUCTION_GRADE_COMPONENTS.md           # Component guide
    ├── SYSTEM_WIDE_STANDARDS_COMPLETE.md        # Implementation summary
    └── README_DEVELOPERS.md                     # This file
```

---

## 🎯 Creating a New Page

### List Page (e.g., Products List)

```tsx
import DataTable from '@/components/DataTable';
import SearchInput from '@/components/SearchInput';
import { handleApiError } from '@/lib/api-error-handler';
import { productService } from '@/services/product.service';

export default function ProductList() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  // Define columns
  const columns = [
    { key: 'code', header: 'Code' },
    { key: 'name', header: 'Name' },
    {
      key: 'actions',
      header: 'Actions',
      render: (product) => (
        <Button onClick={() => navigate(`/products/${product.id}/edit`)}>
          Edit
        </Button>
      ),
    },
  ];

  // Fetch data
  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await productService.getAll({ search: searchQuery });
      setData(response.data);
    } catch (error) {
      handleApiError(error, 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <SearchInput value={searchQuery} onChange={setSearchQuery} />

      <DataTable
        data={data}
        columns={columns}
        keyExtractor={(item) => item.id}
        loading={loading}
        emptyState={{
          title: 'No products found',
          actionLabel: 'Create Product',
          onAction: () => navigate('/products/new'),
        }}
      />
    </div>
  );
}
```

**That's it!** DataTable handles:
- ✅ Loading states (skeleton)
- ✅ Empty states (with icon and action)
- ✅ Error states
- ✅ Pagination (if provided)
- ✅ Table rendering
- ✅ Responsive design

### Form Page (e.g., Product Form)

```tsx
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { validators } from '@/lib/validators';
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';
import { EmailField, PhoneField } from '@/components/form';

// 1. Define schema with shared validators
const schema = z.object({
  name: validators.required('Product name'),
  email: validators.emailRequired,
  phone: validators.phone,
});

type FormData = z.infer<typeof schema>;

export default function ProductForm() {
  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: FormData) => {
    try {
      await productService.create(data);
      handleApiSuccess('Product created', `${data.name} has been created.`);
      navigate('/products');
    } catch (error) {
      handleApiError(error, 'Failed to create product');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <EmailField
        value={email}
        onChange={setEmail}
        error={errors.email?.message}
        required
      />

      <PhoneField
        value={phone}
        onChange={setPhone}
        error={errors.phone?.message}
      />

      <Button type="submit">Create</Button>
    </form>
  );
}
```

**Benefits:**
- ✅ Shared validators (no duplicate regex)
- ✅ Consistent error handling
- ✅ Toast notifications
- ✅ Type safety

---

## 🎨 Common Components Reference

### Must-Use Components

```tsx
// Notifications (NEVER use alert())
import { toast } from 'sonner';
toast.success('Success!');
toast.error('Error!');

// Confirmation (NEVER use window.confirm())
import ConfirmDialog from '@/components/ConfirmDialog';
<ConfirmDialog
  open={open}
  onOpenChange={setOpen}
  title="Delete?"
  description="Are you sure?"
  onConfirm={handleDelete}
  variant="destructive"
/>

// Search (NEVER use basic Input)
import SearchInput from '@/components/SearchInput';
<SearchInput value={query} onChange={setQuery} />

// Empty State (NEVER leave blank pages)
import EmptyState from '@/components/EmptyState';
<EmptyState title="No data" actionLabel="Create" onAction={handleCreate} />

// Loading (NEVER show blank screens)
import { LoadingSpinner, TableSkeleton } from '@/components/LoadingSpinner';
{loading && <TableSkeleton />}

// Status Badges (NEVER write custom badges)
import { StatusBadge } from '@/components/StatusBadge';
<StatusBadge status={item.status} />

// Data Tables (NEVER write custom tables)
import DataTable from '@/components/DataTable';
<DataTable data={data} columns={columns} />

// Pagination (NEVER write custom pagination)
import Pagination from '@/components/Pagination';
<Pagination currentPage={page} totalPages={totalPages} />
```

---

## 🔧 Utilities Reference

### Shared Validators

```tsx
import { validators } from '@/lib/validators';

// Available validators:
validators.emailRequired      // Required email
validators.email              // Optional email
validators.phoneRequired      // Required phone (10 digits)
validators.phone              // Optional phone
validators.gstRequired        // Required GST (15 chars)
validators.gst                // Optional GST
validators.date               // Required date
validators.positiveNumber     // Must be > 0
validators.percentage         // 0-100
validators.pincode            // 6 digit pincode
validators.ifsc               // IFSC code
validators.bankAccount        // Bank account number
```

### Error Handler

```tsx
import { handleApiError, handleApiSuccess } from '@/lib/api-error-handler';

try {
  await service.create(data);
  handleApiSuccess('Created', 'Item has been created.');
} catch (error) {
  handleApiError(error, 'Failed to create item');
  // Automatically shows toast with user-friendly message
}
```

---

## ✅ Pre-Commit Checklist

Before committing code:

- [ ] Read CODING_STANDARDS.md
- [ ] No TypeScript errors (`npx tsc --noEmit`)
- [ ] Used common components (no reinventing)
- [ ] Used shared validators (no custom regex)
- [ ] Used handleApiError (no manual try-catch)
- [ ] Used toast (no alert())
- [ ] Used ConfirmDialog (no window.confirm())
- [ ] Added loading states
- [ ] Added empty states
- [ ] Proper TypeScript types
- [ ] No console.logs (except errors)
- [ ] Tested in browser

---

## 🎓 Learning Resources

### Internal Documentation
1. **CODING_STANDARDS.md** - Complete development guide
2. **PRODUCTION_GRADE_COMPONENTS.md** - Component documentation
3. **Example Pages:**
   - CustomerList.tsx
   - CustomerList.refactored.example.tsx
   - CustomerForm.tsx

### External Resources
- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Tailwind CSS](https://tailwindcss.com/docs)
- [shadcn/ui](https://ui.shadcn.com)
- [React Hook Form](https://react-hook-form.com)
- [Zod](https://zod.dev)

---

## 🐛 Common Issues

### TypeScript Error: Can't find module

```bash
# Make sure you're using the @ alias
import SearchInput from '@/components/SearchInput';  # ✅ Correct
import SearchInput from '../components/SearchInput'; # ❌ Wrong
```

### Component not found

```bash
# Check if you imported from the right path
import { EmailField } from '@/components/form';  # ✅ Correct
import EmailField from '@/components/EmailField'; # ❌ Wrong (no index export)
```

### Validation not working

```tsx
// Make sure you're using the resolver
const { register, handleSubmit } = useForm<FormData>({
  resolver: zodResolver(schema),  // ⭐ Don't forget this!
});
```

---

## 🤝 Contributing

### Workflow

1. **Create feature branch** from `main`
2. **Write code** following CODING_STANDARDS.md
3. **Test thoroughly**
4. **Run checklist**
5. **Submit PR**
6. **Address review comments**
7. **Merge when approved**

### PR Template

```markdown
## What does this PR do?
Brief description

## Checklist
- [ ] Follows CODING_STANDARDS.md
- [ ] Used common components
- [ ] Added tests
- [ ] No TypeScript errors
- [ ] Tested in browser

## Screenshots
(if UI changes)
```

---

## 📞 Getting Help

### Questions About:

**Code Standards?**
→ Check CODING_STANDARDS.md

**Component Usage?**
→ Check PRODUCTION_GRADE_COMPONENTS.md

**Example Implementation?**
→ Check CustomerList.refactored.example.tsx

**Still Stuck?**
→ Ask in team chat

---

## 🎉 Welcome!

You're now ready to build production-grade features for the Garment ERP system!

Remember:
- ✅ Follow CODING_STANDARDS.md
- ✅ Use common components
- ✅ Don't reinvent the wheel
- ✅ Keep it consistent
- ✅ Write maintainable code

Happy coding! 🚀

---

**Last Updated:** January 19, 2025
