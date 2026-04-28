# Web3 Event Platform - Role-Based Layout Architecture

## Overview

This platform implements **strict role-based layout separation** with three distinct layout systems:

1. **Public/User Layout** - Shared header, user adds sidebar
2. **Verifier Layout** - Extends user layout with additional permissions
3. **Admin Layout** - Completely separate layout system

## Layout Components

### 1. Public & User - Shared Layout

**Components:**
- `PublicUserHeader.tsx` - Shared by both Public and User roles
- `UserSidebar.tsx` - Only visible for User and Verifier roles
- `PublicLayout.tsx` - For non-authenticated users
- `UserLayout.tsx` - For authenticated users (includes sidebar)

**Characteristics:**
- Marketing-focused design
- Sticky header with wallet connection
- Clean, modern Web3 branding
- Sidebar navigation for authenticated users

**Public Pages:**
- Home (landing page)
- Explore Events
- Marketplace
- About, FAQ, Terms, Privacy

**User Pages (after wallet connection):**
- Dashboard
- My Events
- My Tickets
- Investments
- Wallet
- Profile & Settings

---

### 2. Verifier - Extends User Layout

**Components:**
- Uses `PublicUserHeader.tsx` (same as User)
- Uses `UserSidebar.tsx` with additional nav items
- Uses `UserLayout.tsx`

**Characteristics:**
- **Extends User permissions** (User + Review capabilities)
- Same header and sidebar as regular users
- Additional navigation items for moderation
- Shares the User layout system

**Additional Pages:**
- Verifier Dashboard
- Pending Events (review queue)
- Reports Management
- Event Review Detail

**Key Principle:** Verifier is NOT a separate layout - it's User + additional features.

---

### 3. Admin - Completely Separate Layout

**Components:**
- `AdminHeader.tsx` - Unique admin header
- `AdminSidebar.tsx` - Unique admin sidebar
- `AdminLayout.tsx` - Separate layout system

**Characteristics:**
- **Completely separate** from Public/User layouts
- Different color scheme (red/orange gradients)
- Data-focused, professional SaaS admin panel
- Different navigation structure
- Search in header
- System status indicators

**Admin Pages:**
- Admin Dashboard (analytics & metrics)
- User Management
- Event Management
- Marketplace Management
- Fraud Monitoring
- Finance Dashboard
- Analytics
- Platform Settings

**Key Principle:** Admin has ZERO shared components with Public/User/Verifier layouts.

---

## Role Hierarchy

```
Public (No Wallet)
  ↓
User (Wallet Connected)
  ↓
Verifier (User + Review Permissions) ← Extends User Layout
  
Admin (Separate Layout) ← Completely Different System
```

## Layout Routing

### Public Routes (`/`)
- Uses `PublicLayout` (no sidebar)
- Public header only
- No authentication required

### User Routes (`/dashboard`, `/events/*`, `/tickets/*`, etc.)
- Uses `UserLayout` (header + sidebar)
- Requires wallet connection
- Sidebar navigation

### Verifier Routes (`/verifier/*`)
- Uses `UserLayout` (same as User)
- Additional sidebar items
- Review-specific pages

### Admin Routes (`/admin/*`)
- Uses `AdminLayout` (completely different)
- Separate header and sidebar
- Admin-only access

## Color Schemes

### Public/User/Verifier
- Primary: Purple to Blue gradients (`from-purple-600 to-blue-600`)
- Background: Deep slate (`bg-slate-950`, `bg-slate-900`)
- Borders: Slate (`border-slate-800`)
- Accents: Electric blue and purple

### Admin
- Primary: Red to Orange gradients (`from-red-600 to-orange-600`)
- Background: Same slate system
- Different visual hierarchy
- More data-dense interface

## Key Files

```
/src/app/
├── layouts/
│   ├── PublicLayout.tsx      # Public pages (no sidebar)
│   ├── UserLayout.tsx         # User + Verifier (with sidebar)
│   └── AdminLayout.tsx        # Admin (separate system)
├── components/shared/
│   ├── PublicUserHeader.tsx   # Shared by Public & User & Verifier
│   ├── UserSidebar.tsx        # For User & Verifier
│   ├── AdminHeader.tsx        # Admin only (separate)
│   └── AdminSidebar.tsx       # Admin only (separate)
├── contexts/
│   └── AuthContext.tsx        # Role management
└── App.tsx                    # Route configuration
```

## Testing Layout Separation

Use the **Role Switcher** (floating button in bottom-right) to switch between roles and observe:

1. **Public → User:** Same header, sidebar appears
2. **User → Verifier:** Same layout, additional sidebar items
3. **Any Role → Admin:** Completely different header, sidebar, and color scheme

Visit `/demo` for detailed layout documentation and role comparison.

## Design Principles

✅ **Correct:**
- Public and User share `PublicUserHeader`
- Verifier extends User's layout (same header, same sidebar structure)
- Admin uses completely separate components

❌ **Incorrect:**
- Verifier having its own layout (it extends User)
- Admin sharing any components with Public/User/Verifier
- Public and User having different headers

---

**Built with strict layout separation to ensure clear role boundaries and maintainable architecture.**
