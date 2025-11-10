import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Form, FormField, FormItem, FormLabel, FormMessage, FormControl } from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

const changePasswordFormSchema = z.object({
  currentPassword: z.string().min(1, "Введите текущий пароль"),
  newPassword: z.string().min(6, "Новый пароль должен содержать минимум 6 символов"),
  confirmPassword: z.string().min(1, "Подтвердите новый пароль"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Пароли не совпадают",
  path: ["confirmPassword"],
});

type ChangePasswordForm = z.infer<typeof changePasswordFormSchema>;

export default function ChangePassword() {
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

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

  const changePasswordMutation = useMutation({
    mutationFn: async ({ currentPassword, newPassword }: ChangePasswordForm) => {
      const res = await apiRequest("POST", "/api/auth/change-password", {
        currentPassword,
        newPassword,
      });
      return await res.json();
    },
    onSuccess: async () => {
      toast({
        title: "Пароль обновлён",
        description: "Используйте новый пароль для дальнейшей работы",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/");
    },
    onError: (error: any) => {
      toast({
        title: "Ошибка",
        description: getErrorMessage(error, "Не удалось обновить пароль"),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ChangePasswordForm) => {
    changePasswordMutation.mutate(data);
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center space-y-2">
        <CardTitle className="text-2xl">Смена пароля</CardTitle>
        <CardDescription>
          Введите текущий пароль и задайте новый, чтобы продолжить работу в системе
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="currentPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Текущий пароль</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" placeholder="••••••••" autoComplete="current-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Новый пароль</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" placeholder="••••••••" autoComplete="new-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Повторите новый пароль</FormLabel>
                  <FormControl>
                    <Input {...field} type="password" placeholder="••••••••" autoComplete="new-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              className="w-full"
              disabled={changePasswordMutation.isPending}
              data-testid="button-change-password-submit"
            >
              {changePasswordMutation.isPending ? "Сохраняем…" : "Обновить пароль"}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
