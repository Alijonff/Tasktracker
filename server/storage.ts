import { db } from "./db";
import {
  departments,
  managements,
  divisions,
  tasks,
  auctionBids,
  users,
  pointTransactions,
  taskComments,
  taskAttachments,
  type Department,
  type Management,
  type Division,
  type Task,
  type AuctionBid,
  type User,
  type PointTransaction,
  type TaskAttachment,
  type InsertTask,
  type InsertBid,
  type InsertDepartment,
  type InsertManagement,
  type InsertDivision,
  type InsertTaskAttachment,
  type Grade,
} from "@shared/schema";
import { type TaskMode } from "@shared/taskMetadata";
import { type PositionType } from "@shared/utils";
import { eq, and, or, like, desc, asc, inArray, gte, isNull, sql } from "drizzle-orm";

export interface IStorage {
  // Users
  createUser(
    username: string,
    passwordHash: string,
    name: string,
    email: string | null,
    role: "admin" | "director" | "manager" | "senior" | "employee",
    grade: Grade,
    departmentId?: string | null,
    managementId?: string | null,
    divisionId?: string | null,
    positionType?: PositionType,
    mustChangePassword?: boolean,
  ): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getAllUsers(filters?: { divisionId?: string; managementId?: string; departmentId?: string }): Promise<User[]>;
  updateUser(
    id: string,
    updates: {
      name?: string;
      email?: string | null;
      role?: "admin" | "director" | "manager" | "senior" | "employee";
      grade?: Grade;
      positionType?: PositionType;
      departmentId?: string | null;
      managementId?: string | null;
      divisionId?: string | null;
      passwordHash?: string;
      mustChangePassword?: boolean;
    }
  ): Promise<User | undefined>;
  deleteUser(id: string): Promise<void>;

  // Departments
  getAllDepartments(): Promise<Department[]>;
  getDepartment(id: string): Promise<Department | undefined>;
  createDepartment(data: InsertDepartment): Promise<Department>;
  updateDepartment(id: string, updates: Partial<InsertDepartment>): Promise<Department | undefined>;

  // Managements
  getAllManagements(filters?: { departmentId?: string }): Promise<Management[]>;
  getManagement(id: string): Promise<Management | undefined>;
  createManagement(data: InsertManagement): Promise<Management>;
  updateManagement(id: string, updates: Partial<InsertManagement>): Promise<Management | undefined>;

  // Divisions
  getAllDivisions(filters?: { managementId?: string; departmentId?: string }): Promise<Division[]>;
  getDivision(id: string): Promise<Division | undefined>;
  createDivision(data: InsertDivision): Promise<Division>;
  updateDivision(id: string, updates: Partial<InsertDivision>): Promise<Division | undefined>;

  // Tasks
  getAllTasks(filters: {
    departmentId?: string;
    managementId?: string;
    divisionId?: string;
    status?: string;
    type?: string;
    search?: string;
    executorId?: string;
    creatorId?: string;
    participantId?: string;
    statuses?: Task["status"][];
    updatedSince?: Date;
    limit?: number;
    orderBy?: "createdAt" | "updatedAt";
  }): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined>;

  // Auction Bids
  getTaskBids(taskId: string): Promise<AuctionBid[]>;
  createBid(bid: InsertBid, options?: { currentAuctionAmount?: number | null }): Promise<AuctionBid>;
  deleteEmployeeBids(employeeId: string): Promise<string[]>;
  deactivateBidsForTask(taskId: string): Promise<void>;
  deactivateBidsForEmployee(employeeId: string, filters?: { departmentId?: string; divisionId?: string }): Promise<void>;

  addTaskComment(comment: {
    taskId: string;
    authorId: string;
    authorName: string;
    content: string;
  }): Promise<void>;

  getDashboardMetrics(filters: { departmentId?: string | null }): Promise<{
    completedTasks: { value: number; hasData: boolean };
    totalHours: { value: number; hasData: boolean };
    activeAuctions: { value: number; hasData: boolean };
    backlogTasks: { value: number; hasData: boolean };
  }>;

