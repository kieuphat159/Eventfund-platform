import { api } from "../lib/api";
import { createPublicClient, encodeFunctionData, http } from "viem";
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
  contractEventId?: string;
  title?: string;
  description?: string;
  category?: string;
  status?: EventStatus;
  verifiers?: string[];

  startDate?: string;
  endDate?: string;
  ticketingStartAt?: string;
  ticketingEndAt?: string;
  createdAt?: string;
  updatedAt?: string;

  organizer?: string;
  organizerWallet?: string;
  onChainOrganizer?: string;
  organizerStake?: string | number;
  investmentEnabled?: boolean;

  venue?: EventVenue;
  imageUrls?: string[];

  fundingGoal?: string | number;
  currentFunding?: string | number;
  minStakeRequired?: string | number;
  minInvestmentAmount?: string | number;
  fundingDeadline?: string;

  totalTickets?: number;
  ticketsSold?: number;
  totalTicketsUsed?: number;
  ticketUsageThreshold?: number;
  usedThreshold?: number;
  escrowedRevenue?: string | number;
  ticketRevenueDeposited?: string | number;
  royaltyRevenueDeposited?: string | number;
  sharesFinalized?: boolean;
  revenueReleased?: boolean;

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

export interface AdminUserItem {
  _id?: string;
  walletAddress: string;
  username?: string;
  email?: string;
  role?: "user" | "organizer" | "verifier" | "admin";
  isActive?: boolean;
  createdAt?: string;
}

