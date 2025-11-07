import OrganizationTree from '../OrganizationTree';

export default function OrganizationTreeExample() {
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
          ],
        },
        {
          id: "mgmt-2",
          name: "Frontend Development",
          type: "management" as const,
          leader: "Emma Wilson",
          rating: 4.9,
          employeeCount: 12,
        },
      ],
    },
  ];

  return (
    <div className="p-4">
      <OrganizationTree data={orgData} />
    </div>
  );
}