  getHighlightedTasks(filters: {
    departmentId?: string | null;
    limit: number;
    recentDays: number;
  }): Promise<Task[]>;

  // Point Transactions
  createPointTransaction(data: {
    userId: string;
    userName: string;
    amount: number;
    type: "task_completion" | "overdue_penalty" | "position_assigned";
    taskId?: string | null;
    taskTitle?: string | null;
    comment?: string | null;
  }): Promise<PointTransaction>;
  getUserPointHistory(userId: string): Promise<PointTransaction[]>;
  assignPointsForTask(taskId: string, basePoints: number, penaltyPoints: number): Promise<void>;

  // Auction management
  getActiveAuctions(filters?: { departmentId?: string }): Promise<Task[]>;
  getAuctionsToClose(): Promise<Task[]>;
  closeAuction(
    taskId: string,
    options: { winnerId?: string; winnerName?: string; assignedValue?: number | null; mode: TaskMode; endAt?: Date }
  ): Promise<Task | undefined>;

  // Review management
  getReviewsToExpire(): Promise<Task[]>;

  // Monthly metrics
  getMonthlyMetrics(departmentId?: string): Promise<{
    completedTasksCount: number;
    closedAuctionsSum: string;
    activeAuctionsCount: number;
    backlogCount: number;
  }>;

  // Analytics
  getEmployeeAnalytics(filters?: { departmentId?: string; managementId?: string; divisionId?: string }): Promise<any[]>;
  getStructureAnalytics(filters?: { departmentId?: string }): Promise<any>;

  // Task Attachments
  getTaskAttachments(taskId: string): Promise<TaskAttachment[]>;
  createTaskAttachment(data: InsertTaskAttachment): Promise<TaskAttachment>;
  deleteTaskAttachment(id: string): Promise<void>;
  getAttachmentCount(taskId: string): Promise<number>;
}

