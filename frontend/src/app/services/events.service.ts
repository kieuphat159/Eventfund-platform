import { api } from "../lib/api";
import { createPublicClient, http } from "viem";
import { sepolia } from "viem/chains";

export interface EventVenue {
  address?: string;
}

export interface EventTicketTier {
  name: string;
  price: number;
  totalSupply: number;
  benefits?: string[];
}

export type EventStatus =
  | "draft"
  | "funding"
  | "funded"
  | "ticketing"
  | "ongoing"
  | "completed"
  | "cancelled"
  | "failed";

export interface EventItem {
  _id?: string;
  id?: string;
  title?: string;
  description?: string;
  category?: string;
  status?: EventStatus;

  startDate?: string;
  endDate?: string;
  ticketingStartAt?: string;
  ticketingEndAt?: string;
  createdAt?: string;
  updatedAt?: string;

  organizer?: string;
  organizerWallet?: string;
  organizerStake?: string | number;

  venue?: EventVenue;
  imageUrls?: string[];

  fundingGoal?: string | number;
  currentFunding?: string | number;
  minStakeRequired?: string | number;
  fundingDeadline?: string;

  totalTickets?: number;
  ticketsSold?: number;
  totalTicketsUsed?: number;
  ticketUsageThreshold?: number;

  ticketTiers?: EventTicketTier[];
  adminSummary?: {
    investorCount?: number;
  };
}

export interface PaginatedEventsData {
  docs?: EventItem[];
  events?: EventItem[];
  totalDocs?: number;
  totalPages?: number;
  page?: number;
  limit?: number;
}

export interface EventsResponse {
  success: boolean;
  data?: PaginatedEventsData | EventItem[];
  message?: string;
}

export interface EventDetailResponse {
  success: boolean;
  data?: EventItem;
  message?: string;
}

export interface CreateEventPayload {
  title: string;
  description: string;
  category: string;
  investmentEnabled?: boolean;
  organizerAddress?: string;
  startDate: string;
  endDate: string;
  ticketingStartAt?: string;
  ticketingEndAt?: string;
  venue: {
    address: string;
  };
  fundingGoal?: string;
  fundingDeadline?: string;
  totalTickets: number;
  ticketPrice?: string;
  organizerStake?: string;
  organizerShareBps?: number;
  usedThreshold?: number;

  minStakeRequired?: string;
  ticketTiers?: EventTicketTier[];
  imageUrls?: string[];
}

export interface UpdateEventPayload {
  title?: string;
  description?: string;
  category?: string;
  startDate?: string;
  endDate?: string;
  ticketingStartAt?: string;
  ticketingEndAt?: string;
  venue?: {
    address?: string;
  };
  fundingGoal?: string;
  fundingDeadline?: string;
  totalTickets?: number;
  minStakeRequired?: string;
  ticketTiers?: EventTicketTier[];
  imageUrls?: string[];
  status?: EventStatus;
}

export interface CreateEventResponse {
  success: boolean;
  data?: EventItem;
  message?: string;
}

export interface EventBlockchainConfig {
  fundAddress: string;
  chainId: string;
}

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

interface TransactionRequestShape {
  to: string;
  data: string;
  value: string;
}

const WEB3AUTH_TX_GAS_CAP = 16_777_216n;

export interface CreateEventIntentTransaction {
  to: string;
  data: string;
  value: string;
  chainId: string;
  functionName?: string;
}

export interface CreateEventIntentData {
  draftEventId: string;
  organizer: string;
  transaction: CreateEventIntentTransaction;
}

export interface ConfirmCreateEventPayload {
  txHash: string;
  draftEventId?: string;
  organizerWallet?: string;
}

export interface ConfirmCreateEventData {
  synced: boolean;
  alreadySynced: boolean;
  txHash: string;
  contractEventId?: string;
  event?: EventItem;
}

export interface CreateEventOnChainResult {
  txHash: string;
  intent: CreateEventIntentData;
  confirmation: ConfirmCreateEventData | null;
}

interface CreateEventIntentResponse {
  success: boolean;
  data?: CreateEventIntentData;
  message?: string;
}

interface ConfirmCreateEventResponse {
  success: boolean;
  data?: ConfirmCreateEventData;
  message?: string;
}

