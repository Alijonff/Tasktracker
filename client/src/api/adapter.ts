import { apiRequest } from "@/lib/queryClient";
import type { Task, PointTransaction, SelectUser } from "@shared/schema";
import { calculateGrade } from "@shared/utils";

export type AuctionStatus = "backlog" | "inProgress" | "underReview" | "completed";
export type Grade = "A" | "B" | "C" | "D";

export interface AuctionTaskSummary {
  id: string;
  title: string;
  description: string;
  status: AuctionStatus;
  departmentId?: string | null;
  managementId?: string | null;
  divisionId?: string | null;
  creatorId: string;
  creatorName: string;
  assigneeId?: string | null;
  assigneeName?: string | null;
  minimumGrade: Grade;
  deadline: string;
  startingPrice: number;
  currentPrice?: number;
  bidsCount: number;
  leadingBidderId?: string;
  leadingBidderName?: string;
  canBid: boolean;
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

const ENABLE_API_MOCKS = true;

const mockAuctionTasks: AuctionTaskSummary[] = [
  {
    id: "mock-1",
    title: "Редизайн лендинга корпоративного портала",
    description:
      "Подготовить полностью адаптивный лендинг с акцентом на новый брендбук и оплатой через UzPay.",
    status: "backlog",
    departmentId: "dep-1",
    creatorId: "user-director",
    creatorName: "Дилшод Каримов",
    minimumGrade: "C",
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 72).toISOString(),
    startingPrice: 1_500_000,
    currentPrice: 1_750_000,
    bidsCount: 4,
    leadingBidderId: "user-8",
    leadingBidderName: "Севинч Эргашева",
    canBid: true,
  },
  {
    id: "mock-2",
    title: "Интеграция автоплатежей в CRM",
    description:
      "Настроить синхронизацию с банковскими API и провести нагрузочное тестирование до 10k транзакций.",
    status: "inProgress",
    departmentId: "dep-1",
    creatorId: "user-director",
    creatorName: "Дилшод Каримов",
    minimumGrade: "B",
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 120).toISOString(),
    startingPrice: 2_800_000,
    currentPrice: 3_200_000,
    bidsCount: 7,
    leadingBidderId: "user-5",
    leadingBidderName: "Фаррух Норматов",
    canBid: false,
  },
  {
    id: "mock-3",
    title: "UX-аудит процесса регистрации",
    description:
      "Собрать аналитику по воронке регистрации и подготовить улучшения с обязательными A/B-тестами.",
    status: "underReview",
    departmentId: "dep-2",
    creatorId: "user-3",
    creatorName: "Нилуфар Саидова",
    minimumGrade: "D",
    deadline: new Date(Date.now() + 1000 * 60 * 60 * 48).toISOString(),
    startingPrice: 900_000,
    currentPrice: 1_050_000,
    bidsCount: 3,
    leadingBidderId: "user-6",
    leadingBidderName: "Мурат Алиев",
    canBid: false,
  },
  {
    id: "mock-4",
    title: "Исследование лояльности корпоративных клиентов",
    description:
      "Подготовить опрос, провести 25 интервью и оформить отчёт с рекомендациями по удержанию.",
    status: "completed",
    departmentId: "dep-3",
    creatorId: "user-7",
    creatorName: "Матлуба Рахматова",
    minimumGrade: "B",
    deadline: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3).toISOString(),
    startingPrice: 1_200_000,
    currentPrice: 1_400_000,
    bidsCount: 5,
    leadingBidderId: "user-9",
    leadingBidderName: "Сардор Юсупов",
    canBid: false,
  },
];

const mockPointHistory: PointTransaction[] = [
  {
    id: "ph-1",
    userId: "current",
    userName: "Дилшод Каримов",
    type: "task_completion",
    amount: 15,
    taskId: "mock-2",
    taskTitle: "Интеграция автоплатежей в CRM",
    comment: "Закрыта в срок",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 2),
  },
  {
    id: "ph-2",
    userId: "current",
    userName: "Дилшод Каримов",
    type: "task_completion",
    amount: 10,
    taskId: "mock-3",
    taskTitle: "UX-аудит процесса регистрации",
    comment: "Высокая оценка от заказчика",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 6),
  },
  {
    id: "ph-3",
    userId: "current",
    userName: "Дилшод Каримов",
    type: "position_assigned",
    amount: 5,
    taskId: null,
    taskTitle: null,
    comment: "Замещение руководителя на период отпуска",
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24 * 10),
  },
];

