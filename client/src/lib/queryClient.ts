import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : {},
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

// Helper to build URL from query key segments
function buildUrlFromQueryKey(queryKey: readonly unknown[]): string {
  if (queryKey.length === 0) return "";
  
  const basePath = queryKey[0] as string;
  
  // If there's a second segment, treat it as query parameters object
  if (queryKey.length > 1 && typeof queryKey[1] === "object" && queryKey[1] !== null) {
    const params = queryKey[1] as Record<string, string | number | boolean>;
    const searchParams = new URLSearchParams();
    
    Object.entries(params).forEach(([key, value]) => {
      // Always include departmentId (required for security)
      // Skip other filters if they're "all" (means no filter)
      if (key === "departmentId") {
        if (value !== undefined && value !== null) {
          searchParams.append(key, String(value));
        }
      } else if (value !== undefined && value !== null && value !== "all" && value !== "") {
        searchParams.append(key, String(value));
      }
    });
    
    const queryString = searchParams.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  }
  
  // Otherwise, join with "/" for simple paths
  return queryKey.join("/") as string;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const url = buildUrlFromQueryKey(queryKey);
    const res = await fetch(url, {
      credentials: "include",
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