const PUBLIC_RPC_URL =
  (import.meta.env.VITE_WEB3AUTH_RPC_URL as string | undefined) ||
  (import.meta.env.VITE_RPC_URL as string | undefined) ||
  "https://ethereum-sepolia-rpc.publicnode.com";

function normalizeEvents(
  data?: PaginatedEventsData | EventItem[],
): EventItem[] {
  if (!data) return [];
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.docs)) return data.docs;
  if (Array.isArray(data.events)) return data.events;
  return [];
}

export async function getEvents(params?: {
  status?: EventStatus;
  category?: string;
  organizer?: string;
  page?: number;
  limit?: number;
  search?: string;
}): Promise<EventItem[]> {
  const query = new URLSearchParams();

  if (params?.status) query.set("status", params.status);
  if (params?.category) query.set("category", params.category);
  if (params?.organizer) query.set("organizer", params.organizer);
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.search) query.set("search", params.search);

  const url = query.toString() ? `/events?${query.toString()}` : "/events";
  const payload = await api.get<EventsResponse>(url);

  return normalizeEvents(payload.data);
}

export async function getEventById(eventId: string): Promise<EventItem | null> {
  const payload = await api.get<EventDetailResponse>(`/events/${eventId}`);
  return payload.data || null;
}

export async function getMyEvents(walletAddress: string): Promise<EventItem[]> {
  if (!walletAddress) return [];
  return getEvents({ organizer: walletAddress });
}

export async function getAdminEvents(params?: {
  status?: EventStatus;
  category?: string;
  organizer?: string;
  page?: number;
  limit?: number;
  search?: string;
}): Promise<EventItem[]> {
  try {
    const query = new URLSearchParams();

    if (params?.status) query.set("status", params.status);
    if (params?.category) query.set("category", params.category);
    if (params?.organizer) query.set("organizer", params.organizer);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    if (params?.search) query.set("search", params.search);

    const url = query.toString()
      ? `/admin/events?${query.toString()}`
      : "/admin/events";
    const payload = await api.get<EventsResponse>(url);

    return normalizeEvents(payload.data);
  } catch {
    const payload = await api.get<EventsResponse>("/events");
    return normalizeEvents(payload.data);
  }
}

export async function getAdminEventById(
  eventId: string,
): Promise<EventItem | null> {
  const payload = await api.get<EventDetailResponse>(
    `/admin/events/${eventId}`,
  );
  return payload.data || null;
}

export async function createEvent(
  payload: CreateEventPayload,
): Promise<EventItem | null> {
  try {
    const response = await api.post<CreateEventResponse>("/events", payload);
    return response.data || null;
  } catch (error) {
    console.error("createEvent failed:", error);
    throw error;
  }
}

export async function createEventIntent(
  payload: CreateEventPayload,
): Promise<CreateEventIntentData | null> {
  const response = await api.post<CreateEventIntentResponse>(
    "/events/create-intent",
    payload,
  );

  return response.data || null;
}

export async function confirmCreateEventTransaction(
  payload: ConfirmCreateEventPayload,
  maxRetries = 15,
  retryDelayMs = 2000,
): Promise<ConfirmCreateEventData | null> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await api.post<ConfirmCreateEventResponse>(
        "/events/create/confirm",
        payload,
      );
      return response.data || null;
    } catch (error: any) {
      const isNotMined = error?.message?.includes("Transaction not mined yet");
      if (isNotMined && attempt < maxRetries) {
        console.warn(
          `[CreateEvent] Transaction not yet mined, retrying check in ${retryDelayMs}ms (attempt ${attempt}/${maxRetries})...`,
        );
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }
      throw error;
    }
  }
  return null;
}

function toHexValue(decimalString: string): string {
  const value = BigInt(decimalString);
  return `0x${value.toString(16)}`;
}

function normalizeAddress(value?: string | null): string | null {
  if (!value) return null;
  return value.toLowerCase();
}

function getRpcErrorMessage(error: unknown): string {
  if (error && typeof error === "object") {
    const err = error as {
      message?: string;
      shortMessage?: string;
      data?: { message?: string; cause?: { message?: string } };
    };

    return (
      err.shortMessage ||
      err.message ||
      err.data?.message ||
      err.data?.cause?.message ||
      "Unknown RPC error"
    );
  }

  return String(error);
}

