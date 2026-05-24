const INSUFFICIENT_BALANCE_PATTERNS = [
  "insufficient funds",
  "insufficient balance",
  "not enough balance",
  "does not have enough balance",
  "no wallet account has enough balance",
  "required value",
];

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;

  const maybeMessage = (error as { message?: unknown })?.message;
  if (typeof maybeMessage === "string") return maybeMessage;

  return "";
}

export function isInsufficientBalanceError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  return INSUFFICIENT_BALANCE_PATTERNS.some((pattern) =>
    message.includes(pattern),
  );
}

export function getInsufficientBalanceMessage(error: unknown): string {
  const message = getErrorMessage(error);
  return (
    message ||
    "Your wallet does not have enough ETH to complete this transaction."
  );
}
