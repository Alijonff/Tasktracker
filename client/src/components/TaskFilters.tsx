import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter } from "lucide-react";
import { useState } from "react";

interface TaskFiltersProps {
  onFilterChange?: (filters: FilterState) => void;
}

export interface FilterState {
  search: string;
  status: string;
  type: string;
  department: string;
}

export default function TaskFilters({ onFilterChange }: TaskFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    search: "",
    status: "all",
    type: "all",
    department: "all",
  });

  const handleChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange?.(newFilters);
  };

  return (
    <div className="flex flex-col md:flex-row gap-3" data-testid="container-task-filters">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" size={18} />
        <Input
          placeholder="Поиск задач..."
          value={filters.search}
          onChange={(e) => handleChange("search", e.target.value)}
          className="pl-10"
          data-testid="input-search-tasks"
        />
      </div>
      
      <Select value={filters.status} onValueChange={(v) => handleChange("status", v)}>
        <SelectTrigger className="w-full md:w-40" data-testid="select-filter-status">
          <SelectValue placeholder="Статус" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все статусы</SelectItem>
          <SelectItem value="BACKLOG">Бэклог</SelectItem>
          <SelectItem value="IN_PROGRESS">В работе</SelectItem>
          <SelectItem value="UNDER_REVIEW">На проверке</SelectItem>
          <SelectItem value="DONE">Выполнена</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.type} onValueChange={(v) => handleChange("type", v)}>
        <SelectTrigger className="w-full md:w-40" data-testid="select-filter-type">
          <SelectValue placeholder="Тип" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все типы</SelectItem>
          <SelectItem value="INDIVIDUAL">Индивидуальная</SelectItem>
          <SelectItem value="UNIT">Командная</SelectItem>
          <SelectItem value="DEPARTMENT">Департамент</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.department} onValueChange={(v) => handleChange("department", v)}>
        <SelectTrigger className="w-full md:w-48" data-testid="select-filter-department">
          <SelectValue placeholder="Подразделение" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Все подразделения</SelectItem>
          <SelectItem value="engineering">Инженерный отдел</SelectItem>
          <SelectItem value="design">Отдел дизайна</SelectItem>
          <SelectItem value="marketing">Отдел маркетинга</SelectItem>
          <SelectItem value="sales">Отдел продаж</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="outline" size="icon" data-testid="button-advanced-filters">
        <Filter size={18} />
      </Button>
    </div>
  );
}
