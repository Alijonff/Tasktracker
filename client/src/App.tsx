import { useEffect } from "react";
import { Switch, Route } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider, useQuery, useMutation } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut, Settings as SettingsIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import AppSidebar from "@/components/AppSidebar";
import { useLocation } from "wouter";
import type { SelectUser } from "@shared/schema";
import Dashboard from "@/pages/Dashboard";
import MyTasks from "@/pages/MyTasks";
import AllTasks from "@/pages/AllTasks";
import Auctions from "@/pages/Auctions";
import CreateTask from "@/pages/CreateTask";
import Reports from "@/pages/Reports";
import Organization from "@/pages/Organization";
import Settings from "@/pages/Settings";
import AdminPanel from "@/pages/AdminPanel";
import Login from "@/pages/Login";
import NotFound from "@/pages/not-found";
import UserAvatar from "@/components/UserAvatar";

function UserMenu() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { data: response } = useQuery<{ user: SelectUser | null }>({
    queryKey: ["/api/auth/me"],
  });

  const user = response?.user;

  const logoutMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/auth/logout"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      setLocation("/login");
      toast({
        title: "Logged out",
        description: "You have been successfully logged out.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to logout. Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!user) return null;

  const roleLabels: Record<string, string> = {
    admin: "Administrator",
    director: "Director",
    manager: "Manager",
    senior: "Senior Employee",
    employee: "Employee",
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <div 
          className="flex items-center gap-3 cursor-pointer hover-elevate active-elevate-2 rounded-md p-2 -m-2"
          data-testid="button-user-menu"
        >
          <div className="text-right hidden sm:block">
            <p className="text-sm font-medium" data-testid="text-user-name">{user.username}</p>
            <p className="text-xs text-muted-foreground" data-testid="text-user-role">
              {roleLabels[user.role] || user.role}
            </p>
          </div>
          <UserAvatar name={user.username} size="md" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>My Account</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => setLocation("/settings")}
          data-testid="menu-item-settings"
        >
          <SettingsIcon className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
          data-testid="menu-item-logout"
        >
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: response, isLoading } = useQuery<{ user: SelectUser | null }>({
    queryKey: ["/api/auth/me"],
  });

  useEffect(() => {
    if (!isLoading && !response?.user) {
      setLocation("/login");
    }
  }, [isLoading, response, setLocation]);

  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  if (!response?.user) {
    return null;
  }

  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 overflow-hidden">
          <header className="flex items-center justify-between p-4 border-b bg-background">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <UserMenu />
          </header>
          <main className="flex-1 overflow-auto p-6">
            {children}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/">
        {() => <ProtectedLayout><Dashboard /></ProtectedLayout>}
      </Route>
      <Route path="/my-tasks">
        {() => <ProtectedLayout><MyTasks /></ProtectedLayout>}
      </Route>
      <Route path="/all-tasks">
        {() => <ProtectedLayout><AllTasks /></ProtectedLayout>}
      </Route>
      <Route path="/auctions">
        {() => <ProtectedLayout><Auctions /></ProtectedLayout>}
      </Route>
      <Route path="/create-task">
        {() => <ProtectedLayout><CreateTask /></ProtectedLayout>}
      </Route>
      <Route path="/reports">
        {() => <ProtectedLayout><Reports /></ProtectedLayout>}
      </Route>
      <Route path="/organization">
        {() => <ProtectedLayout><Organization /></ProtectedLayout>}
      </Route>
      <Route path="/admin">
        {() => <ProtectedLayout><AdminPanel /></ProtectedLayout>}
      </Route>
      <Route path="/settings">
        {() => <ProtectedLayout><Settings /></ProtectedLayout>}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Router />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
