import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  BarChart3,
  TrendingUp,
  Wallet,
  Award,
  ChevronRight,
  ArrowLeft,
  Building2,
  Users,
  User,
  Calendar,
  Clock,
  Target,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { Management, Division, User as UserModel, Department } from "@shared/schema";
import { SessionUser } from "@/types/session";
import { listTasks, getReportsDefaultDept, type AuctionTaskSummary, type AuctionStatus } from "@/api/adapter";
import { formatDateTime, formatMoney } from "@/lib/formatters";

type DrillLevel = "department" | "management" | "division" | "employee";

interface DrilldownState {
  level: DrillLevel;
  managementId?: string;
  divisionId?: string;
  employeeId?: string;
}

interface ChartItem {
  id: string;
  name: string;
  completed: number;
  inProgress: number;
  backlog: number;
  total: number;
  entityType: DrillLevel;
  divisions?: number;
  employees?: number;
  rating?: number;
  parentId?: string;
  isDepartmentOption?: boolean;
  earnedMoney?: number;
  earnedTime?: number;
  totalPoints?: number;
}

const statusLabels: Record<AuctionStatus, string> = {
  BACKLOG: "В ожидании",
  IN_PROGRESS: "В работе",
  UNDER_REVIEW: "На проверке",
  DONE: "Завершено",
};

const statusBadgeVariants: Record<AuctionStatus, "default" | "secondary" | "outline"> = {
  DONE: "default",
  IN_PROGRESS: "secondary",
  UNDER_REVIEW: "secondary",
  BACKLOG: "outline",
};

function parseUserRating(value: UserModel["rating"]): number | undefined {
  if (!value) return undefined;
  const numeric = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}
