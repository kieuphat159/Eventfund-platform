# Web3 Event Platform - EventChain

A comprehensive Web3 event ticketing platform with NFT tickets, marketplace, and investment features. Built with **strict role-based layout separation**.

## 🎯 Key Features

- **NFT Ticketing System** - Event tickets as blockchain-based NFTs
- **Ticket Marketplace** - Secure resale of tickets
- **Event Investment** - Invest in events and earn returns
- **Multi-Role Dashboard** - Different interfaces for different user types
- **Strict Layout Separation** - Role-specific UI architecture

## 🔐 Role System

### 1. **Public** (No Wallet Connected)
- Browse events without authentication
- View marketplace listings
- Access public information pages
- **Layout:** Public header only, no sidebar

### 2. **User** (Wallet Connected)
- Same header as Public + sidebar navigation
- Create and manage events
- Buy and sell NFT tickets
- Invest in events
- **Layout:** PublicUserHeader + UserSidebar

### 3. **Verifier** (User + Review Permissions)
- **Extends User role** (same layout as User)
- Same header and sidebar with additional nav items
- Review pending events
- Handle user reports
- Moderate platform content
- **Layout:** Same as User with extra navigation items

### 4. **Admin** (Separate System)
- **Completely separate layout** from Public/User/Verifier
- Unique AdminHeader with different branding
- Unique AdminSidebar with admin-specific navigation
- Platform management and analytics
- User and event administration
- **Layout:** AdminHeader + AdminSidebar (different color scheme)

## 🏗️ Architecture Highlights

### Layout Separation Rules

✅ **Correct Implementation:**
- Public and User share `PublicUserHeader.tsx`
- Verifier extends User layout (same header, same sidebar structure)
- Admin uses completely separate components with no shared code

❌ **Violations Prevented:**
- Verifier having its own layout (it extends User)
- Admin sharing any components with Public/User/Verifier
- Public and User having different headers

### Component Structure

```
/src/app/
├── layouts/
│   ├── PublicLayout.tsx      # For public pages (no sidebar)
│   ├── UserLayout.tsx         # For User & Verifier (with sidebar)
│   └── AdminLayout.tsx        # Separate admin system
│
├── components/shared/
│   ├── PublicUserHeader.tsx   # Shared by Public, User, Verifier
│   ├── UserSidebar.tsx        # For User & Verifier
│   ├── AdminHeader.tsx        # Admin only (separate)
│   └── AdminSidebar.tsx       # Admin only (separate)
│
├── pages/
│   ├── public/                # Public pages
│   ├── user/                  # User dashboard pages
│   ├── verifier/              # Verifier-specific pages
│   └── admin/                 # Admin dashboard pages
```

## 🚀 Getting Started

1. **Role Switcher**: Click the floating button (bottom-right) to switch between roles
2. **Demo Page**: Visit `/demo` for detailed layout documentation
3. **Test Navigation**: Switch roles to observe layout changes

### Available Routes

**Public Routes** (`/`)
- `/` - Home landing page
- `/explore` - Browse all events
- `/marketplace` - NFT ticket marketplace
- `/demo` - Layout documentation

**User Routes** (requires wallet)
- `/dashboard` - User overview
- `/events/my-events` - Created events
- `/tickets/my-tickets` - Owned NFT tickets
- `/investments` - Event investments
- `/wallet` - Wallet overview

**Verifier Routes** (User + review permissions)
- `/verifier/dashboard` - Review overview
- `/verifier/pending` - Pending events
- `/verifier/reports` - User reports

**Admin Routes** (separate layout)
- `/admin/dashboard` - Platform analytics
- `/admin/users` - User management
- `/admin/events` - Event management
- `/admin/marketplace` - Marketplace monitoring
- `/admin/fraud` - Fraud detection
- `/admin/finance` - Financial dashboard

## 🎨 Design System

### Color Schemes

**Public/User/Verifier:**
- Primary: Purple to Blue gradients (`from-purple-600 to-blue-600`)
- Background: Deep slate (`bg-slate-950`, `bg-slate-900`)
- Accent: Electric blue and purple

**Admin:**
- Primary: Red to Orange gradients (`from-red-600 to-orange-600`)
- Background: Same slate system
- Emphasis on data visualization

### Tech Stack

- **React** - UI framework
- **TypeScript** - Type safety
- **React Router** - Routing
- **Tailwind CSS v4** - Styling
- **Recharts** - Data visualization
- **Radix UI** - Component primitives
- **Lucide React** - Icons

## 📱 Features by Role

### Public Features
- View featured events
- Browse event marketplace
- Search and filter events
- View event details

### User Features
- Dashboard with statistics
- Create events (multi-step form)
- Buy and manage NFT tickets
- Invest in events
- Sell tickets on marketplace
- Transaction history
- Wallet management

### Verifier Features
- All User features
- Review pending events
- Approve/reject events with comments
- Handle user reports
- View moderation statistics
- Access to event creator details

### Admin Features
- Platform-wide analytics
- User management (suspend, role assignment)
- Event management (all events, flagged events)
- Marketplace monitoring
- Fraud detection and alerts
- Financial reports
- System configuration
- Platform settings

## 🧪 Testing Layout Separation

Use the **Role Switcher** (floating button) to observe:

1. **Public → User**: Same header remains, sidebar appears
2. **User → Verifier**: Layout stays the same, additional nav items appear
3. **Any Role → Admin**: Complete layout change - different header, sidebar, and colors

## 📖 Documentation

See [LAYOUT_ARCHITECTURE.md](./LAYOUT_ARCHITECTURE.md) for detailed architectural documentation.

## 🎯 Design Principles

1. **Strict Separation**: Admin layout shares ZERO components with Public/User/Verifier
2. **Progressive Enhancement**: Verifier extends User rather than replacing it
3. **Shared Where Appropriate**: Public and User share header for consistency
4. **Clear Visual Hierarchy**: Each role has distinct color coding
5. **Mobile Responsive**: All layouts adapt to mobile viewports

---

**Built with strict role-based layout separation to ensure clear role boundaries and maintainable architecture.**

🔗 Navigate to `/demo` to explore the role system interactively!
