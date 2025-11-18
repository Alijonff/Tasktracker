import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateUser, hashPassword, verifyPassword } from "./auth";
import {
  AUCTION_RANGE_MULTIPLIER,
  calculateAuctionPrice,
  calculateEarnedValue,
  calculateOverduePenaltyHours,
  compareBids,
  getAuctionBaseValue,
  getAuctionMaxValue,
  getBidValue,
  parseDecimal,
  resolveAuctionMode,
  selectWinningBid,
  shouldAutoAssignToCreator,
} from "./businessRules";
import { filterOutAdminBids, isAdminUser } from "./utils/bidFilters";
import { reassignTasksFromTerminatedEmployee } from "./services/employeeLifecycle";
import { z } from "zod";
import {
  loginSchema,
  insertUserSchema,
  changePasswordSchema,
  insertDepartmentSchema,
  insertManagementSchema,
  insertDivisionSchema,
  type Task,
  type Grade,
  type Department,
  type AuctionBid,
  type User,
} from "@shared/schema";
import {
  DEFAULT_TASK_METADATA,
  TASK_MODES,
  TASK_TYPES,
  normalizeTaskMode,
  normalizeTaskType,
  type TaskMetadata,
  type TaskMode,
  type TaskType,
} from "@shared/taskMetadata";
import { getTaskMetadata, setTaskMetadata } from "./taskMetadataStore";
import {
  getInitialPointsByPosition,
  getGradeByPosition,
  calculateGradeProgress,
  type PositionType,
} from "@shared/utils";
import multer from "multer";
import { Client } from "@replit/object-storage";

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
  if (user.positionType === "deputy" && user.departmentId === departmentId) return true;
  return false;
}

// Multer configuration for file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB max file size
    files: 1, // Only one file per request
  },
});

// Object Storage client for file storage
const objectStorageClient = new Client();

const positionTypeValues = [
  "admin",
  "director",
  "deputy",
  "management_head",
  "management_deputy",
  "division_head",
  "senior",
  "employee",
] as const satisfies readonly PositionType[];

const positionTypeSchema = z.enum(positionTypeValues);

