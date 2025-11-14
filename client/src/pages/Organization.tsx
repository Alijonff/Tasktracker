import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import PositionCell, { PositionType, positionLabels } from "@/components/PositionCell";
import { Plus, X, ChevronDown } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Department, Management, Division, SelectUser } from "@shared/schema";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface ManagementFormData {
  id: string;
  name: string;
  divisions: DivisionFormData[];
}

interface DivisionFormData {
  id: string;
  name: string;
}

function extractErrorMessage(error: any, fallback: string) {
  if (error?.message) {
    const parts = String(error.message).split(": ");
    const lastPart = parts[parts.length - 1];
    try {
      const parsed = JSON.parse(lastPart);
      if (parsed?.error && typeof parsed.error === "string") {
        return parsed.error;
      }
    } catch {
      // ignore parse errors
    }
    return String(error.message);
  }
  return fallback;
}

function parseRating(value: SelectUser["rating"]) {
  if (!value) return undefined;
  const numeric = typeof value === "string" ? parseFloat(value) : Number(value);
  return Number.isNaN(numeric) ? undefined : numeric;
}

function getErrorStatusCode(error: any): number | null {
  if (!error?.message) return null;
  const [statusPart] = String(error.message).split(":");
  const status = Number(statusPart?.trim());
  return Number.isNaN(status) ? null : status;
}

function invalidateOrganizationQueries() {
  queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
  queryClient.invalidateQueries({ queryKey: ["/api/managements"] });
  queryClient.invalidateQueries({ queryKey: ["/api/divisions"] });
  queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
}

const optionalEmailField = z
  .string()
  .trim()
  .email("Введите корректный email")
  .or(z.literal(""))
  .optional();