export class DbStorage implements IStorage {
  // Users
  async createUser(
    username: string,
    passwordHash: string,
    name: string,
    email: string | null,
    role: "admin" | "director" | "manager" | "senior" | "employee",
    grade: Grade,
    departmentId?: string | null,
    managementId?: string | null,
    divisionId?: string | null,
    positionType?: PositionType,
    mustChangePassword?: boolean,
  ): Promise<User> {
    const [user] = await db.insert(users).values({
      username,
      passwordHash,
      name,
      email: email ?? null,
      role,
      grade,
      departmentId: departmentId || null,
      managementId: managementId || null,
      divisionId: divisionId || null,
      positionType: role === "admin" ? "admin" : (positionType ?? "employee"),
      mustChangePassword: mustChangePassword ?? false,
    }).returning();
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getAllUsers(filters?: { divisionId?: string; managementId?: string; departmentId?: string }): Promise<User[]> {
    if (filters?.divisionId) {
      return await db.select().from(users).where(eq(users.divisionId, filters.divisionId));
    }
    if (filters?.managementId) {
      return await db.select().from(users).where(eq(users.managementId, filters.managementId));
    }
    if (filters?.departmentId) {
      return await db.select().from(users).where(eq(users.departmentId, filters.departmentId));
    }
    return await db.select().from(users);
  }

  async updateUser(
    id: string,
    updates: {
      name?: string;
      email?: string | null;
      role?: "admin" | "director" | "manager" | "senior" | "employee";
      grade?: Grade;
      positionType?: PositionType;
      departmentId?: string | null;
      managementId?: string | null;
      divisionId?: string | null;
      passwordHash?: string;
      mustChangePassword?: boolean;
    }
  ): Promise<User | undefined> {
    const [user] = await db.update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user;
  }

  async deleteUser(id: string): Promise<void> {
    await db.delete(users).where(eq(users.id, id));
  }

  // Departments
  async getAllDepartments(): Promise<Department[]> {
    return await db.select().from(departments);
  }

  async getDepartment(id: string): Promise<Department | undefined> {
    const [dept] = await db.select().from(departments).where(eq(departments.id, id));
    return dept;
  }

  async createDepartment(data: InsertDepartment): Promise<Department> {
    const [department] = await db.insert(departments).values(data).returning();
    return department;
  }

  async updateDepartment(id: string, updates: Partial<InsertDepartment>): Promise<Department | undefined> {
    const [department] = await db
      .update(departments)
      .set(updates)
      .where(eq(departments.id, id))
      .returning();
    return department;
  }

  async deleteDepartment(id: string): Promise<void> {
    await db.delete(departments).where(eq(departments.id, id));
  }

  // Managements
  async getAllManagements(filters?: { departmentId?: string }): Promise<Management[]> {
    if (filters?.departmentId) {
      return await db.select().from(managements).where(eq(managements.departmentId, filters.departmentId));
    }
    return await db.select().from(managements);
  }

  async getManagement(id: string): Promise<Management | undefined> {
    const [mgmt] = await db.select().from(managements).where(eq(managements.id, id));
    return mgmt;
  }

  async createManagement(data: InsertManagement): Promise<Management> {
    const [management] = await db.insert(managements).values(data).returning();
    return management;
  }

  async updateManagement(id: string, updates: Partial<InsertManagement>): Promise<Management | undefined> {
    const [management] = await db
      .update(managements)
      .set(updates)
      .where(eq(managements.id, id))
      .returning();
    return management;
  }

  async deleteManagement(id: string): Promise<void> {
    await db.delete(managements).where(eq(managements.id, id));
  }

  // Divisions
  async getAllDivisions(filters?: { managementId?: string; departmentId?: string }): Promise<Division[]> {
    if (filters?.managementId) {
      return await db.select().from(divisions).where(eq(divisions.managementId, filters.managementId));
    }
    if (filters?.departmentId) {
      return await db.select().from(divisions).where(eq(divisions.departmentId, filters.departmentId));
    }
    return await db.select().from(divisions);
  }

  async getDivision(id: string): Promise<Division | undefined> {
    const [div] = await db.select().from(divisions).where(eq(divisions.id, id));
    return div;
  }

  async createDivision(data: InsertDivision): Promise<Division> {
    const [division] = await db.insert(divisions).values(data).returning();
    return division;
  }

  async updateDivision(id: string, updates: Partial<InsertDivision>): Promise<Division | undefined> {
    const [division] = await db
      .update(divisions)
      .set(updates)
      .where(eq(divisions.id, id))
      .returning();
    return division;
  }

  async deleteDivision(id: string): Promise<void> {
    await db.delete(divisions).where(eq(divisions.id, id));
  }

  // Tasks
  async getAllTasks(filters: {
    departmentId?: string;
    managementId?: string;
    divisionId?: string;
    status?: string;
    type?: string;
    search?: string;
    executorId?: string;
    creatorId?: string;
    participantId?: string;
    statuses?: Task["status"][];
    updatedSince?: Date;
    limit?: number;
    orderBy?: "createdAt" | "updatedAt";
  }): Promise<Task[]> {
    let query = db.select().from(tasks);
    const conditions: any[] = [];

    if (filters.departmentId) {
      conditions.push(eq(tasks.departmentId, filters.departmentId));
    }
    if (filters.managementId) {
      conditions.push(eq(tasks.managementId, filters.managementId));
    }
    if (filters.divisionId) {
      conditions.push(eq(tasks.divisionId, filters.divisionId));
    }
    if (filters.status && filters.status !== "all") {
      conditions.push(eq(tasks.status, filters.status as any));
    }
    if (filters.statuses && filters.statuses.length > 0) {
      conditions.push(inArray(tasks.status, filters.statuses as any));
    }
    if (filters.type && filters.type !== "all") {
      conditions.push(eq(tasks.type, filters.type as any));
    }
    if (filters.executorId) {
      conditions.push(eq(tasks.executorId, filters.executorId));
    }
    if (filters.creatorId) {
      conditions.push(eq(tasks.creatorId, filters.creatorId));
    }
    if (filters.participantId) {
      conditions.push(
        or(
          eq(tasks.executorId, filters.participantId),
          eq(tasks.creatorId, filters.participantId)
        )
      );
    }
    if (filters.search) {
      conditions.push(
        or(
          like(tasks.title, `%${filters.search}%`),
          like(tasks.description, `%${filters.search}%`)
        )
      );
    }
    if (filters.updatedSince) {
      conditions.push(gte(tasks.updatedAt, filters.updatedSince));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as any;
    }

    if (filters.orderBy === "updatedAt") {
      query = query.orderBy(desc(tasks.updatedAt)) as any;
    } else {
      query = query.orderBy(desc(tasks.createdAt)) as any;
    }

    if (filters.limit) {
      query = query.limit(filters.limit) as any;
    }

    return await query;
  }

  async getTask(id: string): Promise<Task | undefined> {
    const [task] = await db.select().from(tasks).where(eq(tasks.id, id));
    return task;
  }

  // Task mutations
  async createTask(taskData: InsertTask): Promise<Task> {
    const [task] = await db.insert(tasks).values(taskData as any).returning();
    return task;
  }

  async updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined> {
    const [task] = await db
      .update(tasks)
      .set({ ...updates as any, updatedAt: new Date() })
      .where(eq(tasks.id, id))
      .returning();
    return task;
  }

  // Auction Bids
  async getTaskBids(taskId: string): Promise<AuctionBid[]> {
    return await db
      .select()
      .from(auctionBids)
      .where(and(eq(auctionBids.taskId, taskId), eq(auctionBids.isActive, true)))
      .orderBy(
        asc(sql`COALESCE(${auctionBids.valueTimeMinutes}, ${auctionBids.valueMoney})`),
        desc(auctionBids.bidderPoints),
        asc(auctionBids.createdAt),
      );
  }

  async createBid(bidData: InsertBid, options?: { currentAuctionAmount?: number | null }): Promise<AuctionBid> {
    return await db.transaction(async (tx) => {
      const [bid] = await tx.insert(auctionBids).values(bidData as any).returning();
      const updates: Partial<InsertTask> = { auctionHasBids: true, updatedAt: new Date() };

      if (options?.currentAuctionAmount !== undefined && options?.currentAuctionAmount !== null) {
        updates.currentPrice = options.currentAuctionAmount as any;
      }

      await tx.update(tasks).set(updates as any).where(eq(tasks.id, bidData.taskId));
      return bid;
    });
  }

  async deleteEmployeeBids(employeeId: string): Promise<string[]> {
    return await db.transaction(async (tx) => {
      const deletedBids = await tx
        .update(auctionBids)
        .set({ isActive: false })
        .where(eq(auctionBids.bidderId, employeeId))
        .returning({ taskId: auctionBids.taskId });

      const taskIds = Array.from(new Set(deletedBids.map(b => b.taskId)));

      if (taskIds.length > 0) {
        await tx.execute(sql`
          SELECT id FROM tasks WHERE id = ANY(${taskIds}) FOR UPDATE
        `);

        await tx.execute(sql`
          UPDATE tasks
          SET auction_has_bids = EXISTS(
            SELECT 1 FROM auction_bids WHERE task_id = tasks.id AND is_active = true
          )
          WHERE id = ANY(${taskIds})
        `);
      }

      return taskIds;
    });
  }

  async deactivateBidsForTask(taskId: string): Promise<void> {
    await db
      .update(auctionBids)
      .set({ isActive: false })
      .where(eq(auctionBids.taskId, taskId));
  }

  async deactivateBidsForEmployee(
    employeeId: string,
    filters?: { departmentId?: string; divisionId?: string }
  ): Promise<void> {
    const conditions: any[] = [eq(auctionBids.bidderId, employeeId)];

    if (filters?.departmentId || filters?.divisionId) {
      const tasksSubquery = db
        .select({ id: tasks.id })
        .from(tasks)
        .where(
          and(
            filters.departmentId ? eq(tasks.departmentId, filters.departmentId) : undefined,
            filters.divisionId ? eq(tasks.divisionId, filters.divisionId) : undefined
          )
        );

      conditions.push(
        sql`${auctionBids.taskId} IN (${tasksSubquery})`
      );
    }

    await db
      .update(auctionBids)
      .set({ isActive: false })
      .where(and(...conditions));
  }

  async addTaskComment(comment: {
    taskId: string;
    authorId: string;
    authorName: string;
    content: string;
  }): Promise<void> {
    await db.insert(taskComments).values({
      taskId: comment.taskId,
      authorId: comment.authorId,
      authorName: comment.authorName,
      content: comment.content,
    });
  }

  async getDashboardMetrics(filters: { departmentId?: string | null }) {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));

