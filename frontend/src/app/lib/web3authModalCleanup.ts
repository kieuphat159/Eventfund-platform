let observer: MutationObserver | null = null;

export function watchAndCleanWeb3AuthModal() {
  // Web3Auth v10 mounts modal into #w3a-modal or #w3a-container
  const selectors = ["#w3a-modal", "#w3a-container", "[id^='w3a-']"];

  const cleanup = () => {
    selectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => el.remove());
    });

    // Remove overflow:hidden that Web3Auth sets on body when modal opens
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

    // If modal root exists but is empty (blank screen) → cleanup
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

  // Safety timeout: if modal still present after 30s → force remove
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