const positionRoleMap: Record<PositionType, "director" | "manager" | "senior" | "employee"> = {
  admin: "director",
  director: "director",
  deputy: "manager",
  management_head: "manager",
  management_deputy: "manager",
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

const basePointsByGrade: Record<Grade, number> = {
  A: 30,
  B: 20,
  C: 15,
  D: 10,
};

const positionGradeMap: Record<PositionType, Grade> = {
  admin: "A",
  director: "A",
  deputy: "A",
  management_head: "A",
  management_deputy: "B",
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

function getBasePointsForTask(task: Task): number {
  const minimumGrade = (task.minimumGrade as Grade) ?? "D";
  return basePointsByGrade[minimumGrade] ?? basePointsByGrade.D;
}

const gradeSchema = z.enum(["A", "B", "C", "D"]);
const taskModeSchema = z.enum(TASK_MODES);
const taskTypeSchema = z.enum(TASK_TYPES);

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

function normalizeAuctionAmount(value: number, mode: TaskMode): number {
  if (mode === "TIME") {
    return Math.max(1, Math.round(value));
  }
  return value;
}

function resolveTaskMetadata(task: Task, fallback?: TaskMetadata): TaskMetadata {
  const stored = fallback ?? getTaskMetadata(task.id);
  return {
    mode: normalizeTaskMode((task as any).auctionMode ?? stored.mode ?? DEFAULT_TASK_METADATA.mode),
    taskType: normalizeTaskType(
      ((task as any).taskType ?? task.type ?? stored.taskType ?? DEFAULT_TASK_METADATA.taskType) as TaskType,
    ),
  };
}

function parseTaskAmount(value: unknown, mode: TaskMode): number | null {
  if (value === null || value === undefined) return null;
  if (mode === "TIME") {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    const parsed = Number.parseInt(String(value), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return parseDecimal(value as string);
}

function normalizeTaskResponse(task: Task, metadata?: TaskMetadata) {
  const resolvedMetadata = resolveTaskMetadata(task, metadata);
  const initial = getAuctionBaseValue(task, resolvedMetadata.mode);
  const max = getAuctionMaxValue(task, resolvedMetadata.mode);
  const assigned = parseTaskAmount(
    resolvedMetadata.mode === "TIME" ? task.earnedTimeMinutes : task.earnedMoney,
    resolvedMetadata.mode,
  );
  const currentAmount = calculateAuctionPrice(task, new Date(), resolvedMetadata.mode);

  return {
    ...task,
    mode: resolvedMetadata.mode,
    taskType: resolvedMetadata.taskType,
    auctionInitialAmount: initial,
    auctionMaxAmount: max,
    auctionAssignedAmount: assigned,
    auctionCurrentAmount: currentAmount,
  } as Task & TaskMetadata & {
    auctionInitialAmount?: number | null;
    auctionMaxAmount?: number | null;
    auctionAssignedAmount?: number | null;
    auctionCurrentAmount?: number | null;
  };
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
  const deadline = new Date(start);

  if (Number.isNaN(deadline.getTime())) {
    return start;
  }

  deadline.setDate(deadline.getDate() + 1);
  deadline.setHours(18, 0, 0, 0);

  return deadline;
}

function calculateReviewDeadline(start: Date): Date {
  let current = new Date(start);
  let remaining = 48 * 60 * 60 * 1000; // 48 hours in ms

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

const dateInputSchema = z
  .union([z.string(), z.date()])
  .transform((value) => (value instanceof Date ? value : new Date(value)))
  .refine((value) => !Number.isNaN(value.getTime()), { message: "Некорректная дата" });

const createTaskSchema = z
  .object({
    title: z.string().min(1, "Введите название задачи"),
    description: z.string().min(1, "Введите описание задачи"),
    type: taskTypeSchema.default(DEFAULT_TASK_METADATA.taskType),
    taskType: taskTypeSchema.default(DEFAULT_TASK_METADATA.taskType),
    mode: taskModeSchema.default(DEFAULT_TASK_METADATA.mode),
    deadline: dateInputSchema,
    minimumGrade: gradeSchema.default("D"),
    departmentId: z.string().min(1, "Укажите департамент").optional(),
    managementId: z.string().min(1, "Укажите управление").optional(),
    divisionId: z.string().min(1, "Укажите отдел").optional(),
    executorId: z.string().min(1, "Укажите исполнителя").optional(),
    auctionInitialSum: decimalNumberSchema,
  });

const placeBidSchema = z
  .object({
    valueMoney: decimalNumberSchema.optional(),
    valueTimeMinutes: z
      .union([z.string(), z.number()])
      .transform((value) => {
        if (typeof value === "number") return value;
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : NaN;
      })
      .pipe(z.number().int().positive("Значение должно быть больше нуля").optional()),
  })
  .refine((data) => data.valueMoney !== undefined || data.valueTimeMinutes !== undefined, {
    message: "Укажите значение ставки",
  });

const updateManagementDeputySchema = z.object({
  deputyId: z.string().min(1).nullable(),
});

async function findManagementByDeputyId(userId: string) {
  const managements = await storage.getAllManagements();
  return managements.find((management) => management.deputyId === userId) ?? null;
}

async function clearManagementDeputyAssignment(userId: string) {
  const management = await findManagementByDeputyId(userId);
  if (management) {
    await storage.updateManagement(management.id, { deputyId: null });
  }
}

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
        positionType,
      } as const;
    }
    case "management_head":
    case "management_deputy": {
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
        positionType,
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
        positionType,
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
  async function enhanceUserCapabilities(user: Omit<User, "passwordHash">) {
    let canCreateAuctions = false;

    if (user.role === "director" && user.departmentId) {
      canCreateAuctions = true;
    } else if (user.positionType === "deputy" && user.departmentId) {
      canCreateAuctions = true;
    }

    return { ...user, canCreateAuctions };
  }

  async function finalizeExpiredAuctions(departmentId?: string) {
    const backlogAuctions = await storage.getActiveAuctions(
      departmentId ? { departmentId } : undefined,
    );
    const now = new Date();

    for (const task of backlogAuctions) {
      const metadata = resolveTaskMetadata(task);
      if (metadata.taskType === "INDIVIDUAL") {
        continue;
      }
      if (!task.auctionPlannedEndAt) continue;
      const plannedEnd = new Date(task.auctionPlannedEndAt);
      if (Number.isNaN(plannedEnd.getTime())) {
        continue;
      }

      const closingTime = plannedEnd.getTime() + NO_BID_GRACE_HOURS * 60 * 60 * 1000;
      if (closingTime > now.getTime()) {
        continue;
      }

      const bids = await filterOutAdminBids(await storage.getTaskBids(task.id));

        if (bids.length === 0) {
          if (!shouldAutoAssignToCreator(task, now) || (await isAdminUser(task.creatorId))) {
            continue;
          }

          const assignedValue = calculateEarnedValue(task, null, metadata.mode, now);

          await storage.updateTask(task.id, {
            status: "IN_PROGRESS" as any,
            executorId: task.creatorId,
            executorName: task.creatorName,
            auctionWinnerId: task.creatorId,
            auctionWinnerName: task.creatorName,
            earnedMoney:
              metadata.mode === "MONEY" && assignedValue !== null && assignedValue !== undefined
                ? decimalToString(assignedValue)
                : null,
            earnedTimeMinutes:
              metadata.mode === "TIME" && assignedValue !== null ? Math.round(assignedValue) : null,
            auctionEndAt: now,
          });
        } else {
          const winningBid = selectWinningBid(bids, metadata.mode);
          if (!winningBid || (await isAdminUser(winningBid.bidderId))) {
            continue;
          }

          const assignedValue = calculateEarnedValue(task, winningBid, metadata.mode, now);
          const assignedSum = assignedValue ?? getAuctionMaxValue(task, metadata.mode);

        await storage.updateTask(task.id, {
          status: "IN_PROGRESS" as any,
          executorId: winningBid.bidderId,
          executorName: winningBid.bidderName,
          auctionWinnerId: winningBid.bidderId,
          auctionWinnerName: winningBid.bidderName,
          earnedMoney:
            metadata.mode === "MONEY" && assignedSum !== null && assignedSum !== undefined
              ? decimalToString(assignedSum)
              : null,
          earnedTimeMinutes:
            metadata.mode === "TIME" && assignedSum !== null ? Math.round(assignedSum) : null,
          auctionEndAt: now,
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

  app.put("/api/managements/:id/deputy", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const management = await storage.getManagement(id);

      if (!management) {
        return res.status(404).json({ error: "Управление не найдено" });
      }

      if (!canModifyDepartment(req.session.user, management.departmentId)) {
        return res.status(403).json({ error: "Недостаточно прав для изменения управления" });
      }

      const parsed = updateManagementDeputySchema.parse(req.body);

      if (!parsed.deputyId) {
        const updated = await storage.updateManagement(id, { deputyId: null });
        return res.json(updated ?? { ...management, deputyId: null });
      }

      const candidate = await storage.getUserById(parsed.deputyId);
      if (!candidate) {
        return res.status(404).json({ error: "Сотрудник не найден" });
      }

      if (candidate.departmentId !== management.departmentId) {
        return res.status(400).json({ error: "Сотрудник должен принадлежать этому департаменту" });
      }

      const departmentEmployees = await storage.getAllUsers({ departmentId: management.departmentId });
      const departmentManagements = await storage.getAllManagements({ departmentId: management.departmentId });

      const blockedUserIds = new Set<string>();
      for (const employee of departmentEmployees) {
        if (employee.role === "director") {
          blockedUserIds.add(employee.id);
        } else if (employee.role === "manager") {
          if (!employee.managementId && !employee.divisionId) {
            blockedUserIds.add(employee.id);
          } else if (employee.managementId && !employee.divisionId) {
            blockedUserIds.add(employee.id);
          } else if (employee.divisionId) {
            blockedUserIds.add(employee.id);
          }
        }
      }

      for (const deptManagement of departmentManagements) {
        if (deptManagement.deputyId) {
          blockedUserIds.add(deptManagement.deputyId);
        }
      }

      if (management.deputyId) {
        blockedUserIds.delete(management.deputyId);
      }

      if (blockedUserIds.has(parsed.deputyId)) {
        return res.status(409).json({ error: "Сотрудник уже занимает управленческую должность в этом департаменте" });
      }

      const updated = await storage.updateManagement(id, { deputyId: parsed.deputyId });
      res.json(updated);
    } catch (error) {
      res.status(400).json({ error: "Не удалось обновить заместителя управления" });
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

      if (parsed.managementId) {
        const management = await storage.getManagement(parsed.managementId);
        if (!management || management.departmentId !== parsed.departmentId) {
          return res.status(400).json({ error: "Управление не найдено в этом департаменте" });
        }
      }

      const newDivision = await storage.createDivision({
        ...parsed,
        managementId: parsed.managementId ?? null,
      });
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

  // Delete department (admin only)
  // NOTE: Basic implementation - checks managements, divisions, users, tasks
  // TODO: Add checks for bids, point transactions, and other dependencies
  // TODO: Implement transaction for race condition prevention
  // Production: Consider cascade deletes or soft deletes
  app.delete("/api/departments/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getDepartment(id);
      
      if (!existing) {
        return res.status(404).json({ error: "Департамент не найден" });
      }

      const managements = await storage.getAllManagements({ departmentId: id });
      if (managements.length > 0) {
        return res.status(409).json({ error: "Невозможно удалить департамент с управлениями" });
      }

      const divisions = await storage.getAllDivisions({ departmentId: id });
      if (divisions.length > 0) {
        return res.status(409).json({ error: "Невозможно удалить департамент с подразделениями" });
      }

      const users = await storage.getAllUsers({ departmentId: id });
      if (users.length > 0) {
        return res.status(409).json({ error: "Невозможно удалить департамент с сотрудниками" });
      }

      const tasks = await storage.getAllTasks({ departmentId: id });
      if (tasks.length > 0) {
        return res.status(409).json({ error: "Невозможно удалить департамент с задачами" });
      }

      await storage.deleteDepartment(id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Ошибка при удалении департамента" });
    }
  });

  // Delete management (admin only)
  // NOTE: Basic implementation - checks divisions, users, tasks
  // TODO: Add checks for bids, point transactions, and other dependencies
  // TODO: Implement transaction for race condition prevention
  // Production: Consider cascade deletes or soft deletes
  app.delete("/api/managements/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getManagement(id);
      
      if (!existing) {
        return res.status(404).json({ error: "Управление не найдено" });
      }

      const divisions = await storage.getAllDivisions({ managementId: id });
      if (divisions.length > 0) {
        return res.status(409).json({ error: "Невозможно удалить управление с подразделениями" });
      }

      const users = await storage.getAllUsers({ managementId: id });
      if (users.length > 0) {
        return res.status(409).json({ error: "Невозможно удалить управление с сотрудниками" });
      }

      const tasks = await storage.getAllTasks({ managementId: id });
      if (tasks.length > 0) {
        return res.status(409).json({ error: "Невозможно удалить управление с задачами" });
      }

      await storage.deleteManagement(id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Ошибка при удалении управления" });
    }
  });

  // Delete division (admin only)
  // NOTE: Basic implementation - checks users, tasks
  // TODO: Add checks for bids, point transactions, and other dependencies
  // TODO: Implement transaction for race condition prevention
  // Production: Consider cascade deletes or soft deletes
  app.delete("/api/divisions/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await storage.getDivision(id);
      
      if (!existing) {
        return res.status(404).json({ error: "Подразделение не найдено" });
      }

      const users = await storage.getAllUsers({ divisionId: id });
      if (users.length > 0) {
        return res.status(409).json({ error: "Невозможно удалить подразделение с сотрудниками" });
      }

      const tasks = await storage.getAllTasks({ divisionId: id });
      if (tasks.length > 0) {
        return res.status(409).json({ error: "Невозможно удалить подразделение с задачами" });
      }

      await storage.deleteDivision(id);
      res.json({ success: true });
    } catch (error) {
      res.status(400).json({ error: "Ошибка при удалении подразделения" });
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

      if (parsed.positionType === "management_deputy") {
        if (!assignment.managementId) {
          return res.status(400).json({ error: "Укажите управление для этой должности" });
        }
        const management = await storage.getManagement(assignment.managementId);
        if (!management) {
          return res.status(404).json({ error: "Управление не найдено" });
        }
        if (management.deputyId) {
          return res.status(400).json({ error: "У этого управления уже есть заместитель" });
        }
      } else {
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
      }

      const passwordHash = await hashPassword(parsed.password);
      const grade = getGradeByPosition(assignment.positionType);
      const user = await storage.createUser(
        parsed.username,
        passwordHash,
        parsed.name,
        parsed.email ?? null,
        assignment.role,
        grade,
        assignment.departmentId,
        assignment.managementId,
        assignment.divisionId,
        assignment.positionType,
        true
      );

      if (parsed.positionType === "management_deputy" && assignment.managementId) {
        await storage.updateManagement(assignment.managementId, { deputyId: user.id });
      }

      const startingPoints = getInitialPointsByPosition(parsed.positionType);

      const positionLabels: Record<PositionType, string> = {
        admin: "Администратор",
        director: "Директор",
        deputy: "Заместитель",
        management_head: "Руководитель управления",
        management_deputy: "Заместитель руководителя управления",
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
        positionType?: PositionType;
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

        if (parsed.positionType === "management_deputy") {
          if (!assignment.managementId) {
            return res.status(400).json({ error: "Укажите управление для этой должности" });
          }
          const management = await storage.getManagement(assignment.managementId);
          if (!management) {
            return res.status(404).json({ error: "Управление не найдено" });
          }
          if (management.deputyId && management.deputyId !== id) {
            return res.status(400).json({ error: "У этого управления уже есть заместитель" });
          }
          const currentManagement = await findManagementByDeputyId(id);
          if (currentManagement && currentManagement.id !== assignment.managementId) {
            await storage.updateManagement(currentManagement.id, { deputyId: null });
          }
        } else {
          await clearManagementDeputyAssignment(id);
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
        }

        updates.role = assignment.role;
        updates.grade = getGradeByPosition(assignment.positionType);
        updates.positionType = assignment.positionType;
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

      // Deactivate bids when employee is transferred (v2.1 §6)
      const departmentChanged = updates.departmentId !== undefined && employee.departmentId && updates.departmentId !== employee.departmentId;
      const divisionChanged = updates.divisionId !== undefined && employee.divisionId && updates.divisionId !== employee.divisionId;

      if (departmentChanged) {
        // Transfer to different department: deactivate all bids from old department (including all divisions)
        await storage.deactivateBidsForEmployee(id, { departmentId: employee.departmentId });
      }

      if (divisionChanged && !departmentChanged) {
        // Transfer within same department to different division: deactivate bids from old division only
        await storage.deactivateBidsForEmployee(id, { divisionId: employee.divisionId });
      }

      if (parsed.positionType === "management_deputy" && updates.managementId) {
        await storage.updateManagement(updates.managementId, { deputyId: id });
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

      const currentUser = req.session.user!;

      // По бизнес-логике: только админ может уволить директора департамента
      if (employee.positionType === "director") {
        if (currentUser.role !== "admin") {
          return res.status(403).json({ error: "Только администратор может уволить директора департамента" });
        }
      }

      if (employee.departmentId && !canModifyDepartment(currentUser, employee.departmentId)) {
        return res.status(403).json({ error: "Недостаточно прав для удаления сотрудника" });
      }

      await reassignTasksFromTerminatedEmployee(storage, id);

      // Deactivate all bids from terminated employee (v2.1 §6)
      await storage.deactivateBidsForEmployee(id);

      await clearManagementDeputyAssignment(id);
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
      const requestedMode = parsed.mode;
      const requestedTaskType = parsed.taskType ?? parsed.type;

      const allowedDepartmentIds = new Set<string>();

      if (currentUser.role === "director" && currentUser.departmentId) {
        allowedDepartmentIds.add(currentUser.departmentId);
      }

      if (currentUser.positionType === "deputy" && currentUser.departmentId) {
        allowedDepartmentIds.add(currentUser.departmentId);
      }

      if (allowedDepartmentIds.size === 0) {
        return res.status(403).json({ error: "У вас нет прав для создания аукционов" });
      }

      let departmentId = parsed.departmentId;

      if (departmentId) {
        if (!allowedDepartmentIds.has(departmentId)) {
          return res.status(403).json({ error: "Нет доступа к выбранному департаменту" });
        }
      } else {
        const uniqueDepartments = Array.from(allowedDepartmentIds);
        if (uniqueDepartments.length > 1) {
          return res.status(400).json({ error: "Укажите департамент для аукциона" });
        }
        [departmentId] = uniqueDepartments;
      }

      if (!departmentId) {
        return res.status(500).json({ error: "Не удалось определить департамент" });
      }

      let managementId: string | null = null;
      let divisionId: string | null = null;

      if (requestedTaskType === "UNIT") {
        if (!parsed.divisionId) {
          return res.status(400).json({ error: "Укажите отдел для задачи" });
        }

        const division = await storage.getDivision(parsed.divisionId);

        if (!division) {
          return res.status(404).json({ error: "Отдел не найден" });
        }

        if (division.departmentId !== departmentId) {
          return res
            .status(400)
            .json({ error: "Отдел должен принадлежать выбранному департаменту" });
        }

        managementId = division.managementId ?? null;
        divisionId = division.id;
      }

      const startAt = new Date();
      const normalizedInitial = normalizeAuctionAmount(parsed.auctionInitialSum, requestedMode);
      const plannedEndAt = calculateAuctionEnd(startAt);
      const basePrice = requestedMode === "MONEY" ? decimalToString(normalizedInitial) : null;
      const baseTime = requestedMode === "TIME" ? Math.round(normalizedInitial) : null;

      let individualExecutor: User | null = null;

      if (requestedTaskType === "INDIVIDUAL") {
        if (!parsed.executorId) {
          return res.status(400).json({ error: "Выберите исполнителя для задачи" });
        }

        const executor = await storage.getUserById(parsed.executorId);

        if (!executor) {
          return res.status(404).json({ error: "Исполнитель не найден" });
        }

        if ((executor as any).isActive === false) {
          return res.status(400).json({ error: "Исполнитель недоступен" });
        }

        if (executor.role === "admin") {
          return res.status(400).json({ error: "Нельзя назначить администратора" });
        }

        if (executor.departmentId !== departmentId) {
          return res.status(400).json({ error: "Исполнитель должен принадлежать выбранному департаменту" });
        }

        if (executor.id === currentUser.id) {
          return res.status(400).json({ error: "Нельзя назначить себя исполнителем" });
        }

        individualExecutor = executor;
      }

      const taskData: Partial<Task> = {
        title: parsed.title,
        description: parsed.description,
        type: parsed.type,
        status: requestedTaskType === "INDIVIDUAL" ? "IN_PROGRESS" : "BACKLOG",
        auctionMode: requestedTaskType === "INDIVIDUAL" ? null : requestedMode,
        departmentId,
        managementId,
        divisionId,
        creatorId: currentUser.id,
        creatorName: currentUser.name,
        executorId: requestedTaskType === "INDIVIDUAL" ? individualExecutor!.id : null,
        executorName: requestedTaskType === "INDIVIDUAL" ? individualExecutor!.name : null,
        minimumGrade: parsed.minimumGrade,
        deadline: parsed.deadline,
        rating: null,
        auctionStartAt: requestedTaskType === "INDIVIDUAL" ? null : startAt,
        auctionPlannedEndAt: requestedTaskType === "INDIVIDUAL" ? null : plannedEndAt,
        basePrice: requestedTaskType === "INDIVIDUAL" ? null : basePrice,
        baseTimeMinutes: requestedTaskType === "INDIVIDUAL" ? null : baseTime,
        earnedMoney: null,
        earnedTimeMinutes: null,
        auctionEndAt: null,
        auctionWinnerId: null,
        auctionWinnerName: null,
        auctionHasBids: false,
      };

      const created = await storage.createTask(taskData as any);
      const metadata = setTaskMetadata(created.id, {
        mode: requestedMode,
        taskType: requestedTaskType,
      });
      res.status(201).json(normalizeTaskResponse(created, metadata));
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
        executorId,
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
      if (typeof executorId === "string" && executorId !== "" && executorId !== "all") {
        filters.executorId = executorId;
      }
      if (typeof participantId === "string" && participantId !== "" && participantId !== "all") {
        filters.participantId = participantId;
      }

      const allTasks = await storage.getAllTasks(filters);
      const tasksWithAuctionPrice = allTasks.map((task) => normalizeTaskResponse(task));
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
        executorId: currentUser.id,
        orderBy: "updatedAt",
      });
      res.json(tasks.map((task) => normalizeTaskResponse(task)));
    } catch (error) {
      console.error("Ошибка при получении личных задач:", error);
      res.status(500).json({ error: "Не удалось получить задачи" });
    }
  });

  app.get("/api/auctions/active", requireAuth, async (req, res) => {
    try {
      const currentUser = req.session.user!;

      const scope =
        currentUser.role === "admin"
          ? { departmentId: undefined as string | undefined }
          : currentUser.departmentId
          ? { departmentId: currentUser.departmentId }
          : null;

      if (!scope) {
        return res.json([]);
      }

      await finalizeExpiredAuctions(scope.departmentId);

      const activeAuctions = await storage.getActiveAuctions(
        scope.departmentId ? { departmentId: scope.departmentId } : undefined,
      );
      const auctionsWithPrice = activeAuctions.map((task) => normalizeTaskResponse(task));

      res.json(auctionsWithPrice);
    } catch (error) {
      console.error("Ошибка при получении активных аукционов:", error);
      res.status(500).json({ error: "Не удалось получить активные аукционы" });
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

      res.json(normalizeTaskResponse(task));
    } catch (error) {
      res.status(500).json({ error: "Не удалось получить задачу" });
    }
  });

  app.patch("/api/tasks/:id/status", requireAuth, async (req, res) => {
    try {
      const { id } = req.params;
      const { status, comment } = req.body as { status?: string; comment?: string };
      const allowedStatuses = ["BACKLOG", "IN_PROGRESS", "UNDER_REVIEW", "DONE"] as const;

      if (!status || !allowedStatuses.includes(status as (typeof allowedStatuses)[number])) {
        return res.status(400).json({ error: "Некорректный статус задачи" });
      }

      const task = await storage.getTask(id);
      if (!task) {
        return res.status(404).json({ error: "Задача не найдена" });
      }

      const currentUser = req.session.user!;
      const metadata = resolveTaskMetadata(task);
      const targetStatus = status as Task["status"];
      const currentStatus = task.status as Task["status"];
      const commentText = typeof comment === "string" ? comment.trim() : "";
      const isCreator = task.creatorId === currentUser.id;

      if (currentStatus === targetStatus) {
        return res.json(task);
      }

      const transitions: Record<Task["status"], Task["status"][]> = {
        BACKLOG: ["IN_PROGRESS"],
        IN_PROGRESS: ["UNDER_REVIEW"],
        UNDER_REVIEW: ["DONE", "IN_PROGRESS"],
        DONE: [],
      };

      const available = transitions[currentStatus] ?? [];
      if (!available.includes(targetStatus)) {
        return res.status(400).json({ error: "Недопустимое изменение статуса" });
      }

      const isAdmin = currentUser.role === "admin";
      const isDirector = currentUser.role === "director" && currentUser.departmentId === task.departmentId;
      const isExecutor = task.executorId === currentUser.id;

      if (targetStatus === "IN_PROGRESS") {
        if (currentStatus === "BACKLOG") {
          if (!task.executorId) {
            return res.status(400).json({ error: "Задача должна иметь исполнителя" });
          }
          if (!(isExecutor || isDirector || isAdmin)) {
            return res.status(403).json({ error: "Только исполнитель или директор могут начать задачу" });
          }
        } else if (currentStatus === "UNDER_REVIEW") {
          if (!(isCreator || isDirector || isAdmin)) {
            return res
              .status(403)
              .json({ error: "Только создатель или директор могут вернуть задачу на доработку" });
          }
          if (!commentText) {
            return res.status(400).json({ error: "Добавьте комментарий при возврате задачи" });
          }
        }
      }

      if (targetStatus === "UNDER_REVIEW" && !isExecutor && !isAdmin) {
        return res.status(403).json({ error: "Только исполнитель может отправить задачу на проверку" });
      }

      if (targetStatus === "DONE" && !(isDirector || isAdmin)) {
        return res.status(403).json({ error: "Только директор департамента может завершить задачу" });
      }

      if (
        currentStatus === "UNDER_REVIEW" &&
        targetStatus === "IN_PROGRESS" &&
        commentText
      ) {
        await storage.addTaskComment({
          taskId: task.id,
          authorId: currentUser.id,
          authorName: currentUser.name,
          content: commentText,
        });
      }

      const updateData: any = { status: targetStatus };

      if (targetStatus === "UNDER_REVIEW") {
        updateData.reviewDeadline = calculateReviewDeadline(new Date());
      }

      if (targetStatus === "DONE") {
        updateData.doneAt = new Date();
        if (metadata.mode === "TIME") {
          const reward = task.earnedTimeMinutes ?? getAuctionBaseValue(task, metadata.mode);
          if (reward !== null && reward !== undefined) {
            updateData.earnedTimeMinutes = normalizeAuctionAmount(reward, "TIME");
          }
        } else {
          const reward = parseDecimal(task.earnedMoney as any) ?? getAuctionBaseValue(task, metadata.mode);
          if (reward !== null && reward !== undefined) {
            updateData.earnedMoney = decimalToString(reward);
          }
        }
      }

      const updated = await storage.updateTask(id, updateData);
      if (!updated) {
        return res.status(404).json({ error: "Задача не найдена" });
      }

      if (targetStatus === "DONE" && task.executorId && task.assignedPoints == null) {
        const basePoints = getBasePointsForTask(task);
        let penaltyPoints = 0;
        if (task.deadline) {
          const deadline = new Date(task.deadline);
          penaltyPoints = calculateOverduePenaltyHours(deadline, new Date());
        }
        await storage.assignPointsForTask(task.id, basePoints, penaltyPoints);
      }

      res.json(normalizeTaskResponse(updated));
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

      const metadata = resolveTaskMetadata(task);
      if (metadata.taskType === "INDIVIDUAL") {
        return res.status(400).json({ error: "Ставки недоступны для индивидуальных задач" });
      }

      const sessionUser = req.session.user!;
      const activeUser = await storage.getUserById(sessionUser.id);
      if (!activeUser) {
        return res.status(403).json({ error: "Пользователь не найден или деактивирован" });
      }

      if (activeUser.role === "admin") {
        return res.status(403).json({ error: "Администраторы не могут делать ставки" });
      }

      if (activeUser.id === task.creatorId) {
        return res.status(400).json({ error: "Создатель задачи не может делать ставки" });
      }

      if (activeUser.role !== "admin") {
        if (!activeUser.departmentId || activeUser.departmentId !== task.departmentId) {
          return res
            .status(403)
            .json({ error: "Ставки доступны только сотрудникам департамента задачи" });
        }

        if (metadata.taskType === "UNIT") {
          if (!task.divisionId) {
            return res.status(400).json({ error: "Для задач типа 'UNIT' должен быть указан отдел" });
          }

          if (activeUser.divisionId !== task.divisionId) {
            return res
              .status(403)
              .json({ error: "Ставки доступны только сотрудникам отдела задачи" });
          }
        }
      }

      await finalizeExpiredAuctions(task.departmentId);
      const refreshedTask = await storage.getTask(id);
      if (
        !refreshedTask ||
        refreshedTask.status !== "BACKLOG" ||
        refreshedTask.type === "INDIVIDUAL"
      ) {
        return res.status(400).json({ error: "Аукцион уже завершён" });
      }

      task = refreshedTask;

      const roleForGrade = (roleGradeMap[activeUser.role as keyof typeof roleGradeMap]
        ? activeUser.role
        : "employee") as keyof typeof roleGradeMap;
      const userGrade: Grade = (activeUser.grade as Grade) ?? getRoleGrade(roleForGrade);
      const minimumGrade = task.minimumGrade as Grade;
      if (!hasGradeAccess(userGrade, minimumGrade)) {
        return res
          .status(403)
          .json({ error: `Ставки доступны с грейда ${minimumGrade}, ваш грейд: ${userGrade}` });
      }

      const parsed = placeBidSchema.parse(req.body);
      const rawBidValue =
        metadata.mode === "TIME"
          ? parsed.valueTimeMinutes
          : parsed.valueMoney ?? parsed.valueTimeMinutes;

      if (rawBidValue === undefined) {
        return res.status(400).json({ error: "Укажите значение ставки" });
      }

      const bidAmount = normalizeAuctionAmount(rawBidValue, metadata.mode);
      const auctionPrice = calculateAuctionPrice(task, new Date(), metadata.mode);
      if (auctionPrice === null) {
        return res.status(400).json({ error: "Ставки недоступны для этой задачи" });
      }

      if (bidAmount >= auctionPrice) {
        return res.status(400).json({ error: "Ставка должна быть ниже текущей цены" });
      }

      const existingBids = await filterOutAdminBids(await storage.getTaskBids(id));
      const currentWinningBid = selectWinningBid(existingBids, metadata.mode);

      if (currentWinningBid) {
        const candidateBid = {
          id: "pending",
          taskId: task.id,
          bidderId: activeUser.id,
          bidderName: activeUser.name,
          bidderRating: (activeUser.rating as string | null) ?? "0",
          bidderGrade: userGrade,
          bidderPoints: Number(activeUser.points ?? 0),
          valueMoney: metadata.mode === "MONEY" ? decimalToString(bidAmount) : null,
          valueTimeMinutes: metadata.mode === "TIME" ? bidAmount : null,
          createdAt: new Date(),
        } as AuctionBid;

        if (compareBids(candidateBid, currentWinningBid, metadata.mode) >= 0) {
          return res.status(400).json({ error: "Есть более выгодная ставка" });
        }
      }

      const bidRecord = await storage.createBid(
        {
          taskId: task.id,
          bidderId: activeUser.id,
          bidderName: activeUser.name,
          bidderRating: (activeUser.rating as string | null) ?? "0",
          bidderGrade: userGrade,
          bidderPoints: Number(activeUser.points ?? 0),
          valueMoney: metadata.mode === "MONEY" ? decimalToString(bidAmount) : null,
          valueTimeMinutes: metadata.mode === "TIME" ? bidAmount : null,
        },
        { currentAuctionAmount: auctionPrice },
      );

      res.status(201).json(bidRecord);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: error.errors.map((e) => e.message).join(", ") });
      }
      console.error("Ошибка при создании ставки:", error);
      res.status(500).json({ error: "Не удалось разместить ставку" });
    }
  });

  // Task Attachments API
  app.get("/api/tasks/:id/attachments", requireAuth, async (req, res) => {
    try {
      const { id: taskId } = req.params;
      const task = await storage.getTask(taskId);
      
      if (!task) {
        return res.status(404).json({ error: "Задача не найдена" });
      }

      const attachments = await storage.getTaskAttachments(taskId);
      res.json(attachments);
    } catch (error) {
      console.error("Ошибка при получении вложений:", error);
      res.status(500).json({ error: "Не удалось получить вложения" });
    }
  });

  app.post("/api/tasks/:id/attachments", requireAuth, upload.single("file"), async (req, res) => {
    try {
      const { id: taskId } = req.params;
      const currentUser = req.session.user!;
      const file = req.file;

      if (!file) {
        return res.status(400).json({ error: "Файл не предоставлен" });
      }

      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Задача не найдена" });
      }

      // Check attachment count limit (max 10 files)
      const existingCount = await storage.getAttachmentCount(taskId);
      if (existingCount >= 10) {
        return res.status(400).json({ error: "Превышен лимит вложений (максимум 10 файлов)" });
      }

      // Generate unique storage path
      const timestamp = Date.now();
      const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
      const storagePath = `tasks/${taskId}/${timestamp}_${sanitizedFilename}`;

      // Upload to Object Storage (.private directory)
      await objectStorageClient.uploadFromBytes(storagePath, file.buffer);

      // Save attachment metadata to database
      const attachment = await storage.createTaskAttachment({
        taskId,
        uploaderId: currentUser.id,
        uploaderName: currentUser.name,
        filename: file.originalname,
        filesizeBytes: file.size,
        storagePath,
      });

      res.status(201).json(attachment);
    } catch (error) {
      console.error("Ошибка при загрузке файла:", error);
      res.status(500).json({ error: "Не удалось загрузить файл" });
    }
  });

  app.delete("/api/tasks/:taskId/attachments/:attachmentId", requireAuth, async (req, res) => {
    try {
      const { taskId, attachmentId } = req.params;
      const currentUser = req.session.user!;

      const task = await storage.getTask(taskId);
      if (!task) {
        return res.status(404).json({ error: "Задача не найдена" });
      }

      const attachments = await storage.getTaskAttachments(taskId);
      const attachment = attachments.find((a) => a.id === attachmentId);

      if (!attachment) {
        return res.status(404).json({ error: "Вложение не найдено" });
      }

      // Authorization per v2.1 §9: creator can delete any file, executor can delete their own files, uploader can delete their files, admin can delete any
      const isCreator = task.creatorId === currentUser.id;
      const isExecutor = task.executorId === currentUser.id;
      const isUploader = attachment.uploaderId === currentUser.id;
      const isAdmin = currentUser.role === "admin";
      
      const canDelete = 
        isAdmin ||
        isCreator || // creator can delete any attachment
        isUploader || // uploader can delete their attachment
        (isExecutor && isUploader); // executor can delete their own uploaded files

      if (!canDelete) {
        return res.status(403).json({ error: "Недостаточно прав для удаления вложения" });
      }

      // Delete from Object Storage
      try {
        await objectStorageClient.delete(attachment.storagePath);
      } catch (storageError) {
        console.error("Ошибка при удалении из Object Storage:", storageError);
        // Continue with database deletion even if storage deletion fails
      }

      // Delete from database (soft delete via deleted_at)
      await storage.deleteTaskAttachment(attachmentId);

      res.json({ success: true });
    } catch (error) {
      console.error("Ошибка при удалении вложения:", error);
      res.status(500).json({ error: "Не удалось удалить вложение" });
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
      const enhancedUser = await enhanceUserCapabilities(userWithoutPassword);
      req.session.userId = user.id;
      req.session.user = enhancedUser;

      // Explicitly save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("Ошибка сохранения сессии:", err);
          return res.status(500).json({ error: "Не удалось сохранить сессию" });
        }
        res.json({ user: enhancedUser });
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
      const enhancedUser = await enhanceUserCapabilities(userWithoutPassword);
      req.session.user = enhancedUser;

      res.json({ user: enhancedUser });
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

      if (role !== "admin") {
        return res.status(400).json({ error: "Создание сотрудников выполняйте через раздел кадров" });
      }

      const user = await storage.createUser(
        userData.username,
        passwordHash,
        userData.name,
        userData.email ?? null,
        role,
        "A",
        null,
        null,
        null,
        "employee",
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

  app.get("/api/users/me/points", requireAuth, async (req, res) => {
    try {
      const currentUserId = req.session.user!.id;
      const freshUser = await storage.getUserById(currentUserId);
      if (!freshUser) {
        return res.status(404).json({ error: "Пользователь не найден" });
      }

      const points = Number(freshUser.points ?? 0);
      const { grade, nextGrade, pointsToNext } = calculateGradeProgress(points);

      res.json({ points, grade, nextGrade: nextGrade ?? null, pointsToNext: pointsToNext ?? null });
    } catch (error) {
      console.error("Ошибка при получении баллов пользователя:", error);
      res.status(500).json({ error: "Не удалось получить баллы пользователя" });
    }
  });

  app.get("/api/users/me/point-history", requireAuth, async (req, res) => {
    try {
      const currentUserId = req.session.user!.id;
      const history = await storage.getUserPointHistory(currentUserId);
      res.json(history);
    } catch (error) {
      res.status(500).json({ error: "Не удалось получить историю баллов" });
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

  app.get("/api/metrics/month", requireAuth, async (req, res) => {
    try {
      const user = req.session.user!;
      const departmentId = user.role === "admin" ? undefined : user.departmentId || undefined;

      if (!departmentId && user.role !== "admin") {
        return res.json({
          completed_tasks_count: 0,
          closed_auctions_sum: 0,
          active_auctions_count: 0,
          backlog_count: 0,
        });
      }

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

      const allTasks = await storage.getAllTasks(departmentId ? { departmentId } : {});

      const completed_tasks_count = allTasks.filter(
        (task) =>
          task.status === "DONE" &&
          task.updatedAt &&
          new Date(task.updatedAt) >= startOfMonth &&
          new Date(task.updatedAt) <= endOfMonth
      ).length;

      const closedAuctionsThisMonth = allTasks.filter(
        (task) =>
          task.type !== "INDIVIDUAL" &&
          task.status !== "BACKLOG" &&
          task.auctionMode === "MONEY" &&
          task.earnedMoney &&
          task.updatedAt &&
          new Date(task.updatedAt) >= startOfMonth &&
          new Date(task.updatedAt) <= endOfMonth
      );

      const closed_auctions_sum = closedAuctionsThisMonth.reduce((sum, task) => {
        const amount = parseDecimal(task.earnedMoney as any);
        return sum + (amount || 0);
      }, 0);

      const active_auctions_count = allTasks.filter(
        (task) => task.type !== "INDIVIDUAL" && task.status === "BACKLOG"
      ).length;

      const backlog_count = allTasks.filter((task) => task.status === "BACKLOG").length;

      res.json({
        completed_tasks_count,
        closed_auctions_sum,
        active_auctions_count,
        backlog_count,
      });
    } catch (error) {
      console.error("Ошибка при получении метрик:", error);
      res.status(500).json({ error: "Не удалось получить метрики" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
