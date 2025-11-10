import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { insertUserSchema, type SelectUser, type SelectEmployee } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit2 } from "lucide-react";

const createUserFormSchema = insertUserSchema;

type CreateUserForm = z.infer<typeof createUserFormSchema>;

const editUserFormSchema = z.object({
  role: z.enum(["admin", "director", "manager", "senior", "employee"]),
  employeeId: z.string().nullable(),
});

type EditUserForm = z.infer<typeof editUserFormSchema>;

export default function AdminPanel() {
  const { toast } = useToast();
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SelectUser | null>(null);

  const getErrorMessage = (error: any, fallback: string) => {
    if (error?.message) {
      const parts = String(error.message).split(": ");
      const lastPart = parts[parts.length - 1];
      try {
        const parsed = JSON.parse(lastPart);
        if (parsed?.error && typeof parsed.error === "string") {
          return parsed.error;
        }
      } catch {
        // ignore JSON parse errors
      }
      return String(error.message);
    }
    return fallback;
  };

  const { data: users = [], isLoading: usersLoading } = useQuery<SelectUser[]>({
    queryKey: ["/api/users"],
  });

  const { data: employees = [] } = useQuery<SelectEmployee[]>({
    queryKey: ["/api/employees"],
  });

  const createForm = useForm<CreateUserForm>({
    resolver: zodResolver(createUserFormSchema),
    defaultValues: {
      username: "",
      password: "",
      role: "employee",
      employeeId: null,
    },
  });

  const editForm = useForm<EditUserForm>({
    resolver: zodResolver(editUserFormSchema),
    defaultValues: {
      role: "employee",
      employeeId: null,
    },
  });

  const createUserMutation = useMutation({
    mutationFn: async (data: CreateUserForm) => {
      const res = await apiRequest("POST", "/api/users", data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setIsCreateDialogOpen(false);
      createForm.reset();
      toast({
        title: "Пользователь создан",
        description: "Новый пользователь успешно добавлен",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: getErrorMessage(error, "Не удалось создать пользователя"),
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EditUserForm }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setEditingUser(null);
      editForm.reset();
      toast({
        title: "Пользователь обновлён",
        description: "Данные пользователя сохранены",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: getErrorMessage(error, "Не удалось обновить пользователя"),
        variant: "destructive",
      });
    },
  });

  const onCreateSubmit = (data: CreateUserForm) => {
    createUserMutation.mutate(data);
  };

  const onEditSubmit = (data: EditUserForm) => {
    if (editingUser) {
      updateUserMutation.mutate({ id: editingUser.id, data });
    }
  };

  const handleEditClick = (user: SelectUser) => {
    setEditingUser(user);
    editForm.reset({
      role: user.role,
      employeeId: user.employeeId,
    });
  };

  const getRoleBadgeColor = (role: string) => {
    const colors: Record<string, string> = {
      admin: "bg-red-500/20 text-red-300",
      director: "bg-purple-500/20 text-purple-300",
      manager: "bg-blue-500/20 text-blue-300",
      senior: "bg-green-500/20 text-green-300",
      employee: "bg-gray-500/20 text-gray-300",
    };
    return colors[role] || colors.employee;
  };

  const roleLabels: Record<string, string> = {
    admin: "Администратор",
    director: "Директор",
    manager: "Менеджер",
    senior: "Ведущий сотрудник",
    employee: "Сотрудник",
  };

  const getRoleLabel = (role: string) => roleLabels[role] || role;

  const getEmployeeName = (employeeId: string | null) => {
    if (!employeeId) return "—";
    const employee = employees.find(e => e.id === employeeId);
    return employee?.name || "—";
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold" data-testid="text-admin-panel-title">Панель администратора</h1>
            <p className="text-muted-foreground mt-1">Управляйте учётными записями и правами доступа</p>
          </div>

          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="button-create-user">
                <Plus className="mr-2 h-4 w-4" />
                Создать пользователя
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Новый пользователь</DialogTitle>
                <DialogDescription>
                  Добавьте новую учётную запись в систему
                </DialogDescription>
              </DialogHeader>
              
              <Form {...createForm}>
                <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                  <FormField
                    control={createForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Имя пользователя</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="ivan.petrov" data-testid="input-username" />
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
                          <Input {...field} type="password" placeholder="••••••••" data-testid="input-password" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Роль</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger data-testid="select-role">
                              <SelectValue placeholder="Выберите роль" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="admin">Администратор</SelectItem>
                            <SelectItem value="director">Директор</SelectItem>
                            <SelectItem value="manager">Менеджер</SelectItem>
                            <SelectItem value="senior">Ведущий сотрудник</SelectItem>
                            <SelectItem value="employee">Сотрудник</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={createForm.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Привязать к сотруднику (необязательно)</FormLabel>
                        <Select
                          onValueChange={(value) => field.onChange(value === "__none__" ? null : value)}
                          value={field.value || "__none__"}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-employee">
                              <SelectValue placeholder="Выберите сотрудника" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="__none__">Без привязки</SelectItem>
                            {employees.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                {emp.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <DialogFooter>
                    <Button type="submit" disabled={createUserMutation.isPending} data-testid="button-submit-create">
                      {createUserMutation.isPending ? "Создание…" : "Создать"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Учётные записи</CardTitle>
            <CardDescription>Управляйте пользователями и их правами доступа</CardDescription>
          </CardHeader>
          <CardContent>
            {usersLoading ? (
              <div className="text-center py-8 text-muted-foreground">Загрузка…</div>
            ) : users.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Пользователи не найдены</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Имя пользователя</TableHead>
                    <TableHead>Роль</TableHead>
                    <TableHead>Привязанный сотрудник</TableHead>
                    <TableHead className="text-right">Действия</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-medium" data-testid={`text-username-${user.id}`}>
                        {user.username}
                      </TableCell>
                      <TableCell>
                        <span className={`px-2 py-1 rounded-md text-xs font-medium ${getRoleBadgeColor(user.role)}`} data-testid={`badge-role-${user.id}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </TableCell>
                      <TableCell data-testid={`text-employee-${user.id}`}>
                        {getEmployeeName(user.employeeId)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditClick(user)}
                          data-testid={`button-edit-${user.id}`}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Редактирование пользователя</DialogTitle>
              <DialogDescription>
                Обновите роль и привязку сотрудника для {editingUser?.username}
              </DialogDescription>
            </DialogHeader>

            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <FormField
                  control={editForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Роль</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-role">
                            <SelectValue placeholder="Выберите роль" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Администратор</SelectItem>
                          <SelectItem value="director">Директор</SelectItem>
                          <SelectItem value="manager">Менеджер</SelectItem>
                          <SelectItem value="senior">Ведущий сотрудник</SelectItem>
                          <SelectItem value="employee">Сотрудник</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={editForm.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Привязка к сотруднику</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "__none__" ? null : value)}
                        value={field.value || "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-edit-employee">
                            <SelectValue placeholder="Выберите сотрудника" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">Без привязки</SelectItem>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="submit" disabled={updateUserMutation.isPending} data-testid="button-submit-edit">
                    {updateUserMutation.isPending ? "Сохранение…" : "Сохранить"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
