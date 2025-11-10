import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  BarChart3, 
  TrendingUp, 
  Clock, 
  Award, 
  ChevronRight,
  ArrowLeft,
  Building2,
  Users,
  User
} from "lucide-react";
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  Cell
} from "recharts";
import type { Task, Management, Division, User as UserModel } from "@shared/schema";

type DrillLevel = "department" | "management" | "division" | "employee";

interface DrilldownState {
  level: DrillLevel;
  managementId?: string;
  divisionId?: string;
  employeeId?: string;
}

export default function Reports() {
  const [drilldown, setDrilldown] = useState<DrilldownState>({
    level: "department"
  });

  // Fetch all organizational data
  const { data: managements = [] } = useQuery<Management[]>({
    queryKey: ["/api/managements"],
  });

  const { data: divisions = [] } = useQuery<Division[]>({
    queryKey: ["/api/divisions"],
  });

  const { data: employees = [] } = useQuery<UserModel[]>({
    queryKey: ["/api/employees"],
  });

  // Fetch tasks filtered by current drilldown level
  const tasksFilters = {
    departmentId: "dept-1",
    managementId: drilldown.managementId || "all",
    divisionId: drilldown.divisionId || "all",
    assigneeId: drilldown.employeeId || "all",
  };

  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", tasksFilters],
  });

  // Calculate statistics based on current level
  const calculateStats = () => {
    const completed = tasks.filter(t => t.status === "completed").length;
    const inProgress = tasks.filter(t => t.status === "inProgress").length;
    const backlog = tasks.filter(t => t.status === "backlog").length;
    const total = tasks.length;
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Calculate average estimated hours (handle both string and number types)
    const totalHours = tasks.reduce((sum, t) => {
      const hours = typeof t.estimatedHours === 'string' 
        ? parseFloat(t.estimatedHours) 
        : t.estimatedHours;
      return sum + (hours || 0);
    }, 0);
    const avgHours = total > 0 ? (totalHours / total).toFixed(1) : "0";

    // Calculate employee count at current level
    let employeeCount = employees.length;
    if (drilldown.divisionId) {
      employeeCount = employees.filter((e) => e.divisionId === drilldown.divisionId).length;
    } else if (drilldown.managementId) {
      const divIds = divisions
        .filter(d => d.managementId === drilldown.managementId)
        .map(d => d.id);
      employeeCount = employees.filter((e) => (e.divisionId ? divIds.includes(e.divisionId) : false)).length;
    }

    return {
      completed,
      inProgress,
      backlog,
      total,
      completionRate,
      avgHours,
      employeeCount
    };
  };

  const stats = calculateStats();

  // Get data for bar charts based on current level
  const getChartData = () => {
    switch (drilldown.level) {
      case "department":
        // Show managements
        return managements.map(mgmt => {
          const mgmtDivisions = divisions.filter(d => d.managementId === mgmt.id);
          const mgmtTasks = tasks.filter(t => t.managementId === mgmt.id);
          return {
            id: mgmt.id,
            name: mgmt.name,
            completed: mgmtTasks.filter(t => t.status === "completed").length,
            inProgress: mgmtTasks.filter(t => t.status === "inProgress").length,
            backlog: mgmtTasks.filter(t => t.status === "backlog").length,
            total: mgmtTasks.length,
            divisions: mgmtDivisions.length
          };
        });

      case "management":
        // Show divisions in selected management
        const mgmtDivisions = divisions.filter((d) => d.managementId === drilldown.managementId);
        return mgmtDivisions.map((div) => {
          const divTasks = tasks.filter((t) => t.divisionId === div.id);
          const divEmployees = employees.filter((e) => e.divisionId === div.id);
          return {
            id: div.id,
            name: div.name,
            completed: divTasks.filter(t => t.status === "completed").length,
            inProgress: divTasks.filter(t => t.status === "inProgress").length,
            backlog: divTasks.filter(t => t.status === "backlog").length,
            total: divTasks.length,
            employees: divEmployees.length
          };
        });

      case "division":
        // Show employees in selected division
        const divEmployees = employees.filter((e) => e.divisionId === drilldown.divisionId);
        return divEmployees.map((emp) => {
          const empTasks = tasks.filter((t) => t.assigneeId === emp.id);
          return {
            id: emp.id,
            name: emp.name,
            completed: empTasks.filter(t => t.status === "completed").length,
            inProgress: empTasks.filter(t => t.status === "inProgress").length,
            backlog: empTasks.filter(t => t.status === "backlog").length,
            total: empTasks.length,
            rating: emp.rating
          };
        });

      default:
        return [];
    }
  };

  const chartData = getChartData();

  // Navigation handlers
  const handleDrillDown = (id: string) => {
    switch (drilldown.level) {
      case "department":
        setDrilldown({ level: "management", managementId: id });
        break;
      case "management":
        setDrilldown({ 
          level: "division", 
          managementId: drilldown.managementId,
          divisionId: id 
        });
        break;
      case "division":
        setDrilldown({ 
          level: "employee",
          managementId: drilldown.managementId,
          divisionId: drilldown.divisionId,
          employeeId: id
        });
        break;
    }
  };

  const handleGoBack = () => {
    switch (drilldown.level) {
      case "management":
        setDrilldown({ level: "department" });
        break;
      case "division":
        setDrilldown({ 
          level: "management",
          managementId: drilldown.managementId 
        });
        break;
      case "employee":
        setDrilldown({ 
          level: "division",
          managementId: drilldown.managementId,
          divisionId: drilldown.divisionId
        });
        break;
    }
  };

  // Get current context name
  const getCurrentContext = () => {
    switch (drilldown.level) {
      case "department":
        return "ИТ Департамент";
      case "management": {
        const mgmt = managements.find(m => m.id === drilldown.managementId);
        return mgmt?.name || "";
      }
      case "division": {
        const div = divisions.find(d => d.id === drilldown.divisionId);
        return div?.name || "";
      }
      case "employee": {
        const emp = employees.find(e => e.id === drilldown.employeeId);
        return emp?.name || "";
      }
      default:
        return "";
    }
  };

  const getLevelIcon = () => {
    switch (drilldown.level) {
      case "department":
        return <Building2 className="text-primary" size={20} />;
      case "management":
        return <Building2 className="text-primary" size={20} />;
      case "division":
        return <Users className="text-primary" size={20} />;
      case "employee":
        return <User className="text-primary" size={20} />;
    }
  };

  const getLevelLabel = () => {
    switch (drilldown.level) {
      case "department":
        return "Уровень департамента";
      case "management":
        return "Уровень управления";
      case "division":
        return "Уровень отдела";
      case "employee":
        return "Уровень сотрудника";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-muted-foreground">Загрузка данных...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with breadcrumb */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {drilldown.level !== "department" && (
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
              {getLevelIcon()}
              <h1 className="text-3xl font-bold">{getCurrentContext()}</h1>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-xs">
                {getLevelLabel()}
              </Badge>
              <p className="text-muted-foreground text-sm">
                Аналитика производительности
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card data-testid="card-total-tasks">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-primary/20">
                <BarChart3 className="text-primary" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Всего задач</p>
                <p className="text-2xl font-bold font-mono" data-testid="text-total-tasks">
                  {stats.total}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-completion-rate">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-chart-3/20">
                <TrendingUp className="text-chart-3" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Завершено</p>
                <p className="text-2xl font-bold font-mono" data-testid="text-completion-rate">
                  {stats.completionRate}%
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-avg-hours">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-chart-1/20">
                <Clock className="text-chart-1" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Среднее время</p>
                <p className="text-2xl font-bold font-mono" data-testid="text-avg-hours">
                  {stats.avgHours}ч
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card data-testid="card-employee-count">
          <CardContent className="p-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-md bg-chart-5/20">
                <Users className="text-chart-5" size={24} />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Сотрудников</p>
                <p className="text-2xl font-bold font-mono" data-testid="text-employee-count">
                  {stats.employeeCount}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Chart - Performance by sublevel */}
      {drilldown.level !== "employee" && chartData.length > 0 && (
        <Card data-testid="card-performance-chart">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="text-primary" size={20} />
              {drilldown.level === "department" && "Производительность управлений"}
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
                  width={150}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '6px'
                  }}
                />
                <Legend />
                <Bar 
                  dataKey="completed" 
                  fill="hsl(var(--chart-3))" 
                  name="Завершено"
                  onClick={(data) => drilldown.level !== "division" && data.payload && handleDrillDown(data.payload.id)}
                  cursor={drilldown.level !== "division" ? "pointer" : "default"}
                />
                <Bar 
                  dataKey="inProgress" 
                  fill="hsl(var(--chart-1))" 
                  name="В работе"
                  onClick={(data) => drilldown.level !== "division" && data.payload && handleDrillDown(data.payload.id)}
                  cursor={drilldown.level !== "division" ? "pointer" : "default"}
                />
                <Bar 
                  dataKey="backlog" 
                  fill="hsl(var(--chart-4))" 
                  name="В ожидании"
                  onClick={(data) => drilldown.level !== "division" && data.payload && handleDrillDown(data.payload.id)}
                  cursor={drilldown.level !== "division" ? "pointer" : "default"}
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

      {/* Drillable Cards */}
      {drilldown.level !== "employee" && chartData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chartData.map((item: any) => (
            <Card 
              key={item.id}
              className="hover-elevate active-elevate-2 cursor-pointer transition-all"
              onClick={() => handleDrillDown(item.id)}
              data-testid={`card-drill-${item.id}`}
            >
              <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                <CardTitle className="text-lg font-semibold">
                  {item.name}
                </CardTitle>
                <ChevronRight size={20} className="text-muted-foreground" />
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
                  {typeof item.rating === 'number' && (
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
                        {item.divisions || item.employees}
                      </span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Employee Detail View */}
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

            {tasks.length > 0 && (
              <div className="mt-6">
                <h3 className="font-semibold mb-3">Последние задачи</h3>
                <div className="space-y-2">
                  {tasks.slice(0, 5).map(task => (
                    <div 
                      key={task.id}
                      className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                      data-testid={`task-item-${task.id}`}
                    >
                      <div className="flex-1">
                        <p className="font-medium">{task.title}</p>
                        <p className="text-sm text-muted-foreground">
                          {task.estimatedHours}ч • {task.type}
                        </p>
                      </div>
                      <Badge 
                        variant={
                          task.status === "completed" ? "default" : 
                          task.status === "inProgress" ? "secondary" : 
                          "outline"
                        }
                      >
                        {task.status === "completed" ? "Завершено" :
                         task.status === "inProgress" ? "В работе" :
                         task.status === "backlog" ? "В ожидании" :
                         task.status === "underReview" ? "На проверке" :
                         task.status === "overdue" ? "Просрочено" : task.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {drilldown.level !== "employee" && chartData.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center">
            <p className="text-muted-foreground">
              Нет данных для отображения на этом уровне
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
