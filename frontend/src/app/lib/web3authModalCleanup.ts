let observer: MutationObserver | null = null;

export function watchAndCleanWeb3AuthModal() {
  // Web3Auth v10 mount modal vào #w3a-modal hoặc #w3a-container
  const selectors = ["#w3a-modal", "#w3a-container", "[id^='w3a-']"];

  const cleanup = () => {
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    });

    // Xóa overflow:hidden mà Web3Auth set trên body khi mở modal
    document.body.style.overflow = "";
    document.body.style.removeProperty("overflow");
    document.documentElement.style.removeProperty("overflow");

    observer?.disconnect();
    observer = null;
  };

  observer?.disconnect();

  observer = new MutationObserver(() => {
    const modalRoot = document.querySelector("#w3a-modal");
    if (!modalRoot) return;

    // Nếu modal root tồn tại nhưng rỗng (màn trắng) → cleanup
    const isEmpty =
      !modalRoot.hasChildNodes() ||
      (modalRoot as HTMLElement).innerHTML.trim() === "";

    if (isEmpty) {
      cleanup();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });

  // Safety timeout: nếu sau 30s modal vẫn còn → force remove
  const safetyTimer = setTimeout(cleanup, 30_000);

  return () => {
    clearTimeout(safetyTimer);
    observer?.disconnect();
    observer = null;
  };
}

export function forceCloseWeb3AuthModal() {
  const selectors = [
    "#w3a-modal",
    "#w3a-container",
    "[id^='w3a-']",
    ".w3a-modal",
    ".w3a-overlay",
  ];
  selectors.forEach((sel) => {
    document.querySelectorAll(sel).forEach((el) => el.remove());
  });
  document.body.style.removeProperty("overflow");
  document.documentElement.style.removeProperty("overflow");
}