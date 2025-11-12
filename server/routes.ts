import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateUser, hashPassword, verifyPassword } from "./auth";
import { z } from "zod";
import {
  loginSchema,
  insertUserSchema,
  changePasswordSchema,
  insertDepartmentSchema,
  insertManagementSchema,
  insertDivisionSchema,
  type Task,
  type AuctionBid,
  type Grade,
} from "@shared/schema";
import { getInitialPointsByPosition } from "@shared/utils";

// Authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || !req.session.user) {
    return res.status(401).json({ error: "Требуется авторизация" });
  }
  next();
}

// Authorization middleware for admin only
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Доступ только для администратора" });
  }
  next();
}

// Helper to check if user can modify a resource in a specific department
function canModifyDepartment(user: any, departmentId: string): boolean {
  if (user.role === "admin") return true;
  if (user.role === "director" && user.departmentId === departmentId) return true;
  return false;
}

const positionTypeSchema = z.enum([
  "director",
  "deputy",
  "management_head",
  "division_head",
  "senior",
  "employee",
]);

type PositionType = z.infer<typeof positionTypeSchema>;

const positionRoleMap: Record<PositionType, "director" | "manager" | "senior" | "employee"> = {
  director: "director",
  deputy: "manager",
  management_head: "manager",
  division_head: "manager",
  senior: "senior",
  employee: "employee",
};

const roleGradeMap: Record<"admin" | "director" | "manager" | "senior" | "employee", Grade> = {
  admin: "A",
  director: "A",
  manager: "B",
  senior: "C",
  employee: "D",
};

const gradePriority: Record<Grade, number> = { A: 4, B: 3, C: 2, D: 1 };

const positionGradeMap: Record<PositionType, Grade> = {
  director: "A",
  deputy: "A",
  management_head: "A",
  division_head: "B",
  senior: "C",
  employee: "D",
};

function hasGradeAccess(userGrade: Grade, minimum: Grade): boolean {
  return gradePriority[userGrade] >= gradePriority[minimum];
}

function getRoleGrade(role: "admin" | "director" | "manager" | "senior" | "employee"): Grade {
  return roleGradeMap[role];
}

const gradeSchema = z.enum(["A", "B", "C", "D"]);

const decimalNumberSchema = z
  .union([z.number(), z.string()])
  .transform((value) => {
    if (typeof value === "number") {
      return value;
    }
    const normalized = value.trim().replace(",", ".");
    return Number.parseFloat(normalized);
  })
  .pipe(z.number().positive("Значение должно быть больше нуля"));

function decimalToString(value: number): string {
  return value.toFixed(2);
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

function moveToNextWeekdayStart(date: Date): Date {
  const result = new Date(date);
  while (isWeekend(result)) {
    result.setDate(result.getDate() + 1);
    result.setHours(0, 0, 0, 0);
  }
  return result;
}

function calculateAuctionEnd(start: Date): Date {
  let current = new Date(start);
  let remaining = 24 * 60 * 60 * 1000; // 24 hours in ms

  if (Number.isNaN(current.getTime())) {
    return start;
  }

  while (remaining > 0) {
    if (isWeekend(current)) {
      current = moveToNextWeekdayStart(current);
      continue;
    }

    const dayEnd = new Date(current);
    dayEnd.setHours(24, 0, 0, 0);
    const available = dayEnd.getTime() - current.getTime();
    const consumed = Math.min(available, remaining);
    current = new Date(current.getTime() + consumed);
    remaining -= consumed;
  }

  return current;
}

function parseDecimal(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  const numeric = typeof value === "number" ? value : Number.parseFloat(String(value));
  if (!Number.isFinite(numeric)) {
    return null;
  }
  return numeric;
}

function calculateAuctionPrice(task: Task, now: Date = new Date()): number | null {
  if (!task.auctionInitialPrice || !task.auctionMaxPrice || !task.auctionStartAt || !task.auctionEndAt) {
    return null;
  }

  const start = new Date(task.auctionStartAt);
  const end = new Date(task.auctionEndAt);
  const initial = parseDecimal(task.auctionInitialPrice);
  const max = parseDecimal(task.auctionMaxPrice);

  if (!initial || !max || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start.getTime() === end.getTime()) {
    return null;
  }

  if (now <= start) {
    return initial;
  }

  if (now >= end) {
    return max;
  }

  const total = end.getTime() - start.getTime();
  const elapsed = now.getTime() - start.getTime();
  const progress = Math.min(Math.max(elapsed / total, 0), 1);
  return initial + (max - initial) * progress;
}

const dateInputSchema = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value : new Date(value)))
  .refine((value) => !Number.isNaN(value.getTime()), { message: "Некорректная дата" });

const createTaskSchema = z
  .object({
    title: z.string().min(1, "Введите название задачи"),
    description: z.string().min(1, "Введите описание задачи"),
    type: z.enum(["individual", "auction"]),
    deadline: dateInputSchema,
    estimatedHours: decimalNumberSchema,
    minimumGrade: gradeSchema.default("D"),
    assigneeId: z.string().min(1).optional(),
    departmentId: z.string().min(1, "Укажите департамент").optional(),
    auctionInitialPrice: decimalNumberSchema.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === "individual" && (!value.assigneeId || value.assigneeId.trim() === "")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["assigneeId"],
        message: "Выберите исполнителя",
      });
    }
    if (value.type === "auction" && value.auctionInitialPrice === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["auctionInitialPrice"],
        message: "Укажите стартовую ставку",
      });
    }
  });

const placeBidSchema = z.object({
  hours: decimalNumberSchema,
});