function mapBundlerAuthError(message: string): string {
  const normalized = message.toLowerCase();
  const is401 =
    normalized.includes("401") || normalized.includes("unauthorized");
  const is429 =
    normalized.includes("429") || normalized.includes("too many requests");
  const isPimlico = normalized.includes("pimlico");
  const isWeb3AuthWalletApi =
    normalized.includes("api-wallet.web3auth.io") ||
    normalized.includes("/transaction") ||
    normalized.includes("bad request");

  if (is401 && (isPimlico || normalized.includes("non-200 status code"))) {
    return "Smart account bundler rejected request (401 Unauthorized). Check VITE_BUNDLER_URL and set Pimlico API key (VITE_PIMLICO_API_KEY or ?apikey= in URL).";
  }

  if (is429) {
    return "Web3Auth wallet service is rate-limiting this transaction (429 Too Many Requests). Wait a bit, reconnect the wallet, and try again. The app now pre-fills gas to reduce these rate-limit hits.";
  }

  if (isWeb3AuthWalletApi) {
    return "Web3Auth wallet service rejected the transaction request. This usually means the wallet is on the wrong chain or the embedded wallet session needs to be switched back to Sepolia.";
  }

  return message;
}

function isGasLimitTooHighError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("gas limit too high") ||
    (normalized.includes("cap:") && normalized.includes("tx:"))
  );
}

function toHexChainId(chainId: string): string {
  if (chainId.startsWith("0x")) {
    return chainId.toLowerCase();
  }

  return `0x${BigInt(chainId).toString(16)}`;
}

async function ensureProviderChain(
  provider: Eip1193Provider,
  expectedChainId: string,
): Promise<void> {
  const expectedHexChainId = toHexChainId(expectedChainId);
  const currentChainId = await provider.request({
    method: "eth_chainId",
  });

  if (
    typeof currentChainId === "string" &&
    currentChainId.toLowerCase() === expectedHexChainId
  ) {
    return;
  }

  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: expectedHexChainId }],
    });
  } catch (switchError) {
    const switchMessage = getRpcErrorMessage(switchError).toLowerCase();
    const shouldAddChain =
      switchMessage.includes("4902") ||
      switchMessage.includes("unknown chain") ||
      switchMessage.includes("not found");

    if (!shouldAddChain) {
      throw switchError;
    }

    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: expectedHexChainId,
          chainName: "Ethereum Sepolia",
          nativeCurrency: {
            name: "Ethereum",
            symbol: "ETH",
            decimals: 18,
          },
          rpcUrls: ["https://ethereum-sepolia-rpc.publicnode.com"],
          blockExplorerUrls: ["https://sepolia.etherscan.io"],
        },
      ],
    });
  }
}

async function getProviderAccounts(
  provider: Eip1193Provider,
): Promise<string[]> {
  const result = await provider.request({ method: "eth_accounts" });
  if (!Array.isArray(result)) return [];

  return result
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.toLowerCase());
}

async function resolveSignerAddress(
  provider: Eip1193Provider,
  preferredSignerAddress?: string,
  fallbackSignerAddress?: string,
): Promise<string> {
  const normalizedPreferred = normalizeAddress(preferredSignerAddress);
  const normalizedFallback = normalizeAddress(fallbackSignerAddress);
  const signerCandidates = Array.from(
    new Set(
      [normalizedPreferred, normalizedFallback].filter(
        (address): address is string => !!address,
      ),
    ),
  );

  if (!signerCandidates.length) {
    throw new Error("Wallet signer address is required to create event.");
  }

  const providerAccounts = await getProviderAccounts(provider);
  if (!providerAccounts.length) {
    throw new Error("Wallet has no active accounts. Please reconnect wallet.");
  }

  for (const candidate of signerCandidates) {
    if (providerAccounts.includes(candidate)) {
      return candidate;
    }
  }

  throw new Error(
    `Active wallet account does not match available signers. Expected one of: ${signerCandidates.join(", ")}. Active accounts: ${providerAccounts.join(", ")}.`,
  );
}

async function getBalanceWei(
  provider: Eip1193Provider,
  address: string,
): Promise<bigint> {
  const result = await provider.request({
    method: "eth_getBalance",
    params: [address, "latest"],
  });

  const hex = typeof result === "string" ? result : "0x0";
  return BigInt(hex);
}

