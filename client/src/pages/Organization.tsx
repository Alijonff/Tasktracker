import { useState } from "react";
import OrganizationTree from "@/components/OrganizationTree";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Organization() {
  const orgData = [
    {
      id: "dept-1",
      name: "Engineering Department",
      type: "department" as const,
      leader: "Sarah Johnson",
      rating: 4.7,
      employeeCount: 45,
      children: [
        {
          id: "mgmt-1",
          name: "Backend Development",
          type: "management" as const,
          leader: "Mike Chen",
          rating: 4.8,
          employeeCount: 15,
          children: [
            {
              id: "div-1",
              name: "API Team",
              type: "division" as const,
              leader: "Alex Rivera",
              rating: 4.6,
              employeeCount: 8,
            },
            {
              id: "div-2",
              name: "Database Team",
              type: "division" as const,
              leader: "Emma Wilson",
              rating: 4.9,
              employeeCount: 7,
            },
          ],
        },
        {
          id: "mgmt-2",
          name: "Frontend Development",
          type: "management" as const,
          leader: "David Park",
          rating: 4.9,
          employeeCount: 12,
          children: [
            {
              id: "div-3",
              name: "Web Team",
              type: "division" as const,
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
      type: "department" as const,
      leader: "Jessica Martinez",
      rating: 4.8,
      employeeCount: 18,
      children: [
        {
          id: "mgmt-3",
          name: "UI/UX Design",
          type: "management" as const,
          leader: "Tom Anderson",
          rating: 4.9,
          employeeCount: 10,
        },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Структура организации</h1>
          <p className="text-muted-foreground">Управляйте отделами, командами и сотрудниками</p>
        </div>
        <Button data-testid="button-add-department">
          <Plus size={18} />
          Добавить департамент
        </Button>
      </div>

      <OrganizationTree data={orgData} />
    </div>
  );
}
