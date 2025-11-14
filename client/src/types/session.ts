import type { SelectUser } from "@shared/schema";

export type SessionUser = SelectUser & {
  canCreateAuctions?: boolean;
};
