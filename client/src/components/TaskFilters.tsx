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
          placeholder="Search tasks..."
          value={filters.search}
          onChange={(e) => handleChange("search", e.target.value)}
          className="pl-10"
          data-testid="input-search-tasks"
        />
      </div>
      
      <Select value={filters.status} onValueChange={(v) => handleChange("status", v)}>
        <SelectTrigger className="w-full md:w-40" data-testid="select-filter-status">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Status</SelectItem>
          <SelectItem value="backlog">Backlog</SelectItem>
          <SelectItem value="inProgress">In Progress</SelectItem>
          <SelectItem value="underReview">Under Review</SelectItem>
          <SelectItem value="completed">Completed</SelectItem>
          <SelectItem value="overdue">Overdue</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.type} onValueChange={(v) => handleChange("type", v)}>
        <SelectTrigger className="w-full md:w-40" data-testid="select-filter-type">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Types</SelectItem>
          <SelectItem value="individual">Individual</SelectItem>
          <SelectItem value="auction">Auction</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.department} onValueChange={(v) => handleChange("department", v)}>
        <SelectTrigger className="w-full md:w-48" data-testid="select-filter-department">
          <SelectValue placeholder="Department" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Departments</SelectItem>
          <SelectItem value="engineering">Engineering</SelectItem>
          <SelectItem value="design">Design</SelectItem>
          <SelectItem value="marketing">Marketing</SelectItem>
          <SelectItem value="sales">Sales</SelectItem>
        </SelectContent>
      </Select>

      <Button variant="outline" size="icon" data-testid="button-advanced-filters">
        <Filter size={18} />
      </Button>
    </div>
  );
}
