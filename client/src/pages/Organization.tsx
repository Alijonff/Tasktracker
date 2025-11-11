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
import PositionCell, { PositionType, positionLabels } from "@/components/PositionCell";
import { Plus, X } from "lucide-react";
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

const createEmployeeFormSchema = z.object({
  username: z.string().min(1, "Введите имя пользователя"),
  password: z.string().min(6, "Пароль должен содержать минимум 6 символов"),
  name: z.string().min(1, "Введите имя"),
  email: z.string().email("Введите корректный email"),
});

type CreateEmployeeFormValues = z.infer<typeof createEmployeeFormSchema>;

const editEmployeeFormSchema = z.object({
  name: z.string().min(1, "Введите имя"),
  email: z.string().email("Введите корректный email"),
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
  const { toast } = useToast();

  const createDepartmentMutation = useMutation({
    mutationFn: async (data: { name: string }) => {
      const response = await apiRequest("POST", "/api/departments", data);
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
        variant: "destructive",
      });
    },
  });

  const createManagementMutation = useMutation({
    mutationFn: async (data: { name: string; departmentId: string }) => {
      const response = await apiRequest("POST", "/api/managements", data);
      return response.json();
    },
  });

  const createDivisionMutation = useMutation({
    mutationFn: async (data: { name: string; managementId: string; departmentId: string }) => {
      const response = await apiRequest("POST", "/api/divisions", data);
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

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedDepartmentName = departmentName.trim();
    if (!trimmedDepartmentName) {
      toast({
        title: "Ошибка",
        description: "Введите название департамента",
        variant: "destructive",
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
      queryClient.invalidateQueries({ queryKey: ["/api/managements"] });
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
      if (!department || !management) {
        throw new Error("department and management are required");
      }
      const response = await apiRequest("POST", "/api/divisions", {
        name: divisionName,
        departmentId: department.id,
        managementId: management.id,
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/divisions"] });
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
    if (!department || !management) return;

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
            <div>Управление: {management?.name ?? "—"}</div>
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
      const payload = {
        ...values,
        username: values.username.trim(),
        name: values.name.trim(),
        email: values.email.trim(),
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
        email: values.email.trim(),
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
                <Label>Имя пользователя</Label>
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
                    <FormLabel>Имя пользователя</FormLabel>
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

  const canEditDepartment = (departmentId: string) => {
    if (!currentUser) return false;
    if (currentUser.role === "admin") return true;
    if (currentUser.role === "director" && currentUser.departmentId === departmentId) return true;
    return false;
  };

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

  const openDivisionDialog = (department: Department, management: Management) => {
    setDivisionDialogState({ open: true, department, management });
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
        <Button onClick={() => setIsDialogOpen(true)} data-testid="button-add-department">
          <Plus size={18} className="mr-2" />
          Создать структуру
        </Button>
      </div>

      {departments.length === 0 ? (
        <div className="border rounded-lg p-12 text-center">
          <p className="text-muted-foreground mb-4">Структура организации пока не создана</p>
          <Button onClick={() => setIsDialogOpen(true)} variant="outline">
            <Plus size={18} className="mr-2" />
            Создать первый департамент
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {departments.map((department) => {
            const canEdit = canEditDepartment(department.id);
            const departmentEmployees = employees.filter((emp) => emp.departmentId === department.id);
            const director = departmentEmployees.find((emp) => emp.role === "director");
            const deputy = departmentEmployees.find((emp) => emp.role === "manager" && !emp.managementId && !emp.divisionId);
            const departmentManagements = managements.filter((mgmt) => mgmt.departmentId === department.id);

            return (
              <Card key={department.id}>
                <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <CardTitle>{department.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">Директор и заместитель находятся на верхнем уровне дерева</p>
                  </div>
                  {canEdit && (
                    <Button variant="outline" size="sm" onClick={() => openManagementDialog(department)}>
                      <Plus className="h-4 w-4 mr-2" />
                      Добавить управление
                    </Button>
                  )}
                </CardHeader>
                <CardContent className="space-y-6">
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

                  <div className="space-y-4">
                    {departmentManagements.length === 0 ? (
                      <div className="rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
                        Управления пока не созданы. {canEdit ? "Добавьте первое управление, чтобы продолжить построение структуры." : "Обратитесь к администратору или директору департамента."}
                      </div>
                    ) : (
                      departmentManagements.map((management) => {
                        const managementEmployees = departmentEmployees.filter((emp) => emp.managementId === management.id);
                        const managementHead = managementEmployees.find((emp) => emp.role === "manager" && !emp.divisionId);
                        const managementDivisions = divisions.filter((division) => division.managementId === management.id);

                        return (
                          <Card key={management.id} className="border border-muted">
                            <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div>
                                <CardTitle className="text-lg">{management.name}</CardTitle>
                                <p className="text-sm text-muted-foreground">Руководитель управления и его отделы</p>
                              </div>
                              {canEdit && (
                                <Button variant="outline" size="sm" onClick={() => openDivisionDialog(department, management)}>
                                  <Plus className="h-4 w-4 mr-2" />
                                  Добавить отдел
                                </Button>
                              )}
                            </CardHeader>
                            <CardContent className="space-y-4">
                              <PositionCell
                                positionType="management_head"
                                employee={managementHead ? { id: managementHead.id, name: managementHead.name, rating: parseRating(managementHead.rating) } : undefined}
                                canEdit={canEdit}
                                onClick={canEdit ? () => openSlot({ positionType: "management_head", departmentId: department.id, departmentName: department.name, managementId: management.id, managementName: management.name, employee: managementHead }) : undefined}
                              />

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
                                      <Card key={division.id} className="bg-muted/30">
                                        <CardHeader>
                                          <CardTitle className="text-base">{division.name}</CardTitle>
                                        </CardHeader>
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
                                      </Card>
                                    );
                                  })
                                )}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
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

