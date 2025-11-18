import type { Task } from "@shared/schema";
import type { IStorage } from "../storage";

export async function reassignTasksFromTerminatedEmployee(
  storage: Pick<IStorage, "getAllTasks" | "updateTask" | "deleteEmployeeBids">,
  employeeId: string,
): Promise<void> {
  const activeTasks = await storage.getAllTasks({
    executorId: employeeId,
    statuses: ["IN_PROGRESS", "UNDER_REVIEW"],
  });

  await Promise.all(
    activeTasks.map((task) =>
      storage.updateTask(task.id, {
        executorId: task.creatorId,
        executorName: task.creatorName,
        auctionWinnerId: task.creatorId,
        auctionWinnerName: task.creatorName,
      } as Partial<Task>),
    ),
  );

  await storage.deleteEmployeeBids(employeeId);
}
