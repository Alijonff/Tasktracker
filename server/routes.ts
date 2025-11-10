import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateUser, hashPassword, verifyPassword } from "./auth";
import { loginSchema, insertUserSchema, changePasswordSchema } from "@shared/schema";

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

  // Get all users (employees) - optionally filtered
  app.get("/api/employees", requireAuth, async (req, res) => {
    try {
      const { divisionId, managementId, departmentId } = req.query;
      const filters: { divisionId?: string; managementId?: string; departmentId?: string } = {};
      
      if (divisionId) filters.divisionId = divisionId as string;
      if (managementId) filters.managementId = managementId as string;
      if (departmentId) filters.departmentId = departmentId as string;
      
      const allUsers = await storage.getAllUsers(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(allUsers);
    } catch (error) {
      res.status(500).json({ error: "Не удалось получить список сотрудников" });
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