interface AdminUsersResponse {
  success: boolean;
  data?: {
    docs?: AdminUserItem[];
  };
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
  minInvestmentAmount?: string;
  ticketTiers?: EventTicketTier[];
  imageUrls?: string[];
  imageFiles?: File[];
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
  reason?: string;
  txHash?: string;
  releaseTxHash?: string;
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

export interface AdminEventInvestmentItem {
  _id?: string;
  contributor?: string;
  amount?: string;
  contributionAmount?: string;
  sharePercentage?: number;
  createdAt?: string;
}

export interface AdminEventInvestmentsData {
  docs?: AdminEventInvestmentItem[];
  summary?: {
    totalInvestors?: number;
    totalContributions?: number;
    totalValue?: string | number;
  };
  totalDocs?: number;
  page?: number;
  limit?: number;
}

interface AdminEventInvestmentsResponse {
  success: boolean;
  data?: AdminEventInvestmentsData;
  message?: string;
}

export interface Eip1193Provider {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
}

interface TransactionRequestShape {
  to: string;
  data: string;
  value: string;
}

type CancellationReasonCode =
  | "funding_goal_not_met"
  | "organizer_cancelled"
  | "ticket_sales_not_met";

const FUND_CANCEL_ABI = [
  {
    type: "function",
    name: "cancelEvent",
    stateMutability: "nonpayable",
    inputs: [
      { name: "eventId", type: "uint256" },
      { name: "reason", type: "uint8" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "finalizeFunding",
    stateMutability: "nonpayable",
    inputs: [{ name: "eventId", type: "uint256" }],
    outputs: [],
  },
] as const;

const FUND_READONLY_ABI = [
  {
    type: "function",
    name: "ticket",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "address" }],
  },
] as const;

const FUND_COMPLETE_ABI = [
  {
    type: "error",
    name: "AlreadyFinalized",
    inputs: [],
  },
  {
    type: "error",
    name: "BadParam",
    inputs: [],
  },
  {
    type: "error",
    name: "EventNotFound",
    inputs: [],
  },
  {
    type: "error",
    name: "NotCompleted",
    inputs: [],
  },
  {
    type: "error",
    name: "NotOrganizer",
    inputs: [],
  },
  {
    type: "error",
    name: "NotTicketing",
    inputs: [],
  },
  {
    type: "error",
    name: "TicketContractNotSet",
    inputs: [],
  },
  {
    type: "error",
    name: "Unsafe",
    inputs: [],
  },
  {
    type: "function",
    name: "setCompletedIfThresholdMet",
    stateMutability: "nonpayable",
    inputs: [{ name: "eventId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "releaseRevenue",
    stateMutability: "nonpayable",
    inputs: [{ name: "eventId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawStake",
    stateMutability: "nonpayable",
    inputs: [{ name: "eventId", type: "uint256" }],
    outputs: [],
  },
] as const;

const TICKET_USAGE_ABI = [
  {
    type: "function",
    name: "getUsageStats",
    stateMutability: "view",
    inputs: [{ name: "eventId", type: "uint256" }],
    outputs: [
      { name: "totalMinted", type: "uint256" },
      { name: "totalSold", type: "uint256" },
      { name: "totalUsed", type: "uint256" },
      { name: "usageRatio", type: "uint256" },
    ],
  },
] as const;

const WEB3AUTH_TX_GAS_CAP = 16_777_216n;
const EVENT_TX_FALLBACK_GAS_LIMIT = 1_500_000n;
const COMPLETION_USAGE_PERCENT = 36n;

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

export async function getManagedEvents(
  walletAddress: string,
): Promise<EventItem[]> {
  if (!walletAddress) return [];

  const normalizedWallet = walletAddress.toLowerCase();
  const events = await getEvents({ limit: 100 });

  return events.filter((event) =>
    Array.isArray(event.verifiers)
      ? event.verifiers.some(
          (verifierWallet) =>
            verifierWallet?.toLowerCase() === normalizedWallet,
        )
      : false,
  );
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
    const response = await api.post<CreateEventResponse>(
      "/events",
      buildCreateEventRequestBody(payload),
    );
    return response.data || null;
  } catch (error) {
    console.debug("createEvent failed:", error);
    throw error;
  }
}

export async function createEventIntent(
  payload: CreateEventPayload,
): Promise<CreateEventIntentData | null> {
  const response = await api.post<CreateEventIntentResponse>(
    "/events/create-intent",
    buildCreateEventRequestBody(payload),
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
        console.debug(
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

function buildCreateEventRequestBody(payload: CreateEventPayload) {
  const { imageFiles, venue, ticketTiers, ...rest } = payload;

  if (!imageFiles?.length) {
    return {
      ...rest,
      venue,
      ticketTiers,
    };
  }

  const formData = new FormData();

  Object.entries(rest).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") {
      return;
    }

    formData.append(key, String(value));
  });

  formData.append("venue", JSON.stringify(venue));

  if (ticketTiers !== undefined) {
    formData.append("ticketTiers", JSON.stringify(ticketTiers));
  }

  if (payload.imageUrls?.length) {
    formData.append("imageUrls", JSON.stringify(payload.imageUrls));
  }

  imageFiles.forEach((file) => {
    formData.append("images", file);
  });

  return formData;
}

function parseHexToBigInt(value: unknown): bigint | null {
  if (typeof value !== "string") return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

function toSafeGasHex(
  estimatedGas: bigint,
  fallbackGasLimit = EVENT_TX_FALLBACK_GAS_LIMIT,
): string {
  const paddedGas = estimatedGas + estimatedGas / 5n + 15_000n;
  const boundedGas =
    paddedGas > WEB3AUTH_TX_GAS_CAP ? WEB3AUTH_TX_GAS_CAP : paddedGas;

  if (boundedGas > 0n) {
    return toHexValue(boundedGas.toString());
  }

  const safeFallback =
    fallbackGasLimit > WEB3AUTH_TX_GAS_CAP
      ? WEB3AUTH_TX_GAS_CAP
      : fallbackGasLimit;
  return toHexValue(safeFallback.toString());
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

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error || "Unknown error");
}

function shouldFallbackToWalletCancellation(message: string): boolean {
  return message
    .toLowerCase()
    .includes("organizer wallet signature required");
}

function shouldFallbackToWalletCompletion(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("organizer wallet signature required") ||
    normalized.includes("requires organizer wallet") ||
    normalized.includes("cannot mark completed with current backend signer") ||
    normalized.includes("cannot change status from ticketing to completed")
  );
}

function getPublicClient() {
  return createPublicClient({
    chain: sepolia,
    transport: http(PUBLIC_RPC_URL),
  });
}

function extractErrorName(error: unknown): string | null {
  const queue: unknown[] = [error];
  const seen = new Set<unknown>();

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== "object" || seen.has(current)) {
      continue;
    }
    seen.add(current);

    const candidate = current as {
      errorName?: string;
      name?: string;
      message?: string;
      shortMessage?: string;
      cause?: unknown;
      details?: string;
      metaMessages?: string[];
    };

    if (typeof candidate.errorName === "string") {
      return candidate.errorName;
    }

    const textCandidates = [
      candidate.shortMessage,
      candidate.message,
      candidate.details,
      ...(Array.isArray(candidate.metaMessages) ? candidate.metaMessages : []),
    ].filter((value): value is string => typeof value === "string");

    for (const text of textCandidates) {
      const match = text.match(/\b([A-Z][A-Za-z0-9_]+)\(\)/);
      if (match?.[1]) {
        return match[1];
      }
    }

    if (candidate.cause) {
      queue.push(candidate.cause);
    }

    for (const value of Object.values(candidate)) {
      if (value && typeof value === "object") {
        queue.push(value);
      }
    }
  }

  return null;
}

async function validateCompletionReadiness(
  event: EventItem,
  fundAddress: string,
  fromAddress: string,
): Promise<void> {
  if (!event.contractEventId) {
    throw new Error("Event has not been synced on-chain yet.");
  }

  const normalizedFrom = normalizeAddress(fromAddress);
  const normalizedOrganizer = normalizeAddress(
    event.onChainOrganizer || event.organizerWallet || event.organizer,
  );

  if (normalizedOrganizer && normalizedFrom !== normalizedOrganizer) {
    throw new Error(
      `Connected wallet ${fromAddress} is not the on-chain organizer ${normalizedOrganizer}. Please switch to the organizer wallet used to create this event on-chain.`,
    );
  }

  const publicClient = getPublicClient();
  const chainEventId = BigInt(event.contractEventId as string);
  let totalUsed = BigInt(event.totalTicketsUsed ?? 0);
  let totalSold = BigInt(event.ticketsSold ?? 0);

  try {
    const ticketAddress = (await (publicClient as any).readContract({
      address: fundAddress as `0x${string}`,
      abi: FUND_READONLY_ABI,
      functionName: "ticket",
    })) as `0x${string}`;

    if (!ticketAddress || /^0x0{40}$/i.test(ticketAddress)) {
      throw new Error(
        "Fund contract has no ticket contract configured on-chain yet.",
      );
    }

    const usageStats = (await (publicClient as any).readContract({
      address: ticketAddress,
      abi: TICKET_USAGE_ABI,
      functionName: "getUsageStats",
      args: [chainEventId],
    })) as [bigint, bigint, bigint, bigint];

    totalSold = usageStats[1];
    totalUsed = usageStats[2];
  } catch (error) {
    console.warn(
      "[CompleteEvent] Failed to fetch on-chain ticket usage stats before completion.",
      error,
    );
  }

  if (totalSold <= 0n) {
    throw new Error(
      "Event have not sold any tickets yet.",
    );
  }

  const requiredUsed = (totalSold * COMPLETION_USAGE_PERCENT + 99n) / 100n;
  if (totalUsed < requiredUsed) {
    throw new Error(
      `Event have not reached completion threshold on-chain: only ${totalUsed.toString()}/${requiredUsed.toString()} tickets checked in (36% of ${totalSold.toString()} tickets sold).`,
    );
  }

  try {
    await publicClient.simulateContract({
      account: fromAddress as `0x${string}`,
      address: fundAddress as `0x${string}`,
      abi: FUND_COMPLETE_ABI,
      functionName: "setCompletedIfThresholdMet",
      args: [chainEventId],
    });
  } catch (error) {
    const errorName = extractErrorName(error);

    if (errorName === "NotOrganizer") {
      throw new Error(
        "Connected wallet is not authorized on-chain for this event. Please switch to the organizer wallet that created the event.",
      );
    }

    if (errorName === "NotTicketing") {
      throw new Error(
        "Event is not in `ticketing` state on-chain, so it cannot be marked completed. The app status may be ahead of the contract state.",
      );
    }

    if (errorName === "Unsafe") {
      if (totalSold <= 0n) {
        throw new Error(
          "Event have not sold any tickets yet.",
        );
      }

      if (totalUsed < requiredUsed) {
        throw new Error(
          `Event have not reached completion threshold on-chain: only ${totalUsed.toString()}/${requiredUsed.toString()} tickets checked in (36% of ${totalSold.toString()} tickets sold).`,
        );
      }

      throw new Error(
        "On-chain completion conditions are not satisfied yet. The event may already be finalized, cancelled, or still missing required ticket usage/revenue state.",
      );
    }

    if (errorName === "TicketContractNotSet") {
      throw new Error(
        "Fund contract has not been linked to the Ticket contract on-chain.",
      );
    }

    if (errorName === "EventNotFound") {
      throw new Error("Event was not found on-chain.");
    }

    throw new Error(
      `On-chain completion preflight failed: ${mapBundlerAuthError(getRpcErrorMessage(error))}`,
    );
  }
}

async function validateRevenueReleaseReadiness(
  event: EventItem,
  fundAddress: string,
  fromAddress: string,
): Promise<void> {
  if (!event.contractEventId) {
    throw new Error("Event has not been synced on-chain yet.");
  }

  const publicClient = getPublicClient();

  try {
    await publicClient.simulateContract({
      account: fromAddress as `0x${string}`,
      address: fundAddress as `0x${string}`,
      abi: FUND_COMPLETE_ABI,
      functionName: "releaseRevenue",
      args: [BigInt(event.contractEventId)],
    });
  } catch (error) {
    const errorName = extractErrorName(error);

    if (errorName === "NotOrganizer") {
      throw new Error(
        "Connected wallet is not authorized to release revenue for this event on-chain.",
      );
    }

    if (errorName === "NotCompleted") {
      throw new Error(
        "Event has not reached `completed` state on-chain yet, so revenue cannot be released.",
      );
    }

    if (errorName === "BadParam") {
      throw new Error(
        "Event is completed on-chain but there is no escrowed revenue in Fund to distribute yet.",
      );
    }

    if (errorName === "AlreadyFinalized") {
      throw new Error("Revenue for this event has already been released.");
    }

    if (errorName === "Unsafe") {
      throw new Error(
        "Revenue cannot be released on-chain yet. Shares may not be finalized, refunds may be enabled, or revenue state is not ready.",
      );
    }

    throw new Error(
      `On-chain revenue release preflight failed: ${mapBundlerAuthError(getRpcErrorMessage(error))}`,
    );
  }
}

function buildCompletionTransaction(event: EventItem): TransactionRequestShape {
  if (!event.contractEventId) {
    throw new Error("Event has not been synced on-chain yet.");
  }

  return {
    to: "",
    data: encodeFunctionData({
      abi: FUND_COMPLETE_ABI,
      functionName: "setCompletedIfThresholdMet",
      args: [BigInt(event.contractEventId)],
    }),
    value: "0",
  };
}

function buildReleaseRevenueTransaction(
  event: EventItem,
): TransactionRequestShape {
  if (!event.contractEventId) {
    throw new Error("Event has not been synced on-chain yet.");
  }

  return {
    to: "",
    data: encodeFunctionData({
      abi: FUND_COMPLETE_ABI,
      functionName: "releaseRevenue",
      args: [BigInt(event.contractEventId)],
    }),
    value: "0",
  };
}

function buildWithdrawStakeTransaction(event: EventItem): TransactionRequestShape {
  if (!event.contractEventId) {
    throw new Error("Event has not been synced on-chain yet.");
  }

  return {
    to: "",
    data: encodeFunctionData({
      abi: FUND_COMPLETE_ABI,
      functionName: "withdrawStake",
      args: [BigInt(event.contractEventId)],
    }),
    value: "0",
  };
}

function resolveCancellationReason(
  event: EventItem,
  requestedReason?: string,
): CancellationReasonCode {
  const normalizedReason = requestedReason?.trim().toLowerCase();

  if (
    normalizedReason === "funding_goal_not_met" ||
    normalizedReason === "organizer_cancelled" ||
    normalizedReason === "ticket_sales_not_met"
  ) {
    return normalizedReason as CancellationReasonCode;
  }

  const fundingGoal = BigInt(String(event.fundingGoal ?? 0));
  const currentFunding = BigInt(String(event.currentFunding ?? 0));
  const fundingDeadline = event.fundingDeadline
    ? new Date(event.fundingDeadline)
    : null;
  const isFundingGoalMissed =
    event.status === "funding" &&
    fundingGoal > 0n &&
    currentFunding < fundingGoal &&
    !!fundingDeadline &&
    !Number.isNaN(fundingDeadline.getTime()) &&
    fundingDeadline.getTime() <= Date.now();

  if (isFundingGoalMissed) {
    return "funding_goal_not_met";
  }

  // organizer_cancelled is accepted on-chain for Funding, Funded, and Ticketing,
  // making it the safest explicit default when we don't have stronger evidence.
  return "organizer_cancelled";
}

function buildCancellationTransaction(
  event: EventItem,
  reasonCode: CancellationReasonCode,
): TransactionRequestShape {
  if (!event.contractEventId) {
    throw new Error("Event has not been synced on-chain yet.");
  }

  if (reasonCode === "funding_goal_not_met") {
    return {
      to: "",
      data: encodeFunctionData({
        abi: FUND_CANCEL_ABI,
        functionName: "finalizeFunding",
        args: [BigInt(event.contractEventId)],
      }),
      value: "0",
    };
  }

  return {
    to: "",
    data: encodeFunctionData({
      abi: FUND_CANCEL_ABI,
      functionName: "cancelEvent",
      args: [
        BigInt(event.contractEventId),
        reasonCode === "ticket_sales_not_met" ? 2 : 1,
      ],
    }),
    value: "0",
  };
}

async function estimateTransactionGas(
  provider: Eip1193Provider,
  fromAddress: string,
  transaction: TransactionRequestShape,
  fallbackGasLimit = EVENT_TX_FALLBACK_GAS_LIMIT,
): Promise<string> {
  const txRequest = {
    from: fromAddress,
    to: transaction.to,
    data: transaction.data,
    value: toHexValue(transaction.value || "0"),
  };

  try {
    const estimated = await provider.request({
      method: "eth_estimateGas",
      params: [txRequest],
    });

    const estimatedGas = parseHexToBigInt(estimated);
    if (estimatedGas && estimatedGas > 0n) {
      return toSafeGasHex(estimatedGas, fallbackGasLimit);
    }
    } catch (error) {
    console.debug(
      "[CreateEvent] Failed to estimate gas via wallet provider, retrying via public RPC.",
      error,
    );
  }

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
    return toSafeGasHex(estimatedGas, fallbackGasLimit);
    } catch (error) {
    console.debug(
      `[CreateEvent] Failed to pre-estimate gas; using fallback gas limit ${fallbackGasLimit.toString()}.`,
      error,
    );
    return toHexValue(
      (
        fallbackGasLimit > WEB3AUTH_TX_GAS_CAP
          ? WEB3AUTH_TX_GAS_CAP
          : fallbackGasLimit
      ).toString(),
    );
  }
}

