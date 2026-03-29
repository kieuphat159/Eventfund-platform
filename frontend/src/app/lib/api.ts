export class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

const API_BASE_URL =
  ((import.meta as { env?: { VITE_API_BASE_URL?: string } }).env
    ?.VITE_API_BASE_URL as string | undefined) || "http://localhost:4000/api";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

interface RequestOptions extends Omit<RequestInit, "method" | "body"> {
  headers?: HeadersInit;
  body?: unknown;
}

async function request<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers, ...rest } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    ...rest,
    headers: {
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "object" && payload !== null && "message" in payload
        ? String(
            (payload as { message?: string }).message ||
              `Request failed (${response.status})`,
          )
        : `Request failed (${response.status})`;

    throw new ApiError(message, response.status, payload);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<RequestOptions, "body">) =>
    request<T>("GET", path, options),
  post: <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "body">,
  ) => request<T>("POST", path, { ...options, body }),
  put: <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "body">,
  ) => request<T>("PUT", path, { ...options, body }),
  patch: <T>(
    path: string,
    body?: unknown,
    options?: Omit<RequestOptions, "body">,
  ) => request<T>("PATCH", path, { ...options, body }),
  delete: <T>(path: string, options?: Omit<RequestOptions, "body">) =>
    request<T>("DELETE", path, options),
};