class PositionAssignmentError extends Error {}

async function resolveEmployeeAssignment(
  positionType: PositionType,
  data: { departmentId?: string | null; managementId?: string | null; divisionId?: string | null }
) {
  switch (positionType) {
    case "director":
    case "deputy": {
      const departmentId = data.departmentId;
      if (!departmentId) {
        throw new PositionAssignmentError("Укажите департамент для этой должности");
      }
      const department = await storage.getDepartment(departmentId);
      if (!department) {
        throw new PositionAssignmentError("Департамент не найден");
      }
      return {
        departmentId: department.id,
        managementId: null,
        divisionId: null,
        role: positionRoleMap[positionType],
        grade: positionGradeMap[positionType],
      } as const;
    }
    case "management_head": {
      const managementId = data.managementId;
      if (!managementId) {
        throw new PositionAssignmentError("Укажите управление для этой должности");
      }
      const management = await storage.getManagement(managementId);
      if (!management) {
        throw new PositionAssignmentError("Управление не найдено");
      }
      if (data.departmentId && data.departmentId !== management.departmentId) {
        throw new PositionAssignmentError("Управление относится к другому департаменту");
      }
      return {
        departmentId: management.departmentId,
        managementId: management.id,
        divisionId: null,
        role: positionRoleMap[positionType],
        grade: positionGradeMap[positionType],
      } as const;
    }
    case "division_head":
    case "senior":
    case "employee": {
      const divisionId = data.divisionId;
      if (!divisionId) {
        throw new PositionAssignmentError("Укажите отдел для этой должности");
      }
      const division = await storage.getDivision(divisionId);
      if (!division) {
        throw new PositionAssignmentError("Отдел не найден");
      }
      if (data.departmentId && data.departmentId !== division.departmentId) {
        throw new PositionAssignmentError("Отдел относится к другому департаменту");
      }
      if (data.managementId && data.managementId !== division.managementId) {
        throw new PositionAssignmentError("Отдел относится к другому управлению");
      }
      return {
        departmentId: division.departmentId,
        managementId: division.managementId,
        divisionId: division.id,
        role: positionRoleMap[positionType],
        grade: positionGradeMap[positionType],
      } as const;
    }
    default: {
      throw new PositionAssignmentError("Неизвестный тип должности");
    }
  }
}

const optionalEmailSchema = z
  .string()
  .trim()
  .email("Введите корректный email")
  .optional()
  .or(z.literal(""))
  .or(z.null())
  .transform((value) => {
    if (value === null) return null;
    if (value === undefined) return undefined;
    return value === "" ? undefined : value;
  });

