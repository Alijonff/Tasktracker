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
  insertDivisionSchema
} from "@shared/schema";

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
      } as const;
    }
    default: {
      throw new PositionAssignmentError("Неизвестный тип должности");
    }
  }
}

const createEmployeeSchema = z.object({
  username: z.string().min(1, "Введите имя пользователя"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  name: z.string().min(1, "Введите имя"),
  email: z.string().email("Введите корректный email"),
  departmentId: z.string().min(1, "Выберите департамент"),
  managementId: z.string().nullable().optional(),
  divisionId: z.string().nullable().optional(),
  positionType: positionTypeSchema,
});

const updateEmployeeSchema = z.object({
  name: z.string().min(1, "Введите имя").optional(),
  email: z.string().email("Введите корректный email").optional(),
  positionType: positionTypeSchema.optional(),
  departmentId: z.string().optional(),
  managementId: z.string().nullable().optional(),
  divisionId: z.string().nullable().optional(),
});

export async function registerRoutes(app: Express): Promise<Server> {
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

      if (divisionId) filters.divisionId = divisionId as string;
      if (managementId) filters.managementId = managementId as string;
      if (departmentId) filters.departmentId = departmentId as string;

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
        parsed.email,
        assignment.role,
        assignment.departmentId,
        assignment.managementId,
        assignment.divisionId,
        true
      );

      const { passwordHash: _, ...userWithoutPassword } = user;
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
        email?: string;
        role?: "admin" | "director" | "manager" | "senior" | "employee";
        departmentId?: string | null;
        managementId?: string | null;
        divisionId?: string | null;
      } = {};

      if (parsed.name !== undefined) updates.name = parsed.name;
      if (parsed.email !== undefined) updates.email = parsed.email;

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

  // Get all tasks (with filtering)
  app.get("/api/tasks", async (req, res) => {
    try {
      const { 
        departmentId, 
        managementId, 
        divisionId, 
        status, 
        type, 
        search,
        assigneeId 
      } = req.query;
      
      // Department ID is required for security and data scoping
      if (!departmentId) {
        return res.status(400).json({ error: "Не указан идентификатор департамента" });
      }
      
      const filters: {
        departmentId: string;
        managementId?: string;
        divisionId?: string;
        status?: string;
        type?: string;
        search?: string;
        assigneeId?: string;
      } = {
        departmentId: departmentId as string,
      };
      
      if (managementId) filters.managementId = managementId as string;
      if (divisionId) filters.divisionId = divisionId as string;
      if (status) filters.status = status as string;
      if (type) filters.type = type as string;
      if (search) filters.search = search as string;
      if (assigneeId) filters.assigneeId = assigneeId as string;
      
      const allTasks = await storage.getAllTasks(filters);
      res.json(allTasks);
    } catch (error) {
      console.error("Ошибка при получении задач:", error);
      res.status(500).json({ error: "Не удалось получить задачи" });
    }
  });

  // Get task by ID
  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const task = await storage.getTask(id);
      
      if (!task) {
        return res.status(404).json({ error: "Задача не найдена" });
      }

      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Не удалось получить задачу" });
    }
  });

  // Get auction bids for a task
  app.get("/api/tasks/:id/bids", async (req, res) => {
    try {
      const { id} = req.params;
      const bids = await storage.getTaskBids(id);
      res.json(bids);
    } catch (error) {
      res.status(500).json({ error: "Не удалось получить ставки" });
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
      
      const user = await storage.createUser(
        userData.username,
        passwordHash,
        userData.name,
        userData.email,
        userData.role || "employee",
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
      const updates = req.body;
      
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

  const httpServer = createServer(app);

  return httpServer;
}