async function waitForPublicTransactionReceipt(txHash: string) {
  const publicClient = getPublicClient();
  return publicClient.waitForTransactionReceipt({
    hash: txHash as `0x${string}`,
  });
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

  const gas = await estimateTransactionGas(
    provider,
    fromAddress,
    {
      to: intent.transaction.to,
      data: intent.transaction.data,
      value: intent.transaction.value,
    },
    EVENT_TX_FALLBACK_GAS_LIMIT,
  );

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
          gas,
        },
      ],
    })) as string;
  } catch (error) {
    const firstErrorMessage = getRpcErrorMessage(error);
    if (gas && isGasLimitTooHighError(firstErrorMessage)) {
      const fallbackGas = toHexValue(EVENT_TX_FALLBACK_GAS_LIMIT.toString());
      try {
        txHash = (await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              ...txParamsBase,
              gas: fallbackGas,
            },
          ],
        })) as string;
      } catch (retryError) {
        const retryMessage = mapBundlerAuthError(
          getRpcErrorMessage(retryError),
        );
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

export async function cancelEventWithWalletFallback(
  provider: Eip1193Provider | undefined,
  eventId: string,
  payload: UpdateEventPayload = { status: "cancelled" },
  organizerWallet?: string,
  smartAccountAddress?: string,
): Promise<EventItem | null> {
  const currentEvent = await getEventById(eventId);
  if (!currentEvent) {
    throw new Error("Event not found.");
  }

  const resolvedReason = resolveCancellationReason(currentEvent, payload.reason);
  const cancelPayload: UpdateEventPayload = {
    ...payload,
    status: "cancelled",
    reason: resolvedReason,
  };

  try {
    return await updateEvent(eventId, cancelPayload);
  } catch (error) {
    const message = getErrorMessage(error);
    if (!shouldFallbackToWalletCancellation(message)) {
      throw error;
    }

    if (!provider?.request) {
      throw new Error(
        `${message}. Wallet provider is unavailable for organizer-signed cancellation.`,
      );
    }

    if (!currentEvent.contractEventId) {
      throw error;
    }

    const config = await getEventBlockchainConfig();
    const transaction = buildCancellationTransaction(
      currentEvent,
      resolvedReason,
    );
    transaction.to = config.fundAddress;

    await ensureProviderChain(provider, config.chainId);

    const fromAddress = await resolveSignerAddress(
      provider,
      organizerWallet,
      smartAccountAddress,
    );

    const gas = await estimateTransactionGas(
      provider,
      fromAddress,
      transaction,
      500_000n,
    );
    const txParamsBase = {
      from: fromAddress,
      to: transaction.to,
      data: transaction.data,
      value: toHexValue(transaction.value),
    };

    let txHash = "";
    try {
      txHash = (await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            ...txParamsBase,
            gas,
          },
        ],
      })) as string;
    } catch (sendError) {
      const firstErrorMessage = getRpcErrorMessage(sendError);
      if (gas && isGasLimitTooHighError(firstErrorMessage)) {
        const fallbackGas = toHexValue("500000");
        txHash = (await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              ...txParamsBase,
              gas: fallbackGas,
            },
          ],
        })) as string;
      } else {
        throw new Error(
          `Cancel event transaction failed with signer ${fromAddress}: ${mapBundlerAuthError(firstErrorMessage)}`,
        );
      }
    }

    if (!txHash) {
      throw new Error("Failed to send cancel event transaction.");
    }

    return await updateEvent(eventId, {
      ...cancelPayload,
      txHash,
    });
  }
}