const mockPointsOverview: PointsOverview = {
  points: 72,
  grade: "B",
  nextGrade: "A",
  pointsToNext: 13,
};

const mockMetrics: DashboardMetrics = {
  completedTasks: 18,
  closedAuctionsAmount: 12_450_000,
  activeAuctions: 6,
  backlogTasks: 9,
};

type TaskApiResponse = { tasks: Task[] } | Task[];

function parseNumber(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : undefined;
}

function transformTask(task: Task): AuctionTaskSummary {
  const startingPrice = parseNumber(task.auctionInitialPrice) ?? parseNumber(task.estimatedHours) ?? 0;
  const currentPrice =
    parseNumber(task.auctionAssignedPrice) ?? parseNumber(task.auctionMaxPrice) ?? undefined;

  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: (task.status === "overdue" ? "inProgress" : task.status) as AuctionStatus,
    departmentId: task.departmentId,
    managementId: task.managementId ?? undefined,
    divisionId: task.divisionId ?? undefined,
    creatorId: task.creatorId,
    creatorName: task.creatorName,
    assigneeId: task.assigneeId ?? undefined,
    assigneeName: task.assigneeName ?? undefined,
    minimumGrade: (task.minimumGrade ?? "D") as Grade,
    deadline: new Date(task.deadline).toISOString(),
    startingPrice,
    currentPrice,
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
  return list.filter((task) => task.type === "auction").map(transformTask);
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
  if (ENABLE_API_MOCKS) {
    return applyClientFilters(mockAuctionTasks, params);
  }

  try {
    const tasks = await fetchTasksFromServer(params);
    return applyClientFilters(tasks, params);
  } catch (error) {
    console.warn("Falling back to auction mocks", error);
    return applyClientFilters(mockAuctionTasks, params);
  }
}

export async function listAuctions(params: ListAuctionsParams = {}): Promise<AuctionTaskSummary[]> {
  const { status, scope = "all", ...rest } = params;
  const statuses = Array.isArray(status)
    ? status
    : status
    ? [status]
    : rest.statuses ?? ["backlog"];

  const baseParams: ListTasksParams = {
    ...rest,
    scope,
    statuses,
  };

  return listTasks(baseParams);
}

export interface CreateAuctionTaskPayload {
  title: string;
  description: string;
  minimumGrade: Grade;
  startingPrice: number;
  deadline: string;
}

export async function createAuctionTask(payload: CreateAuctionTaskPayload): Promise<AuctionTaskSummary> {
  if (ENABLE_API_MOCKS) {
    const fallbackDepartment = payload.minimumGrade === "A" ? "dep-1" : "dep-2";

    const newTask: AuctionTaskSummary = {
      id: `mock-${Date.now()}`,
      title: payload.title,
      description: payload.description,
      status: "backlog",
      departmentId: fallbackDepartment,
      creatorId: "user-director",
      creatorName: "Дилшод Каримов",
      minimumGrade: payload.minimumGrade,
      deadline: payload.deadline,
      startingPrice: payload.startingPrice,
      currentPrice: undefined,
      bidsCount: 0,
      leadingBidderId: undefined,
      leadingBidderName: undefined,
      canBid: true,
    };
    mockAuctionTasks.unshift(newTask);
    return newTask;
  }

  const response = await apiRequest("POST", "/api/tasks/auction", payload);
  const data = (await response.json()) as Task;
  return transformTask(data);
}


export async function updateTaskStatus(taskId: string, status: AuctionStatus): Promise<void> {
  if (ENABLE_API_MOCKS) {
    const task = mockAuctionTasks.find((item) => item.id === taskId);
    if (task) {
      task.status = status;
    }
    return;
  }

  await apiRequest("PATCH", `/api/tasks/${taskId}/status`, { status });
}

