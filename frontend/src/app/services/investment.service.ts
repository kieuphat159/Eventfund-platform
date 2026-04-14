import { api } from "../lib/api";

export interface InvestmentDetail {
  _id: string;
  eventId: {
    _id: string;
    title?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    description?: string;
  };
  contributionAmount: string;
  sharePercentage: number;
  claimedReward: string;
  pendingReward: string;
  shareTokenId?: string;
  createdAt: string;
}

function normalizeInvestment(detail: InvestmentDetail): InvestmentDetail {
  return {
    ...detail,
    contributionAmount: String(detail.contributionAmount || '0'),
    sharePercentage: Number(detail.sharePercentage || 0),
    claimedReward: String(detail.claimedReward || '0'),
    pendingReward: String(detail.pendingReward || '0'),
  };
}

export async function getInvestments(): Promise<InvestmentDetail[]> {
  const response = await api.get<{
    success: boolean;
    data: InvestmentDetail[];
  }>("/users/shares");

  return (response.data || []).map(normalizeInvestment);
}

export async function getInvestmentById(id: string): Promise<InvestmentDetail> {
  const response = await api.get<{ success: boolean; data: InvestmentDetail }>(
    `/users/shares/${id}`,
  );

  return normalizeInvestment(response.data);
}

export async function investInEvent(
  eventId: string,
  amount: string,
): Promise<InvestmentDetail> {
  const response = await api.post<{ success: boolean; data: InvestmentDetail }>(
    `/events/${eventId}/invest`,
    { amount },
  );

  return normalizeInvestment(response.data);
}
