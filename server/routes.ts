import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";

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
      const { id } = req.params;
      const bids = await storage.getTaskBids(id);
      res.json(bids);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bids" });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