const createEmployeeSchema = z.object({
  username: z.string().min(1, "Введите логин"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  name: z.string().min(1, "Введите имя"),
  email: optionalEmailSchema,
  departmentId: z.string().min(1, "Выберите департамент"),
  managementId: z.string().nullable().optional(),
  divisionId: z.string().nullable().optional(),
  positionType: positionTypeSchema,
});

const updateEmployeeSchema = z.object({
  name: z.string().min(1, "Введите имя").optional(),
  email: optionalEmailSchema,
  positionType: positionTypeSchema.optional(),
  departmentId: z.string().optional(),
  managementId: z.string().nullable().optional(),
  divisionId: z.string().nullable().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
  async function finalizeExpiredAuctions(departmentId?: string) {
    const filters: Parameters<typeof storage.getAllTasks>[0] = {
      type: "auction",
      status: "backlog",
    };

    if (departmentId) {
      filters.departmentId = departmentId;
    }

    const backlogAuctions = await storage.getAllTasks(filters);
    const now = new Date();

    for (const task of backlogAuctions) {
      if (!task.auctionEndAt) continue;
      const auctionEnd = new Date(task.auctionEndAt);
      if (Number.isNaN(auctionEnd.getTime()) || auctionEnd.getTime() > now.getTime()) {
        continue;
      }

      const bids = await storage.getTaskBids(task.id);

      if (bids.length === 0) {
        const departmentUsers = await storage.getAllUsers({ departmentId: task.departmentId });
        const director = departmentUsers.find((user) => user.role === "director");
        const assigneeId = director?.id ?? task.creatorId;
        const assigneeName = director?.name ?? task.creatorName;
        await storage.updateTask(task.id, {
          status: "inProgress" as any,
          assigneeId,
          assigneeName,
          auctionWinnerId: assigneeId,
          auctionWinnerName: assigneeName,
          auctionAssignedPrice: task.auctionMaxPrice ?? task.auctionInitialPrice ?? null,
        });
      } else {
        const winningBid = bids.reduce((best, bid) => {
          const bestValue = parseDecimal(best.hours) ?? Number.POSITIVE_INFINITY;
          const currentValue = parseDecimal(bid.hours) ?? Number.POSITIVE_INFINITY;
          return currentValue < bestValue ? bid : best;
        }, bids[0] as AuctionBid);

        await storage.updateTask(task.id, {
          status: "inProgress" as any,
          assigneeId: winningBid.bidderId,
          assigneeName: winningBid.bidderName,
          auctionWinnerId: winningBid.bidderId,
          auctionWinnerName: winningBid.bidderName,
          auctionAssignedPrice: winningBid.hours,
        });
      }
    }
  }

  // Get all departments
  app.get("/api/departments", requireAuth, async (req, res) => {
    try {
      const allDepartments = await storage.getAllDepartments();
      res.json(allDepartments);
    } catch (error) {
      res.status(500).json({ error: "Не удалось получить список департаментов" });
    }
  });

  // Get all managements (optionally filtered by department)
  app.get("/api/managements", requireAuth, async (req, res) => {
    try {
      const { departmentId } = req.query;
      const allManagements = await storage.getAllManagements(
        departmentId ? { departmentId: departmentId as string } : undefined
      );
      res.json(allManagements);
    } catch (error) {
      res.status(500).json({ error: "Не удалось получить список управлений" });
    }
  });

  // Get all divisions (optionally filtered by management or department)
  app.get("/api/divisions", requireAuth, async (req, res) => {
    try {
      const { managementId, departmentId } = req.query;
      const filters: { managementId?: string; departmentId?: string } = {};
      
      if (managementId) filters.managementId = managementId as string;
      if (departmentId) filters.departmentId = departmentId as string;
      
      const allDivisions = await storage.getAllDivisions(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(allDivisions);
    } catch (error) {
      res.status(500).json({ error: "Не удалось получить список подразделений" });
    }
  });

  // Create department (admin only)
  app.post("/api/departments", requireAuth, requireAdmin, async (req, res) => {
    try {
      const parsed = insertDepartmentSchema.parse(req.body);
      const newDepartment = await storage.createDepartment(parsed);
      res.status(201).json(newDepartment);
    } catch (error) {
      res.status(400).json({ error: "Ошибка при создании департамента" });
    }
  });

  // Update department (admin or director of that department)
  app.patch("/api/departments/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getDepartment(id);
      
      if (!existing) {
        return res.status(404).json({ error: "Департамент не найден" });
      }
      
      // Check authorization using ACTUAL departmentId from DB
      if (!canModifyDepartment(req.session.user, existing.id)) {
        return res.status(403).json({ error: "Недостаточно прав для изменения департамента" });
      }
      
      const updated = await storage.updateDepartment(id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Ошибка при обновлении департамента" });
    }
  });

  // Create management (admin or director of that department)
  app.post("/api/managements", requireAuth, async (req, res) => {
    try {
      const parsed = insertManagementSchema.parse(req.body);
      
      // Check authorization - must be able to modify the parent department
      if (!canModifyDepartment(req.session.user, parsed.departmentId)) {
        return res.status(403).json({ error: "Недостаточно прав для создания управления" });
      }
      
      const newManagement = await storage.createManagement(parsed);
      res.status(201).json(newManagement);
    } catch (error) {
      res.status(400).json({ error: "Ошибка при создании управления" });
    }
  });

  // Update management (admin or director of that department)
  app.patch("/api/managements/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getManagement(id);
      
      if (!existing) {
        return res.status(404).json({ error: "Управление не найдено" });
      }
      
      // Check authorization for current department
      if (!canModifyDepartment(req.session.user, existing.departmentId)) {
        return res.status(403).json({ error: "Недостаточно прав для изменения управления" });
      }
      
      // If trying to change departmentId, verify rights to new department too
      if (req.body.departmentId && req.body.departmentId !== existing.departmentId) {
        if (!canModifyDepartment(req.session.user, req.body.departmentId)) {
          return res.status(403).json({ error: "Недостаточно прав для перемещения управления в другой департамент" });
        }
      }
      
      const updated = await storage.updateManagement(id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Ошибка при обновлении управления" });
    }
  });

  // Create division (admin or director of that department)
  app.post("/api/divisions", requireAuth, async (req, res) => {
    try {
      const parsed = insertDivisionSchema.parse(req.body);
      
      // Check authorization - must be able to modify the parent department
      if (!canModifyDepartment(req.session.user, parsed.departmentId)) {
        return res.status(403).json({ error: "Недостаточно прав для создания подразделения" });
      }
      
      const newDivision = await storage.createDivision(parsed);
      res.status(201).json(newDivision);
    } catch (error) {
      res.status(400).json({ error: "Ошибка при создании подразделения" });
    }
  });

  // Update division (admin or director of that department)
  app.patch("/api/divisions/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getDivision(id);
      
      if (!existing) {
        return res.status(404).json({ error: "Подразделение не найдено" });
      }
      
      // Check authorization for current department
      if (!canModifyDepartment(req.session.user, existing.departmentId)) {
        return res.status(403).json({ error: "Недостаточно прав для изменения подразделения" });
      }
      
      // If trying to change departmentId, verify rights to new department too
      if (req.body.departmentId && req.body.departmentId !== existing.departmentId) {
        if (!canModifyDepartment(req.session.user, req.body.departmentId)) {
          return res.status(403).json({ error: "Недостаточно прав для перемещения подразделения в другой департамент" });
        }
      }
      
      const updated = await storage.updateDivision(id, req.body);
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Ошибка при обновлении подразделения" });
    }
  });

  // Get all users (employees) - optionally filtered
  app.get("/api/employees", requireAuth, async (req, res) => {
    try {
      const { divisionId, managementId, departmentId } = req.query;
      const filters: { divisionId?: string; managementId?: string; departmentId?: string } = {};

      if (typeof divisionId === "string" && divisionId) filters.divisionId = divisionId;
      if (typeof managementId === "string" && managementId) filters.managementId = managementId;
      if (typeof departmentId === "string" && departmentId) filters.departmentId = departmentId;

      const currentUser = req.session.user;
      if (currentUser && currentUser.role !== "admin") {
        if (!currentUser.departmentId) {
          return res.json([]);
        }
        if (filters.departmentId && filters.departmentId !== currentUser.departmentId) {
          return res.status(403).json({ error: "Недостаточно прав для выбранного департамента" });
        }
        filters.departmentId = currentUser.departmentId;
      }

      const allUsers = await storage.getAllUsers(Object.keys(filters).length > 0 ? filters : undefined);
      const safeUsers = allUsers.map(({ passwordHash, ...user }) => user);
      res.json(safeUsers);
    } catch (error) {
      res.status(500).json({ error: "Не удалось получить список сотрудников" });
    }
  });

  app.post("/api/employees", requireAuth, async (req, res) => {
    try {
      const parsed = createEmployeeSchema.parse(req.body);
      const assignment = await resolveEmployeeAssignment(parsed.positionType, {
        departmentId: parsed.departmentId,
        managementId: parsed.managementId ?? null,
        divisionId: parsed.divisionId ?? null,
      });

      if (!canModifyDepartment(req.session.user, assignment.departmentId)) {
        return res.status(403).json({ error: "Недостаточно прав для добавления сотрудника" });
      }

      const uniquePositions: PositionType[] = ["director", "deputy", "management_head", "division_head"];
      if (uniquePositions.includes(parsed.positionType)) {
        const employees = await storage.getAllUsers({ departmentId: assignment.departmentId });
        const isTaken = employees.some((emp) => {
          if (parsed.positionType === "director") {
            return emp.role === "director" && !emp.managementId && !emp.divisionId;
          }
          if (parsed.positionType === "deputy") {
            return emp.role === "manager" && !emp.managementId && !emp.divisionId;
          }
          if (parsed.positionType === "management_head") {
            return emp.role === "manager" && emp.managementId === assignment.managementId && !emp.divisionId;
          }
          if (parsed.positionType === "division_head") {
            return emp.role === "manager" && emp.divisionId === assignment.divisionId;
          }
          return false;
        });

        if (isTaken) {
          return res.status(400).json({ error: "Эта должность уже занята" });
        }
      }

      const passwordHash = await hashPassword(parsed.password);
      const user = await storage.createUser(
        parsed.username,
        passwordHash,
        parsed.name,
        parsed.email ?? null,
        assignment.role,
        assignment.grade,
        assignment.departmentId,
        assignment.managementId,
        assignment.divisionId,
        true
      );

      // Assign starting points for the position
      // Map PositionType to getInitialPointsByPosition keys
      const positionKeyMap: Record<PositionType, string> = {
        director: "department_director",
        deputy: "department_deputy",
        management_head: "management_head",
        division_head: "division_head",
        senior: "division_senior",
        employee: "division_employee",
      };
      const positionKey = positionKeyMap[parsed.positionType];
      const startingPoints = getInitialPointsByPosition(positionKey);
      
      const positionLabels: Record<PositionType, string> = {
        director: "Директор",
        deputy: "Заместитель",
        management_head: "Руководитель управления",
        division_head: "Руководитель отдела",
        senior: "Старший сотрудник",
        employee: "Сотрудник",
      };
      const positionLabel = positionLabels[parsed.positionType];
      
      try {
        await storage.createPointTransaction({
          userId: user.id,
          userName: user.name,
          amount: startingPoints,
          type: "position_assigned",
          taskId: null,
          taskTitle: null,
          comment: `Назначена должность: ${positionLabel} (${startingPoints} баллов)`,
        });
      } catch (error) {
        // Rollback user creation if point transaction fails
        await storage.deleteUser(user.id);
        throw error;
      }

      // Fetch updated user with correct points after transaction
      const updatedUser = await storage.getUserById(user.id);
      if (!updatedUser) {
        throw new Error("Failed to fetch updated user");
      }
      
      const { passwordHash: _, ...userWithoutPassword } = updatedUser;
      res.status(201).json(userWithoutPassword);
    } catch (error: any) {
      if (error instanceof PositionAssignmentError) {
        return res.status(400).json({ error: error.message });
      }
      if (error?.code === "23505") {
        return res.status(400).json({ error: "Имя пользователя или email уже используется" });
      }
      res.status(400).json({ error: "Не удалось создать сотрудника" });
    }
  });

  app.patch("/api/employees/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const parsed = updateEmployeeSchema.parse(req.body);
      const employee = await storage.getUserById(id);

      if (!employee) {
        return res.status(404).json({ error: "Сотрудник не найден" });
      }

      if (employee.role === "admin") {
        return res.status(400).json({ error: "Нельзя изменять данные администратора" });
      }

      if (employee.departmentId && !canModifyDepartment(req.session.user, employee.departmentId)) {
        return res.status(403).json({ error: "Недостаточно прав для изменения сотрудника" });
      }

      const updates: {
        name?: string;
        email?: string | null;
        role?: "admin" | "director" | "manager" | "senior" | "employee";
        grade?: Grade;
        departmentId?: string | null;
        managementId?: string | null;
        divisionId?: string | null;
      } = {};

      if (parsed.name !== undefined) updates.name = parsed.name;
      if (parsed.email !== undefined) updates.email = parsed.email ?? null;

      if (parsed.positionType) {
        const assignment = await resolveEmployeeAssignment(parsed.positionType, {
          departmentId: parsed.departmentId ?? employee.departmentId,
          managementId: parsed.managementId ?? employee.managementId,
          divisionId: parsed.divisionId ?? employee.divisionId,
        });

        if (!canModifyDepartment(req.session.user, assignment.departmentId)) {
          return res.status(403).json({ error: "Недостаточно прав для изменения сотрудника" });
        }

        const uniquePositions: PositionType[] = ["director", "deputy", "management_head", "division_head"];
        if (uniquePositions.includes(parsed.positionType)) {
          const employees = await storage.getAllUsers({ departmentId: assignment.departmentId });
          const isTaken = employees.some((emp) => {
            if (emp.id === id) return false;
            if (parsed.positionType === "director") {
              return emp.role === "director" && !emp.managementId && !emp.divisionId;
            }
            if (parsed.positionType === "deputy") {
              return emp.role === "manager" && !emp.managementId && !emp.divisionId;
            }
            if (parsed.positionType === "management_head") {
              return emp.role === "manager" && emp.managementId === assignment.managementId && !emp.divisionId;
            }
            if (parsed.positionType === "division_head") {
              return emp.role === "manager" && emp.divisionId === assignment.divisionId;
            }
            return false;
          });

          if (isTaken) {
            return res.status(400).json({ error: "Эта должность уже занята" });
          }
        }

        updates.role = assignment.role;
        updates.grade = assignment.grade;
        updates.departmentId = assignment.departmentId;
        updates.managementId = assignment.managementId;
        updates.divisionId = assignment.divisionId;
      } else {
        if (parsed.departmentId !== undefined) {
          if (!canModifyDepartment(req.session.user, parsed.departmentId)) {
            return res.status(403).json({ error: "Недостаточно прав для изменения сотрудника" });
          }
          updates.departmentId = parsed.departmentId;
        }
        if (parsed.managementId !== undefined) updates.managementId = parsed.managementId;
        if (parsed.divisionId !== undefined) updates.divisionId = parsed.divisionId;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ error: "Нет данных для обновления" });
      }

      const updated = await storage.updateUser(id, updates);
      if (!updated) {
        return res.status(404).json({ error: "Сотрудник не найден" });
      }

      const { passwordHash: _, ...userWithoutPassword } = updated;
      res.json(userWithoutPassword);
    } catch (error) {
      if (error instanceof PositionAssignmentError) {
        return res.status(400).json({ error: error.message });
      }
      res.status(400).json({ error: "Не удалось обновить сотрудника" });
    }
  });

  app.delete("/api/employees/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const employee = await storage.getUserById(id);

      if (!employee) {
        return res.status(404).json({ error: "Сотрудник не найден" });
      }

      if (employee.role === "admin") {
        return res.status(400).json({ error: "Нельзя удалить администратора" });
      }

      if (employee.departmentId && !canModifyDepartment(req.session.user, employee.departmentId)) {
        return res.status(403).json({ error: "Недостаточно прав для удаления сотрудника" });
      }

      await storage.deleteUser(id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Не удалось удалить сотрудника" });
    }
  });

  app.get("/api/dashboard/overview", requireAuth, async (req, res) => {
    try {
      const currentUser = req.session.user;
      if (!currentUser) {
        return res.status(401).json({ error: "Требуется авторизация" });
      }

      const emptyMetrics = {
        completedTasks: { value: 0, hasData: false },
        totalHours: { value: 0, hasData: false },
        activeAuctions: { value: 0, hasData: false },
        backlogTasks: { value: 0, hasData: false },
      } as const;

      const { departmentId: queryDepartmentId } = req.query;
      let departmentId =
        typeof queryDepartmentId === "string" && queryDepartmentId.trim() !== ""
          ? queryDepartmentId
          : undefined;

      if (currentUser.role !== "admin") {
        if (!currentUser.departmentId) {
          return res.json({ metrics: emptyMetrics, highlightTasks: [] });
        }
        if (departmentId && departmentId !== currentUser.departmentId) {
          return res.status(403).json({ error: "Недостаточно прав для выбранного департамента" });
        }
        departmentId = currentUser.departmentId;
      }

      const metrics = await storage.getDashboardMetrics({ departmentId: departmentId ?? null });
      const highlightTasks = await storage.getHighlightedTasks({
        departmentId: departmentId ?? null,
        limit: 6,
        recentDays: 14,
      });

      res.json({ metrics, highlightTasks });
    } catch (error) {
      console.error("Ошибка при получении данных панели:", error);
      res.status(500).json({ error: "Не удалось получить данные панели" });
    }
  });

  // Get all tasks (with filtering)
  app.post("/api/tasks", requireAuth, async (req, res) => {
    try {
      const currentUser = req.session.user!;
      const parsed = createTaskSchema.parse(req.body);

      let departmentId = parsed.departmentId ?? currentUser.departmentId ?? undefined;

      if (!departmentId) {
        return res.status(400).json({ error: "Укажите департамент для задачи" });
      }

      const department = await storage.getDepartment(departmentId);
      if (!department) {
        return res.status(404).json({ error: "Департамент не найден" });
      }

      if (currentUser.role !== "admin") {
        if (currentUser.role !== "director" || currentUser.departmentId !== departmentId) {
          return res.status(403).json({ error: "Создавать задачи может только директор департамента" });
        }
      }

      const taskData: any = {
        title: parsed.title,
        description: parsed.description,
        type: parsed.type,
        status: "backlog",
        departmentId,
        managementId: null,
        divisionId: null,
        creatorId: currentUser.id,
        creatorName: currentUser.name,
        assigneeId: null,
        assigneeName: null,
        minimumGrade: parsed.minimumGrade,
        deadline: parsed.deadline,
        estimatedHours: decimalToString(parsed.estimatedHours),
        actualHours: null,
        rating: null,
        auctionStartAt: null,
        auctionEndAt: null,
        auctionInitialPrice: null,
        auctionMaxPrice: null,
        auctionAssignedPrice: null,
        auctionWinnerId: null,
        auctionWinnerName: null,
      } satisfies Partial<Task>;

      if (parsed.type === "individual") {
        const assignee = parsed.assigneeId ? await storage.getUserById(parsed.assigneeId) : null;
        if (!assignee || assignee.departmentId !== departmentId) {
          return res.status(400).json({ error: "Исполнитель не найден или относится к другому департаменту" });
        }

        const assigneeGrade = assignee.grade ?? getRoleGrade(assignee.role);
        if (!hasGradeAccess(assigneeGrade, parsed.minimumGrade)) {
          return res.status(400).json({ error: "Грейд исполнителя ниже минимального для задачи" });
        }

        taskData.assigneeId = assignee.id;
        taskData.assigneeName = assignee.name;
      } else {
        const startAt = new Date();
        const initialPrice = parsed.auctionInitialPrice!;
        const endAt = calculateAuctionEnd(startAt);
        taskData.auctionStartAt = startAt;
        taskData.auctionEndAt = endAt;
        taskData.auctionInitialPrice = decimalToString(initialPrice);
        taskData.auctionMaxPrice = decimalToString(initialPrice * 1.5);
      }

      const created = await storage.createTask(taskData);
      res.status(201).json(created);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
      }
      console.error("Ошибка при создании задачи:", error);
      res.status(500).json({ error: "Не удалось создать задачу" });
    }
  });

  app.get("/api/tasks", requireAuth, async (req, res) => {
    try {
      const currentUser = req.session.user!;
      const {
        departmentId: departmentIdQuery,
        managementId,
        divisionId,
        status,
        type,
        search,
        assigneeId,
        participantId,
      } = req.query;

      let departmentId =
        typeof departmentIdQuery === "string" && departmentIdQuery.trim() !== ""
          ? departmentIdQuery
          : undefined;

      if (currentUser.role !== "admin") {
        if (!currentUser.departmentId) {
          return res.status(403).json({ error: "Недостаточно прав для просмотра задач" });
        }
        if (departmentId && departmentId !== currentUser.departmentId) {
          return res.status(403).json({ error: "Недостаточно прав для выбранного департамента" });
        }
        departmentId = currentUser.departmentId;
      }

      await finalizeExpiredAuctions(departmentId);

      const filters: Parameters<typeof storage.getAllTasks>[0] = {};
      if (departmentId) filters.departmentId = departmentId;

      if (typeof managementId === "string" && managementId !== "" && managementId !== "all") {
        filters.managementId = managementId;
      }
      if (typeof divisionId === "string" && divisionId !== "" && divisionId !== "all") {
        filters.divisionId = divisionId;
      }
      if (typeof status === "string" && status !== "" && status !== "all") {
        filters.status = status;
      }
      if (typeof type === "string" && type !== "" && type !== "all") {
        filters.type = type;
      }
      if (typeof search === "string" && search.trim() !== "") {
        filters.search = search.trim();
      }
      if (typeof assigneeId === "string" && assigneeId !== "" && assigneeId !== "all") {
        filters.assigneeId = assigneeId;
      }
      if (typeof participantId === "string" && participantId !== "" && participantId !== "all") {
        filters.participantId = participantId;
      }

      const allTasks = await storage.getAllTasks(filters);
      const now = new Date();
      const tasksWithAuctionPrice = allTasks.map((task) => {
        const auctionPrice = calculateAuctionPrice(task, now);
        return auctionPrice !== null ? { ...task, auctionCurrentPrice: decimalToString(auctionPrice) } : task;
      });
      res.json(tasksWithAuctionPrice);
    } catch (error) {
      console.error("Ошибка при получении задач:", error);
      res.status(500).json({ error: "Не удалось получить задачи" });
    }
  });

  app.get("/api/my-tasks", requireAuth, async (req, res) => {
    try {
      const currentUser = req.session.user!;
      const tasks = await storage.getAllTasks({
        assigneeId: currentUser.id,
        orderBy: "updatedAt",
      });
      res.json(tasks);
    } catch (error) {
      console.error("Ошибка при получении личных задач:", error);
      res.status(500).json({ error: "Не удалось получить задачи" });
    }
  });

  // Get task by ID
  app.get("/api/tasks/:id", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const task = await storage.getTask(id);

      if (!task) {
        return res.status(404).json({ error: "Задача не найдена" });
      }

      const currentUser = req.session.user!;
      if (
        currentUser.role !== "admin" &&
        (!currentUser.departmentId || currentUser.departmentId !== task.departmentId)
      ) {
        return res.status(403).json({ error: "Недостаточно прав для просмотра задачи" });
      }

      const price = calculateAuctionPrice(task);
      const response = price !== null ? { ...task, auctionCurrentPrice: decimalToString(price) } : task;

      res.json(response);
    } catch (error) {
      res.status(500).json({ error: "Не удалось получить задачу" });
    }
  });

  app.patch("/api/tasks/:id/status", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, comment } = req.body as { status?: string; comment?: string };
      const allowedStatuses = ["backlog", "inProgress", "underReview", "completed"] as const;

      if (!status || !allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
        return res.status(400).json({ error: "Некорректный статус задачи" });
      }

      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ error: "Задача не найдена" });
      }

      const currentUser = req.session.user!;
      const targetStatus = status as Task["status"];
      const currentStatus = task.status as Task["status"];
      const commentText = typeof comment === "string" ? comment.trim() : "";

      if (currentStatus === targetStatus) {
        return res.json(task);
      }

      const transitions: Record<string, Task["status"][]> = {
        backlog: ["inProgress"],
        inProgress: ["underReview"],
        underReview: ["completed", "inProgress"],
        completed: [],
        overdue: ["inProgress"],
      };

      const available = transitions[currentStatus] ?? [];
      if (!available.includes(targetStatus)) {
        return res.status(400).json({ error: "Недопустимое изменение статуса" });
      }

      const isAdmin = currentUser.role === "admin";
      const isDirector = currentUser.role === "director" && currentUser.departmentId === task.departmentId;
      const isAssignee = task.assigneeId === currentUser.id;

      if (targetStatus === "inProgress") {
        if (currentStatus === "backlog" || currentStatus === "overdue") {
          if (!task.assigneeId) {
            return res.status(400).json({ error: "Задача должна иметь исполнителя" });
          }
          if (!(isAssignee || isDirector || isAdmin)) {
            return res.status(403).json({ error: "Только исполнитель или директор могут начать задачу" });
          }
        } else if (currentStatus === "underReview") {
          if (!(isDirector || isAdmin)) {
            return res.status(403).json({ error: "Только директор может вернуть задачу на доработку" });
          }
          if (!commentText) {
            return res.status(400).json({ error: "Добавьте комментарий при возврате задачи" });
          }
        }
      }

      if (targetStatus === "underReview" && !isAssignee && !isAdmin) {
        return res.status(403).json({ error: "Только исполнитель может отправить задачу на проверку" });
      }

      if (targetStatus === "completed" && !(isDirector || isAdmin)) {
        return res.status(403).json({ error: "Только директор департамента может завершить задачу" });
      }

      if (
        currentStatus === "underReview" &&
        targetStatus === "inProgress" &&
        commentText
      ) {
        await storage.addTaskComment({
          taskId: task.id,
          authorId: currentUser.id,
          authorName: currentUser.name,
          content: commentText,
        });
      }

      const updated = await storage.updateTask(id, { status: targetStatus as any });
      if (!updated) {
        return res.status(404).json({ error: "Задача не найдена" });
      }

      // Apply overdue penalty if task is completed/underReview past deadline
      // Only apply once - check if penalty already exists for this task
      if ((status === "completed" || status === "underReview") && task.assigneeId && task.deadline) {
        const hasPenalty = await storage.hasOverduePenalty(task.id);
        
        if (!hasPenalty) {
          const { calculateOverdueDays } = await import("@shared/utils");
          const overdueDays = calculateOverdueDays(new Date(task.deadline), new Date());
          
          if (overdueDays > 0) {
            const assignee = await storage.getUserById(task.assigneeId);
            if (assignee) {
              const penaltyPoints = overdueDays * -2;
              await storage.createPointTransaction({
                userId: task.assigneeId,
                userName: assignee.name,
                amount: penaltyPoints,
                type: "overdue_penalty",
                taskId: task.id,
                comment: `Штраф за просрочку задачи "${task.title}" на ${overdueDays} ${overdueDays === 1 ? 'день' : overdueDays < 5 ? 'дня' : 'дней'}`,
              });
            }
          }
        }
      }

      res.json(updated);
    } catch (error) {
      console.error("Ошибка при обновлении статуса задачи:", error);
      res.status(500).json({ error: "Не удалось обновить статус задачи" });
    }
  });

  // Get auction bids for a task
  app.get("/api/tasks/:id/bids", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ error: "Задача не найдена" });
      }

      const currentUser = req.session.user!;
      if (
        currentUser.role !== "admin" &&
        (!currentUser.departmentId || currentUser.departmentId !== task.departmentId)
      ) {
        return res.status(403).json({ error: "Недостаточно прав для просмотра ставок" });
      }

      const bids = await storage.getTaskBids(id);
      res.json(bids);
    } catch (error) {
      res.status(500).json({ error: "Не удалось получить ставки" });
    }
  });

  app.post("/api/tasks/:id/bids", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      let task = await storage.getTask(id);

      if (!task) {
        return res.status(404).json({ error: "Задача не найдена" });
      }

      const currentUser = req.session.user!;
      if (
        currentUser.role !== "admin" &&
        (!currentUser.departmentId || currentUser.departmentId !== task.departmentId)
      ) {
        return res.status(403).json({ error: "Недостаточно прав для участия в аукционе" });
      }

      await finalizeExpiredAuctions(task.departmentId);
      const refreshedTask = await storage.getTask(id);
      if (!refreshedTask || refreshedTask.status !== "backlog" || refreshedTask.type !== "auction") {
        return res.status(400).json({ error: "Аукцион уже завершён" });
      }

      task = refreshedTask;

      const userGrade: Grade = (currentUser.grade as Grade) ?? getRoleGrade(currentUser.role);
      const minimumGrade = task.minimumGrade as Grade;
      if (!hasGradeAccess(userGrade, minimumGrade)) {
        return res.status(403).json({ error: "Ваш грейд не допускает участие в этом аукционе" });
      }

      const parsed = placeBidSchema.parse(req.body);
      const auctionPrice = calculateAuctionPrice(task);
      if (auctionPrice === null) {
        return res.status(400).json({ error: "Ставки недоступны для этой задачи" });
      }

      if (parsed.hours > auctionPrice) {
        return res.status(400).json({ error: "Ставка должна быть не выше текущей цены" });
      }

      const existingBids = await storage.getTaskBids(id);
      const currentBest = existingBids.reduce((best, bid) => {
        const value = parseDecimal(bid.hours) ?? Number.POSITIVE_INFINITY;
        return value < best ? value : best;
      }, Number.POSITIVE_INFINITY);

      if (currentBest !== Number.POSITIVE_INFINITY && parsed.hours > currentBest) {
        return res.status(400).json({ error: "Есть более выгодная ставка" });
      }

      const bidRecord = await storage.createBid({
        taskId: task.id,
        bidderId: currentUser.id,
        bidderName: currentUser.name,
        bidderRating: (currentUser.rating as string | null) ?? "0",
        hours: decimalToString(parsed.hours),
      });

      res.status(201).json(bidRecord);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
      }
      console.error("Ошибка при создании ставки:", error);
      res.status(500).json({ error: "Не удалось разместить ставку" });
    }
  });

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const credentials = loginSchema.parse(req.body);
      const user = await authenticateUser(storage, credentials);
      
      if (!user) {
        return res.status(401).json({ error: "Неверное имя пользователя или пароль" });
      }
      
      const { passwordHash, ...userWithoutPassword } = user;
      req.session.userId = user.id;
      req.session.user = userWithoutPassword;
      
      // Explicitly save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("Ошибка сохранения сессии:", err);
          return res.status(500).json({ error: "Не удалось сохранить сессию" });
        }
        res.json({ user: userWithoutPassword });
      });
    } catch (error) {
      res.status(400).json({ error: "Некорректный запрос" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Не удалось завершить сеанс" });
      }
      res.json({ success: true });
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (req.session.userId && req.session.user) {
      res.json({ user: req.session.user });
    } else {
      res.json({ user: null });
    }
  });

  app.post("/api/auth/change-password", requireAuth, async (req, res) => {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Некорректные данные формы" });
    }

    try {
      const userId = req.session.userId!;
      const user = await storage.getUserById(userId);

      if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }

      const { currentPassword, newPassword } = parsed.data;
      const isValid = await verifyPassword(currentPassword, user.passwordHash);

      if (!isValid) {
        return res.status(400).json({ error: "Неверный текущий пароль" });
      }

      const newHash = await hashPassword(newPassword);
      const updatedUser = await storage.updateUser(userId, { passwordHash: newHash, mustChangePassword: false });

      if (!updatedUser) {
        return res.status(500).json({ error: "Не удалось обновить пароль" });
      }

      const { passwordHash: _, ...userWithoutPassword } = updatedUser;
      req.session.user = userWithoutPassword;

      res.json({ user: userWithoutPassword });
    } catch (error) {
      console.error("Ошибка при смене пароля:", error);
      res.status(500).json({ error: "Не удалось обновить пароль" });
    }
  });

  // User management routes (for admin panel)
  app.get("/api/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithoutPasswords = users.map(({ passwordHash, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Не удалось получить список пользователей" });
    }
  });

  app.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const passwordHash = await hashPassword(userData.password);
      
      const role = userData.role || "employee";
      const grade = getRoleGrade(role);

      const user = await storage.createUser(
        userData.username,
        passwordHash,
        userData.name,
        userData.email ?? null,
        role,
        grade,
        userData.departmentId || null,
        userData.managementId || null,
        userData.divisionId || null,
        true
      );
      
      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "Имя пользователя или email уже используется" });
      }
      res.status(400).json({ error: "Не удалось создать пользователя" });
    }
  });

  app.patch("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = { ...req.body };

      if (Object.prototype.hasOwnProperty.call(updates, "email")) {
        if (typeof updates.email === "string") {
          updates.email = updates.email.trim() || null;
        } else if (updates.email === "" || updates.email === undefined) {
          updates.email = null;
        }
      }

      if (typeof updates.role === "string") {
        updates.grade = getRoleGrade(updates.role as any);
      }

      const user = await storage.updateUser(id, updates);
      
      if (!user) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }
      
      const { passwordHash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Не удалось обновить пользователя" });
    }
  });

  // Point Transactions endpoints
  app.post("/api/tasks/:id/assign-points", requireAuth, async (req, res) => {
    try {
      const { id: taskId } = req.params;
      const { points, comment } = req.body;
      const user = req.session.user!;

      // Validation
      if (!points || typeof points !== "number" || points <= 0 || !Number.isFinite(points)) {
        return res.status(400).json({ error: "Баллы должны быть положительным числом" });
      }

      if (user.role !== "director" && user.role !== "admin") {
        return res.status(403).json({ error: "Только директор может назначать баллы" });
      }

      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Задача не найдена" });
      }

      if (!task.assigneeId) {
        return res.status(400).json({ error: "Задача не назначена исполнителю" });
      }

      if (task.status !== "completed") {
        return res.status(400).json({ error: "Баллы можно назначить только за выполненную задачу" });
      }

      if (task.assignedPoints !== null && task.assignedPoints !== undefined) {
        return res.status(400).json({ error: "Баллы уже назначены за эту задачу" });
      }

      if (user.role === "director" && task.departmentId !== user.departmentId) {
        return res.status(403).json({ error: "Нет доступа к этой задаче" });
      }

      const assignee = await storage.getUserById(task.assigneeId);
      if (!assignee) {
        return res.status(404).json({ error: "Исполнитель не найден" });
      }

      // Assign points atomically (DB transaction)
      await storage.assignPointsForTask(taskId, points, comment || null);

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Не удалось назначить баллы" });
    }
  });

  app.get("/api/users/:id/point-history", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const user = req.session.user!;

      // Authorization: only self, admin, or director of same department
      if (user.id !== id && user.role !== "admin") {
        if (user.role === "director") {
          const targetUser = await storage.getUserById(id);
          if (!targetUser || targetUser.departmentId !== user.departmentId) {
            return res.status(403).json({ error: "Нет доступа к истории баллов этого пользователя" });
          }
        } else {
          return res.status(403).json({ error: "Нет доступа к истории баллов этого пользователя" });
        }
      }

      const history = await storage.getUserPointHistory(id);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Не удалось получить историю баллов" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
