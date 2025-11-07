import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import AppSidebar from "@/components/AppSidebar";
import Dashboard from "@/pages/Dashboard";
import MyTasks from "@/pages/MyTasks";
import Auctions from "@/pages/Auctions";
import CreateTask from "@/pages/CreateTask";
import Reports from "@/pages/Reports";
import Organization from "@/pages/Organization";
import Settings from "@/pages/Settings";
import NotFound from "@/pages/not-found";
import UserAvatar from "@/components/UserAvatar";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/my-tasks" component={MyTasks} />
      <Route path="/auctions" component={Auctions} />
      <Route path="/create-task" component={CreateTask} />
      <Route path="/reports" component={Reports} />
      <Route path="/organization" component={Organization} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  const style = {
    "--sidebar-width": "20rem",
    "--sidebar-width-icon": "4rem",
  };

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider style={style as React.CSSProperties}>
          <div className="flex h-screen w-full">
            <AppSidebar />
            <div className="flex flex-col flex-1 overflow-hidden">
              <header className="flex items-center justify-between p-4 border-b bg-background">
                <SidebarTrigger data-testid="button-sidebar-toggle" />
                <div className="flex items-center gap-3">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium">Михаил Чен</p>
                    <p className="text-xs text-muted-foreground">Старший инженер</p>
                  </div>
                  <UserAvatar name="Михаил Чен" size="md" />
                </div>
              </header>
              <main className="flex-1 overflow-auto p-6">
                <Router />
              </main>
            </div>
          </div>
        </SidebarProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}