async function estimateTransactionGas(
  fromAddress: string,
  transaction: TransactionRequestShape,
): Promise<string | undefined> {
  try {
    const publicClient = createPublicClient({
      chain: sepolia,
      transport: http(PUBLIC_RPC_URL),
    });

    const estimatedGas = await publicClient.estimateGas({
      account: fromAddress as `0x${string}`,
      to: transaction.to as `0x${string}`,
      data: transaction.data as `0x${string}`,
      value: BigInt(transaction.value || "0"),
    });

    // Pad the limit a bit to avoid edge-case underestimation.
    const paddedGas = estimatedGas + estimatedGas / 5n + 15000n;
    if (paddedGas > WEB3AUTH_TX_GAS_CAP) {
      console.warn(
        `[CreateEvent] Pre-estimated gas ${paddedGas.toString()} exceeds wallet cap ${WEB3AUTH_TX_GAS_CAP.toString()}. Falling back to wallet-side estimation.`,
      );
      return undefined;
    }

    return toHexValue(paddedGas.toString());
  } catch (error) {
    console.warn(
      "[CreateEvent] Failed to pre-estimate gas via public RPC, falling back to wallet estimation.",
      error,
    );
    return undefined;
  }
}

async function getSenderCandidates(
  provider: Eip1193Provider,
  preferredAddresses: Array<string | undefined>,
): Promise<string[]> {
  const providerAccounts = await getProviderAccounts(provider);

  return Array.from(
    new Set(
      [...preferredAddresses, ...providerAccounts]
        .map((item) => normalizeAddress(item ?? null))
        .filter((item): item is string => !!item),
    ),
  );
}

function isRetryableAccountError(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("insufficient funds") ||
    normalized.includes("cannot read properties of null") ||
    normalized.includes("execution reverted")
  );
}

async function pickFundedSenderAddress(
  provider: Eip1193Provider,
  tx: TransactionRequestShape,
  preferredAddresses: Array<string | undefined>,
): Promise<string[]> {
  const candidates = await getSenderCandidates(provider, preferredAddresses);

  if (!candidates.length) {
    throw new Error(
      "Wallet has no available accounts. Please reconnect wallet.",
    );
  }

  const txValue = BigInt(tx.value || "0");
  const candidatesWithBalance = await Promise.all(
    candidates.map(async (candidate) => ({
      address: candidate,
      balance: await getBalanceWei(provider, candidate),
    })),
  );

  const funded = candidatesWithBalance.filter((item) => item.balance > txValue);

  if (!funded.length) {
    const balances = candidatesWithBalance.map(
      (item) => `${item.address} (${item.balance.toString()} wei)`,
    );
    throw new Error(
      `No wallet account has enough balance for tx value. Required value: ${txValue.toString()} wei. Accounts: ${balances.join(", ")}`,
    );
  }

  // Try richer accounts first to reduce insufficient-fund failures from gas overhead.
  funded.sort((a, b) => (a.balance > b.balance ? -1 : 1));
  return funded.map((item) => item.address);
}

