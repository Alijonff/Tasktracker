import type { Task } from "@shared/schema";
import type { IStorage } from "../storage";

export async function reassignTasksFromTerminatedEmployee(
  storage: Pick<IStorage, "getAllTasks" | "updateTask" | "deleteEmployeeBids">,
  employeeId: string,
): Promise<void> {
  const activeTasks = await storage.getAllTasks({
    assigneeId: employeeId,
    statuses: ["inProgress", "underReview"],
  });

  await Promise.all(
    activeTasks.map((task) =>
      storage.updateTask(task.id, {
        assigneeId: task.creatorId,
        assigneeName: task.creatorName,
        auctionWinnerId: task.creatorId,
        auctionWinnerName: task.creatorName,
      } as Partial<Task>),
    ),
  );

  await storage.deleteEmployeeBids(employeeId);
}
