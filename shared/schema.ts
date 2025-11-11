import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const roleEnum = pgEnum("role", ["admin", "director", "manager", "senior", "employee"]);
export const taskStatusEnum = pgEnum("task_status", ["backlog", "inProgress", "underReview", "completed", "overdue"]);
export const taskTypeEnum = pgEnum("task_type", ["individual", "auction"]);
export const positionTypeEnum = pgEnum("position_type", [
  "department_director",
  "department_deputy",
  "management_head",
  "division_head",
  "division_senior",
  "division_employee"
]);

// Organization structure tables
export const departments = pgTable("departments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  leaderId: varchar("leader_id"),
  leaderName: text("leader_name"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  employeeCount: integer("employee_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const managements = pgTable("managements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  departmentId: varchar("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  leaderId: varchar("leader_id"),
  leaderName: text("leader_name"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  employeeCount: integer("employee_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const divisions = pgTable("divisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  managementId: varchar("management_id").notNull().references(() => managements.id, { onDelete: "cascade" }),
  departmentId: varchar("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  leaderId: varchar("leader_id"),
  leaderName: text("leader_name"),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  employeeCount: integer("employee_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  role: roleEnum("role").notNull().default("employee"),
  divisionId: varchar("division_id").references(() => divisions.id, { onDelete: "set null" }),
  managementId: varchar("management_id").references(() => managements.id, { onDelete: "set null" }),
  departmentId: varchar("department_id").references(() => departments.id, { onDelete: "set null" }),
  rating: decimal("rating", { precision: 3, scale: 2 }).default("0"),
  completedTasks: integer("completed_tasks").default(0),
  totalHours: decimal("total_hours", { precision: 10, scale: 2 }).default("0"),
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const tasks = pgTable("tasks", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: taskStatusEnum("status").notNull().default("backlog"),
  type: taskTypeEnum("type").notNull(),
  departmentId: varchar("department_id").notNull().references(() => departments.id, { onDelete: "cascade" }),
  managementId: varchar("management_id").references(() => managements.id, { onDelete: "set null" }),
  divisionId: varchar("division_id").references(() => divisions.id, { onDelete: "set null" }),
  creatorId: varchar("creator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  creatorName: text("creator_name").notNull(),
  assigneeId: varchar("assignee_id").references(() => users.id, { onDelete: "set null" }),
  assigneeName: text("assignee_name"),
  deadline: timestamp("deadline").notNull(),
  estimatedHours: decimal("estimated_hours", { precision: 6, scale: 2 }).notNull(),
  actualHours: decimal("actual_hours", { precision: 6, scale: 2 }),
  rating: decimal("rating", { precision: 3, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const auctionBids = pgTable("auction_bids", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  bidderId: varchar("bidder_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  bidderName: text("bidder_name").notNull(),
  bidderRating: decimal("bidder_rating", { precision: 3, scale: 2 }).notNull(),
  hours: decimal("hours", { precision: 6, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const taskComments = pgTable("task_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  authorId: varchar("author_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const timeLogs = pgTable("time_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  taskId: varchar("task_id").notNull().references(() => tasks.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  userName: text("user_name").notNull(),
  hours: decimal("hours", { precision: 6, scale: 2 }).notNull(),
  date: timestamp("date").notNull(),
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow(),
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

export const insertDivisionSchema = createInsertSchema(divisions).omit({
  id: true,
  createdAt: true,
});

export const insertTaskSchema = createInsertSchema(tasks).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  deadline: z.string().transform((val) => new Date(val)),
});

export const insertBidSchema = createInsertSchema(auctionBids).omit({
  id: true,
  createdAt: true,
});

export const insertCommentSchema = createInsertSchema(taskComments).omit({
  id: true,
  createdAt: true,
});

export const insertTimeLogSchema = createInsertSchema(timeLogs).omit({
  id: true,
  createdAt: true,
}).extend({
  date: z.string().transform((val) => new Date(val)),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  passwordHash: true,
  createdAt: true,
  mustChangePassword: true,
  rating: true,
  completedTasks: true,
  totalHours: true,
}).extend({
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Введите имя пользователя"),
  password: z.string().min(1, "Введите пароль"),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Введите текущий пароль"),
  newPassword: z.string().min(6, "Новый пароль должен содержать минимум 6 символов"),
});

// Insert types
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type InsertManagement = z.infer<typeof insertManagementSchema>;
export type InsertDivision = z.infer<typeof insertDivisionSchema>;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertBid = z.infer<typeof insertBidSchema>;
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type InsertTimeLog = z.infer<typeof insertTimeLogSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Login = z.infer<typeof loginSchema>;

// Additional types for analytics
export type AnalyticsLevel = "department" | "management" | "division" | "employee";

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
