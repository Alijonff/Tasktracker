# TaskFlow - Enterprise Task Management System

## Overview

TaskFlow is a comprehensive enterprise task management system designed for hierarchical organizations. It manages tasks and working time across a four-level organizational structure: Department → Management → Division → Employee. The system features auction-based task allocation, where employees bid on tasks by proposing completion times. Key capabilities include a rating system, detailed analytics, time tracking, real-time collaboration, and role-based access control. The project aims to optimize task distribution, improve resource allocation, and enhance organizational efficiency.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework:** React with TypeScript, using Vite.

**UI Design System:** Material Design 3 principles, Shadcn/ui (New York style), Tailwind CSS with custom design tokens. Features a dark theme with glassmorphism effects. Primary color: #0d5257 (dark teal). Typography: Inter and Roboto Mono.

**State Management:** TanStack Query for server state and data fetching, React hooks for local state.

**Routing:** Wouter for client-side routing.

**Key Design Patterns:** Component composition, reusable UI components, dialog-based workflows, responsive layouts, data visualization with Recharts.

### Backend Architecture

**Runtime:** Node.js with Express.js.

**Database ORM:** Drizzle ORM with type-safe schema definitions.

**API Design:** RESTful endpoints, storage abstraction layer, filter-based queries for hierarchical traversal, segmented query parameters.

**Key Endpoints:** `/api/departments`, `/api/managements`, `/api/divisions`, `/api/employees`, `/api/tasks`, `/api/auction-bids`.

**Data Access Patterns:** Hierarchical filtering, security enforced via `departmentId`, efficient relationship queries.

**Background Workers:** 
- **Auction Closer** (`server/workers/auctionCloser.ts`): Runs every 5 minutes, processes expired auctions (where `auctionPlannedEndAt` has passed), assigns to lowest bidder or department director if no bids, updates task status from `backlog` to `inProgress`.

**Working Hours Utilities** (`shared/utils.ts`): 
- `diffWorkingHours`: Calculates working hours between dates (8-hour workdays, excludes weekends).
- `addWorkingHours`: Adds working hours to a date, used for 24-hour auction timers.
- `calculateAuctionEnd`: Computes auction end time by adding 24 working hours to start time.

### Data Storage

**Database:** PostgreSQL (configured for Neon serverless).

**Schema Design:**
- **Organizational Hierarchy:** `departments`, `managements`, `divisions`, `employees` (with role, rating, points, time metrics).
- **Task Management:** `tasks` (auction-only, статусы: backlog → inProgress → underReview → completed; хранит дедлайны, исполнителей, минимальный грейд и параметры аукциона).
- **Monetary Auction System:** All tasks use monetary auctions with linear price growth from `auctionInitialSum` to `auctionMaxSum` (initial × 1.5) over 24 working hours. Fields: `auctionInitialSum`, `auctionMaxSum`, `auctionAssignedSum`, `auctionPlannedEndAt`.
- **Auction Bids:** `auctionBids` table tracks monetary bids (`bidAmount` in decimal), bidder grade, and rating. Auto-closure assigns to lowest bidder; if no bids, assigns to department director with max sum.
- **Rating & Grade System:** Employees have decimal rating (0-5) and points that determine grade (D/C/B/A). Grades calculated dynamically: <45=D, 45-64=C, 65-84=B, ≥85=A. Only employees with grade ≥ task's `minimumGrade` can bid.

### Authentication & Authorization

**Roles:** Admin, Director (Department), Manager (Management/Division), Senior Employee, Employee.

**Access Control:** Role-based permissions enforced at API level, hierarchical visibility for leaders, employees limited to assigned tasks and division auctions, task creation restricted to Senior Employee and above.

**DELETE Endpoints (Admin-only):** Basic implementation with dependency checks for departments, managements, divisions. Returns 409 Conflict if dependent entities exist (managements, divisions, users, tasks). **Limitations:** Does not check all dependencies (bids, point transactions, etc.). Production requires cascade deletes or soft deletes. No transactional safeguards against race conditions.

### Development Workflow

**Build System:** Vite for frontend, esbuild for backend, TypeScript with strict mode, shared schema definitions.

**Database Migrations:** Drizzle Kit for schema migrations.

**Module Resolution:** Path aliases (`@/`, `@shared/`), ESM modules.

## External Dependencies

**Database:** Neon Serverless PostgreSQL (`@neondatabase/serverless`).

**UI Component Library:** Radix UI primitives, Shadcn/ui, Recharts.

**Forms & Validation:** React Hook Form, Zod, `@hookform/resolvers`, Drizzle-Zod.

**Utilities:** `date-fns`, `clsx`, `tailwind-merge`, `class-variance-authority`.

**Session Management:** `connect-pg-simple` for PostgreSQL-backed sessions.