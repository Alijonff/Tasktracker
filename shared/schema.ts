import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  timestamp,
  decimal,
  pgEnum,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const roleEnum = pgEnum("role", [
  "admin",
  "director",
  "manager",
  "senior",
  "employee",
]);
export const gradeEnum = pgEnum("grade", ["A", "B", "C", "D"]);
export const taskStatusEnum = pgEnum("task_status", [
  "BACKLOG",
  "IN_PROGRESS",
  "UNDER_REVIEW",
  "DONE",
]);
export const taskTypeEnum = pgEnum("task_type", ["INDIVIDUAL", "UNIT", "DEPARTMENT"]);
export const auctionModeEnum = pgEnum("auction_mode", ["MONEY", "TIME"]);
export const positionTypeEnum = pgEnum("position_type", [
  "admin",
  "director",
  "deputy",
  "management_head",
  "management_deputy",
  "division_head",
  "senior",
  "employee",
]);
export const pointTransactionTypeEnum = pgEnum("point_transaction_type", [
  "TASK_COMPLETION",
  "MANUAL_ADJUSTMENT",
  "BID_PLACEMENT",
]);

// Organization structure tables
export const departments = pgTable("departments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  leaderId: varchar("leader_id"),
  leaderName: text("leader_name"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  employeeCount: integer("employee_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const managements = pgTable("managements", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  departmentId: varchar("department_id")
    .notNull()
    .references(() => departments.id, { onDelete: "cascade" }),
  leaderId: varchar("leader_id"),
  leaderName: text("leader_name"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  employeeCount: integer("employee_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const divisions = pgTable("divisions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  managementId: varchar("management_id")
    .references(() => managements.id, { onDelete: "set null" }),
  departmentId: varchar("department_id")
    .notNull()
    .references(() => departments.id, { onDelete: "cascade" }),
  leaderId: varchar("leader_id"),
  leaderName: text("leader_name"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  employeeCount: integer("employee_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  email: text("email").unique(),
  role: roleEnum("role").notNull().default("employee"),
  positionType: positionTypeEnum("position_type"),
  divisionId: varchar("division_id").references(() => divisions.id, {
    onDelete: "set null",
  }),
  managementId: varchar("management_id").references(() => managements.id, {
    onDelete: "set null",
  }),
  departmentId: varchar("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  grade: gradeEnum("grade").notNull().default("D"),
  points: integer("points").notNull().default(0),
  completedTasks: integer("completed_tasks").default(0),
  totalHours: decimal("total_hours", { precision: 10, scale: 2 }).default("0"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: taskStatusEnum("status").notNull().default("BACKLOG"),
  type: taskTypeEnum("type").notNull(),
  departmentId: varchar("department_id")
    .notNull()
    .references(() => departments.id, { onDelete: "cascade" }),
  managementId: varchar("management_id").references(() => managements.id, {
    onDelete: "set null",
  }),
  divisionId: varchar("division_id").references(() => divisions.id, {
    onDelete: "set null",
  }),
  creatorId: varchar("creator_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  creatorName: text("creator_name").notNull(),
  executorId: varchar("executor_id").references(() => users.id, {
    onDelete: "set null",
  }),
  executorName: text("executor_name"),
  minimumGrade: gradeEnum("required_grade").notNull().default("D"),
  deadline: timestamp("deadline").notNull(),
  reviewDeadline: timestamp("review_deadline"),
  doneAt: timestamp("done_at"),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  assignedPoints: integer("assigned_points"),
  auctionMode: auctionModeEnum("auction_mode"),
  auctionStartAt: timestamp("auction_start_at"),
  auctionPlannedEndAt: timestamp("auction_planned_end_at"),
  auctionEndAt: timestamp("auction_end_at"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }),
  currentPrice: decimal("current_price", { precision: 10, scale: 2 }),
  baseTimeMinutes: integer("base_time_minutes"),
  earnedMoney: decimal("earned_money", { precision: 10, scale: 2 }),
  earnedTimeMinutes: integer("earned_time_minutes"),
  auctionWinnerId: varchar("auction_winner_id").references(() => users.id, {
    onDelete: "set null",
  }),
  auctionWinnerName: text("auction_winner_name"),
  auctionHasBids: boolean("auction_has_bids").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  statusIdx: index("tasks_status_idx").on(table.status),
  departmentIdx: index("tasks_department_idx").on(table.departmentId),
  plannedEndIdx: index("tasks_planned_end_idx").on(table.auctionPlannedEndAt),
}));

export const auctionBids = pgTable("auction_bids", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  taskId: varchar("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  bidderId: varchar("bidder_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  bidderName: text("bidder_name").notNull(),
  bidderRating: decimal("bidder_rating", { precision: 3, scale: 2 }).notNull(),
  bidderGrade: gradeEnum("bidder_grade").notNull(),
  bidderPoints: integer("bidder_points").notNull().default(0),
  valueMoney: decimal("value_money", { precision: 10, scale: 2 }),
  valueTimeMinutes: integer("value_time_minutes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskComments = pgTable("task_comments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  taskId: varchar("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  authorId: varchar("author_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const timeLogs = pgTable("time_logs", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  taskId: varchar("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  userName: text("user_name").notNull(),
  hours: decimal("hours", { precision: 6, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pointTransactions = pgTable("point_transactions", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  userId: varchar("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  userName: text("user_name").notNull(),
  amount: integer("amount").notNull(),
  type: pointTransactionTypeEnum("type").notNull(),
  taskId: varchar("task_id").references(() => tasks.id, {
    onDelete: "set null",
  }),
  taskTitle: text("task_title"),
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskAttachments = pgTable("task_attachments", {
  id: varchar("id")
    .primaryKey()
    .default(sql`gen_random_uuid()`),
  taskId: varchar("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  uploaderId: varchar("uploader_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  uploaderName: text("uploader_name").notNull(),
  filename: text("filename").notNull(),
  filesizeBytes: integer("filesize_bytes").notNull(),
  storagePath: text("storage_path").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  deletedAt: timestamp("deleted_at"),
});

// TypeScript types from tables
export type Department = typeof departments.$inferSelect;
export type Management = typeof managements.$inferSelect;
export type Division = typeof divisions.$inferSelect;
export type User = typeof users.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type AuctionBid = typeof auctionBids.$inferSelect;
export type TaskComment = typeof taskComments.$inferSelect;
export type TimeLog = typeof timeLogs.$inferSelect;
export type PointTransaction = typeof pointTransactions.$inferSelect;
export type TaskAttachment = typeof taskAttachments.$inferSelect;

export type Grade = (typeof gradeEnum.enumValues)[number];

// Aliases for consistency
export type SelectUser = User;

// Insert schemas
export const insertDepartmentSchema = createInsertSchema(departments).omit({
  id: true,
  createdAt: true,
});

export const insertManagementSchema = createInsertSchema(managements).omit({
  id: true,
  createdAt: true,
});

export const insertDivisionSchema = createInsertSchema(divisions)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    managementId: z
      .string()
      .min(1, "Укажите управление")
      .optional()
      .nullable(),
  });

const dateTransform = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value : new Date(value)));

export const insertTaskSchema = createInsertSchema(tasks)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    doneAt: true,
  })
  .extend({
    deadline: dateTransform,
    auctionStartAt: dateTransform.optional(),
    auctionEndAt: dateTransform.optional(),
  });

export const insertBidSchema = createInsertSchema(auctionBids).omit({
  id: true,
  createdAt: true,
  isActive: true,
});

export const insertCommentSchema = createInsertSchema(taskComments).omit({
  id: true,
  createdAt: true,
});

export const insertTimeLogSchema = createInsertSchema(timeLogs)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    date: z.string().transform((val) => new Date(val)),
  });

export const insertPointTransactionSchema = createInsertSchema(
  pointTransactions,
).omit({
  id: true,
  createdAt: true,
});

export const insertTaskAttachmentSchema = createInsertSchema(
  taskAttachments,
).omit({
  id: true,
  createdAt: true,
  deletedAt: true,
});

export const insertUserSchema = createInsertSchema(users)
  .omit({
    id: true,
    passwordHash: true,
    createdAt: true,
    mustChangePassword: true,
    rating: true,
    grade: true,
    positionType: true,
    points: true,
    completedTasks: true,
    totalHours: true,
  })
  .extend({
    email: z
      .string()
      .trim()
      .email("Введите корректный email")
      .optional()
      .or(z.literal(""))
      .transform((value) => (value === "" ? undefined : value)),
    password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  });

export const loginSchema = z.object({
  username: z.string().min(1, "Введите имя пользователя"),
  password: z.string().min(1, "Введите пароль"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Введите текущий пароль"),
  newPassword: z
    .string()
    .min(6, "Новый пароль должен содержать минимум 6 символов"),
});

// Insert types
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type InsertManagement = z.infer<typeof insertManagementSchema>;
export type InsertDivision = z.infer<typeof insertDivisionSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertBid = z.infer<typeof insertBidSchema>;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type InsertTimeLog = z.infer<typeof insertTimeLogSchema>;
export type InsertTaskAttachment = z.infer<typeof insertTaskAttachmentSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Login = z.infer<typeof loginSchema>;

// Additional types for analytics
export type AnalyticsLevel =
  | "department"
  | "management"
  | "division"
  | "employee";

export type AnalyticsMetrics = {
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completionRate: number;
  totalHours: number;
  averageTaskDuration: number;
  averageRating: number;
  activeAuctions: number;
};

export type DepartmentAnalytics = {
  department: Department;
  metrics: AnalyticsMetrics;
  managements: Array<{
    management: Management;
    metrics: AnalyticsMetrics;
  }>;
};

export type ManagementAnalytics = {
  management: Management;
  department: Department;
  metrics: AnalyticsMetrics;
  divisions: Array<{
    division: Division;
    metrics: AnalyticsMetrics;
  }>;
};

export type DivisionAnalytics = {
  division: Division;
  management: Management;
  department: Department;
  metrics: AnalyticsMetrics;
  users: Array<{
    user: User;
    metrics: AnalyticsMetrics;
  }>;
};

export type UserAnalytics = {
  user: User;
  division: Division;
  management: Management;
  department: Department;
  metrics: AnalyticsMetrics;
  recentTasks: Task[];
};
