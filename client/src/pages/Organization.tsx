import { useState } from "react";
import OrganizationTree, { OrgNode } from "@/components/OrganizationTree";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus } from "lucide-react";

const initialOrgData: OrgNode[] = [
  {
    id: "dept-1",
    name: "Engineering Department",
    type: "department",
    leader: "Sarah Johnson",
    rating: 4.7,
    employeeCount: 45,
    children: [
      {
        id: "mgmt-1",
        name: "Backend Development",
        type: "management",
        leader: "Mike Chen",
        rating: 4.8,
        employeeCount: 15,
        children: [
          {
            id: "div-1",
            name: "API Team",
            type: "division",
            leader: "Alex Rivera",
            rating: 4.6,
            employeeCount: 8,
          },
          {
            id: "div-2",
            name: "Database Team",
            type: "division",
            leader: "Emma Wilson",
            rating: 4.9,
            employeeCount: 7,
          },
        ],
      },
      {
        id: "mgmt-2",
        name: "Frontend Development",
        type: "management",
        leader: "David Park",
        rating: 4.9,
        employeeCount: 12,
        children: [
          {
            id: "div-3",
            name: "Web Team",
            type: "division",
            leader: "Lisa Wang",
            rating: 4.7,
            employeeCount: 7,
          },
        ],
      },
    ],
  },
  {
    id: "dept-2",
    name: "Design Department",
    type: "department",
    leader: "Jessica Martinez",
    rating: 4.8,
    employeeCount: 18,
    children: [
      {
        id: "mgmt-3",
        name: "UI/UX Design",
        type: "management",
        leader: "Tom Anderson",
        rating: 4.9,
        employeeCount: 10,
      },
    ],
  },
];

interface AddDepartmentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (department: { name: string; leader: string; rating?: number; employeeCount?: number }) => void;
}

function AddDepartmentDialog({ open, onOpenChange, onSubmit }: AddDepartmentDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    leader: "",
    rating: "",
    employeeCount: "",
  });

  const resetForm = () =>
    setFormData({
      name: "",
      leader: "",
      rating: "",
      employeeCount: "",
    });

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = formData.name.trim();
    const trimmedLeader = formData.leader.trim();

    if (!trimmedName || !trimmedLeader) {
      return;
    }

    const parsedRating = formData.rating ? Number(formData.rating) : undefined;
    const parsedEmployeeCount = formData.employeeCount ? Number(formData.employeeCount) : undefined;

    onSubmit({
      name: trimmedName,
      leader: trimmedLeader,
      rating: parsedRating,
      employeeCount: parsedEmployeeCount,
    });

    resetForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="dialog-add-department">
        <DialogHeader>
          <DialogTitle>Новый департамент</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="department-name">Название *</Label>
            <Input
              id="department-name"
              value={formData.name}
              onChange={(event) => setFormData({ ...formData, name: event.target.value })}
              placeholder="Например, Администрация"
              required
              data-testid="input-department-name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="department-leader">Руководитель *</Label>
            <Input
              id="department-leader"
              value={formData.leader}
              onChange={(event) => setFormData({ ...formData, leader: event.target.value })}
              placeholder="Введите имя руководителя"
              required
              data-testid="input-department-leader"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department-rating">Рейтинг</Label>
              <Input
                id="department-rating"
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={formData.rating}
                onChange={(event) => setFormData({ ...formData, rating: event.target.value })}
                placeholder="4.8"
                data-testid="input-department-rating"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="department-employees">Кол-во сотрудников</Label>
              <Input
                id="department-employees"
                type="number"
                min="0"
                value={formData.employeeCount}
                onChange={(event) => setFormData({ ...formData, employeeCount: event.target.value })}
                placeholder="0"
                data-testid="input-department-employees"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              data-testid="button-cancel-add-department"
            >
              Отмена
            </Button>
            <Button type="submit" data-testid="button-save-department">
              Сохранить
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Organization() {
  const [orgData, setOrgData] = useState<OrgNode[]>(initialOrgData);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const handleAddDepartment = (department: { name: string; leader: string; rating?: number; employeeCount?: number }) => {
    setOrgData((prev) => [
      ...prev,
      {
        id: `dept-${Date.now()}`,
        name: department.name,
        type: "department",
        leader: department.leader,
        rating: department.rating,
        employeeCount: department.employeeCount,
        children: [],
      },
    ]);
    setIsDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Структура организации</h1>
          <p className="text-muted-foreground">Управляйте отделами, командами и сотрудниками</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-department">
          <Plus size={18} />
          Добавить департамент
        </Button>
      </div>

      <OrganizationTree data={orgData} />

      <AddDepartmentDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        onSubmit={handleAddDepartment}
      />
    </div>
  );
}