export async function createEventOnChain(
  provider: Eip1193Provider,
  payload: CreateEventPayload,
  organizerWallet?: string,
  smartAccountAddress?: string,
): Promise<CreateEventOnChainResult> {
  if (!provider?.request) {
    throw new Error("Wallet provider is unavailable");
  }

  const intent = await createEventIntent(payload);
  if (!intent?.transaction) {
    throw new Error("Unable to create event intent");
  }

  await ensureProviderChain(provider, intent.transaction.chainId);

  // Web3Auth/Torus can manage a smart account address in UI, but the actual
  // signing key belongs to the embedded EOA. Prefer the EOA for eth_sendTransaction
  // and only fall back to the smart account address if that's the only account
  // exposed by the provider.
  const fromAddress = await resolveSignerAddress(
    provider,
    organizerWallet,
    smartAccountAddress,
  );
  const signerBalance = await getBalanceWei(provider, fromAddress);
  const txValue = BigInt(intent.transaction.value || "0");

  if (signerBalance <= txValue) {
    throw new Error(
      `Signer ${fromAddress} does not have enough balance for tx value. Required value: ${txValue.toString()} wei, balance: ${signerBalance.toString()} wei.`,
    );
  }

  const gas = await estimateTransactionGas(fromAddress, {
    to: intent.transaction.to,
    data: intent.transaction.data,
    value: intent.transaction.value,
  });

  let txHash = "";
  const txParamsBase = {
    from: fromAddress,
    to: intent.transaction.to,
    data: intent.transaction.data,
    value: toHexValue(intent.transaction.value),
  };
  try {
    txHash = (await provider.request({
      method: "eth_sendTransaction",
      params: [
        {
          ...txParamsBase,
          ...(gas ? { gas } : {}),
        },
      ],
    })) as string;
  } catch (error) {
    const firstErrorMessage = getRpcErrorMessage(error);
    if (gas && isGasLimitTooHighError(firstErrorMessage)) {
      try {
        txHash = (await provider.request({
          method: "eth_sendTransaction",
          params: [txParamsBase],
        })) as string;
      } catch (retryError) {
        const retryMessage = mapBundlerAuthError(getRpcErrorMessage(retryError));
        throw new Error(
          `Create event transaction failed with signer ${fromAddress}: ${retryMessage}`,
        );
      }
    } else {
      const message = mapBundlerAuthError(firstErrorMessage);
      throw new Error(
        `Create event transaction failed with signer ${fromAddress}: ${message}`,
      );
    }
  }

  if (!txHash) {
    throw new Error("Failed to send create event transaction.");
  }

  const confirmation = await confirmCreateEventTransaction({
    txHash,
    draftEventId: intent.draftEventId,
    organizerWallet: fromAddress,
  });

  return {
    txHash,
    intent,
    confirmation,
  };
}

export async function getEventBlockchainConfig(): Promise<EventBlockchainConfig> {
  const response = await api.get<{
    success: boolean;
    data?: EventBlockchainConfig;
    message?: string;
  }>("/events/blockchain-config");

  if (!response.data?.fundAddress || !response.data?.chainId) {
    throw new Error(response.message || "Failed to load blockchain config");
  }

  return response.data;
}

export async function updateEvent(
  eventId: string,
  payload: UpdateEventPayload,
): Promise<EventItem | null> {
  const response = await api.patch<CreateEventResponse>(
    `/events/${eventId}`,
    payload,
  );
  return response.data || null;
}

export async function updateAdminEvent(
  eventId: string,
  payload: UpdateEventPayload,
): Promise<EventItem | null> {
  const response = await api.patch<CreateEventResponse>(
    `/admin/events/${eventId}`,
    payload,
  );
  return response.data || null;
}

export async function updateAdminEventStatus(
  eventId: string,
  status: EventStatus,
  options?: {
    quantity?: number;
    ticketType?: number;
  },
): Promise<EventItem | null> {
  const body: {
    status: EventStatus;
    quantity?: number;
    ticketType?: number;
  } = { status };

  if (typeof options?.quantity === "number") {
    body.quantity = options.quantity;
  }

  if (typeof options?.ticketType === "number") {
    body.ticketType = options.ticketType;
  }

  const response = await api.patch<CreateEventResponse>(
    `/admin/events/${eventId}/status`,
    body,
  );
  return response.data || null;
}

export async function deleteEvent(eventId: string): Promise<boolean> {
  await api.delete(`/events/${eventId}`);
  return true;
}

export async function getEventStats(eventId: string) {
  return api.get(`/events/${eventId}/stats`);
}

export async function getAdminEventInvestments(
  eventId: string,
  params?: {
    page?: number;
    limit?: number;
    sort?:
      | "createdAt"
      | "-createdAt"
      | "contributionAmount"
      | "-contributionAmount";
  },
): Promise<AdminEventInvestmentsData | null> {
  const query = new URLSearchParams();

  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.sort) query.set("sort", params.sort);

  const url = query.toString()
    ? `/admin/events/${eventId}/investments?${query.toString()}`
    : `/admin/events/${eventId}/investments`;

  const response = await api.get<AdminEventInvestmentsResponse>(url);
  return response.data || null;
}

export async function deleteEventImage(
  eventId: string,
  imageUrl: string,
): Promise<boolean> {
  await api.delete(`/events/${eventId}/images/${encodeURIComponent(imageUrl)}`);
  return true;
}