export async function completeEventWithWalletFallback(
  provider: Eip1193Provider | undefined,
  eventId: string,
  payload: UpdateEventPayload = { status: "completed" },
  organizerWallet?: string,
  smartAccountAddress?: string,
): Promise<EventItem | null> {
  const currentEvent = await getEventById(eventId);
  if (!currentEvent) {
    throw new Error("Event not found.");
  }

  const completePayload: UpdateEventPayload = {
    ...payload,
    status: "completed",
  };

  try {
    return await updateEvent(eventId, completePayload);
  } catch (error) {
    const message = getErrorMessage(error);
    if (!shouldFallbackToWalletCompletion(message)) {
      throw error;
    }

    if (!provider?.request) {
      throw new Error(
        `${message}. Wallet provider is unavailable for organizer-signed completion.`,
      );
    }

    if (!currentEvent.contractEventId) {
      throw error;
    }

    const config = await getEventBlockchainConfig();
    const completionTransaction = buildCompletionTransaction(currentEvent);
    const releaseTransaction = buildReleaseRevenueTransaction(currentEvent);
    const withdrawStakeTransaction = buildWithdrawStakeTransaction(currentEvent);
    completionTransaction.to = config.fundAddress;
    releaseTransaction.to = config.fundAddress;
    withdrawStakeTransaction.to = config.fundAddress;

    await ensureProviderChain(provider, config.chainId);

    const fromAddress = await resolveSignerAddress(
      provider,
      organizerWallet,
      smartAccountAddress,
    );

    await validateCompletionReadiness(
      currentEvent,
      config.fundAddress,
      fromAddress,
    );

    const completionGas = await estimateTransactionGas(
      provider,
      fromAddress,
      completionTransaction,
      350_000n,
    );
    const txParamsBase = {
      from: fromAddress,
      to: completionTransaction.to,
      value: toHexValue(completionTransaction.value),
    };

    let completionTxHash = "";
    try {
      completionTxHash = (await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            ...txParamsBase,
            data: completionTransaction.data,
            gas: completionGas,
          },
        ],
      })) as string;
    } catch (sendError) {
      const firstErrorMessage = getRpcErrorMessage(sendError);
      if (completionGas && isGasLimitTooHighError(firstErrorMessage)) {
        const fallbackGas = toHexValue("350000");
        completionTxHash = (await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              ...txParamsBase,
              data: completionTransaction.data,
              gas: fallbackGas,
            },
          ],
        })) as string;
      } else {
        throw new Error(
          `Complete event transaction failed with signer ${fromAddress}: ${mapBundlerAuthError(firstErrorMessage)}`,
        );
      }
    }

    if (!completionTxHash) {
      throw new Error("Failed to send complete event transaction.");
    }

    const completionReceipt =
      await waitForPublicTransactionReceipt(completionTxHash);
    if (completionReceipt.status !== "success") {
      throw new Error("Complete event transaction failed on-chain.");
    }

    await validateRevenueReleaseReadiness(
      currentEvent,
      config.fundAddress,
      fromAddress,
    );

    const releaseGas = await estimateTransactionGas(
      provider,
      fromAddress,
      releaseTransaction,
      500_000n,
    );

    let releaseTxHash = "";
    try {
      releaseTxHash = (await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            ...txParamsBase,
            data: releaseTransaction.data,
            gas: releaseGas,
          },
        ],
      })) as string;
    } catch (sendError) {
      const firstErrorMessage = getRpcErrorMessage(sendError);
      if (releaseGas && isGasLimitTooHighError(firstErrorMessage)) {
        const fallbackGas = toHexValue("500000");
        releaseTxHash = (await provider.request({
          method: "eth_sendTransaction",
          params: [
            {
              ...txParamsBase,
              data: releaseTransaction.data,
              gas: fallbackGas,
            },
          ],
        })) as string;
      } else {
        throw new Error(
          `Release revenue transaction failed with signer ${fromAddress}: ${mapBundlerAuthError(firstErrorMessage)}`,
        );
      }
    }

    if (!releaseTxHash) {
      throw new Error("Failed to send release revenue transaction.");
    }

    const releaseReceipt = await waitForPublicTransactionReceipt(releaseTxHash);
    if (releaseReceipt.status !== "success") {
      throw new Error("Release revenue transaction failed on-chain.");
    }

    try {
      const withdrawGas = await estimateTransactionGas(
        provider,
        fromAddress,
        withdrawStakeTransaction,
        250_000n,
      );

      await provider.request({
        method: "eth_sendTransaction",
        params: [
          {
            ...txParamsBase,
            data: withdrawStakeTransaction.data,
            gas: withdrawGas,
          },
        ],
      });
    } catch (withdrawError) {
      const message = getRpcErrorMessage(withdrawError).toLowerCase();
      if (
        !message.includes("nothingtoclaim") &&
        !message.includes("missing revert data") &&
        !message.includes("estimate gas")
      ) {
        throw new Error(
          `Withdraw organizer stake transaction failed with signer ${fromAddress}: ${mapBundlerAuthError(getRpcErrorMessage(withdrawError))}`,
        );
      }
    }

    return await updateEvent(eventId, {
      ...completePayload,
      txHash: completionTxHash,
      releaseTxHash,
    });
  }
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

export async function assignEventVerifierOnChain(
  eventId: string,
  verifierWallet: string,
): Promise<EventItem | null> {
  const response = await api.post<CreateEventResponse>(
    `/events/${eventId}/assign-verifier/onchain`,
    { verifier: verifierWallet },
  );

  return response.data || null;
}

export async function getVerifierUsers(): Promise<AdminUserItem[]> {
  const response = await api.get<AdminUsersResponse>(
    "/admin/users?role=verifier&limit=100",
  );

  const docs = response.data?.docs || [];
  return docs.sort((a, b) => {
    const left = (a.username || a.email || a.walletAddress || "").toLowerCase();
    const right = (b.username || b.email || b.walletAddress || "").toLowerCase();
    return left.localeCompare(right);
  });
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
