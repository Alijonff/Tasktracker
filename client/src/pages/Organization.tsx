import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import OrganizationTree, { OrgNode } from "@/components/OrganizationTree";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Department, Management, Division } from "@shared/schema";

interface ManagementFormData {
  id: string;
  name: string;
  divisions: DivisionFormData[];
}

interface DivisionFormData {
  id: string;
  name: string;
}

function AddDepartmentDialog({ 
  open, 
  onOpenChange 
}: { 
  open: boolean; 
  onOpenChange: (open: boolean) => void;
}) {
  const [departmentName, setDepartmentName] = useState("");
  const [managements, setManagements] = useState<ManagementFormData[]>([]);
  const { toast } = useToast();

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await fetch("/api/departments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Ошибка создания департамента");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
      toast({ title: "Департамент создан" });
    },
    onError: () => {
      toast({ 
        title: "Ошибка", 
        description: "Не удалось создать департамент",
        variant: "destructive" 
      });
    },
  });

  const createManagementMutation = useMutation({
    mutationFn: async (data: { name: string; departmentId: string }) => {
      const response = await fetch("/api/managements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Ошибка создания управления");
      return response.json();
    },
  });

  const createDivisionMutation = useMutation({
    mutationFn: async (data: { name: string; managementId: string; departmentId: string }) => {
      const response = await fetch("/api/divisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Ошибка создания отдела");
      return response.json();
    },
  });

  const resetForm = () => {
    setDepartmentName("");
    setManagements([]);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const addManagement = () => {
    setManagements([...managements, { 
      id: `temp-${Date.now()}`, 
      name: "", 
      divisions: [] 
    }]);
  };

  const removeManagement = (id: string) => {
    setManagements(managements.filter(m => m.id !== id));
  };

  const updateManagementName = (id: string, name: string) => {
    setManagements(managements.map(m => 
      m.id === id ? { ...m, name } : m
    ));
  };

  const addDivision = (managementId: string) => {
    setManagements(managements.map(m => 
      m.id === managementId 
        ? { ...m, divisions: [...m.divisions, { id: `temp-${Date.now()}`, name: "" }] }
        : m
    ));
  };

  const removeDivision = (managementId: string, divisionId: string) => {
    setManagements(managements.map(m => 
      m.id === managementId
        ? { ...m, divisions: m.divisions.filter(d => d.id !== divisionId) }
        : m
    ));
  };

  const updateDivisionName = (managementId: string, divisionId: string, name: string) => {
    setManagements(managements.map(m => 
      m.id === managementId
        ? { 
            ...m, 
            divisions: m.divisions.map(d => 
              d.id === divisionId ? { ...d, name } : d
            )
          }
        : m
    ));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedDepartmentName = departmentName.trim();
    if (!trimmedDepartmentName) {
      toast({ 
        title: "Ошибка", 
        description: "Введите название департамента",
        variant: "destructive" 
      });
      return;
    }

    try {
      const department = await createDepartmentMutation.mutateAsync({
        name: trimmedDepartmentName,
      });

      for (const management of managements) {
        if (!management.name.trim()) continue;
        
        const createdManagement = await createManagementMutation.mutateAsync({
          name: management.name.trim(),
          departmentId: department.id,
        });

        for (const division of management.divisions) {
          if (!division.name.trim()) continue;
          
          await createDivisionMutation.mutateAsync({
            name: division.name.trim(),
            managementId: createdManagement.id,
            departmentId: department.id,
          });
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/managements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/divisions"] });
      
      toast({ title: "Структура создана успешно" });
      resetForm();
      handleOpenChange(false);
    } catch (error) {
      console.error("Error creating structure:", error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto" data-testid="dialog-add-department">
        <DialogHeader>
          <DialogTitle>Создать структуру организации</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="department-name">Название департамента *</Label>
            <Input
              id="department-name"
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              placeholder="Например, Отдел продаж"
              required
              data-testid="input-department-name"
            />
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Управления (опционально)</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addManagement}
                data-testid="button-add-management"
              >
                <Plus className="h-4 w-4 mr-1" />
                Добавить управление
              </Button>
            </div>

            {managements.map((management, mIndex) => (
              <div key={management.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex gap-2">
                  <Input
                    value={management.name}
                    onChange={(e) => updateManagementName(management.id, e.target.value)}
                    placeholder={`Название управления ${mIndex + 1}`}
                    data-testid={`input-management-name-${mIndex}`}
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    onClick={() => removeManagement(management.id)}
                    data-testid={`button-remove-management-${mIndex}`}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>

                <div className="pl-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm text-muted-foreground">Отделы</Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => addDivision(management.id)}
                      data-testid={`button-add-division-${mIndex}`}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Добавить отдел
                    </Button>
                  </div>

                  {management.divisions.map((division, dIndex) => (
                    <div key={division.id} className="flex gap-2">
                      <Input
                        value={division.name}
                        onChange={(e) => updateDivisionName(management.id, division.id, e.target.value)}
                        placeholder={`Название отдела ${dIndex + 1}`}
                        data-testid={`input-division-name-${mIndex}-${dIndex}`}
                      />
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        onClick={() => removeDivision(management.id, division.id)}
                        data-testid={`button-remove-division-${mIndex}-${dIndex}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
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
            <Button 
              type="submit" 
              disabled={createDepartmentMutation.isPending}
              data-testid="button-save-department"
            >
              {createDepartmentMutation.isPending ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Organization() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const { data: departments = [], isLoading: departmentsLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: managements = [] } = useQuery<Management[]>({
    queryKey: ["/api/managements"],
  });

  const { data: divisions = [] } = useQuery<Division[]>({
    queryKey: ["/api/divisions"],
  });

  const buildOrgTree = (): OrgNode[] => {
    return departments.map(dept => ({
      id: dept.id,
      name: dept.name,
      type: "department" as const,
      leader: dept.leaderName || undefined,
      rating: dept.rating ? parseFloat(dept.rating) : undefined,
      employeeCount: dept.employeeCount || 0,
      children: managements
        .filter(mgmt => mgmt.departmentId === dept.id)
        .map(mgmt => ({
          id: mgmt.id,
          name: mgmt.name,
          type: "management" as const,
          leader: mgmt.leaderName || undefined,
          rating: mgmt.rating ? parseFloat(mgmt.rating) : undefined,
          employeeCount: mgmt.employeeCount || 0,
          children: divisions
            .filter(div => div.managementId === mgmt.id)
            .map(div => ({
              id: div.id,
              name: div.name,
              type: "division" as const,
              leader: div.leaderName || undefined,
              rating: div.rating ? parseFloat(div.rating) : undefined,
              employeeCount: div.employeeCount || 0,
            })),
        })),
    }));
  };

  const orgData = buildOrgTree();

  if (departmentsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Загрузка...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Структура организации</h1>
          <p className="text-muted-foreground">Управляйте департаментами, управлениями и отделами</p>
        </div>
        <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-department">
          <Plus size={18} />
          Создать структуру
        </Button>
      </div>

      {orgData.length === 0 ? (
        <div className="border rounded-lg p-12 text-center">
          <p className="text-muted-foreground mb-4">Структура организации пока не создана</p>
          <Button onClick={() => setIsDialogOpen(true)} variant="outline">
            <Plus size={18} />
            Создать первый департамент
          </Button>
        </div>
      ) : (
        <OrganizationTree data={orgData} />
      )}

      <AddDepartmentDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
      />
    </div>
  );
}