export async function placeBid(taskId: string, amountSum: number): Promise<{ taskId: string; amount: number }> {
  if (ENABLE_API_MOCKS) {
    const task = mockAuctionTasks.find((item) => item.id === taskId);
    if (task) {
      task.currentPrice = amountSum;
      task.bidsCount += 1;
      task.leadingBidderId = "current";
      task.leadingBidderName = "Вы";
      task.canBid = false;
    }
    return { taskId, amount: amountSum };
  }

  await apiRequest("POST", `/api/tasks/${taskId}/bids`, { amount: amountSum });
  return { taskId, amount: amountSum };
}

export async function getDashboardMetrics(): Promise<DashboardMetrics> {
  if (ENABLE_API_MOCKS) {
    return mockMetrics;
  }

  try {
    const response = await apiRequest("GET", "/api/dashboard/overview");
    const data = await response.json();
    return {
      completedTasks: data.metrics.completedTasks?.value ?? 0,
      closedAuctionsAmount: data.metrics.closedAuctionsAmount?.value ?? 0,
      activeAuctions: data.metrics.activeAuctions?.value ?? 0,
      backlogTasks: data.metrics.backlogTasks?.value ?? 0,
    };
  } catch (error) {
    console.warn("Falling back to dashboard mocks", error);
    return mockMetrics;
  }
}

export async function getMyPoints(): Promise<PointsOverview> {
  if (ENABLE_API_MOCKS) {
    return mockPointsOverview;
  }

  try {
    const response = await apiRequest("GET", "/api/users/me/points");
    const data = await response.json();
    const grade = calculateGrade(data.points ?? 0);
    let nextGrade: Grade | undefined;
    let pointsToNext: number | undefined;

    if (grade === "D") {
      nextGrade = "C";
      pointsToNext = Math.max(0, 45 - data.points);
    } else if (grade === "C") {
      nextGrade = "B";
      pointsToNext = Math.max(0, 65 - data.points);
    } else if (grade === "B") {
      nextGrade = "A";
      pointsToNext = Math.max(0, 85 - data.points);
    }

    return {
      points: data.points ?? 0,
      grade,
      nextGrade,
      pointsToNext,
    };
  } catch (error) {
    console.warn("Falling back to points overview mocks", error);
    return mockPointsOverview;
  }
}

export async function getMyPointsHistory(): Promise<PointTransaction[]> {
  if (ENABLE_API_MOCKS) {
    return mockPointHistory;
  }

  try {
    const response = await apiRequest("GET", "/api/users/me/point-history");
    return await response.json();
  } catch (error) {
    console.warn("Falling back to points history mocks", error);
    return mockPointHistory;
  }
}

export function getAdapterMockControls() {
  return {
    isUsingMocks: ENABLE_API_MOCKS,
    toggleHint:
      "Чтобы переключить моки, измените флаг ENABLE_API_MOCKS в client/src/api/adapter.ts и перезапустите dev-сервер.",
  } as const;
}

export async function getReportsDefaultDept(
  currentUser?: Pick<SelectUser, "role" | "departmentId"> | null,
): Promise<ReportsDefaultDepartment> {
  if (ENABLE_API_MOCKS) {
    const isAdmin = currentUser?.role === "admin";
    return {
      defaultDepartmentId: currentUser?.departmentId ?? (isAdmin ? mockAuctionTasks[0]?.departmentId ?? null : "dep-1"),
      allowAllDepartments: isAdmin,
    };
  }

  try {
    const response = await apiRequest("GET", "/api/reports/default-department");
    const data = await response.json();
    return {
      defaultDepartmentId: data.departmentId ?? null,
      allowAllDepartments: Boolean(data.allowAllDepartments ?? (currentUser?.role === "admin")),
    };
  } catch (error) {
    console.warn("Falling back to reports default department", error);
    const isAdmin = currentUser?.role === "admin";
    return {
      defaultDepartmentId: currentUser?.departmentId ?? (isAdmin ? mockAuctionTasks[0]?.departmentId ?? null : null),
      allowAllDepartments: isAdmin,
    };
  }
}
