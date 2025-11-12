import { LayoutDashboard, CheckSquare, ListTodo, Gavel, BarChart3, Building2, Award } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { useLocation } from "wouter";

const menuItems = [
  { title: "Панель управления", url: "/", icon: LayoutDashboard },
  { title: "Мои задачи", url: "/my-tasks", icon: CheckSquare },
  { title: "Все задачи", url: "/all-tasks", icon: ListTodo },
  { title: "Аукционы", url: "/auctions", icon: Gavel },
  { title: "Мои баллы", url: "/point-history", icon: Award },
  { title: "Отчёты", url: "/reports", icon: BarChart3 },
];

const adminItems = [{ title: "Организация", url: "/organization", icon: Building2 }];

export default function AppSidebar() {
  const [location] = useLocation();

  return (
    <Sidebar data-testid="sidebar-main">
      <SidebarHeader className="p-6">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-md bg-primary">
            <CheckSquare className="text-primary-foreground" size={24} />
          </div>
          <div>
            <h2 className="font-bold text-xl">TaskFlow</h2>
            <p className="text-xs text-muted-foreground">Управление задачами</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Главное меню</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {menuItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Администрирование</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {adminItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton 
                    asChild 
                    isActive={location === item.url}
                    data-testid={`link-${item.title.toLowerCase().replace(/\s+/g, '-')}`}
                  >
                    <a href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </a>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
