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
  contributionAmount: number;
  sharePercentage: number;
  claimedReward: number;
  pendingReward: number;
  shareTokenId?: string;
  createdAt: string;
}

function normalizeInvestment(detail: InvestmentDetail): InvestmentDetail {
  return {
    ...detail,
    contributionAmount: Number(detail.contributionAmount || 0),
    sharePercentage: Number(detail.sharePercentage || 0),
    claimedReward: Number(detail.claimedReward || 0),
    pendingReward: Number(detail.pendingReward || 0),
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
  amount: number,
): Promise<InvestmentDetail> {
  const response = await api.post<{ success: boolean; data: InvestmentDetail }>(
    `/events/${eventId}/invest`,
    { amount: amount.toString() },
  );

  return response.data;
}