const createEmployeeFormSchema = z.object({
  username: z.string().min(1, "Введите логин"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  name: z.string().min(1, "Введите имя"),
  email: optionalEmailField,
});

type CreateEmployeeFormValues = z.infer<typeof createEmployeeFormSchema>;

const editEmployeeFormSchema = z.object({
  name: z.string().min(1, "Введите имя"),
  email: optionalEmailField,
});

type EditEmployeeFormValues = z.infer<typeof editEmployeeFormSchema>;

interface SlotSelection {
  positionType: PositionType;
  departmentId: string;
  departmentName: string;
  managementId?: string | null;
  managementName?: string;
  divisionId?: string | null;
  divisionName?: string;
  employee?: SelectUser;
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
  const [departmentDivisions, setDepartmentDivisions] = useState<DivisionFormData[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await apiRequest("POST", "/api/departments", data);
      return response.json();
    },
  });

  const createManagementMutation = useMutation({
    mutationFn: async (data: { name: string; departmentId: string }) => {
      const response = await apiRequest("POST", "/api/managements", data);
      return response.json();
    },
  });

  const createDivisionMutation = useMutation({
    mutationFn: async (data: { name: string; managementId?: string | null; departmentId: string }) => {
      const response = await apiRequest("POST", "/api/divisions", {
        ...data,
        managementId: data.managementId ?? null,
      });
      return response.json();
    },
  });

  const resetForm = () => {
    setDepartmentName("");
    setManagements([]);
    setDepartmentDivisions([]);
    setIsSubmitting(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }
    onOpenChange(nextOpen);
  };

  const addManagement = () => {
    setManagements((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}`,
        name: "",
        divisions: [],
      },
    ]);
  };

  const removeManagement = (id: string) => {
    setManagements((prev) => prev.filter((m) => m.id !== id));
  };

  const updateManagementName = (id: string, name: string) => {
    setManagements((prev) =>
      prev.map((m) => (m.id === id ? { ...m, name } : m))
    );
  };

  const addDivision = (managementId: string) => {
    setManagements((prev) =>
      prev.map((m) =>
        m.id === managementId
          ? { ...m, divisions: [...m.divisions, { id: `temp-${Date.now()}`, name: "" }] }
          : m
      )
    );
  };

  const removeDivision = (managementId: string, divisionId: string) => {
    setManagements((prev) =>
      prev.map((m) =>
        m.id === managementId
          ? { ...m, divisions: m.divisions.filter((d) => d.id !== divisionId) }
          : m
      )
    );
  };

  const updateDivisionName = (managementId: string, divisionId: string, name: string) => {
    setManagements((prev) =>
      prev.map((m) =>
        m.id === managementId
          ? {
              ...m,
              divisions: m.divisions.map((d) =>
                d.id === divisionId ? { ...d, name } : d
              ),
            }
          : m
      )
    );
  };

  const addDepartmentDivision = () => {
    setDepartmentDivisions((prev) => [
      ...prev,
      { id: `dept-division-${Date.now()}-${prev.length}`, name: "" },
    ]);
  };

  const removeDepartmentDivision = (divisionId: string) => {
    setDepartmentDivisions((prev) => prev.filter((division) => division.id !== divisionId));
  };

  const updateDepartmentDivisionName = (divisionId: string, name: string) => {
    setDepartmentDivisions((prev) =>
      prev.map((division) => (division.id === divisionId ? { ...division, name } : division))
    );
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    const trimmedDepartmentName = departmentName.trim();
    if (!trimmedDepartmentName) {
      toast({
        title: "Ошибка",
        description: "Введите название департамента",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const department = await createDepartmentMutation.mutateAsync({
        name: trimmedDepartmentName,
      });

      for (const management of managements) {
        const trimmedManagementName = management.name.trim();
        if (!trimmedManagementName) continue;

        const createdManagement = await createManagementMutation.mutateAsync({
          name: trimmedManagementName,
          departmentId: department.id,
        });

        for (const division of management.divisions) {
          const trimmedDivisionName = division.name.trim();
          if (!trimmedDivisionName) continue;

          await createDivisionMutation.mutateAsync({
            name: trimmedDivisionName,
            managementId: createdManagement.id,
            departmentId: department.id,
          });
        }
      }

      for (const division of departmentDivisions) {
        const trimmedDivisionName = division.name.trim();
        if (!trimmedDivisionName) continue;

        await createDivisionMutation.mutateAsync({
          name: trimmedDivisionName,
          managementId: null,
          departmentId: department.id,
        });
      }

      invalidateOrganizationQueries();

      toast({ title: "Структура создана успешно" });
      resetForm();
      handleOpenChange(false);
    } catch (error) {
      toast({
        title: "Ошибка",
        description: extractErrorMessage(error, "Не удалось создать структуру организации"),
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
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

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Отделы департамента (без управления)</Label>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={addDepartmentDivision}
              >
                <Plus className="h-4 w-4 mr-1" />
                Добавить отдел
              </Button>
            </div>
            {departmentDivisions.length === 0 ? (
              <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                Если в департаменте нет управлений, добавьте отделы, которые будут подчиняться напрямую директору.
              </div>
            ) : (
              <div className="space-y-2">
                {departmentDivisions.map((division, index) => (
                  <div key={division.id} className="flex gap-2">
                    <Input
                      value={division.name}
                      onChange={(event) => updateDepartmentDivisionName(division.id, event.target.value)}
                      placeholder={`Название отдела ${index + 1}`}
                    />
                    <Button type="button" size="icon" variant="ghost" onClick={() => removeDepartmentDivision(division.id)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Эти отделы будут относиться непосредственно к департаменту и появятся в дереве структуры как отдельный блок.
            </p>
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
              disabled={isSubmitting}
              data-testid="button-save-department"
            >
              {isSubmitting ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateManagementDialog({
  open,
  onOpenChange,
  department,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department | null;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
    }
  }, [open]);

  const createManagement = useMutation({
    mutationFn: async (managementName: string) => {
      if (!department) {
        throw new Error("department is required");
      }
      const response = await apiRequest("POST", "/api/managements", {
        name: managementName,
        departmentId: department.id,
      });
      return response.json();
    },
    onSuccess: () => {
      invalidateOrganizationQueries();
      toast({ title: "Управление создано" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: extractErrorMessage(error, "Не удалось создать управление"),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!department) return;

    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        title: "Ошибка",
        description: "Введите название управления",
        variant: "destructive",
      });
      return;
    }

    createManagement.mutate(trimmed);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить управление</DialogTitle>
          <DialogDescription>
            Департамент: {department?.name ?? "—"}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-management-name">Название управления</Label>
            <Input
              id="new-management-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={createManagement.isPending}>
              {createManagement.isPending ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateDivisionDialog({
  open,
  onOpenChange,
  department,
  management,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  department: Department | null;
  management: Management | null;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) {
      setName("");
    }
  }, [open]);

  const createDivision = useMutation({
    mutationFn: async (divisionName: string) => {
      if (!department) {
        throw new Error("department is required");
      }
      const response = await apiRequest("POST", "/api/divisions", {
        name: divisionName,
        departmentId: department.id,
        managementId: management?.id ?? null,
      });
      return response.json();
    },
    onSuccess: () => {
      invalidateOrganizationQueries();
      toast({ title: "Отдел создан" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: extractErrorMessage(error, "Не удалось создать отдел"),
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!department) return;

    const trimmed = name.trim();
    if (!trimmed) {
      toast({
        title: "Ошибка",
        description: "Введите название отдела",
        variant: "destructive",
      });
      return;
    }

    createDivision.mutate(trimmed);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Добавить отдел</DialogTitle>
          <DialogDescription className="space-y-1">
            <div>Департамент: {department?.name ?? "—"}</div>
            <div>
              {management ? `Управление: ${management.name}` : "Отдел будет создан без управления"}
            </div>
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-division-name">Название отдела</Label>
            <Input
              id="new-division-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Отмена
            </Button>
            <Button type="submit" disabled={createDivision.isPending}>
              {createDivision.isPending ? "Создание..." : "Создать"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EmployeeDialog({
  open,
  onOpenChange,
  slot,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slot: SlotSelection | null;
}) {
  const { toast } = useToast();
  const createForm = useForm<CreateEmployeeFormValues>({
    resolver: zodResolver(createEmployeeFormSchema),
    defaultValues: {
      username: "",
      password: "",
      name: "",
      email: "",
    },
  });
  const editForm = useForm<EditEmployeeFormValues>({
    resolver: zodResolver(editEmployeeFormSchema),
    defaultValues: {
      name: "",
      email: "",
    },
  });

  useEffect(() => {
    if (!slot) {
      createForm.reset({ username: "", password: "", name: "", email: "" });
      editForm.reset({ name: "", email: "" });
      return;
    }

    if (slot.employee) {
      editForm.reset({
        name: slot.employee.name ?? "",
        email: slot.employee.email ?? "",
      });
    } else {
      createForm.reset({ username: "", password: "", name: "", email: "" });
    }
  }, [slot, createForm, editForm]);

  const invalidateOrgQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
    queryClient.invalidateQueries({ queryKey: ["/api/departments"] });
    queryClient.invalidateQueries({ queryKey: ["/api/managements"] });
    queryClient.invalidateQueries({ queryKey: ["/api/divisions"] });
  };

  const createEmployee = useMutation({
    mutationFn: async (values: CreateEmployeeFormValues) => {
      if (!slot) throw new Error("slot is required");
      const trimmedEmail = values.email ? values.email.trim() : "";
      const payload = {
        ...values,
        username: values.username.trim(),
        name: values.name.trim(),
        email: trimmedEmail ? trimmedEmail : null,
        positionType: slot.positionType,
        departmentId: slot.departmentId,
        managementId: slot.managementId ?? null,
        divisionId: slot.divisionId ?? null,
      };
      const response = await apiRequest("POST", "/api/employees", payload);
      return response.json();
    },
    onSuccess: () => {
      invalidateOrgQueries();
      toast({ title: "Сотрудник добавлен" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: extractErrorMessage(error, "Не удалось создать сотрудника"),
        variant: "destructive",
      });
    },
  });

  const updateEmployee = useMutation({
    mutationFn: async (values: EditEmployeeFormValues) => {
      if (!slot?.employee) throw new Error("employee is required");
      const payload = {
        name: values.name.trim(),
        email: values.email ? values.email.trim() || null : null,
      };
      const response = await apiRequest("PATCH", `/api/employees/${slot.employee.id}`, payload);
      return response.json();
    },
    onSuccess: () => {
      invalidateOrgQueries();
      toast({ title: "Изменения сохранены" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: extractErrorMessage(error, "Не удалось обновить данные сотрудника"),
        variant: "destructive",
      });
    },
  });

  const deleteEmployee = useMutation({
    mutationFn: async () => {
      if (!slot?.employee) throw new Error("employee is required");
      await apiRequest("DELETE", `/api/employees/${slot.employee.id}`);
    },
    onSuccess: () => {
      invalidateOrgQueries();
      toast({ title: "Сотрудник удалён" });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: extractErrorMessage(error, "Не удалось удалить сотрудника"),
        variant: "destructive",
      });
    },
  });

  if (!slot) {
    return <Dialog open={open} onOpenChange={onOpenChange} />;
  }

  const positionLabel = positionLabels[slot.positionType];

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          onOpenChange(false);
        }
      }}
    >
      <DialogContent className="sm:max-w-lg space-y-4">
        <DialogHeader>
          <DialogTitle>{slot.employee ? "Карточка сотрудника" : "Добавить сотрудника"}</DialogTitle>
          <DialogDescription>
            {positionLabel} · {slot.departmentName}
            {slot.managementName ? ` • ${slot.managementName}` : ""}
            {slot.divisionName ? ` • ${slot.divisionName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
          <div><span className="font-medium">Департамент:</span> {slot.departmentName}</div>
          {slot.managementName && <div><span className="font-medium">Управление:</span> {slot.managementName}</div>}
          {slot.divisionName && <div><span className="font-medium">Отдел:</span> {slot.divisionName}</div>}
          <div><span className="font-medium">Должность:</span> {positionLabel}</div>
        </div>

        {slot.employee ? (
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit((values) => updateEmployee.mutate(values))} className="space-y-4">
              <div className="space-y-2">
                <Label>Логин</Label>
                <Input value={slot.employee.username} disabled />
              </div>
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Имя</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={deleteEmployee.isPending || updateEmployee.isPending}
                    >
                      Удалить
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Удалить сотрудника?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Сотрудник будет удалён из структуры. Это действие нельзя отменить.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Отмена</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteEmployee.mutate()}
                        disabled={deleteEmployee.isPending}
                      >
                        {deleteEmployee.isPending ? "Удаление..." : "Удалить"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <div className="flex w-full justify-end gap-2 sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={updateEmployee.isPending || deleteEmployee.isPending}
                  >
                    Отмена
                  </Button>
                  <Button type="submit" disabled={updateEmployee.isPending || deleteEmployee.isPending}>
                    {updateEmployee.isPending ? "Сохранение..." : "Сохранить"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </Form>
        ) : (
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit((values) => createEmployee.mutate(values))} className="space-y-4">
              <FormField
                control={createForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                  <FormLabel>Логин</FormLabel>
                    <FormControl>
                      <Input {...field} autoFocus />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Пароль</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Имя</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={createForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={createEmployee.isPending}>
                  Отмена
                </Button>
                <Button type="submit" disabled={createEmployee.isPending}>
                  {createEmployee.isPending ? "Создание..." : "Создать"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Organization() {
  const { toast } = useToast();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<SlotSelection | null>(null);
  const [isEmployeeDialogOpen, setIsEmployeeDialogOpen] = useState(false);
  const [managementDialogState, setManagementDialogState] = useState<{ open: boolean; department: Department | null }>({ open: false, department: null });
  const [divisionDialogState, setDivisionDialogState] = useState<{ open: boolean; department: Department | null; management: Management | null }>({ open: false, department: null, management: null });

  const { data: departments = [], isLoading: departmentsLoading } = useQuery<Department[]>({
    queryKey: ["/api/departments"],
  });

  const { data: managements = [] } = useQuery<Management[]>({
    queryKey: ["/api/managements"],
  });

  const { data: divisions = [] } = useQuery<Division[]>({
    queryKey: ["/api/divisions"],
  });

  const { data: employees = [] } = useQuery<SelectUser[]>({
    queryKey: ["/api/employees"],
  });

  const { data: authData } = useQuery<{ user: SelectUser | null }>({
    queryKey: ["/api/auth/me"],
  });

  const currentUser = authData?.user;
  const collapsibleStorageKey = currentUser ? `org-sections-${currentUser.id}` : "org-sections";

  const [sectionState, setSectionState] = useState<Record<string, boolean>>({});

  const getSectionOpen = (id: string, fallback = true) => (id in sectionState ? sectionState[id] : fallback);
  const handleSectionToggle = (id: string, open: boolean) => {
    setSectionState((prev) => {
      if (prev[id] === open) return prev;
      return { ...prev, [id]: open };
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const storedSections = localStorage.getItem(collapsibleStorageKey);
      setSectionState(storedSections ? JSON.parse(storedSections) : {});
    } catch {
      setSectionState({});
    }
  }, [collapsibleStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    localStorage.setItem(collapsibleStorageKey, JSON.stringify(sectionState));
  }, [sectionState, collapsibleStorageKey]);

  const updateManagementDeputy = useMutation({
    mutationFn: async ({ managementId, deputyId }: { managementId: string; deputyId: string | null }) => {
      const response = await apiRequest("PUT", `/api/managements/${managementId}/deputy`, { deputyId });
      return response.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/managements"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({ title: variables.deputyId ? "Заместитель назначен" : "Назначение снято" });
    },
    onError: (error: any) => {
      const status = getErrorStatusCode(error);
      toast({
        title: "Ошибка",
        description:
          status === 409 || status === 422
            ? "Сотрудник уже занимает управленческую должность в этом департаменте"
            : extractErrorMessage(error, "Не удалось обновить заместителя управления"),
        variant: "destructive",
      });
    },
  });

  const canEditDepartment = (departmentId: string) => {
    if (!currentUser) return false;
    if (currentUser.role === "admin") return true;
    if (currentUser.role === "director" && currentUser.departmentId === departmentId) return true;
    return false;
  };

  const canCreateStructure = currentUser?.role === "admin";

  const openSlot = (slot: SlotSelection) => {
    setSelectedSlot(slot);
    setIsEmployeeDialogOpen(true);
  };

  const handleEmployeeDialogOpenChange = (open: boolean) => {
    if (!open) {
      setIsEmployeeDialogOpen(false);
      setSelectedSlot(null);
    }
  };

  const openManagementDialog = (department: Department) => {
    setManagementDialogState({ open: true, department });
  };

  const openDivisionDialog = (department: Department, management?: Management | null) => {
    setDivisionDialogState({ open: true, department, management: management ?? null });
  };

  const handleManagementDeputyChange = (managementId: string, deputyId: string | null) => {
    updateManagementDeputy.mutate({ managementId, deputyId });
  };

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
          <p className="text-muted-foreground">Управляйте департаментами, управлениями, отделами и сотрудниками</p>
        </div>
        {canCreateStructure && (
          <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-department">
            <Plus size={18} className="mr-2" />
            Создать структуру
          </Button>
        )}
      </div>

      {departments.length === 0 ? (
        <div className="border rounded-lg p-12 text-center space-y-4">
          <p className="text-muted-foreground">Нет данных</p>
          {canCreateStructure && (
            <Button onClick={() => setIsDialogOpen(true)} variant="outline">
              <Plus size={18} className="mr-2" />
              Создать структуру
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {departments.map((department) => {
            const canEdit = canEditDepartment(department.id);
            const departmentEmployees = employees.filter((emp) => emp.departmentId === department.id);
            const director = departmentEmployees.find((emp) => emp.role === "director");
            const deputy = departmentEmployees.find((emp) => emp.role === "manager" && !emp.managementId && !emp.divisionId);
            const departmentManagements = managements.filter((mgmt) => mgmt.departmentId === department.id);
            const directDepartmentDivisions = divisions.filter(
              (division) => division.departmentId === department.id && !division.managementId,
            );
            const employeesByManagement = departmentManagements.reduce<Record<string, SelectUser[]>>((acc, mgmt) => {
              acc[mgmt.id] = departmentEmployees.filter((emp) => emp.managementId === mgmt.id);
              return acc;
            }, {});
            const blockedManagementRoleIds = new Set<string>();
            if (director) {
              blockedManagementRoleIds.add(director.id);
            }
            if (deputy) {
              blockedManagementRoleIds.add(deputy.id);
            }
            Object.values(employeesByManagement).forEach((mgmtEmployees) => {
              mgmtEmployees
                .filter((emp) => emp.role === "manager" && !emp.divisionId)
                .forEach((leader) => blockedManagementRoleIds.add(leader.id));
            });
            departmentEmployees
              .filter((emp) => emp.role === "manager" && Boolean(emp.divisionId))
              .forEach((leader) => blockedManagementRoleIds.add(leader.id));
            departmentManagements.forEach((mgmt) => {
              if (mgmt.deputyId) {
                blockedManagementRoleIds.add(mgmt.deputyId);
              }
            });

            return (
              <Card key={department.id}>
                <CardHeader className="space-y-2">
                  <CardTitle>{department.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">Директор и заместитель находятся на верхнем уровне дерева</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  {(() => {
                    const leadersSectionId = `leaders-${department.id}`;
                    const leadersOpen = getSectionOpen(leadersSectionId, true);
                    return (
                      <Collapsible
                        open={leadersOpen}
                        onOpenChange={(open) => handleSectionToggle(leadersSectionId, open)}
                      >
                        <div className="flex items-center justify-between rounded-md border bg-muted/40 px-4 py-3">
                          <div>
                            <p className="font-medium">Руководство департамента</p>
                            <p className="text-xs text-muted-foreground">Директор и заместитель департамента</p>
                          </div>
                          <CollapsibleTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Переключить руководство департамента"
                              className={`h-8 w-8 rounded-full transition-transform ${leadersOpen ? "" : "-rotate-90"}`}
                            >
                              <ChevronDown className="h-4 w-4" />
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                        <CollapsibleContent className="pt-4">
                          <div className="grid gap-4 sm:grid-cols-2">
                            <PositionCell
                              positionType="director"
                              employee={director ? { id: director.id, name: director.name, rating: parseRating(director.rating) } : undefined}
                              canEdit={canEdit}
                              onClick={canEdit ? () => openSlot({ positionType: "director", departmentId: department.id, departmentName: department.name, employee: director }) : undefined}
                            />
                            <PositionCell
                              positionType="deputy"
                              employee={deputy ? { id: deputy.id, name: deputy.name, rating: parseRating(deputy.rating) } : undefined}
                              canEdit={canEdit}
                              onClick={canEdit ? () => openSlot({ positionType: "deputy", departmentId: department.id, departmentName: department.name, employee: deputy }) : undefined}
                            />
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })()}

                  {(() => {
                    const sectionId = `department-direct-divisions-${department.id}`;
                    const sectionOpen = getSectionOpen(sectionId, true);
                    const hasDivisions = directDepartmentDivisions.length > 0;

                    if (!hasDivisions && !canEdit) {
                      return null;
                    }

                    return (
                      <Collapsible
                        open={sectionOpen}
                        onOpenChange={(open) => handleSectionToggle(sectionId, open)}
                      >
                        <div className="flex flex-col gap-3 rounded-md border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium">Отделы без управления</p>
                            <p className="text-xs text-muted-foreground">
                              Подчиняются напрямую директору департамента
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {canEdit && (
                              <Button variant="outline" size="sm" onClick={() => openDivisionDialog(department, null)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Добавить отдел
                              </Button>
                            )}
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Переключить отделы без управления"
                                className={`h-8 w-8 rounded-full transition-transform ${sectionOpen ? "" : "-rotate-90"}`}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                        </div>
                        <CollapsibleContent className="pt-4 space-y-4">
                          {!hasDivisions ? (
                            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                              {canEdit
                                ? "Отделы без управления ещё не созданы. Добавьте первый отдел, чтобы сотрудники могли подчиняться напрямую директору."
                                : "В этом департаменте пока нет отделов без управления."}
                            </div>
                          ) : (
                            directDepartmentDivisions.map((division) => {
                              const divisionEmployees = departmentEmployees.filter((emp) => emp.divisionId === division.id);
                              const divisionHead = divisionEmployees.find((emp) => emp.role === "manager");
                              const seniors = divisionEmployees.filter((emp) => emp.role === "senior");
                              const regulars = divisionEmployees.filter((emp) => emp.role === "employee");

                              return (
                                <Collapsible
                                  key={division.id}
                                  open={getSectionOpen(division.id, true)}
                                  onOpenChange={(open) => handleSectionToggle(division.id, open)}
                                >
                                  <Card className="bg-muted/30">
                                    <CardHeader className="flex items-center justify-between">
                                      <CardTitle className="text-base">{division.name}</CardTitle>
                                      <CollapsibleTrigger asChild>
                                        <Button
                                          variant="ghost"
                                          size="icon"
                                          aria-label={`Переключить отдел ${division.name}`}
                                          className={`h-8 w-8 rounded-full transition-transform ${getSectionOpen(division.id, true) ? "" : "-rotate-90"}`}
                                        >
                                          <ChevronDown className="h-4 w-4" />
                                        </Button>
                                      </CollapsibleTrigger>
                                    </CardHeader>
                                    <CollapsibleContent>
                                      <CardContent className="space-y-4">
                                        <PositionCell
                                          positionType="division_head"
                                          employee={
                                            divisionHead
                                              ? { id: divisionHead.id, name: divisionHead.name, rating: parseRating(divisionHead.rating) }
                                              : undefined
                                          }
                                          canEdit={canEdit}
                                          onClick={
                                            canEdit
                                              ? () =>
                                                  openSlot({
                                                    positionType: "division_head",
                                                    departmentId: department.id,
                                                    departmentName: department.name,
                                                    divisionId: division.id,
                                                    divisionName: division.name,
                                                    employee: divisionHead,
                                                  })
                                              : undefined
                                          }
                                        />

                                        <div className="space-y-2">
                                          <p className="text-sm font-medium">Старшие сотрудники</p>
                                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                            {seniors.map((senior) => (
                                              <PositionCell
                                                key={senior.id}
                                                positionType="senior"
                                                employee={{ id: senior.id, name: senior.name, rating: parseRating(senior.rating) }}
                                                canEdit={canEdit}
                                                onClick={
                                                  canEdit
                                                    ? () =>
                                                        openSlot({
                                                          positionType: "senior",
                                                          departmentId: department.id,
                                                          departmentName: department.name,
                                                          divisionId: division.id,
                                                          divisionName: division.name,
                                                          employee: senior,
                                                        })
                                                    : undefined
                                                }
                                              />
                                            ))}
                                            {canEdit && (
                                              <PositionCell
                                                positionType="senior"
                                                canEdit
                                                onClick={() =>
                                                  openSlot({
                                                    positionType: "senior",
                                                    departmentId: department.id,
                                                    departmentName: department.name,
                                                    divisionId: division.id,
                                                    divisionName: division.name,
                                                  })
                                                }
                                              />
                                            )}
                                          </div>
                                        </div>

                                        <div className="space-y-2">
                                          <p className="text-sm font-medium">Сотрудники</p>
                                          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                            {regulars.map((employee) => (
                                              <PositionCell
                                                key={employee.id}
                                                positionType="employee"
                                                employee={{ id: employee.id, name: employee.name, rating: parseRating(employee.rating) }}
                                                canEdit={canEdit}
                                                onClick={
                                                  canEdit
                                                    ? () =>
                                                        openSlot({
                                                          positionType: "employee",
                                                          departmentId: department.id,
                                                          departmentName: department.name,
                                                          divisionId: division.id,
                                                          divisionName: division.name,
                                                          employee,
                                                        })
                                                    : undefined
                                                }
                                              />
                                            ))}
                                            {canEdit && (
                                              <PositionCell
                                                positionType="employee"
                                                canEdit
                                                onClick={() =>
                                                  openSlot({
                                                    positionType: "employee",
                                                    departmentId: department.id,
                                                    departmentName: department.name,
                                                    divisionId: division.id,
                                                    divisionName: division.name,
                                                  })
                                                }
                                              />
                                            )}
                                          </div>
                                        </div>
                                      </CardContent>
                                    </CollapsibleContent>
                                  </Card>
                                </Collapsible>
                              );
                            })
                          )}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })()}

                  {(() => {
                    const managementSectionId = `department-managements-${department.id}`;
                    const managementOpen = getSectionOpen(managementSectionId, true);
                    return (
                      <Collapsible
                        open={managementOpen}
                        onOpenChange={(open) => handleSectionToggle(managementSectionId, open)}
                      >
                        <div className="flex flex-col gap-3 rounded-md border bg-muted/40 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <p className="font-medium">Управления и отделы</p>
                            <p className="text-xs text-muted-foreground">Полная структура департамента по управлениям</p>
                          </div>
                          <div className="flex items-center gap-2">
                            {canEdit && (
                              <Button variant="outline" size="sm" onClick={() => openManagementDialog(department)}>
                                <Plus className="h-4 w-4 mr-2" />
                                Добавить управление
                              </Button>
                            )}
                            <CollapsibleTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Переключить список управлений"
                                className={`h-8 w-8 rounded-full transition-transform ${managementOpen ? "" : "-rotate-90"}`}
                              >
                                <ChevronDown className="h-4 w-4" />
                              </Button>
                            </CollapsibleTrigger>
                          </div>
                        </div>
                        <CollapsibleContent className="pt-4 space-y-4">
                          {departmentManagements.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                              Управления пока не созданы. {canEdit ? "Добавьте первое управление, чтобы продолжить построение структуры." : "Обратитесь к администратору или директору департамента."}
                            </div>
                          ) : (
                            departmentManagements.map((management) => {
                              const managementEmployees = employeesByManagement[management.id] ?? [];
                              const managementHead = managementEmployees.find((emp) => emp.role === "manager" && !emp.divisionId);
                              const managementDeputy = management.deputyId
                                ? departmentEmployees.find((emp) => emp.id === management.deputyId) ?? null
                                : null;
                              const availableDeputyCandidates = departmentEmployees
                                .filter((emp) => emp.id !== management.deputyId)
                                .filter((emp) => !blockedManagementRoleIds.has(emp.id))
                                .sort((a, b) => a.name.localeCompare(b.name, "ru"));
                              const deputySelectValue = management.deputyId ?? "none";
                              const isDeputySelectDisabled = availableDeputyCandidates.length === 0;
                              const managementDivisions = divisions.filter((division) => division.managementId === management.id);

                              return (
                                <Collapsible
                                  key={management.id}
                                  open={getSectionOpen(management.id, true)}
                                  onOpenChange={(open) => handleSectionToggle(management.id, open)}
                                >
                                  <Card className="border border-muted">
                                    <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                      <div>
                                        <CardTitle className="text-lg">{management.name}</CardTitle>
                                        <p className="text-sm text-muted-foreground">Руководитель управления и его отделы</p>
                                      </div>
                                      <div className="flex items-center gap-2">
                                        {canEdit && (
                                          <Button variant="outline" size="sm" onClick={() => openDivisionDialog(department, management)}>
                                            <Plus className="h-4 w-4 mr-2" />
                                            Добавить отдел
                                          </Button>
                                        )}
                                        <CollapsibleTrigger asChild>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            aria-label={`Переключить управление ${management.name}`}
                                            className={`h-8 w-8 rounded-full transition-transform ${getSectionOpen(management.id, true) ? "" : "-rotate-90"}`}
                                          >
                                            <ChevronDown className="h-4 w-4" />
                                          </Button>
                                        </CollapsibleTrigger>
                                      </div>
                                    </CardHeader>
                                    <CollapsibleContent>
                                      <CardContent className="space-y-4">
                              <PositionCell
                                positionType="management_head"
                                employee={managementHead ? { id: managementHead.id, name: managementHead.name, rating: parseRating(managementHead.rating) } : undefined}
                                canEdit={canEdit}
                                onClick={canEdit ? () => openSlot({ positionType: "management_head", departmentId: department.id, departmentName: department.name, managementId: management.id, managementName: management.name, employee: managementHead }) : undefined}
                              />

                              <div className="space-y-3">
                                <p className="text-sm font-medium">Заместитель руководителя управления</p>
                                <PositionCell
                                  positionType="management_deputy"
                                  employee={managementDeputy ? { id: managementDeputy.id, name: managementDeputy.name, rating: parseRating(managementDeputy.rating) } : undefined}
                                  canEdit={canEdit}
                                  onClick={
                                    canEdit
                                      ? () =>
                                          openSlot({
                                            positionType: "management_deputy",
                                            departmentId: department.id,
                                            departmentName: department.name,
                                            managementId: management.id,
                                            managementName: management.name,
                                            employee: managementDeputy ?? undefined,
                                          })
                                      : undefined
                                  }
                                />
                                {canEdit && (
                                  <div className="space-y-2">
                                    <Select
                                      value={deputySelectValue}
                                      onValueChange={(value) => {
                                        if (value === "none") {
                                          if (management.deputyId) {
                                            handleManagementDeputyChange(management.id, null);
                                          }
                                          return;
                                        }
                                        if (value !== management.deputyId) {
                                          handleManagementDeputyChange(management.id, value);
                                        }
                                      }}
                                      disabled={updateManagementDeputy.isPending || isDeputySelectDisabled}
                                    >
                                      <SelectTrigger className="w-full sm:w-64">
                                        <SelectValue placeholder="Выберите сотрудника" />
                                      </SelectTrigger>
                                      <SelectContent>
                                        <SelectItem value="none">Нет заместителя</SelectItem>
                                        {managementDeputy && (
                                          <SelectItem value={managementDeputy.id}>
                                            {managementDeputy.name} ({managementDeputy.username})
                                          </SelectItem>
                                        )}
                                        {availableDeputyCandidates.map((emp) => (
                                          <SelectItem key={emp.id} value={emp.id}>
                                            {emp.name} ({emp.username})
                                          </SelectItem>
                                        ))}
                                      </SelectContent>
                                    </Select>
                                    {isDeputySelectDisabled && (
                                      <p className="text-xs text-muted-foreground">Нет доступных сотрудников для назначения</p>
                                    )}
                                    {management.deputyId && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => handleManagementDeputyChange(management.id, null)}
                                        disabled={updateManagementDeputy.isPending}
                                      >
                                        Снять назначение
                                      </Button>
                                    )}
                                  </div>
                                )}
                              </div>

                              <div className="space-y-4">
                                {managementDivisions.length === 0 ? (
                                  <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
                                    В этом управлении ещё нет отделов.
                                  </div>
                                ) : (
                                  managementDivisions.map((division) => {
                                    const divisionEmployees = departmentEmployees.filter((emp) => emp.divisionId === division.id);
                                    const divisionHead = divisionEmployees.find((emp) => emp.role === "manager");
                                    const seniors = divisionEmployees.filter((emp) => emp.role === "senior");
                                    const regulars = divisionEmployees.filter((emp) => emp.role === "employee");

                                    return (
                                      <Collapsible
                                        key={division.id}
                                        open={getSectionOpen(division.id, true)}
                                        onOpenChange={(open) => handleSectionToggle(division.id, open)}
                                      >
                                        <Card className="bg-muted/30">
                                          <CardHeader className="flex items-center justify-between">
                                            <CardTitle className="text-base">{division.name}</CardTitle>
                                            <CollapsibleTrigger asChild>
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                aria-label={`Переключить отдел ${division.name}`}
                                                className={`h-8 w-8 rounded-full transition-transform ${getSectionOpen(division.id, true) ? "" : "-rotate-90"}`}
                                              >
                                                <ChevronDown className="h-4 w-4" />
                                              </Button>
                                            </CollapsibleTrigger>
                                          </CardHeader>
                                          <CollapsibleContent>
                                            <CardContent className="space-y-4">
                                          <PositionCell
                                            positionType="division_head"
                                            employee={divisionHead ? { id: divisionHead.id, name: divisionHead.name, rating: parseRating(divisionHead.rating) } : undefined}
                                            canEdit={canEdit}
                                            onClick={canEdit ? () => openSlot({ positionType: "division_head", departmentId: department.id, departmentName: department.name, managementId: management.id, managementName: management.name, divisionId: division.id, divisionName: division.name, employee: divisionHead }) : undefined}
                                          />

                                          <div className="space-y-2">
                                            <p className="text-sm font-medium">Старшие сотрудники</p>
                                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                              {seniors.map((senior) => (
                                                <PositionCell
                                                  key={senior.id}
                                                  positionType="senior"
                                                  employee={{ id: senior.id, name: senior.name, rating: parseRating(senior.rating) }}
                                                  canEdit={canEdit}
                                                  onClick={canEdit ? () => openSlot({ positionType: "senior", departmentId: department.id, departmentName: department.name, managementId: management.id, managementName: management.name, divisionId: division.id, divisionName: division.name, employee: senior }) : undefined}
                                                />
                                              ))}
                                              {canEdit && (
                                                <PositionCell
                                                  positionType="senior"
                                                  canEdit
                                                  onClick={() => openSlot({ positionType: "senior", departmentId: department.id, departmentName: department.name, managementId: management.id, managementName: management.name, divisionId: division.id, divisionName: division.name })}
                                                />
                                              )}
                                            </div>
                                          </div>

                                          <div className="space-y-2">
                                            <p className="text-sm font-medium">Сотрудники</p>
                                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                                              {regulars.map((employee) => (
                                                <PositionCell
                                                  key={employee.id}
                                                  positionType="employee"
                                                  employee={{ id: employee.id, name: employee.name, rating: parseRating(employee.rating) }}
                                                  canEdit={canEdit}
                                                  onClick={canEdit ? () => openSlot({ positionType: "employee", departmentId: department.id, departmentName: department.name, managementId: management.id, managementName: management.name, divisionId: division.id, divisionName: division.name, employee }) : undefined}
                                                />
                                              ))}
                                              {canEdit && (
                                                <PositionCell
                                                  positionType="employee"
                                                  canEdit
                                                  onClick={() => openSlot({ positionType: "employee", departmentId: department.id, departmentName: department.name, managementId: management.id, managementName: management.name, divisionId: division.id, divisionName: division.name })}
                                                />
                                              )}
                                            </div>
                                          </div>
                                            </CardContent>
                                          </CollapsibleContent>
                                        </Card>
                                      </Collapsible>
                                    );
                                  })
                                )}
                              </div>
                                      </CardContent>
                                    </CollapsibleContent>
                                  </Card>
                                </Collapsible>
                        );
                      })
                    )}
                        </CollapsibleContent>
                      </Collapsible>
                    );
                  })()}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <AddDepartmentDialog open={isDialogOpen} onOpenChange={setIsDialogOpen} />
      <CreateManagementDialog
        open={managementDialogState.open}
        onOpenChange={(open) => setManagementDialogState((prev) => ({ ...prev, open }))}
        department={managementDialogState.department}
      />
      <CreateDivisionDialog
        open={divisionDialogState.open}
        onOpenChange={(open) => setDivisionDialogState((prev) => ({ ...prev, open }))}
        department={divisionDialogState.department}
        management={divisionDialogState.management}
      />
      <EmployeeDialog
        open={isEmployeeDialogOpen}
        onOpenChange={handleEmployeeDialogOpenChange}
        slot={selectedSlot}
      />
    </div>
  );
}