    const baseConditions: any[] = [];

    if (filters.departmentId) {
      baseConditions.push(eq(tasks.departmentId, filters.departmentId));
    }

    const withPeriodConditions = (extra: any) =>
      baseConditions.length > 0
        ? and(...baseConditions, extra, gte(tasks.updatedAt, startOfMonth))
        : and(extra, gte(tasks.updatedAt, startOfMonth));

    const [completedRow] = await db
      .select({ value: sql<number>`count(*)` })
      .from(tasks)
      .where(withPeriodConditions(eq(tasks.status, "DONE" as const)));

    const activeAuctionConditions: any[] = [];
    if (filters.departmentId) {
      activeAuctionConditions.push(eq(tasks.departmentId, filters.departmentId));
    }
    activeAuctionConditions.push(inArray(tasks.type, ["UNIT", "DEPARTMENT"] as any));
    activeAuctionConditions.push(
      inArray(tasks.status, ["BACKLOG", "IN_PROGRESS", "UNDER_REVIEW"] as any)
    );

    const [activeAuctionsRow] = await db
      .select({ value: sql<number>`count(*)` })
      .from(tasks)
      .where(and(...activeAuctionConditions));

    const backlogConditions: any[] = [];
    if (filters.departmentId) {
      backlogConditions.push(eq(tasks.departmentId, filters.departmentId));
    }
    backlogConditions.push(eq(tasks.status, "BACKLOG" as const));

