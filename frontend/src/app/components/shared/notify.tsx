import React from "react";
import { createRoot } from "react-dom/client";

type ToastProps = {
  title?: string;
  message: string;
  type?: "success" | "error" | "info";
  duration?: number;
};

function Toast({ title, message, type = "success" }: ToastProps) {
  const color =
    type === "success"
      ? "bg-emerald-600"
      : type === "error"
        ? "bg-red-600"
        : "bg-slate-600";

  return (
    <div
      className={`max-w-sm w-full ${color} text-white rounded-lg shadow-lg p-4`}
    >
      {title && <div className="font-semibold mb-1">{title}</div>}
      <div className="text-sm text-white/90">{message}</div>
    </div>
  );
}

function mountToast(
  element: HTMLElement,
  node: React.ReactElement,
  duration = 4000,
) {
  const root = createRoot(element);
  root.render(node);
  const timer = setTimeout(() => {
    try {
      root.unmount();
      element.remove();
    } catch {}
    clearTimeout(timer);
  }, duration);
}

export function notifySuccess(
  message: string,
  title?: string,
  duration = 4000,
) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.right = "24px";
  container.style.top = "24px";
  container.style.zIndex = "9999";
  document.body.appendChild(container);
  mountToast(
    container,
    <Toast title={title} message={message} type="success" />,
    duration,
  );
}

export function notifyError(message: string, title?: string, duration = 6000) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.right = "24px";
  container.style.top = "24px";
  container.style.zIndex = "9999";
  document.body.appendChild(container);
  mountToast(
    container,
    <Toast title={title} message={message} type="error" />,
    duration,
  );
}

export default Toast;
