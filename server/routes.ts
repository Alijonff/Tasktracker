import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { authenticateUser, hashPassword } from "./auth";
import { loginSchema, insertUserSchema } from "@shared/schema";

// Authentication middleware
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session.userId || !req.session.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
}

// Authorization middleware for admin only
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Get all departments
  app.get("/api/departments", async (req, res) => {
    try {
      const allDepartments = await storage.getAllDepartments();
      res.json(allDepartments);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch departments" });
    }
  });

  // Get all managements (optionally filtered by department)
  app.get("/api/managements", async (req, res) => {
    try {
      const { departmentId } = req.query;
      const allManagements = await storage.getAllManagements(
        departmentId ? { departmentId: departmentId as string } : undefined
      );
      res.json(allManagements);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch managements" });
    }
  });

  // Get all divisions (optionally filtered by management or department)
  app.get("/api/divisions", async (req, res) => {
    try {
      const { managementId, departmentId } = req.query;
      const filters: { managementId?: string; departmentId?: string } = {};
      
      if (managementId) filters.managementId = managementId as string;
      if (departmentId) filters.departmentId = departmentId as string;
      
      const allDivisions = await storage.getAllDivisions(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(allDivisions);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch divisions" });
    }
  });

  // Get all employees (optionally filtered)
  app.get("/api/employees", async (req, res) => {
    try {
      const { divisionId, managementId, departmentId } = req.query;
      const filters: { divisionId?: string; managementId?: string; departmentId?: string } = {};
      
      if (divisionId) filters.divisionId = divisionId as string;
      if (managementId) filters.managementId = managementId as string;
      if (departmentId) filters.departmentId = departmentId as string;
      
      const allEmployees = await storage.getAllEmployees(Object.keys(filters).length > 0 ? filters : undefined);
      res.json(allEmployees);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch employees" });
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
        return res.status(400).json({ error: "departmentId is required" });
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
      console.error("Error fetching tasks:", error);
      res.status(500).json({ error: "Failed to fetch tasks" });
    }
  });

  // Get task by ID
  app.get("/api/tasks/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const task = await storage.getTask(id);
      
      if (!task) {
        return res.status(404).json({ error: "Task not found" });
      }
      
      res.json(task);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch task" });
    }
  });

  // Get auction bids for a task
  app.get("/api/tasks/:id/bids", async (req, res) => {
    try {
      const { id} = req.params;
      const bids = await storage.getTaskBids(id);
      res.json(bids);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bids" });
    }
  });

  // Auth routes
  app.post("/api/auth/login", async (req, res) => {
    try {
      const credentials = loginSchema.parse(req.body);
      const user = await authenticateUser(storage, credentials);
      
      if (!user) {
        return res.status(401).json({ error: "Invalid credentials" });
      }
      
      const { passwordHash, ...userWithoutPassword } = user;
      req.session.userId = user.id;
      req.session.user = userWithoutPassword;
      res.json({ user: userWithoutPassword });
    } catch (error) {
      res.status(400).json({ error: "Invalid request" });
    }
  });

  app.post("/api/auth/logout", async (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: "Failed to logout" });
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

  // User management routes (for admin panel)
  app.get("/api/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      const usersWithoutPasswords = users.map(({ passwordHash, ...user }) => user);
      res.json(usersWithoutPasswords);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  app.post("/api/users", requireAuth, requireAdmin, async (req, res) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      const passwordHash = await hashPassword(userData.password);
      
      const user = await storage.createUser(
        userData.username,
        passwordHash,
        userData.role || "employee",
        userData.employeeId || null
      );
      
      const { passwordHash: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error: any) {
      if (error.code === '23505') {
        return res.status(400).json({ error: "Username already exists" });
      }
      res.status(400).json({ error: "Failed to create user" });
    }
  });

  app.patch("/api/users/:id", requireAuth, requireAdmin, async (req, res) => {
    try {
      const { id } = req.params;
      const updates = req.body;
      
      const user = await storage.updateUser(id, updates);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      const { passwordHash, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
