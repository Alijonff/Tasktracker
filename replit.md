# TaskFlow - Enterprise Task Management System

## Overview

TaskFlow is a comprehensive enterprise task management system designed for hierarchical organizations. The system manages tasks and working time across a four-level organizational structure: Department → Management → Division → Employee. It features both individual task assignment and auction-based task allocation, where employees bid on tasks by proposing completion times. The platform includes a rating system, detailed analytics, time tracking, and real-time collaboration features.

**Core Capabilities:**
- Hierarchical organizational structure management
- Individual and auction-based task assignment
- Role-based access control (Admin, Director, Manager, Senior Employee, Employee)
- Rating system for employees and directors
- Comprehensive time tracking and analytics
- Real-time task collaboration with comments and file attachments

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework:** React with TypeScript using Vite as the build tool

**UI Design System:** 
- Material Design 3 principles adapted for enterprise use
- Shadcn/ui component library (New York style variant)
- Tailwind CSS for styling with custom design tokens
- Dark theme with glassmorphism effects
- Primary color: #0d5257 (dark teal)
- Typography: Inter for UI text, Roboto Mono for numeric/time data

**State Management:**
- TanStack Query (React Query) for server state management and data fetching
- React hooks for local component state
- Query-based cache invalidation strategy with segmented query keys

**Routing:** Wouter for lightweight client-side routing

**Key Design Patterns:**
- Component composition with shadcn/ui primitives
- Reusable UI components for tasks, ratings, avatars, and status badges
- Dialog-based workflows for task creation, bidding, and time logging
- Responsive layouts with mobile-first approach
- Data visualization using Recharts for analytics

### Backend Architecture

**Runtime:** Node.js with Express.js server

**Database ORM:** Drizzle ORM with type-safe schema definitions

**API Design:**
- RESTful API endpoints organized by resource type
- Storage abstraction layer (`storage.ts`) for database operations
- Filter-based queries supporting organizational hierarchy traversal
- Segmented query parameters for efficient data filtering

**Key Endpoints:**
- `/api/departments` - Department management
- `/api/managements` - Management unit operations (filtered by department)
- `/api/divisions` - Division operations (filtered by management/department)
- `/api/employees` - Employee data (filtered by division/management/department)
- `/api/tasks` - Task CRUD operations with complex filtering
- `/api/auction-bids` - Auction bidding operations

**Data Access Patterns:**
- Hierarchical filtering cascades down organizational structure
- Security enforced through departmentId requirement on task queries
- Efficient relationship queries using Drizzle ORM joins

### Data Storage

**Database:** PostgreSQL (configured for Neon serverless)

**Schema Design:**

**Organizational Hierarchy:**
- `departments` - Top-level organizational units with leader and rating
- `managements` - Mid-level units within departments
- `divisions` - Team-level units within managements
- `employees` - Individual users with role, rating, and time metrics

**Task Management:**
- `tasks` - Core task entity supporting both individual and auction types
- Task statuses: backlog, inProgress, underReview, completed, overdue
- Tracks estimated vs actual hours, deadlines, and assignees
- Support for comments and file attachments

**Auction System:**
- `auctionBids` - Employee bids on auction tasks
- Tracks bid amount (hours), employee rating at bid time
- Auto-assignment logic: lowest bid wins, ties broken by higher rating
- 4-hour timeout mechanism for bid increases

**Rating System:**
- Decimal precision ratings (0-5 scale) for employees and leaders
- Calculated based on task completion accuracy and timeliness
- Affects auction bid prioritization

### Authentication & Authorization

**Roles:**
- Admin: Full system access and organizational structure management
- Director (Department): Department-wide visibility and edit rights
- Manager (Management/Division): Restricted to their unit and below
- Senior Employee: Can create tasks and manage auctions
- Employee: View assigned tasks, participate in auctions, log time

**Access Control:**
- Role-based permissions enforced at API level
- Hierarchical visibility: leaders see all data in their scope and below
- Employees limited to assigned tasks and division auctions
- Task creation restricted to Senior Employee role and above

### Development Workflow

**Build System:**
- Vite for frontend development with HMR
- esbuild for backend bundling
- TypeScript compilation with strict mode enabled
- Shared schema definitions between client and server

**Database Migrations:**
- Drizzle Kit for schema migrations
- `db:push` command for development schema sync
- Migrations stored in `/migrations` directory

**Module Resolution:**
- Path aliases: `@/` for client code, `@shared/` for shared types
- ESM modules throughout (type: "module" in package.json)

## External Dependencies

**Database:**
- Neon Serverless PostgreSQL (@neondatabase/serverless)
- WebSocket support for serverless connection pooling
- Connection string via `DATABASE_URL` environment variable

**UI Component Library:**
- Radix UI primitives for accessible components (dialogs, dropdowns, tooltips, etc.)
- Shadcn/ui built on top of Radix with Tailwind styling
- Recharts for data visualization in analytics dashboards

**Forms & Validation:**
- React Hook Form for form state management
- Zod for schema validation
- @hookform/resolvers for validation integration
- Drizzle-Zod for generating Zod schemas from database schema

**Utilities:**
- date-fns for date manipulation and formatting
- clsx and tailwind-merge for className composition
- class-variance-authority for component variants

**Session Management:**
- connect-pg-simple for PostgreSQL-backed sessions (configured but not yet implemented in routes)

**Development Tools:**
- @replit/vite-plugin-runtime-error-modal for error overlays
- @replit/vite-plugin-cartographer for Replit integration (dev only)

**Key Design Decision - Auction Mechanism:**
The auction system addresses the requirement for fair task distribution. Employees propose completion times lower than the initial estimate, with the system automatically selecting the lowest bid. When bids are equal, employee rating serves as the tiebreaker, incentivizing quality work. The 4-hour timeout creates urgency while allowing sufficient time for consideration. This promotes efficient resource allocation while maintaining fairness through the rating system.