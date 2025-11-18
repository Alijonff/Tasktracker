DO $$ BEGIN
  ALTER TYPE "task_status" RENAME VALUE 'backlog' TO 'BACKLOG';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "task_status" RENAME VALUE 'inProgress' TO 'IN_PROGRESS';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "task_status" RENAME VALUE 'underReview' TO 'UNDER_REVIEW';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "task_status" RENAME VALUE 'completed' TO 'DONE';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "task_type" RENAME VALUE 'auction' TO 'DEPARTMENT';
EXCEPTION WHEN undefined_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "task_type" ADD VALUE 'INDIVIDUAL';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TYPE "task_type" ADD VALUE 'UNIT';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "tasks" ALTER COLUMN "status" SET DEFAULT 'BACKLOG';
