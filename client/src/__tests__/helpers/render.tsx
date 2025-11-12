import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import { renderToString } from "react-dom/server";

export function renderWithQuery(ui: ReactElement): string {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return renderToString(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}