export default function Reports() {
  const [drilldown, setDrilldown] = useState<DrilldownState>({ level: "department" });
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<string | "all" | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>("current");

  const { data: authData } = useQuery<{ user: SessionUser | null }>({ queryKey: ["/api/auth/me"] });
  const currentUser = authData?.user;

  const { data: departments = [] } = useQuery<Department[]>({ queryKey: ["/api/departments"] });
  const { data: managements = [] } = useQuery<Management[]>({ queryKey: ["/api/managements"] });
  const { data: divisions = [] } = useQuery<Division[]>({ queryKey: ["/api/divisions"] });
  const { data: employees = [] } = useQuery<UserModel[]>({ queryKey: ["/api/employees"] });

  const { data: defaultDept } = useQuery({
    queryKey: ["reports", "default-department", currentUser?.id],
    enabled: authData !== undefined,
    queryFn: () =>
      getReportsDefaultDept(
        currentUser ? { role: currentUser.role, departmentId: currentUser.departmentId ?? null } : null,
      ),
  });

  const fallbackDepartmentId = departments[0]?.id ?? null;

  useEffect(() => {
    if (selectedDepartmentId !== null) return;
    if (defaultDept) {
      if (defaultDept.allowAllDepartments && !defaultDept.defaultDepartmentId) {
        setSelectedDepartmentId("all");
        return;
      }
      if (defaultDept.defaultDepartmentId) {
        setSelectedDepartmentId(defaultDept.defaultDepartmentId);
        return;
      }
    }
    if (fallbackDepartmentId) {
      setSelectedDepartmentId(fallbackDepartmentId);
    }
  }, [defaultDept, selectedDepartmentId, fallbackDepartmentId]);

  useEffect(() => {
    if (selectedDepartmentId === null) return;
    setDrilldown({ level: "department" });
  }, [selectedDepartmentId]);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<AuctionTaskSummary[]>({
    queryKey: ["reports", "tasks", { department: selectedDepartmentId }],
    enabled: selectedDepartmentId !== null,
    queryFn: () =>
      listTasks({
        scope: "all",
        departmentId: selectedDepartmentId && selectedDepartmentId !== "all" ? selectedDepartmentId : undefined,
      }),
  });

  const canViewAllDepartments = defaultDept?.allowAllDepartments ?? false;

  const filteredManagements = useMemo(() => {
    if (!selectedDepartmentId || selectedDepartmentId === "all") return managements;
    return managements.filter((mgmt) => mgmt.departmentId === selectedDepartmentId);
  }, [managements, selectedDepartmentId]);

  const filteredDivisions = useMemo(() => {
    if (!selectedDepartmentId || selectedDepartmentId === "all") return divisions;
    return divisions.filter((division) => division.departmentId === selectedDepartmentId);
  }, [divisions, selectedDepartmentId]);

  const filteredEmployees = useMemo(() => {
    if (!selectedDepartmentId || selectedDepartmentId === "all") return employees;
    return employees.filter((emp) => emp.departmentId === selectedDepartmentId);
  }, [employees, selectedDepartmentId]);

  const getMonthRange = (monthKey: string): { start: Date; end: Date } | null => {
    const now = new Date();
    
    if (monthKey === "current") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
      return { start, end };
    }
    
    if (monthKey === "previous") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      return { start, end };
    }
    
    if (monthKey === "all") {
      return null;
    }
    
    const [year, month] = monthKey.split("-").map(Number);
    if (!year || !month || month < 1 || month > 12) return null;
    
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);
    return { start, end };
  };

  const filteredTasks = useMemo(() => {
    const range = getMonthRange(selectedMonth);
    if (!range) return tasks;
    
    return tasks.filter((task) => {
      if (task.status !== "DONE") return false;
      
      const completionDate = task.doneAt ?? task.updatedAt;
      if (!completionDate) return false;
      
      const taskDate = new Date(completionDate);
      return taskDate >= range.start && taskDate <= range.end;
    });
  }, [tasks, selectedMonth]);
  const stats = useMemo(() => {
    const activeTasks = selectedMonth === "all" ? tasks : filteredTasks;
    const completed = activeTasks.filter((t) => t.status === "DONE").length;
    const inProgress = tasks.filter((t) => t.status === "IN_PROGRESS").length;
    const backlog = tasks.filter((t) => t.status === "BACKLOG").length;
    const total = tasks.length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;
    
    const completedTasks = activeTasks.filter((task) => task.status === "DONE");
    const earnedMoney = completedTasks.reduce((sum, task) => {
      const earned = typeof task.earnedMoney === "number" ? task.earnedMoney : 
                     typeof task.earnedMoney === "string" ? parseFloat(task.earnedMoney) : 0;
      return sum + (Number.isFinite(earned) ? earned : 0);
    }, 0);
    
    const earnedTime = completedTasks.reduce((sum, task) => {
      const earned = task.earnedTimeMinutes ?? 0;
      return sum + (typeof earned === "number" && Number.isFinite(earned) ? earned : 0);
    }, 0);
    
    const totalPoints = completedTasks.reduce((sum, task) => {
      const points = task.assignedPoints ?? 0;
      return sum + (typeof points === "number" && Number.isFinite(points) ? points : 0);
    }, 0);

    const monetaryTasks = tasks.filter((task) => task.mode !== "TIME");
    const totalBudget = monetaryTasks.reduce(
      (sum, task) => sum + (task.currentPrice ?? task.startingPrice ?? 0),
      0,
    );
    const avgBudget = monetaryTasks.length > 0 ? totalBudget / monetaryTasks.length : 0;

    let employeeCount = filteredEmployees.length;
    if (drilldown.divisionId) {
      employeeCount = filteredEmployees.filter((emp) => emp.divisionId === drilldown.divisionId).length;
    } else if (drilldown.managementId) {
      const divisionIds = filteredDivisions
        .filter((division) => division.managementId === drilldown.managementId)
        .map((division) => division.id);
      employeeCount = filteredEmployees.filter(
        (emp) => emp.managementId === drilldown.managementId || (emp.divisionId && divisionIds.includes(emp.divisionId)),
      ).length;
    }

    return { completed, inProgress, backlog, total, completionRate, avgBudget, employeeCount, earnedMoney, earnedTime, totalPoints };
  }, [tasks, filteredTasks, selectedMonth, drilldown, filteredEmployees, filteredDivisions]);

  const chartData = useMemo<ChartItem[]>(() => {
    if (selectedDepartmentId === null) return [];
    const activeTasks = selectedMonth === "all" ? tasks : filteredTasks;

    if (drilldown.level === "department") {
      if (selectedDepartmentId === "all") {
        return departments.map((department) => {
          const deptTasks = tasks.filter((task) => task.departmentId === department.id);
          const deptCompletedTasks = activeTasks.filter((task) => task.departmentId === department.id && task.status === "DONE");
          
          const earnedMoney = deptCompletedTasks.reduce((sum, task) => {
            const earned = typeof task.earnedMoney === "number" ? task.earnedMoney : 
                          typeof task.earnedMoney === "string" ? parseFloat(task.earnedMoney) : 0;
            return sum + (Number.isFinite(earned) ? earned : 0);
          }, 0);
          
          const earnedTime = deptCompletedTasks.reduce((sum, task) => {
            const earned = task.earnedTimeMinutes ?? 0;
            return sum + (typeof earned === "number" && Number.isFinite(earned) ? earned : 0);
          }, 0);
          
          const totalPoints = deptCompletedTasks.reduce((sum, task) => {
            const points = task.assignedPoints ?? 0;
            return sum + (typeof points === "number" && Number.isFinite(points) ? points : 0);
          }, 0);
          
          return {
            id: department.id,
            name: department.name,
            completed: deptCompletedTasks.length,
            inProgress: deptTasks.filter((task) => task.status === "IN_PROGRESS").length,
            backlog: deptTasks.filter((task) => task.status === "BACKLOG").length,
            total: deptTasks.length,
            entityType: "department",
            divisions: managements.filter((mgmt) => mgmt.departmentId === department.id).length,
            isDepartmentOption: true,
            earnedMoney,
            earnedTime,
            totalPoints,
          };
        });
      }

      return filteredManagements.map((management) => {
        const managementTasks = tasks.filter((task) => task.managementId === management.id);
        const managementCompletedTasks = activeTasks.filter((task) => task.managementId === management.id && task.status === "DONE");
        const managementDivisions = filteredDivisions.filter((division) => division.managementId === management.id);
        
        const earnedMoney = managementCompletedTasks.reduce((sum, task) => {
          const earned = typeof task.earnedMoney === "number" ? task.earnedMoney : 
                        typeof task.earnedMoney === "string" ? parseFloat(task.earnedMoney) : 0;
          return sum + (Number.isFinite(earned) ? earned : 0);
        }, 0);
        
        const earnedTime = managementCompletedTasks.reduce((sum, task) => {
          const earned = task.earnedTimeMinutes ?? 0;
          return sum + (typeof earned === "number" && Number.isFinite(earned) ? earned : 0);
        }, 0);
        
        const totalPoints = managementCompletedTasks.reduce((sum, task) => {
          const points = task.assignedPoints ?? 0;
          return sum + (typeof points === "number" && Number.isFinite(points) ? points : 0);
        }, 0);
        
        return {
          id: management.id,
          name: management.name,
          completed: managementCompletedTasks.length,
          inProgress: managementTasks.filter((task) => task.status === "IN_PROGRESS").length,
          backlog: managementTasks.filter((task) => task.status === "BACKLOG").length,
          total: managementTasks.length,
          entityType: "management",
          divisions: managementDivisions.length,
          parentId: management.departmentId,
          earnedMoney,
          earnedTime,
          totalPoints,
        };
      });
    }

    if (drilldown.level === "management") {
      if (!drilldown.managementId) return [];
      const managementDivisions = filteredDivisions.filter((division) => division.managementId === drilldown.managementId);
      return managementDivisions.map((division) => {
        const divisionTasks = tasks.filter((task) => task.divisionId === division.id);
        const divisionCompletedTasks = activeTasks.filter((task) => task.divisionId === division.id && task.status === "DONE");
        const divisionEmployees = filteredEmployees.filter((emp) => emp.divisionId === division.id);
        
        const earnedMoney = divisionCompletedTasks.reduce((sum, task) => {
          const earned = typeof task.earnedMoney === "number" ? task.earnedMoney : 
                        typeof task.earnedMoney === "string" ? parseFloat(task.earnedMoney) : 0;
          return sum + (Number.isFinite(earned) ? earned : 0);
        }, 0);
        
        const earnedTime = divisionCompletedTasks.reduce((sum, task) => {
          const earned = task.earnedTimeMinutes ?? 0;
          return sum + (typeof earned === "number" && Number.isFinite(earned) ? earned : 0);
        }, 0);
        
        const totalPoints = divisionCompletedTasks.reduce((sum, task) => {
          const points = task.assignedPoints ?? 0;
          return sum + (typeof points === "number" && Number.isFinite(points) ? points : 0);
        }, 0);
        
        return {
          id: division.id,
          name: division.name,
          completed: divisionCompletedTasks.length,
          inProgress: divisionTasks.filter((task) => task.status === "IN_PROGRESS").length,
          backlog: divisionTasks.filter((task) => task.status === "BACKLOG").length,
          total: divisionTasks.length,
          entityType: "division",
          employees: divisionEmployees.length,
          parentId: drilldown.managementId,
          earnedMoney,
          earnedTime,
          totalPoints,
        };
      });
    }

    if (drilldown.level === "division") {
      if (!drilldown.divisionId) return [];
      const divisionEmployees = filteredEmployees.filter((emp) => emp.divisionId === drilldown.divisionId);
      return divisionEmployees.map((employee) => {
        const employeeTasks = tasks.filter(
          (task) => task.executorId === employee.id || task.leadingBidderId === employee.id,
        );
        const employeeCompletedTasks = activeTasks.filter(
          (task) => (task.executorId === employee.id || task.leadingBidderId === employee.id) && task.status === "DONE",
        );
        
        const earnedMoney = employeeCompletedTasks.reduce((sum, task) => {
          const earned = typeof task.earnedMoney === "number" ? task.earnedMoney : 
                        typeof task.earnedMoney === "string" ? parseFloat(task.earnedMoney) : 0;
          return sum + (Number.isFinite(earned) ? earned : 0);
        }, 0);
        
        const earnedTime = employeeCompletedTasks.reduce((sum, task) => {
          const earned = task.earnedTimeMinutes ?? 0;
          return sum + (typeof earned === "number" && Number.isFinite(earned) ? earned : 0);
        }, 0);
        
        const totalPoints = employeeCompletedTasks.reduce((sum, task) => {
          const points = task.assignedPoints ?? 0;
          return sum + (typeof points === "number" && Number.isFinite(points) ? points : 0);
        }, 0);
        
        return {
          id: employee.id,
          name: employee.name ?? employee.username ?? "Сотрудник",
          completed: employeeCompletedTasks.length,
          inProgress: employeeTasks.filter((task) => task.status === "IN_PROGRESS").length,
          backlog: employeeTasks.filter((task) => task.status === "BACKLOG").length,
          total: employeeTasks.length,
          entityType: "employee",
          rating: parseUserRating(employee.rating),
          parentId: drilldown.divisionId,
          earnedMoney,
          earnedTime,
          totalPoints,
        };
      });
    }

    return [];
  }, [selectedDepartmentId, drilldown, departments, tasks, managements, filteredManagements, filteredDivisions, filteredEmployees, selectedMonth, filteredTasks]);

  const employeeTasks = useMemo(() => {
    if (drilldown.level !== "employee" || !drilldown.employeeId) return [];
    return tasks
      .filter((task) => task.executorId === drilldown.employeeId || task.leadingBidderId === drilldown.employeeId)
      .slice(0, 5);
  }, [tasks, drilldown]);

  const showBackButton =
    drilldown.level !== "department" ||
    (canViewAllDepartments && selectedDepartmentId !== null && selectedDepartmentId !== "all");

  const currentContext = useMemo(() => {
    if (selectedDepartmentId === "all" || !selectedDepartmentId) {
      if (drilldown.level === "department") {
        return "Все департаменты";
      }
    }

    const departmentName = departments.find((dept) => dept.id === selectedDepartmentId)?.name;

    switch (drilldown.level) {
      case "department":
        return departmentName ?? "Выберите департамент";
      case "management": {
        const management = managements.find((mgmt) => mgmt.id === drilldown.managementId);
        return management?.name ?? departmentName ?? "";
      }
      case "division": {
        const division = divisions.find((div) => div.id === drilldown.divisionId);
        return division?.name ?? departmentName ?? "";
      }
      case "employee": {
        const employee = employees.find((emp) => emp.id === drilldown.employeeId);
        return employee?.name ?? employee?.username ?? "Сотрудник";
      }
      default:
        return departmentName ?? "";
    }
  }, [selectedDepartmentId, drilldown, departments, managements, divisions, employees]);

  const levelLabel = useMemo(() => {
    switch (drilldown.level) {
      case "department":
        return selectedDepartmentId === "all" ? "Все департаменты" : "Уровень департамента";
      case "management":
        return "Уровень управления";
      case "division":
        return "Уровень отдела";
      case "employee":
        return "Уровень сотрудника";
      default:
        return "";
    }
  }, [drilldown.level, selectedDepartmentId]);

  const handleDepartmentSelect = (value: string) => {
    if (value === "all") {
      setSelectedDepartmentId("all");
    } else {
      setSelectedDepartmentId(value);
    }
  };

  const handleDrillDown = (item: ChartItem) => {
    if (item.entityType === "employee") {
      return;
    }

    if (item.entityType === "department") {
      if (canViewAllDepartments && selectedDepartmentId === "all" && item.isDepartmentOption) {
        setSelectedDepartmentId(item.id);
        return;
      }
      setDrilldown({ level: "management", managementId: item.id });
      return;
    }

    if (item.entityType === "management") {
      setDrilldown({ level: "division", managementId: item.id });
      return;
    }

    if (item.entityType === "division") {
      setDrilldown({
        level: "employee",
        managementId: item.parentId ?? drilldown.managementId,
        divisionId: item.id,
      });
    }
  };

  const handleBarClick = (payload?: ChartItem) => {
    if (!payload) return;
    if (payload.entityType === "employee") return;
    handleDrillDown(payload);
  };

  const handleGoBack = () => {
    if (drilldown.level === "department") {
      if (canViewAllDepartments && selectedDepartmentId && selectedDepartmentId !== "all") {
        setSelectedDepartmentId("all");
      }
      return;
    }

    if (drilldown.level === "management") {
      setDrilldown({ level: "department" });
      return;
    }

    if (drilldown.level === "division") {
      setDrilldown({ level: "management", managementId: drilldown.managementId });
      return;
    }

    if (drilldown.level === "employee") {
      setDrilldown({
        level: "division",
        managementId: drilldown.managementId,
        divisionId: drilldown.divisionId,
      });
    }
  };

  const isLoading = tasksLoading || selectedDepartmentId === null;
  const departmentSelectValue = selectedDepartmentId === null ? "" : selectedDepartmentId;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {showBackButton && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleGoBack}
              data-testid="button-go-back"
            >
              <ArrowLeft size={20} />
            </Button>
          )}
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="text-primary" size={20} />
              <h1 className="text-3xl font-bold">{currentContext}</h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {levelLabel}
              </Badge>
              <p className="text-muted-foreground text-sm">Аналитика производительности</p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="w-full sm:w-64">
          <Label className="text-sm text-muted-foreground">Департамент</Label>
          <Select
            value={departmentSelectValue}
            onValueChange={handleDepartmentSelect}
            disabled={!departments.length}
          >
            <SelectTrigger className="mt-2" data-testid="select-department">
              <SelectValue placeholder="Выберите департамент" />
            </SelectTrigger>
            <SelectContent>
              {canViewAllDepartments && <SelectItem value="all">Все департаменты</SelectItem>}
              {departments.map((department) => (
                <SelectItem key={department.id} value={department.id}>
                  {department.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="w-full sm:w-56">
          <Label className="text-sm text-muted-foreground flex items-center gap-2">
            <Calendar size={14} />
            Период
          </Label>
          <Select
            value={selectedMonth}
            onValueChange={setSelectedMonth}
          >
            <SelectTrigger className="mt-2" data-testid="select-month">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">Текущий месяц</SelectItem>
              <SelectItem value="previous">Прошлый месяц</SelectItem>
              <SelectItem value="all">Весь период</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        {canViewAllDepartments && (
          <div className="flex items-center gap-3 pb-1">
            <Switch
              id="toggle-all-departments"
              checked={selectedDepartmentId === "all"}
              onCheckedChange={(checked) => {
                if (checked) {
                  setSelectedDepartmentId("all");
                } else {
                  const fallback = defaultDept?.defaultDepartmentId ?? fallbackDepartmentId;
                  setSelectedDepartmentId(fallback ?? null);
                }
              }}
            />
            <Label htmlFor="toggle-all-departments" className="text-sm text-muted-foreground">
              Все департаменты
            </Label>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card data-testid="card-completed-tasks">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-chart-3/20">
                <TrendingUp className="text-chart-3" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Завершено задач</p>
                <p className="text-2xl font-bold font-mono" data-testid="text-completed-tasks">
                  {stats.completed}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-earned-money">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-chart-1/20">
                <Wallet className="text-chart-1" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Заработано</p>
                <p className="text-2xl font-bold font-mono" data-testid="text-earned-money">
                  {formatMoney(stats.earnedMoney)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-earned-time">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-chart-4/20">
                <Clock className="text-chart-4" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Время (ч)</p>
                <p className="text-2xl font-bold font-mono" data-testid="text-earned-time">
                  {Math.round((stats.earnedTime / 60) * 10) / 10}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-total-points">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-chart-5/20">
                <Target className="text-chart-5" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Баллы</p>
                <p className="text-2xl font-bold font-mono" data-testid="text-total-points">
                  {stats.totalPoints}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center h-96">
          <div className="text-muted-foreground">Загрузка данных...</div>
        </div>
      ) : (
        <>
          {drilldown.level !== "employee" && chartData.length > 0 && (
            <Card data-testid="card-performance-chart">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="text-primary" size={20} />
                  {drilldown.level === "department" && (selectedDepartmentId === "all"
                    ? "Производительность департаментов"
                    : "Производительность управлений")}
                  {drilldown.level === "management" && "Производительность отделов"}
                  {drilldown.level === "division" && "Производительность сотрудников"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                    <YAxis
                      type="category"
                      dataKey="name"
                      stroke="hsl(var(--muted-foreground))"
                      width={180}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "6px",
                      }}
                    />
                    <Legend />
                    <Bar
                      dataKey="completed"
                      fill="hsl(var(--chart-3))"
                      name="Завершено"
                      cursor="pointer"
                      onClick={(data) => handleBarClick(data?.payload as ChartItem)}
                    />
                    <Bar
                      dataKey="inProgress"
                      fill="hsl(var(--chart-1))"
                      name="В работе"
                      cursor="pointer"
                      onClick={(data) => handleBarClick(data?.payload as ChartItem)}
                    />
                    <Bar
                      dataKey="backlog"
                      fill="hsl(var(--chart-4))"
                      name="В ожидании"
                      cursor="pointer"
                      onClick={(data) => handleBarClick(data?.payload as ChartItem)}
                    />
                  </BarChart>
                </ResponsiveContainer>
                {drilldown.level !== "division" && (
                  <p className="text-sm text-muted-foreground text-center mt-4">
                    Нажмите на столбец для детализации
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {drilldown.level !== "employee" && chartData.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {chartData.map((item) => {
                const isClickable = item.entityType !== "employee";
                return (
                  <Card
                    key={item.id}
                    className={`transition-all ${isClickable ? "hover-elevate cursor-pointer" : ""}`}
                    onClick={() => {
                      if (isClickable) handleDrillDown(item);
                    }}
                    data-testid={`card-drill-${item.id}`}
                  >
                    <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                      <CardTitle className="text-lg font-semibold">{item.name}</CardTitle>
                      {isClickable && <ChevronRight size={20} className="text-muted-foreground" />}
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Всего задач:</span>
                          <span className="font-mono font-semibold">{item.total}</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Завершено:</span>
                          <Badge variant="outline" className="bg-chart-3/20 text-chart-3 border-chart-3/30">
                            {item.completed}
                          </Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">В работе:</span>
                          <Badge variant="outline" className="bg-chart-1/20 text-chart-1 border-chart-1/30">
                            {item.inProgress}
                          </Badge>
                        </div>
                        {typeof item.rating === "number" && (
                          <div className="flex items-center justify-between text-sm pt-2 border-t">
                            <span className="text-muted-foreground">Рейтинг:</span>
                            <div className="flex items-center gap-1">
                              <Award size={16} className="text-chart-5" />
                              <span className="font-mono font-semibold">{item.rating.toFixed(1)}</span>
                            </div>
                          </div>
                        )}
                        {(item.divisions !== undefined || item.employees !== undefined) && (
                          <div className="flex items-center justify-between text-sm pt-2 border-t">
                            <span className="text-muted-foreground">
                              {item.divisions !== undefined ? "Отделов:" : "Сотрудников:"}
                            </span>
                            <span className="font-mono font-semibold">
                              {item.divisions ?? item.employees}
                            </span>
                          </div>
                        )}
                        {selectedMonth !== "all" && (
                          <>
                            {typeof item.earnedMoney === "number" && item.earnedMoney > 0 && (
                              <div className="flex items-center justify-between text-sm pt-2 border-t">
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Wallet size={14} />
                                  Заработано:
                                </span>
                                <span className="font-mono font-semibold text-chart-1">
                                  {formatMoney(item.earnedMoney)}
                                </span>
                              </div>
                            )}
                            {typeof item.earnedTime === "number" && item.earnedTime > 0 && (
                              <div className="flex items-center justify-between text-sm pt-2 border-t">
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Clock size={14} />
                                  Время (ч):
                                </span>
                                <span className="font-mono font-semibold text-chart-4">
                                  {Math.round((item.earnedTime / 60) * 10) / 10}
                                </span>
                              </div>
                            )}
                            {typeof item.totalPoints === "number" && item.totalPoints !== 0 && (
                              <div className="flex items-center justify-between text-sm pt-2 border-t">
                                <span className="text-muted-foreground flex items-center gap-1">
                                  <Target size={14} />
                                  Баллы:
                                </span>
                                <span className="font-mono font-semibold text-chart-5">
                                  {item.totalPoints}
                                </span>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {drilldown.level === "employee" && (
            <Card data-testid="card-employee-detail">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="text-primary" size={20} />
                  Детальная информация о сотруднике
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">Завершенные задачи</p>
                    <p className="text-3xl font-bold font-mono text-chart-3">{stats.completed}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">В работе</p>
                    <p className="text-3xl font-bold font-mono text-chart-1">{stats.inProgress}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-2">В ожидании</p>
                    <p className="text-3xl font-bold font-mono text-chart-4">{stats.backlog}</p>
                  </div>
                </div>

                {employeeTasks.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-semibold mb-3">Последние задачи</h3>
                    <div className="space-y-2">
                      {employeeTasks.map((task) => (
                        <div
                          key={task.id}
                          className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                          data-testid={`task-item-${task.id}`}
                        >
                          <div className="flex-1">
                            <p className="font-medium">{task.title}</p>
                            <p className="text-sm text-muted-foreground">
                              {formatDateTime(task.deadline)} • {formatMoney(task.currentPrice ?? task.startingPrice)}
                            </p>
                          </div>
                          <Badge variant={statusBadgeVariants[task.status]}>
                            {statusLabels[task.status] ?? task.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {drilldown.level !== "employee" && chartData.length === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <p className="text-muted-foreground">Нет данных для отображения на этом уровне</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
