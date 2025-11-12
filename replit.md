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

### Data Storage

**Database:** PostgreSQL (configured for Neon serverless).

**Schema Design:**
- **Organizational Hierarchy:** `departments`, `managements`, `divisions`, `employees` (with role, rating, time metrics).
- **Task Management:** `tasks` (auction-based, statuses: backlog, inProgress, underReview, completed, overdue; tracks deadlines, assignees, minimumGrade).
- **Auction System:** `auctionBids` (employee bids, tracks bid amount, rating, auto-assignment logic based on lowest bid and rating, 4-hour timeout).
- **Rating System:** Decimal precision (0-5 scale) for employees and leaders, calculated based on task completion and timeliness, affects auction prioritization.

### Authentication & Authorization

**Roles:** Admin, Director (Department), Manager (Management/Division), Senior Employee, Employee.

**Access Control:** Role-based permissions enforced at API level, hierarchical visibility for leaders, employees limited to assigned tasks and division auctions, task creation restricted to Senior Employee and above.

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