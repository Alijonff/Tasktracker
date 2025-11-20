# TaskFlow - Enterprise Task Management System

## Overview

TaskFlow is a comprehensive enterprise task management system designed for hierarchical organizations. It manages tasks and working time across a four-level organizational structure: Department → Management → Division → Employee. The system features auction-based task allocation, where employees bid on tasks by proposing completion times. Key capabilities include a rating system, detailed analytics, time tracking, real-time collaboration, role-based access control, and status-driven task workflows with comment support. The project aims to optimize task distribution, improve resource allocation, and enhance organizational efficiency.

## Recent Changes (November 20, 2025)

- **INDIVIDUAL task rewards fix**: Rewards (earnedMoney/earnedTimeMinutes) now correctly saved at task creation and displayed in TaskDetailDialog
- **Status management UI**: Added status transition controls to TaskDetailDialog:
  - IN_PROGRESS → UNDER_REVIEW: "Submit for review" button (executor only)
  - UNDER_REVIEW → DONE: "Complete task" button (creator only)
  - UNDER_REVIEW → IN_PROGRESS: "Return to work" button with mandatory comment field (creator only)
- **ReturnToWorkDialog component**: New dialog for entering comments when returning tasks to work
- **API enhancements**: Extended `updateTaskStatus` in adapter.ts to support optional comment parameter

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
- **Auction Closer** (`server/workers/auctionCloser.ts`): Runs every 5 minutes, processes:
  - Expired auctions (where `auctionPlannedEndAt` has passed): assigns to lowest bidder or department director if no bids, updates task status from `backlog` to `inProgress`.
  - Expired reviews (where `reviewDeadline` has passed): returns tasks from `underReview` to `inProgress`, clears `reviewDeadline`.

**Working Hours Utilities** (`shared/utils.ts`, `server/routes.ts`): 
- `diffWorkingHours`: Calculates working hours between dates (9-17 workdays, excludes weekends).
- `addWorkingHours`: Adds working hours within 9-17 window, used for general time calculations.
- `calculateAuctionEnd`: Computes auction end time by adding 24 real hours (excluding weekends).
- `calculateReviewDeadline`: Computes review deadline by adding 48 real hours (excluding weekends).

### Data Storage

**Database:** PostgreSQL (configured for Neon serverless).

**Schema Design (v2.2):**
- **Organizational Hierarchy:** `departments`, `managements`, `divisions`, `employees` (with positionType, role, rating, points, time metrics).
- **Task Management:** `tasks` support three types: `INDIVIDUAL` (direct assignment, no auction), `UNIT` (division-level auction), `DEPARTMENT` (department-wide auction). Статусы: backlog → inProgress → underReview → completed. Хранит дедлайны, исполнителей, минимальный грейд и параметры аукциона.
- **Auction System:** Tasks store auction configuration: `auction_mode` ("MONEY" or "TIME"), `base_price`/`base_time_minutes` as starting bid, `auctionPlannedEndAt` for planned close, `earned_money`/`earned_time_minutes` for winning bid reward. Ceiling prices reach ×1.5 base value at planned end + 3 working hours. INDIVIDUAL tasks have null auction fields. **Discrete price growth**: Auction price stops at first bid checkpoint; grace period extends 3 real hours after 18:00 deadline.
- **Auction Bids:** `auctionBids` table tracks bids with `value_money`/`value_time_minutes`, bidder grade/rating/points, `is_active` flag. Auto-closure assigns to lowest bidder; if no bids, assigns to department director with ceiling reward. **Tie-breaking**: Winner selected by lowest bid → current_points → createdAt. Bids deactivated on employee termination or department transfer.
- **File Attachments:** `task_attachments` table stores task files (max 10 files × 25MB) in Object Storage. Authorization: creator deletes any files, executor/uploader delete own files, admin deletes all.
- **Points System:** `point_transactions` table tracks point changes with type (TASK_COMPLETION, MANUAL_ADJUSTMENT, BID_PLACEMENT), reference IDs, amounts, and timestamps. Employees earn/lose points; grades calculated dynamically: <45=D, 45-64=C, 65-84=B, ≥85=A. Only employees with grade ≥ task's `minimumGrade` can bid. **Admin users have positionType='admin', role='admin', maintain 0 points with no accumulation.**
- **Review Deadline:** Tasks in `underReview` have `reviewDeadline` set to 48 real hours (excluding weekends) from transition. Worker auto-returns to `inProgress` after expiration.
- **Reports & Analytics (v2.2):** Reports page implements monthly filtering by task completion date (`doneAt` with fallback to `updatedAt`). Aggregates earned value metrics (earnedMoney, earnedTimeMinutes, assignedPoints) across organizational hierarchy (department → management → division → employee). Month selector: current month, previous month, all time. Summary cards display completed tasks count, total earned money, total earned time (hours), total points. Drilldown cards show per-entity metrics when month filter is active.

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