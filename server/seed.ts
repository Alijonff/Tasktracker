import { db } from "./db";
import { departments, managements, divisions, users, tasks, auctionBids } from "@shared/schema";

const roleGradeMap = {
  director: "A",
  manager: "B",
  senior: "C",
  employee: "D",
} as const;

async function seed() {
  console.log("🌱 Seeding database...");

  // Clear existing data
  await db.delete(auctionBids);
  await db.delete(tasks);
  await db.delete(users);
  await db.delete(divisions);
  await db.delete(managements);
  await db.delete(departments);

  // Create department
  const [dept] = await db.insert(departments).values({
    id: "dept-1",
    name: "Департамент разработки продуктов",
    leaderId: "emp-1",
    leaderName: "Александр Петров",
    employeeCount: 18,
  }).returning();

  console.log("✓ Created department:", dept.name);

  // Create managements
  const mgmt1 = await db.insert(managements).values({
    id: "mgmt-1",
    name: "Инженерное управление",
    departmentId: dept.id,
    leaderId: "emp-2",
    leaderName: "Мария Иванова",
    employeeCount: 10,
  }).returning();

  const mgmt2 = await db.insert(managements).values({
    id: "mgmt-2",
    name: "Операционное управление",
    departmentId: dept.id,
    leaderId: "emp-3",
    leaderName: "Дмитрий Смирнов",
    employeeCount: 8,
  }).returning();

  console.log("✓ Created 2 managements");

  // Create divisions
  const div1 = await db.insert(divisions).values({
    id: "div-1",
    name: "Отдел backend-разработки",
    managementId: mgmt1[0].id,
    departmentId: dept.id,
    leaderId: "emp-4",
    leaderName: "Елена Соколова",
    employeeCount: 5,
  }).returning();

  const div2 = await db.insert(divisions).values({
    id: "div-2",
    name: "Отдел frontend-разработки",
    managementId: mgmt1[0].id,
    departmentId: dept.id,
    leaderId: "emp-5",
    leaderName: "Игорь Васильев",
    employeeCount: 5,
  }).returning();

  const div3 = await db.insert(divisions).values({
    id: "div-3",
    name: "Отдел тестирования",
    managementId: mgmt2[0].id,
    departmentId: dept.id,
    leaderId: "emp-6",
    leaderName: "Ольга Новикова",
    employeeCount: 4,
  }).returning();

  const div4 = await db.insert(divisions).values({
    id: "div-4",
    name: "Отдел DevOps",
    managementId: mgmt2[0].id,
    departmentId: dept.id,
    leaderId: "emp-7",
    leaderName: "Сергей Морозов",
    employeeCount: 4,
  }).returning();

  console.log("✓ Created 4 divisions");

  // Create employees
  const employeesData = [
    // Leaders
    { id: "emp-1", name: "Александр Петров", email: "a.petrov@company.com", divisionId: div1[0].id, managementId: mgmt1[0].id, departmentId: dept.id, role: "director" as const, positionType: "director" as const },
    { id: "emp-2", name: "Мария Иванова", email: "m.ivanova@company.com", divisionId: div1[0].id, managementId: mgmt1[0].id, departmentId: dept.id, role: "manager" as const, positionType: "management_head" as const },
    { id: "emp-3", name: "Дмитрий Смирнов", email: "d.smirnov@company.com", divisionId: div3[0].id, managementId: mgmt2[0].id, departmentId: dept.id, role: "manager" as const, positionType: "management_head" as const },
    { id: "emp-4", name: "Елена Соколова", email: "e.sokolova@company.com", divisionId: div1[0].id, managementId: mgmt1[0].id, departmentId: dept.id, role: "manager" as const, positionType: "division_head" as const },
    { id: "emp-5", name: "Игорь Васильев", email: "i.vasiliev@company.com", divisionId: div2[0].id, managementId: mgmt1[0].id, departmentId: dept.id, role: "manager" as const, positionType: "division_head" as const },
    { id: "emp-6", name: "Ольга Новикова", email: "o.novikova@company.com", divisionId: div3[0].id, managementId: mgmt2[0].id, departmentId: dept.id, role: "manager" as const, positionType: "division_head" as const },
    { id: "emp-7", name: "Сергей Морозов", email: "s.morozov@company.com", divisionId: div4[0].id, managementId: mgmt2[0].id, departmentId: dept.id, role: "manager" as const, positionType: "division_head" as const },
    
    // Backend team
    { id: "emp-8", name: "Анна Козлова", email: "a.kozlova@company.com", divisionId: div1[0].id, managementId: mgmt1[0].id, departmentId: dept.id, role: "senior" as const, positionType: "senior" as const },
    { id: "emp-9", name: "Павел Орлов", email: "p.orlov@company.com", divisionId: div1[0].id, managementId: mgmt1[0].id, departmentId: dept.id, role: "employee" as const, positionType: "employee" as const },
    { id: "emp-10", name: "Татьяна Волкова", email: "t.volkova@company.com", divisionId: div1[0].id, managementId: mgmt1[0].id, departmentId: dept.id, role: "employee" as const, positionType: "employee" as const },
    
    // Frontend team
    { id: "emp-11", name: "Михаил Лебедев", email: "m.lebedev@company.com", divisionId: div2[0].id, managementId: mgmt1[0].id, departmentId: dept.id, role: "senior" as const, positionType: "senior" as const },
    { id: "emp-12", name: "Наталья Егорова", email: "n.egorova@company.com", divisionId: div2[0].id, managementId: mgmt1[0].id, departmentId: dept.id, role: "employee" as const, positionType: "employee" as const },
    { id: "emp-13", name: "Владимир Киселёв", email: "v.kiselev@company.com", divisionId: div2[0].id, managementId: mgmt1[0].id, departmentId: dept.id, role: "employee" as const, positionType: "employee" as const },
    
    // QA team
    { id: "emp-14", name: "Екатерина Павлова", email: "e.pavlova@company.com", divisionId: div3[0].id, managementId: mgmt2[0].id, departmentId: dept.id, role: "senior" as const, positionType: "senior" as const },
    { id: "emp-15", name: "Андрей Федоров", email: "a.fedorov@company.com", divisionId: div3[0].id, managementId: mgmt2[0].id, departmentId: dept.id, role: "employee" as const, positionType: "employee" as const },
    { id: "emp-16", name: "Юлия Романова", email: "y.romanova@company.com", divisionId: div3[0].id, managementId: mgmt2[0].id, departmentId: dept.id, role: "employee" as const, positionType: "employee" as const },
    
    // DevOps team
    { id: "emp-17", name: "Денис Семёнов", email: "d.semenov@company.com", divisionId: div4[0].id, managementId: mgmt2[0].id, departmentId: dept.id, role: "senior" as const, positionType: "senior" as const },
    { id: "emp-18", name: "Светлана Захарова", email: "s.zakharova@company.com", divisionId: div4[0].id, managementId: mgmt2[0].id, departmentId: dept.id, role: "employee" as const, positionType: "employee" as const },
  ];

  const usersData = employeesData.map((employee) => ({
    ...employee,
    username: employee.email.split("@")[0],
    passwordHash: "seed-placeholder-hash",
    grade: roleGradeMap[employee.role],
  }));

  await db.insert(users).values(usersData);
  console.log("✓ Created 18 employees");

  // Create tasks
  const tasksData = [
    {
      id: "task-1",
      title: "Реализовать REST API для управления пользователями",
      description: "Создать endpoints для CRUD операций с пользователями, включая валидацию и обработку ошибок",
      status: "IN_PROGRESS" as const,
      type: "INDIVIDUAL" as const,
      departmentId: dept.id,
      managementId: mgmt1[0].id,
      divisionId: div1[0].id,
      creatorId: "emp-4",
      creatorName: "Елена Соколова",
      executorId: "emp-8",
      executorName: "Анна Козлова",
      minimumGrade: "C" as const,
      deadline: new Date("2024-12-20"),
    },
    {
      id: "task-2",
      title: "Оптимизация запросов к базе данных",
      description: "Провести анализ и оптимизацию медленных запросов, добавить индексы где необходимо",
      status: "UNDER_REVIEW" as const,
      type: "INDIVIDUAL" as const,
      departmentId: dept.id,
      managementId: mgmt1[0].id,
      divisionId: div1[0].id,
      creatorId: "emp-2",
      creatorName: "Мария Иванова",
      executorId: "emp-9",
      executorName: "Павел Орлов",
      minimumGrade: "D" as const,
      deadline: new Date("2024-12-18"),
    },
    {
      id: "task-3",
      title: "Интеграция с платежной системой",
      description: "Реализовать интеграцию с платежным провайдером для обработки онлайн-платежей",
      status: "BACKLOG" as const,
      type: "DEPARTMENT" as const,
      departmentId: dept.id,
      managementId: mgmt1[0].id,
      divisionId: div1[0].id,
      creatorId: "emp-1",
      creatorName: "Александр Петров",
      minimumGrade: "C" as const,
      deadline: new Date("2024-12-25"),
      auctionStartAt: new Date("2024-12-16T09:00:00Z"),
      auctionPlannedEndAt: new Date("2024-12-17T09:00:00Z"),
      auctionMode: "TIME" as const,
      baseTimeMinutes: 32 * 60,
    },
    {
      id: "task-3b",
      title: "Рефакторинг модуля аутентификации",
      description: "Провести рефакторинг кода аутентификации для повышения безопасности",
      status: "BACKLOG" as const,
      type: "UNIT" as const,
      departmentId: dept.id,
      managementId: mgmt1[0].id,
      divisionId: div1[0].id,
      creatorId: "emp-2",
      creatorName: "Мария Иванова",
      minimumGrade: "C" as const,
      deadline: new Date("2024-12-26"),
      auctionStartAt: new Date("2024-12-16T10:00:00Z"),
      auctionPlannedEndAt: new Date("2024-12-17T10:00:00Z"),
      auctionMode: "MONEY" as const,
      basePrice: "5000.00",
    },
    {
      id: "task-4",
      title: "Разработать дашборд аналитики",
      description: "Создать интерактивный дашборд с графиками и метриками производительности",
      status: "IN_PROGRESS" as const,
      type: "INDIVIDUAL" as const,
      departmentId: dept.id,
      managementId: mgmt1[0].id,
      divisionId: div2[0].id,
      creatorId: "emp-5",
      creatorName: "Игорь Васильев",
      executorId: "emp-11",
      executorName: "Михаил Лебедев",
      minimumGrade: "C" as const,
      deadline: new Date("2024-12-22"),
    },
    {
      id: "task-5",
      title: "Оптимизация производительности приложения",
      description: "Улучшить время загрузки страниц и общую отзывчивость интерфейса",
      status: "BACKLOG" as const,
      type: "DEPARTMENT" as const,
      departmentId: dept.id,
      managementId: mgmt1[0].id,
      divisionId: div2[0].id,
      creatorId: "emp-2",
      creatorName: "Мария Иванова",
      minimumGrade: "C" as const,
      deadline: new Date("2024-12-30"),
      auctionStartAt: new Date("2024-12-17T09:00:00Z"),
      auctionPlannedEndAt: new Date("2024-12-18T09:00:00Z"),
      auctionMode: "TIME" as const,
      baseTimeMinutes: 24 * 60,
    },
    {
      id: "task-6",
      title: "Адаптивная верстка для мобильных устройств",
      description: "Доработать responsive дизайн для всех основных экранов приложения",
      status: "DONE" as const,
      type: "INDIVIDUAL" as const,
      departmentId: dept.id,
      managementId: mgmt1[0].id,
      divisionId: div2[0].id,
      creatorId: "emp-5",
      creatorName: "Игорь Васильев",
      executorId: "emp-12",
      executorName: "Наталья Егорова",
      minimumGrade: "D" as const,
      deadline: new Date("2024-12-15"),
      doneAt: new Date("2024-12-15T18:00:00Z"),
    },
    {
      id: "task-7",
      title: "Автоматизация E2E тестирования",
      description: "Написать автоматические тесты для основных пользовательских сценариев",
      status: "IN_PROGRESS" as const,
      type: "INDIVIDUAL" as const,
      departmentId: dept.id,
      managementId: mgmt2[0].id,
      divisionId: div3[0].id,
      creatorId: "emp-6",
      creatorName: "Ольга Новикова",
      executorId: "emp-14",
      executorName: "Екатерина Павлова",
      minimumGrade: "C" as const,
      deadline: new Date("2024-12-21"),
    },
    {
      id: "task-8",
      title: "Тестирование новой функциональности платежей",
      description: "Провести полное функциональное тестирование платежного модуля",
      status: "BACKLOG" as const,
      type: "INDIVIDUAL" as const,
      departmentId: dept.id,
      managementId: mgmt2[0].id,
      divisionId: div3[0].id,
      creatorId: "emp-3",
      creatorName: "Дмитрий Смирнов",
      executorId: "emp-15",
      executorName: "Андрей Федоров",
      minimumGrade: "D" as const,
      deadline: new Date("2024-12-28"),
    },
    {
      id: "task-9",
      title: "Настройка CI/CD pipeline",
      description: "Автоматизировать процесс сборки, тестирования и деплоя приложения",
      status: "UNDER_REVIEW" as const,
      type: "INDIVIDUAL" as const,
      departmentId: dept.id,
      managementId: mgmt2[0].id,
      divisionId: div4[0].id,
      creatorId: "emp-7",
      creatorName: "Сергей Морозов",
      executorId: "emp-17",
      executorName: "Денис Семёнов",
      minimumGrade: "C" as const,
      deadline: new Date("2024-12-19"),
    },
    {
      id: "task-10",
      title: "Мониторинг и логирование",
      description: "Настроить систему мониторинга производительности и централизованного логирования",
      status: "BACKLOG" as const,
      type: "DEPARTMENT" as const,
      departmentId: dept.id,
      managementId: mgmt2[0].id,
      divisionId: div4[0].id,
      creatorId: "emp-1",
      creatorName: "Александр Петров",
      minimumGrade: "C" as const,
      deadline: new Date("2024-12-27"),
      auctionStartAt: new Date("2024-12-18T09:00:00Z"),
      auctionPlannedEndAt: new Date("2024-12-19T09:00:00Z"),
      auctionMode: "TIME" as const,
      baseTimeMinutes: 26 * 60,
    },
  ];

  await db.insert(tasks).values(tasksData);
  console.log("✓ Created 11 tasks");

  // Create auction bids
  const bidsData = [
    {
      id: "bid-1",
      taskId: "task-3",
      bidderId: "emp-8",
      bidderName: "Анна Козлова",
      bidderGrade: "C" as const,
      bidderRating: "4.8",
      bidderPoints: 98,
      valueTimeMinutes: 28 * 60,
    },
    {
      id: "bid-2",
      taskId: "task-3",
      bidderId: "emp-10",
      bidderName: "Татьяна Волкова",
      bidderGrade: "D" as const,
      bidderRating: "4.6",
      bidderPoints: 82,
      valueTimeMinutes: 30 * 60,
    },
    {
      id: "bid-3",
      taskId: "task-5",
      bidderId: "emp-11",
      bidderName: "Михаил Лебедев",
      bidderGrade: "C" as const,
      bidderRating: "4.7",
      bidderPoints: 92,
      valueTimeMinutes: 22 * 60,
    },
    {
      id: "bid-4",
      taskId: "task-5",
      bidderId: "emp-13",
      bidderName: "Владимир Киселёв",
      bidderGrade: "D" as const,
      bidderRating: "4.5",
      bidderPoints: 72,
      valueTimeMinutes: 23 * 60,
    },
    {
      id: "bid-5",
      taskId: "task-10",
      bidderId: "emp-17",
      bidderName: "Денис Семёнов",
      bidderGrade: "C" as const,
      bidderRating: "4.6",
      bidderPoints: 87,
      valueTimeMinutes: 24 * 60,
    },
    {
      id: "bid-6",
      taskId: "task-3b",
      bidderId: "emp-8",
      bidderName: "Анна Козлова",
      bidderGrade: "C" as const,
      bidderRating: "4.8",
      bidderPoints: 98,
      valueMoney: "4500.00",
    },
    {
      id: "bid-7",
      taskId: "task-3b",
      bidderId: "emp-9",
      bidderName: "Павел Орлов",
      bidderGrade: "D" as const,
      bidderRating: "4.5",
      bidderPoints: 76,
      valueMoney: "4700.00",
    },
  ];

  await db.insert(auctionBids).values(bidsData);
  console.log("✓ Created 7 auction bids");

  console.log("✅ Database seeded successfully!");
}

seed().catch((error) => {
  console.error("❌ Seed failed:", error);
  process.exit(1);
});
