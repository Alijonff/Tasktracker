import { db } from "./db";
import { 
  departments, 
  managements, 
  divisions, 
  tasks, 
  auctionBids,
  users,
  type Department,
  type Management,
  type Division,
  type Task,
  type AuctionBid,
  type User,
  type InsertTask,
  type InsertBid,
  type InsertDepartment,
  type InsertManagement,
  type InsertDivision
} from "@shared/schema";
import { eq, and, or, like, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  createUser(
    username: string,
    passwordHash: string,
    name: string,
    email: string,
    role: "admin" | "director" | "manager" | "senior" | "employee",
    departmentId?: string | null,
    managementId?: string | null,
    divisionId?: string | null,
    mustChangePassword?: boolean,
  ): Promise<User>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserById(id: string): Promise<User | undefined>;
  getAllUsers(filters?: { divisionId?: string; managementId?: string; departmentId?: string }): Promise<User[]>;
  updateUser(
    id: string,
    updates: {
      name?: string;
      email?: string;
      role?: "admin" | "director" | "manager" | "senior" | "employee";
      departmentId?: string | null;
      managementId?: string | null;
      divisionId?: string | null;
      passwordHash?: string;
      mustChangePassword?: boolean;
    }
  ): Promise<User | undefined>;

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
    departmentId: string;
    managementId?: string;
    divisionId?: string;
    status?: string;
    type?: string;
    search?: string;
    assigneeId?: string;
  }): Promise<Task[]>;
  getTask(id: string): Promise<Task | undefined>;
  createTask(task: InsertTask): Promise<Task>;
  updateTask(id: string, updates: Partial<InsertTask>): Promise<Task | undefined>;

  // Auction Bids
  getTaskBids(taskId: string): Promise<AuctionBid[]>;
  createBid(bid: InsertBid): Promise<AuctionBid>;
}

export class DbStorage implements IStorage {
  // Users
  async createUser(
    username: string,
    passwordHash: string,
    name: string,
    email: string,
    role: "admin" | "director" | "manager" | "senior" | "employee",
    departmentId?: string | null,
    managementId?: string | null,
    divisionId?: string | null,
    mustChangePassword?: boolean,
  ): Promise<User> {
    const [user] = await db.insert(users).values({
      username,
      passwordHash,
      name,
      email,
      role,
      departmentId: departmentId || null,
      managementId: managementId || null,
      divisionId: divisionId || null,
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
      email?: string;
      role?: "admin" | "director" | "manager" | "senior" | "employee";
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

  // Tasks
  async getAllTasks(filters: {
    departmentId: string;
    managementId?: string;
    divisionId?: string;
    status?: string;
    type?: string;
    search?: string;
    assigneeId?: string;
  }): Promise<Task[]> {
    let query = db.select().from(tasks);
    const conditions = [
      // Always filter by department for security
      eq(tasks.departmentId, filters.departmentId)
    ];
    
    if (filters.managementId) {
      conditions.push(eq(tasks.managementId, filters.managementId));
    }
    if (filters.divisionId) {
      conditions.push(eq(tasks.divisionId, filters.divisionId));
    }
    if (filters.status && filters.status !== "all") {
      conditions.push(eq(tasks.status, filters.status as any));
    }
    if (filters.type && filters.type !== "all") {
      conditions.push(eq(tasks.type, filters.type as any));
    }
    if (filters.assigneeId) {
      conditions.push(eq(tasks.assigneeId, filters.assigneeId));
    }
    if (filters.search) {
      conditions.push(
        or(
          like(tasks.title, `%${filters.search}%`),
          like(tasks.description, `%${filters.search}%`)
        )!
      );
    }
    
    query = query.where(and(...conditions)) as any;
    return await query.orderBy(desc(tasks.createdAt));
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
      .where(eq(auctionBids.taskId, taskId))
      .orderBy(auctionBids.hours);
  }

  async createBid(bidData: InsertBid): Promise<AuctionBid> {
    const [bid] = await db.insert(auctionBids).values(bidData as any).returning();
    return bid;
  }
}

export const storage = new DbStorage();
