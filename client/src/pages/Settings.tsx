import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import UserAvatar from "@/components/UserAvatar";

export default function Settings() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold">Настройки</h1>
        <p className="text-muted-foreground">Управляйте своим аккаунтом и настройками приложения</p>
      </div>

      <Card data-testid="card-profile-settings">
        <CardHeader>
          <CardTitle>Настройки профиля</CardTitle>
          <CardDescription>Обновите свою личную информацию</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center gap-4">
            <UserAvatar name="Админ Админ" size="lg" />
            <Button variant="outline" size="sm" data-testid="button-change-avatar">
              Изменить аватар
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Полное имя</Label>
              <Input id="name" defaultValue="Админ Админ" data-testid="input-full-name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" defaultValue="admin@company.com" data-testid="input-email" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="department">Подразделение</Label>
              <Select defaultValue="admin">
                <SelectTrigger id="department" data-testid="select-department-settings">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Администрация</SelectItem>
                  <SelectItem value="engineering">Инженерный отдел</SelectItem>
                  <SelectItem value="design">Отдел дизайна</SelectItem>
                  <SelectItem value="marketing">Отдел маркетинга</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="role">Роль</Label>
              <Select defaultValue="admin">
                <SelectTrigger id="role" data-testid="select-role-settings">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Администратор</SelectItem>
                  <SelectItem value="director">Директор департамента</SelectItem>
                  <SelectItem value="senior">Старший сотрудник</SelectItem>
                  <SelectItem value="employee">Сотрудник</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button data-testid="button-save-profile">Сохранить изменения</Button>
        </CardContent>
      </Card>

      <Card data-testid="card-notification-settings">
        <CardHeader>
          <CardTitle>Уведомления</CardTitle>
          <CardDescription>Настройте способ получения уведомлений</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Назначение задач</Label>
              <p className="text-sm text-muted-foreground">Получать уведомления при назначении задач</p>
            </div>
            <Switch defaultChecked data-testid="switch-task-notifications" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Обновления аукционов</Label>
              <p className="text-sm text-muted-foreground">Уведомления о победе или проигрыше в аукционах</p>
            </div>
            <Switch defaultChecked data-testid="switch-auction-notifications" />
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Напоминания о дедлайнах</Label>
              <p className="text-sm text-muted-foreground">Напоминания о приближающихся дедлайнах</p>
            </div>
            <Switch defaultChecked data-testid="switch-deadline-notifications" />
          </div>
        </CardContent>
      </Card>

      <Card data-testid="card-system-settings">
        <CardHeader>
          <CardTitle>Системные настройки</CardTitle>
          <CardDescription>Настройте работу приложения</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="language">Язык</Label>
            <Select defaultValue="ru">
              <SelectTrigger id="language" data-testid="select-language">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="ru">Русский</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="timezone">Часовой пояс</Label>
            <Select defaultValue="msk">
              <SelectTrigger id="timezone" data-testid="select-timezone">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="utc">UTC</SelectItem>
                <SelectItem value="est">EST</SelectItem>
                <SelectItem value="pst">PST</SelectItem>
                <SelectItem value="msk">MSK (Москва)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
