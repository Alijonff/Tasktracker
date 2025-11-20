import { apiRequest } from "@/lib/queryClient";
import type { Task, PointTransaction, SelectUser } from "@shared/schema";
import type { TaskMode, TaskType } from "@shared/taskMetadata";
import { calculateGradeProgress } from "@shared/utils";

export type AuctionStatus = Task["status"];
export type Grade = "A" | "B" | "C" | "D";

export interface AuctionTaskSummary {
  id: string;
  title: string;
  description: string;
  status: AuctionStatus;
  mode: TaskMode;
  taskType: TaskType;
  departmentId?: string | null;
  managementId?: string | null;
  divisionId?: string | null;
  creatorId: string;
  creatorName: string;
  executorId?: string | null;
  executorName?: string | null;
  minimumGrade: Grade;
  deadline: string;
  startingPrice: number;
  currentPrice?: number;
  bidsCount: number;
  leadingBidderId?: string;
  leadingBidderName?: string;
  canBid: boolean;
  earnedMoney?: string | number | null;
  earnedTimeMinutes?: number | null;
  assignedPoints?: number | null;
  updatedAt?: string | null;
  doneAt?: string | null;
}

export interface ListTasksParams {
  scope?: "all" | "mine";
  search?: string;
  participantId?: string;
  onlyMyDepartment?: boolean;
  currentUser?: Pick<SelectUser, "id" | "departmentId"> | null;
  departmentId?: string;
  managementId?: string;
  divisionId?: string;
  statuses?: AuctionStatus[];
}

export interface ListAuctionsParams extends Omit<ListTasksParams, "scope"> {
  scope?: ListTasksParams["scope"];
  status?: AuctionStatus | AuctionStatus[];
}

export interface ReportsDefaultDepartment {
  defaultDepartmentId: string | null;
  allowAllDepartments: boolean;
}

export interface DashboardMetrics {
  completedTasks: number;
  closedAuctionsAmount: number;
  activeAuctions: number;
  backlogTasks: number;
}

export interface PointsOverview {
  points: number;
  grade: Grade;
  nextGrade?: Grade;
  pointsToNext?: number;
}

const EMPTY_METRICS: DashboardMetrics = {
  completedTasks: 0,
  closedAuctionsAmount: 0,
  activeAuctions: 0,
  backlogTasks: 0,
};

type TaskApiResponse = { tasks: Task[] } | Task[];

function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function transformTask(task: Task): AuctionTaskSummary {
  const mode = ((task as any).auctionMode as TaskMode) ?? ((task as any).mode as TaskMode) ?? "MONEY";
  const taskType = ((task as any).taskType as TaskType) ?? (task.type as TaskType) ?? "DEPARTMENT";
  const startingPrice =
    mode === "TIME"
      ? parseNumber((task as any).auctionInitialAmount) ?? parseNumber(task.baseTimeMinutes) ?? 0
      : parseNumber((task as any).auctionInitialAmount) ??
      parseNumber(task.basePrice) ??
      parseNumber((task as any).auctionInitialPrice) ??
      parseNumber(task.estimatedHours) ??
      0;
  const currentPrice =
    mode === "TIME"
      ? parseNumber((task as any).auctionCurrentAmount) ??
      parseNumber(task.currentPrice) ??
      parseNumber(task.earnedTimeMinutes) ??
      parseNumber(task.baseTimeMinutes)
      : parseNumber((task as any).auctionCurrentAmount) ??
      parseNumber(task.currentPrice) ??
      parseNumber(task.earnedMoney) ??
      parseNumber(task.basePrice) ??
      parseNumber((task as any).auctionMaxPrice) ??
      parseNumber(task.auctionAssignedPrice) ??
      parseNumber(task.auctionMaxPrice) ??
      undefined;

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status as AuctionStatus,
    mode,
    taskType,
    departmentId: task.departmentId,
    managementId: task.managementId ?? undefined,
    divisionId: task.divisionId ?? undefined,
    creatorId: task.creatorId,
    creatorName: task.creatorName,
    executorId: task.executorId ?? undefined,
    executorName: task.executorName ?? undefined,
    minimumGrade: (task.minimumGrade ?? "D") as Grade,
    deadline: new Date(task.deadline).toISOString(),
    startingPrice,
    currentPrice,
    earnedMoney: task.earnedMoney ?? undefined,
    earnedTimeMinutes: task.earnedTimeMinutes ?? undefined,
    assignedPoints: task.assignedPoints ?? undefined,
    updatedAt: task.updatedAt ? new Date(task.updatedAt).toISOString() : undefined,
    doneAt: task.doneAt ? new Date(task.doneAt).toISOString() : undefined,
    bidsCount: 0,
    leadingBidderId: task.auctionWinnerId ?? undefined,
    leadingBidderName: task.auctionWinnerName ?? undefined,
    canBid: true,
  };
}

