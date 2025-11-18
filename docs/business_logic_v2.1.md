# TaskFlow - Бизнес-логика версия 2.1

## Обзор изменений

Версия 2.1 представляет собой масштабное расширение системы с переходом от auction-only модели к поддержке трех типов задач и двух режимов аукционов.

## Ключевые изменения

### 1. Типы задач (TaskType)

**Было:** Только `auction` (аукционные задачи)

**Стало:** Три типа задач:
- **INDIVIDUAL** - индивидуальная задача, назначается сразу конкретному сотруднику без аукциона
  - Статус при создании: `IN_PROGRESS`
  - `executor_id` установлен сразу
  - `auction_mode` = null

- **UNIT** - задача для отдела через аукцион
  - Статус при создании: `BACKLOG`
  - `unit_id` обязателен
  - `auction_mode` ∈ {MONEY, TIME}

- **DEPARTMENT** - задача для департамента через аукцион
  - Статус при создании: `BACKLOG`
  - `department_id` обязателен
  - `auction_mode` ∈ {MONEY, TIME}

### 2. Режимы аукционов (AuctionMode)

**Было:** Только MONEY (денежные аукционы)

**Стало:** Два режима:
- **MONEY** - аукцион по сумме (деньги)
  - Поля: `base_price`, `value_money`
  - Вознаграждение: `earned_money`
  
- **TIME** - аукцион по времени (минуты)
  - Поля: `base_time_minutes`, `value_time_minutes`
  - Вознаграждение: `earned_time_minutes`
  - Время - отдельная "валюта", не связана с deadline

### 3. Переименование полей

| Старое название | Новое название | Комментарий |
|----------------|----------------|-------------|
| `assigneeId` | `executorId` | Исполнитель (кто выполняет) |
| `assigneeName` | `executorName` | Имя исполнителя |
| `completed` | `done` | Статус завершения |
| - | `done_at` | Дата перехода в DONE |

### 4. Новые поля задачи (Task)

```typescript
type: TaskType                    // INDIVIDUAL | UNIT | DEPARTMENT
auction_mode: AuctionMode | null  // MONEY | TIME | null (для INDIVIDUAL)
executor_id: string | null        // Исполнитель задачи
base_time_minutes: number | null  // Базовое время для TIME аукционов
earned_time_minutes: number | null // Заработанное время при DONE
auction_planned_end_at: Date | null // Планируемое время закрытия аукциона
current_price: decimal | null      // Текущая цена (растёт до 1.5×)
done_at: Date | null              // Момент перехода в DONE
```

### 5. Статусы (TaskStatus)

**Было:** `backlog`, `inProgress`, `underReview`, `completed`

**Стало:** `BACKLOG`, `IN_PROGRESS`, `UNDER_REVIEW`, `DONE`

Переходы:
- **INDIVIDUAL**: создание → `IN_PROGRESS` → `UNDER_REVIEW` → `DONE`
- **UNIT/DEPARTMENT**: создание → `BACKLOG` → `IN_PROGRESS` → `UNDER_REVIEW` → `DONE`
- `DONE` - финальный статус, переоткрытие запрещено

### 6. Ставки (AuctionBid)

Новые поля:
```typescript
value_money: decimal | null        // Ставка в деньгах (MONEY)
value_time_minutes: number | null  // Ставка в минутах (TIME)
is_active: boolean                 // Аннулирована или нет
```

**Аннулирование ставок:**
- При увольнении сотрудника: все его ставки `is_active = false`
- При переводе в другой департамент: ставки по задачам старого департамента аннулируются
- При переводе внутри департамента: ставки по задачам отделов, где сотрудник больше не числится

### 7. Логика аукционов

**Создатель НИКОГДА не участвует в аукционе**

**Аукцион без ставок:**
1. Цена/время растёт до 1.5× за 24 часа
2. Ещё 3 часа ожидания после достижения потолка
3. Автоматическое назначение создателю
4. Статус → `IN_PROGRESS`
5. Итоговая цена/время = увеличенное значение

**Выбор победителя:**
1. Минимальная ставка (value_money или value_time_minutes)
2. При равенстве → больше current_points
3. При равенстве → более ранний created_at

### 8. Вознаграждение

**При переходе в DONE:**
```typescript
final_points = base_points - penalty_points
```

**MONEY:**
```typescript
earned_money = выигранная ставка (value_money)
```

**TIME:**
```typescript
earned_time_minutes = выигранная ставка (value_time_minutes)
```

**Важно:** Просрочка влияет только на баллы, не на earned_money/earned_time_minutes

### 9. Вложения файлов (TaskAttachment)

Новая функциональность:

```typescript
TaskAttachment {
  id: string
  task_id: string
  uploader_id: string
  filename: string
  filesize_bytes: number
  storage_path: string
  created_at: Date
  deleted_at: Date | null
}
```

**Ограничения:**
- Максимум 10 файлов на задачу (активных)
- Максимальный размер файла: 25 МБ
- Типы файлов: без ограничений

**Права:**
- Создатель: может добавлять/удалять файлы на любом этапе
- Исполнитель: может добавлять файлы с `IN_PROGRESS` до `DONE`
- Удаление: создатель - любые файлы, исполнитель - только свои

### 10. История баллов (PointTransaction)

Новая таблица для отслеживания всех изменений баллов:

```typescript
PointTransaction {
  id: string
  employee_id: string
  task_id: string | null
  amount: number              // Изменение баллов (+/-)
  reason: string              // Причина начисления/списания
  created_at: Date
}
```

### 11. Просрочка

**Без изменений:**
- За каждый рабочий час просрочки: -1 балл
- Штраф копится до момента перевода в DONE
- `penalty_points = количество просроченных рабочих часов × (-1)`

### 12. Отчётность

**Новое:**
- Подсчёт по месяцам на основе `done_at`
- Агрегация: количество задач, баллы, деньги, время
- Уровни отчётов: сотрудник, отдел, управление, департамент

## Миграция данных

### Обратная совместимость

❌ **НЕ совместима** - требуется полная миграция:

1. Старые задачи с type='auction' → нужно определить новый тип (UNIT или DEPARTMENT)
2. Поля assigneeId/assigneeName → executorId/executorName
3. Статус 'completed' → 'done'
4. Добавить done_at для завершённых задач

### Рекомендации

1. Создать резервную копию БД перед миграцией
2. Запустить миграцию в тестовой среде
3. Проверить все аукционы и задачи
4. Обновить frontend компоненты

## Терминология

**Обновлённая:**
- **Unit** = Отдел (в коде используется `divisions`)
- **Management/Division** = Управление
- **Department** = Департамент
- **Executor** = Исполнитель (кто выполняет задачу)
- **Creator** = Создатель задачи

## Дата создания

18 ноября 2025

## Версия

2.1
