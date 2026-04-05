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

function normalizeApiBaseUrl(baseUrl: string): string {
  const trimmed = baseUrl.trim().replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

const RESOLVED_API_BASE_URL = normalizeApiBaseUrl(API_BASE_URL);

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
  const resolvedPath = path.startsWith("/") ? path : `/${path}`;

  const requestHeaders = new Headers(headers);
  const token = typeof window !== "undefined" ? localStorage.getItem("jwtToken") : null;

  if (token && !requestHeaders.has("Authorization")) {
    requestHeaders.set("Authorization", `Bearer ${token}`);
  }

  if (body !== undefined && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }

  const response = await fetch(`${RESOLVED_API_BASE_URL}${resolvedPath}`, {
    method,
    ...rest,
    headers: requestHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json() : await response.text();

  if (!response.ok) {
    const fallbackMessage = `Request failed (${response.status})`;
    let message = fallbackMessage;

    if (typeof payload === "object" && payload !== null) {
      const errorPayload = payload as {
        message?: string;
        error?: {
          message?: string;
          details?: Array<{ message?: string } | string>;
        };
      };

      message =
        errorPayload.message ||
        errorPayload.error?.message ||
        (Array.isArray(errorPayload.error?.details)
          ? typeof errorPayload.error.details[0] === "string"
            ? errorPayload.error.details[0]
            : errorPayload.error.details[0]?.message || fallbackMessage
          : fallbackMessage);
    }

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