async function fetchTasksFromServer(params: ListTasksParams): Promise<AuctionTaskSummary[]> {
  const searchParams = new URLSearchParams();
  if (params.search) searchParams.set("search", params.search);
  if (params.participantId) searchParams.set("participantId", params.participantId);
  if (params.currentUser?.departmentId && params.onlyMyDepartment) {
    searchParams.set("departmentId", params.currentUser.departmentId);
  }
  if (params.departmentId) searchParams.set("departmentId", params.departmentId);
  if (params.managementId) searchParams.set("managementId", params.managementId);
  if (params.divisionId) searchParams.set("divisionId", params.divisionId);
  if (params.statuses?.length) searchParams.set("statuses", params.statuses.join(","));

  const baseUrl = params.scope === "mine" ? "/api/my-tasks" : "/api/tasks";
  const query = searchParams.toString();
  const url = query ? `${baseUrl}?${query}` : baseUrl;
  const response = await apiRequest("GET", url);
  const data = (await response.json()) as TaskApiResponse;
  const list = Array.isArray(data) ? data : data.tasks;
  const transformed = list.map(transformTask);
  return transformed;
}

function applyClientFilters(tasks: AuctionTaskSummary[], params: ListTasksParams): AuctionTaskSummary[] {
  let filtered = [...tasks];

  if (params.onlyMyDepartment && params.currentUser?.departmentId) {
    filtered = filtered.filter((task) => task.departmentId === params.currentUser?.departmentId);
  }

  if (params.departmentId) {
    filtered = filtered.filter((task) => task.departmentId === params.departmentId);
  }

  if (params.managementId) {
    filtered = filtered.filter((task) => task.managementId === params.managementId);
  }

  if (params.divisionId) {
    filtered = filtered.filter((task) => task.divisionId === params.divisionId);
  }

  if (params.participantId) {
    filtered = filtered.filter(
      (task) => task.creatorId === params.participantId || task.leadingBidderId === params.participantId,
    );
  }

  if (params.search) {
    const normalized = params.search.trim().toLowerCase();
    filtered = filtered.filter((task) =>
      task.title.toLowerCase().includes(normalized) || task.description.toLowerCase().includes(normalized),
    );
  }

  if (params.statuses?.length) {
    const allowed = new Set(params.statuses);
    filtered = filtered.filter((task) => allowed.has(task.status));
  }

  return filtered;
}

export async function listTasks(params: ListTasksParams = {}): Promise<AuctionTaskSummary[]> {
  try {
    const tasks = await fetchTasksFromServer(params);
    return applyClientFilters(tasks, params);
  } catch (error) {
    console.warn("Failed to load tasks", error);
    return [];
  }
}

export async function listAuctions(params: ListAuctionsParams = {}): Promise<AuctionTaskSummary[]> {
  const { status, scope = "all", ...rest } = params;
  const statuses = Array.isArray(status)
    ? status
    : status
      ? [status]
      : rest.statuses ?? ["BACKLOG"];

  try {
    const response = await apiRequest("GET", "/api/auctions/active");
    const data = (await response.json()) as Task[];
    const transformed = data.map(transformTask);
    const filtered = applyClientFilters(transformed, { ...rest, scope, statuses });
    return filtered.filter((task) => task.taskType !== "INDIVIDUAL");
  } catch (error) {
    console.warn("Failed to load auctions", error);
    return [];
  }
}

export interface CreateAuctionTaskPayload {
  title: string;
  description: string;
  minimumGrade: Grade;
  startingPrice: number;
  deadline: string;
  departmentId?: string;
  managementId?: string;
  divisionId?: string;
  mode?: TaskMode;
  taskType?: TaskType;
}