    const [backlogRow] = await db
      .select({ value: sql<number>`count(*)` })
      .from(tasks)
      .where(and(...backlogConditions));

    const completedValue = Number(completedRow?.value ?? 0);
    const auctionsValue = Number(activeAuctionsRow?.value ?? 0);
    const backlogValue = Number(backlogRow?.value ?? 0);

    return {
      completedTasks: { value: completedValue, hasData: completedValue > 0 },
      totalHours: { value: 0, hasData: false },
      activeAuctions: { value: auctionsValue, hasData: auctionsValue > 0 },
      backlogTasks: { value: backlogValue, hasData: backlogValue > 0 },
    };
  }

  async getHighlightedTasks(filters: {
    departmentId?: string | null;
    limit: number;
    recentDays: number;
  }): Promise<Task[]> {
    const conditions: any[] = [];
    if (filters.departmentId) {
      conditions.push(eq(tasks.departmentId, filters.departmentId));
    }

    const recentThreshold = new Date();
    recentThreshold.setDate(recentThreshold.getDate() - filters.recentDays);

    conditions.push(
      or(
        inArray(tasks.status, ["IN_PROGRESS", "UNDER_REVIEW"] as any),
        and(eq(tasks.status, "BACKLOG" as const), gte(tasks.updatedAt, recentThreshold))
      )
    );

    return await db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(desc(tasks.updatedAt))
      .limit(filters.limit);
  }

  // Point Transactions
  async createPointTransaction(data: {
    userId: string;
    userName: string;
    amount: number;
    type: "task_completion" | "overdue_penalty" | "position_assigned";
    taskId?: string | null;
    taskTitle?: string | null;
    comment?: string | null;
  }): Promise<PointTransaction> {
    return await db.transaction(async (tx) => {
      const [transaction] = await tx
        .insert(pointTransactions)
        .values({
          userId: data.userId,
          userName: data.userName,
          amount: data.amount,
          type: data.type,
          taskId: data.taskId ?? null,
          taskTitle: data.taskTitle ?? null,
          comment: data.comment ?? null,
        })
        .returning();

      // Update user's points within the same transaction
      const [user] = await tx
        .select()
        .from(users)
        .where(eq(users.id, data.userId));

      if (user) {
        const newPoints = Number(user.points) + data.amount;
        await tx
          .update(users)
          .set({ points: newPoints })
          .where(eq(users.id, data.userId));
      }

      return transaction;
    });
  }

  async getUserPointHistory(userId: string): Promise<PointTransaction[]> {
    return await db
      .select()
      .from(pointTransactions)
      .where(eq(pointTransactions.userId, userId))
      .orderBy(desc(pointTransactions.createdAt));
  }

  async assignPointsForTask(taskId: string, basePoints: number, penaltyPoints: number): Promise<void> {
    await db.transaction(async (tx) => {
      const [task] = await tx
        .select()
        .from(tasks)
        .where(eq(tasks.id, taskId));

      if (!task || !task.executorId) {
        throw new Error("Task not found or has no executor");
      }

      const [executor] = await tx
        .select()
        .from(users)
        .where(eq(users.id, task.executorId));

      if (!executor) {
        throw new Error("Executor not found");
      }

      const totalPoints = basePoints - penaltyPoints;

      await tx
        .update(tasks)
        .set({ assignedPoints: totalPoints })
        .where(eq(tasks.id, taskId));

      if (basePoints !== 0) {
        await tx.insert(pointTransactions).values({
          userId: executor.id,
          userName: executor.name,
          amount: basePoints,
          type: "task_completion",
          taskId: task.id,
          taskTitle: task.title,
          comment: `Базовые баллы за задачу "${task.title}"`,
        });
      }

      if (penaltyPoints > 0) {
        await tx.insert(pointTransactions).values({
          userId: executor.id,
          userName: executor.name,
          amount: -penaltyPoints,
          type: "overdue_penalty",
          taskId: task.id,
          taskTitle: task.title,
          comment: `Штраф за просрочку ${penaltyPoints} ч.`,
        });
      }

      const newPoints = Number(executor.points) + totalPoints;
      await tx
        .update(users)
        .set({ points: newPoints })
        .where(eq(users.id, executor.id));
    });
  }

  // Auction management
  async getActiveAuctions(filters?: { departmentId?: string }): Promise<Task[]> {
    const conditions: any[] = [
      inArray(tasks.type, ["UNIT", "DEPARTMENT"] as any),
      eq(tasks.status, "BACKLOG" as const),
    ];

    if (filters?.departmentId) {
      conditions.push(eq(tasks.departmentId, filters.departmentId));
    }

    return await db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(tasks.auctionPlannedEndAt);
  }

  async getAuctionsToClose(): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(
        and(
          inArray(tasks.type, ["UNIT", "DEPARTMENT"] as any),
          eq(tasks.status, "BACKLOG" as const),
          or(
            and(eq(tasks.auctionHasBids, true), sql`${tasks.auctionPlannedEndAt} <= NOW()`),
            and(
              eq(tasks.auctionHasBids, false),
              sql`${tasks.auctionPlannedEndAt} + interval '3 hours' <= NOW()`
            )
          )
        )
      );
  }

  async getReviewsToExpire(): Promise<Task[]> {
    return await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.status, "UNDER_REVIEW" as const),
          sql`${tasks.reviewDeadline} <= NOW() AND ${tasks.reviewDeadline} IS NOT NULL`
        )
      );
  }

  async closeAuction(
    taskId: string,
    options: { winnerId?: string; winnerName?: string; assignedValue?: number | null; mode: TaskMode; endAt?: Date }
  ): Promise<Task | undefined> {
    const { winnerId, winnerName, assignedValue, endAt, mode } = options;
    const updates: Partial<InsertTask> = {
      status: "IN_PROGRESS" as const,
      executorId: winnerId || null,
      executorName: winnerName || null,
      auctionWinnerId: winnerId || null,
      auctionWinnerName: winnerName || null,
      auctionEndAt: endAt ?? new Date(),
    };

    if (assignedValue !== undefined && assignedValue !== null) {
      if (mode === "TIME") {
        updates.earnedTimeMinutes = Math.round(assignedValue);
        updates.earnedMoney = null;
      } else {
        updates.earnedMoney = assignedValue.toFixed(2);
        updates.earnedTimeMinutes = null;
      }
    }

    const [task] = await db
      .update(tasks)
      .set(updates as any)
      .where(
        and(
          eq(tasks.id, taskId),
          inArray(tasks.type, ["UNIT", "DEPARTMENT"] as any),
          eq(tasks.status, "BACKLOG" as const)
        )
      )
      .returning();
    return task;
  }

  async getMonthlyMetrics(departmentId?: string): Promise<{
    completedTasksCount: number;
    closedAuctionsSum: string;
    activeAuctionsCount: number;
    backlogCount: number;
  }> {
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0));

    const baseConditions: any[] = [gte(tasks.updatedAt, startOfMonth)];
    if (departmentId) {
      baseConditions.push(eq(tasks.departmentId, departmentId));
    }

    const [completedRow] = await db
      .select({ value: sql<number>`count(*)` })
      .from(tasks)
      .where(and(...baseConditions, eq(tasks.status, "DONE" as const)));

    const [sumRow] = await db
      .select({
        value: sql<string>`coalesce(sum(CASE WHEN ${tasks.auctionMode} = 'MONEY' THEN ${tasks.earnedMoney} ELSE 0 END), '0')`
      })
      .from(tasks)
      .where(and(...baseConditions, eq(tasks.status, "DONE" as const)));

    const activeConditions: any[] = [
      inArray(tasks.type, ["UNIT", "DEPARTMENT"] as any),
      inArray(tasks.status, ["BACKLOG", "IN_PROGRESS", "UNDER_REVIEW"] as any)
    ];
    if (departmentId) {
      activeConditions.push(eq(tasks.departmentId, departmentId));
    }

    const [activeRow] = await db
      .select({ value: sql<number>`count(*)` })
      .from(tasks)
      .where(and(...activeConditions));

    const backlogConditions: any[] = [eq(tasks.status, "BACKLOG" as const)];
    if (departmentId) {
      backlogConditions.push(eq(tasks.departmentId, departmentId));
    }

    const [backlogRow] = await db
      .select({ value: sql<number>`count(*)` })
      .from(tasks)
      .where(and(...backlogConditions));

    return {
      completedTasksCount: Number(completedRow?.value ?? 0),
      closedAuctionsSum: String(sumRow?.value ?? '0'),
      activeAuctionsCount: Number(activeRow?.value ?? 0),
      backlogCount: Number(backlogRow?.value ?? 0),
    };
  }

  async getEmployeeAnalytics(filters?: { departmentId?: string; managementId?: string; divisionId?: string }): Promise<any[]> {
    const conditions: any[] = [];
    if (filters?.departmentId) conditions.push(eq(users.departmentId, filters.departmentId));
    if (filters?.managementId) conditions.push(eq(users.managementId, filters.managementId));
    if (filters?.divisionId) conditions.push(eq(users.divisionId, filters.divisionId));

    const employees = await db.select().from(users).where(and(...conditions));

    const taskStats = await db
      .select({
        executorId: tasks.executorId,
        completedCount: sql<number>`count(CASE WHEN ${tasks.status} = 'DONE' THEN 1 END)`,
        earnedMoney: sql<string>`sum(CASE WHEN ${tasks.status} = 'DONE' AND ${tasks.auctionMode} = 'MONEY' THEN ${tasks.earnedMoney} ELSE 0 END)`,
        earnedTime: sql<number>`sum(CASE WHEN ${tasks.status} = 'DONE' AND ${tasks.auctionMode} = 'TIME' THEN ${tasks.earnedTimeMinutes} ELSE 0 END)`,
        assignedPoints: sql<number>`sum(CASE WHEN ${tasks.status} = 'DONE' THEN ${tasks.assignedPoints} ELSE 0 END)`
      })
      .from(tasks)
      .groupBy(tasks.executorId);

    const statsMap = new Map(taskStats.map(s => [s.executorId, s]));

    return employees.map(emp => {
      const stats = statsMap.get(emp.id);
      return {
        id: emp.id,
        name: emp.name,
        grade: emp.grade,
        points: Number(emp.points || 0),
        completedTasks: Number(stats?.completedCount || 0),
        earnedMoney: Number(stats?.earnedMoney || 0),
        earnedTime: Number(stats?.earnedTime || 0),
        earnedPoints: Number(stats?.assignedPoints || 0)
      };
    });
  }

  async getStructureAnalytics(filters?: { departmentId?: string }): Promise<any> {
    const conditions: any[] = [];
    if (filters?.departmentId) {
      conditions.push(eq(tasks.departmentId, filters.departmentId));
    }

    const divisionStats = await db
      .select({
        divisionId: tasks.divisionId,
        totalTasks: sql<number>`count(*)`,
        completedTasks: sql<number>`count(CASE WHEN ${tasks.status} = 'DONE' THEN 1 END)`,
        totalMoney: sql<string>`sum(CASE WHEN ${tasks.status} = 'DONE' AND ${tasks.auctionMode} = 'MONEY' THEN ${tasks.earnedMoney} ELSE 0 END)`,
      })
      .from(tasks)
      .where(and(...conditions, sql`${tasks.divisionId} IS NOT NULL`))
      .groupBy(tasks.divisionId);

    const managementStats = await db
      .select({
        managementId: tasks.managementId,
        totalTasks: sql<number>`count(*)`,
        completedTasks: sql<number>`count(CASE WHEN ${tasks.status} = 'DONE' THEN 1 END)`,
        totalMoney: sql<string>`sum(CASE WHEN ${tasks.status} = 'DONE' AND ${tasks.auctionMode} = 'MONEY' THEN ${tasks.earnedMoney} ELSE 0 END)`,
      })
      .from(tasks)
      .where(and(...conditions, sql`${tasks.managementId} IS NOT NULL`))
      .groupBy(tasks.managementId);

    return {
      divisions: divisionStats,
      managements: managementStats
    };
  }

  // Task Attachments
  async getTaskAttachments(taskId: string): Promise<TaskAttachment[]> {
    return await db
      .select()
      .from(taskAttachments)
      .where(and(eq(taskAttachments.taskId, taskId), isNull(taskAttachments.deletedAt)))
      .orderBy(desc(taskAttachments.createdAt));
  }

  async createTaskAttachment(data: InsertTaskAttachment): Promise<TaskAttachment> {
    const [attachment] = await db
      .insert(taskAttachments)
      .values(data as any)
      .returning();
    return attachment;
  }

  async deleteTaskAttachment(id: string): Promise<void> {
    await db
      .update(taskAttachments)
      .set({ deletedAt: new Date() })
      .where(eq(taskAttachments.id, id));
  }

  async getAttachmentCount(taskId: string): Promise<number> {
    const [result] = await db
      .select({ count: sql<number>`count(*)` })
      .from(taskAttachments)
      .where(and(eq(taskAttachments.taskId, taskId), isNull(taskAttachments.deletedAt)));
    return Number(result?.count ?? 0);
  }
}

export const storage = new DbStorage();
