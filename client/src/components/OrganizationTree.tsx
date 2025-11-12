import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronDown, ChevronRight, Building2, Users, User } from "lucide-react";
import UserAvatar from "./UserAvatar";
import RatingDisplay from "./RatingDisplay";
import GradeBadge from "./GradeBadge";

export interface OrgNode {
  id: string;
  name: string;
  type: "department" | "management" | "division" | "employee";
  leader?: string;
  rating?: number;
  points?: number;
  employeeCount?: number;
  children?: OrgNode[];
}

interface OrgNodeItemProps {
  node: OrgNode;
  level: number;
  collapsed: Set<string>;
  onToggle: (nodeId: string) => void;
}

interface CollapsedStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function resolveStorage(storage?: CollapsedStorage): CollapsedStorage | null {
  if (storage) return storage;
  if (typeof window !== "undefined" && window.localStorage) {
    return window.localStorage;
  }
  if (typeof globalThis !== "undefined" && "localStorage" in globalThis) {
    return (globalThis as unknown as { localStorage?: CollapsedStorage }).localStorage ?? null;
  }
  return null;
}

export function readCollapsedState(storageKey: string, storage?: CollapsedStorage): Set<string> {
  const resolved = resolveStorage(storage);
  if (!resolved) return new Set();
  const raw = resolved.getItem(storageKey);
  if (!raw) return new Set();
  try {
    const parsed = JSON.parse(raw) as string[];
    return new Set(parsed);
  } catch {
    return new Set();
  }
}

export function writeCollapsedState(
  storageKey: string,
  collapsed: Set<string>,
  storage?: CollapsedStorage,
): void {
  const resolved = resolveStorage(storage);
  if (!resolved) return;
  resolved.setItem(storageKey, JSON.stringify(Array.from(collapsed)));
}

export function toggleCollapsedNode(prev: Set<string>, nodeId: string): Set<string> {
  const next = new Set(prev);
  if (next.has(nodeId)) {
    next.delete(nodeId);
  } else {
    next.add(nodeId);
  }
  return next;
}

function OrgNodeItem({ node, level, collapsed, onToggle }: OrgNodeItemProps) {
  const isExpanded = !collapsed.has(node.id);
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
        className={`flex items-center gap-2 p-3 rounded-md hover-elevate cursor-pointer ${level > 0 ? "ml-6" : ""}`}
        onClick={() => hasChildren && onToggle(node.id)}
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
          {node.leader && (
            <div className="flex items-center gap-2">
              <UserAvatar name={node.leader} size="sm" />
              <span className="text-sm text-muted-foreground hidden sm:inline">{node.leader}</span>
            </div>
          )}
          {node.type === "employee" && node.points !== undefined && <GradeBadge points={node.points} showPoints tooltip />}
          {node.rating !== undefined && <RatingDisplay rating={node.rating} size="sm" />}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="space-y-1">
          {node.children?.map((child) => (
            <OrgNodeItem key={child.id} node={child} level={level + 1} collapsed={collapsed} onToggle={onToggle} />
          ))}
        </div>
      )}
    </div>
  );
}

interface OrganizationTreeProps {
  data: OrgNode[];
  storageKey: string;
}

export default function OrganizationTree({ data, storageKey }: OrganizationTreeProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    setCollapsed(readCollapsedState(storageKey));
  }, [storageKey]);

  const toggle = useMemo(
    () => (nodeId: string) => {
      setCollapsed((prev) => {
        const next = toggleCollapsedNode(prev, nodeId);
        writeCollapsedState(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  return (
    <Card data-testid="card-organization-tree">
      <CardHeader>
        <CardTitle>Структура организации</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {data.map((node) => (
          <OrgNodeItem key={node.id} node={node} level={0} collapsed={collapsed} onToggle={toggle} />
        ))}
      </CardContent>
    </Card>
  );
}
