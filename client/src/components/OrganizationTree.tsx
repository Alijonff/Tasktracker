import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Building2, Users, User } from "lucide-react";
import { useState } from "react";
import UserAvatar from "./UserAvatar";
import RatingDisplay from "./RatingDisplay";

export interface OrgNode {
  id: string;
  name: string;
  type: "department" | "management" | "division" | "employee";
  leader: string;
  rating?: number;
  employeeCount?: number;
  children?: OrgNode[];
}

interface OrgNodeItemProps {
  node: OrgNode;
  level: number;
}

function OrgNodeItem({ node, level }: OrgNodeItemProps) {
  const [isExpanded, setIsExpanded] = useState(level === 0);

  const hasChildren = node.children && node.children.length > 0;

  const getIcon = () => {
    switch (node.type) {
      case "department":
        return <Building2 size={18} className="text-primary" />;
      case "management":
      case "division":
        return <Users size={18} className="text-primary" />;
      case "employee":
        return <User size={18} className="text-muted-foreground" />;
    }
  };

  return (
    <div className="space-y-1">
      <div
        className={`flex items-center gap-2 p-3 rounded-md hover-elevate cursor-pointer ${
          level > 0 ? "ml-6" : ""
        }`}
        onClick={() => hasChildren && setIsExpanded(!isExpanded)}
        data-testid={`org-node-${node.id}`}
      >
        {hasChildren ? (
          isExpanded ? (
            <ChevronDown size={16} className="text-muted-foreground" />
          ) : (
            <ChevronRight size={16} className="text-muted-foreground" />
          )
        ) : (
          <div className="w-4" />
        )}
        
        {getIcon()}
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium truncate">{node.name}</span>
            {node.employeeCount !== undefined && (
              <span className="text-xs text-muted-foreground">({node.employeeCount})</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <UserAvatar name={node.leader} size="sm" />
            <span className="text-sm text-muted-foreground hidden sm:inline">{node.leader}</span>
          </div>
          {node.rating !== undefined && <RatingDisplay rating={node.rating} size="sm" />}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {node.children?.map((child) => (
            <OrgNodeItem key={child.id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

interface OrganizationTreeProps {
  data: OrgNode[];
}

export default function OrganizationTree({ data }: OrganizationTreeProps) {
  return (
    <Card data-testid="card-organization-tree">
      <CardHeader>
        <CardTitle>Структура организации</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {data.map((node) => (
          <OrgNodeItem key={node.id} node={node} level={0} />
        ))}
      </CardContent>
    </Card>
  );
}