export async function createAuctionTask(payload: CreateAuctionTaskPayload): Promise<AuctionTaskSummary> {
  const response = await apiRequest("POST", "/api/tasks", {
    title: payload.title,
    description: payload.description,
    type: payload.taskType ?? "DEPARTMENT",
    mode: payload.mode ?? "MONEY",
    taskType: payload.taskType ?? "DEPARTMENT",
    minimumGrade: payload.minimumGrade,
    deadline: payload.deadline,
    departmentId: payload.departmentId,
    managementId: payload.managementId,
    divisionId: payload.divisionId,
    auctionInitialSum: payload.startingPrice,
  });
  const data = (await response.json()) as Task;
  return transformTask(data);
}

export async function updateTaskStatus(taskId: string, status: AuctionStatus): Promise<void> {
  await apiRequest("PATCH", `/api/tasks/${taskId}/status`, { status });
}

export async function placeBid(
  taskId: string,
  amountSum: number,
  mode: TaskMode,
): Promise<{ taskId: string; amount: number }> {
  const payload = mode === "TIME" ? { valueTimeMinutes: amountSum } : { valueMoney: amountSum };
  await apiRequest("POST", `/api/tasks/${taskId}/bids`, payload);
  return { taskId, amount: amountSum };
}

export interface BidHistoryItem {
  id: string;
  bidder: string;
  bidderName: string;
  amount: number;
  timestamp: string;
  rating?: number;
  grade?: Grade;
}

export async function getBidsForTask(taskId: string): Promise<BidHistoryItem[]> {
  try {
    const response = await apiRequest("GET", `/api/tasks/${taskId}/bids`);
    const data = await response.json();

    if (!Array.isArray(data)) {
      console.warn("Invalid bids response", data);
      return [];
    }

    return data.map((bid: any) => {
      const rawAmount = bid.valueMoney ?? bid.valueTimeMinutes;
      const amount = parseNumber(rawAmount) ?? 0;
      const rating = parseNumber(bid.bidderRating);

      return {
        id: bid.id,
        bidder: bid.bidderName ?? "Unknown",
        bidderName: bid.bidderName ?? "Unknown",
        amount,
        timestamp: new Date(bid.createdAt).toLocaleString("ru-RU"),
        rating: rating ?? undefined,
        grade: bid.bidderGrade,
      } satisfies BidHistoryItem;
    });
  } catch (error) {
    console.warn("Failed to load bids for task", taskId, error);
    return [];
  }
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  try {
    const response = await apiRequest("GET", "/api/dashboard/overview");
    const data = await response.json();
    return {
      completedTasks: data.metrics?.completedTasks?.value ?? 0,
      closedAuctionsAmount: data.metrics?.closedAuctionsAmount?.value ?? 0,
      activeAuctions: data.metrics?.activeAuctions?.value ?? 0,
      backlogTasks: data.metrics?.backlogTasks?.value ?? 0,
    };
  } catch (error) {
    console.warn("Failed to load dashboard metrics", error);
    return EMPTY_METRICS;
  }
}

export async function getMyPoints(): Promise<PointsOverview> {
  const response = await apiRequest("GET", "/api/users/me/points");
  const data = await response.json();
  const numericPoints = typeof data.points === "number" ? data.points : Number(data.points);

  if (!Number.isFinite(numericPoints)) {
    throw new Error("Некорректное значение баллов пользователя");
  }

  const safePoints = Number(numericPoints);
  const { grade, nextGrade, pointsToNext } = calculateGradeProgress(safePoints);

  return {
    points: safePoints,
    grade,
    nextGrade,
    pointsToNext,
  };
}

export async function getMyPointsHistory(): Promise<PointTransaction[]> {
  const response = await apiRequest("GET", "/api/users/me/point-history");
  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error("Некорректный ответ сервера: ожидался список транзакций");
  }

  return data;
}

export async function getReportsDefaultDept(
  currentUser?: Pick<SelectUser, "role" | "departmentId"> | null,
): Promise<ReportsDefaultDepartment> {
  try {
    const response = await apiRequest("GET", "/api/reports/default-department");
    const data = await response.json();
    return {
      defaultDepartmentId: data.departmentId ?? null,
      allowAllDepartments: Boolean(data.allowAllDepartments ?? (currentUser?.role === "admin")),
    };
  } catch (error) {
    console.warn("Failed to load reports default department", error);
    return {
      defaultDepartmentId: currentUser?.departmentId ?? null,
      allowAllDepartments: currentUser?.role === "admin",
    };
  }
}
