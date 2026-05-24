import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Award, ChartLine, DollarSign } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import {
  claimRewardOnChain,
  getInvestmentById,
  InvestmentDetail as InvestmentDetailType,
} from "../../services/investment.service";
import { Button } from "@/app/components/ui/button";
import { useLoading } from "../../components/ui/loadingContext";
import {
  addIntegerValues,
  calculatePercentage,
  compareIntegerValues,
  formatIntegerWithUnit,
  subtractIntegerValues,
} from "../../lib/utils";
import { logger } from "../../lib/logger";
import { useAuth } from "../../contexts/AuthContext";
import { useWeb3Auth } from "@web3auth/modal/react";
import { resolveTransactionProvider } from "../../services/providerService";
import { InsufficientBalanceDialog } from "../../components/shared/InsufficientBalanceDialog";
import {
  getInsufficientBalanceMessage,
  isInsufficientBalanceError,
} from "../../lib/insufficientBalance";

export const InvestmentDetail: React.FC = () => {
  const { id } = useParams();
  const [investment, setInvestment] = useState<InvestmentDetailType | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");
  const [claimingReward, setClaimingReward] = useState(false);
  const [insufficientBalanceMessage, setInsufficientBalanceMessage] =
    useState("");
  const { show: showLoading, hide: hideLoading } = useLoading();
  const { user, connectWallet } = useAuth();
  const { web3Auth } = useWeb3Auth();
  const walletProvider = resolveTransactionProvider(web3Auth?.provider);

  useEffect(() => {
    const fetchInvestment = async () => {
      if (!id) {
        setError("Invalid investment ID.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        showLoading('Loading investment details...');
        const data = await getInvestmentById(id);
        setInvestment(data);
      } catch (err) {
        logger.error("investments", "Failed to load investment detail", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load investment details.",
        );
      } finally {
        setLoading(false);
        hideLoading();
      }
    };

    fetchInvestment();
  }, [id]);

  const refreshInvestment = async () => {
    if (!id) return;
    const data = await getInvestmentById(id);
    setInvestment(data);
  };

  const handleClaimReward = async () => {
    const eventId = investment?.eventId?._id;
    if (!eventId) return;

    try {
      if (!user?.walletAddress) {
        await connectWallet();
        return;
      }

      if (!walletProvider?.request) {
        throw new Error(
          "Wallet provider is not ready. Please reconnect wallet and try again.",
        );
      }

      setClaimingReward(true);
      setActionError("");
      showLoading("Claiming reward...");
      await claimRewardOnChain(walletProvider, eventId, user.walletAddress);
      await refreshInvestment();
    } catch (err) {
      if (isInsufficientBalanceError(err)) {
        setInsufficientBalanceMessage(getInsufficientBalanceMessage(err));
      }
      logger.error("investments", "Failed to claim reward", err);
      setActionError(
        err instanceof Error ? err.message : "Unable to claim reward.",
      );
    } finally {
      setClaimingReward(false);
      hideLoading();
    }
  };

  if (loading) {
    return (
      <div className="min-h-[400px] flex items-center justify-center text-white">
        <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
        <span className="ml-3">Loading investment details...</span>
      </div>
    );
  }

  if (error || !investment) {
    return (
      <div className="space-y-6 text-white">
        <div className="text-red-400">{error || "Investment not found."}</div>
        <Link to="/app/investments">
          <Button
            variant="outline"
            className="border-slate-600 hover:bg-slate-700 text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Investments
          </Button>
        </Link>
      </div>
    );
  }

  const totalReturns = addIntegerValues(
    investment.claimedReward,
    investment.pendingReward,
  );
  const profitLoss = subtractIntegerValues(
    totalReturns,
    investment.contributionAmount,
  );
  const roi = calculatePercentage(
    totalReturns,
    investment.contributionAmount,
    1,
  ).toFixed(1);
  const canClaimReward =
    investment.eventId?.status === "completed" &&
    compareIntegerValues(investment.contributionAmount, "0") > 0 &&
    compareIntegerValues(investment.claimedReward, "0") === 0;

  return (
    <div className="space-y-6">
      <InsufficientBalanceDialog
        open={!!insufficientBalanceMessage}
        message={insufficientBalanceMessage}
        onClose={() => setInsufficientBalanceMessage("")}
      />

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <Link
            to="/app/investments"
            className="inline-flex items-center text-sm text-slate-400 hover:text-white mb-3"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Investments
          </Link>
          <h1 className="text-3xl font-bold text-white mb-2">
            Investment details
          </h1>
          <p className="text-slate-400">
            Full detail view of your event investment.
          </p>
          {actionError && (
            <p className="mt-2 text-sm text-red-300">{actionError}</p>
          )}
        </div>
        <div className="space-x-2">
          {canClaimReward && (
            <Button
              className="bg-cyan-600 hover:bg-cyan-500 text-white"
              disabled={claimingReward}
              onClick={() => void handleClaimReward()}
            >
              <Award className="w-4 h-4 mr-2" />
              {claimingReward ? "Claiming..." : "Claim Reward"}
            </Button>
          )}
          <a
            href={`/events/${investment.eventId?._id ?? ""}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-600"
          >
            View Event Page
          </a>
        </div>
      </div>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">
            {investment.eventId?.title || "Event investment"}
          </CardTitle>
          <CardDescription className="text-slate-400">
            Investment details for this share position
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
              <div>
                <p className="text-sm text-slate-400 mb-1">Event status</p>
                <div className="inline-flex items-center rounded-full bg-slate-700 px-3 py-1 text-xs uppercase tracking-widest text-slate-200">
                  {investment.eventId?.status || "unknown"}
                </div>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">
                  Contribution amount
                </p>
                <p className="text-white text-lg font-semibold">
                  {formatIntegerWithUnit(investment.contributionAmount, "wei")}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Share percentage</p>
                <p className="text-white text-lg font-semibold">
                  {investment.sharePercentage}%
                </p>
              </div>
              {investment.shareTokenId && (
                <div>
                  <p className="text-sm text-slate-400 mb-1">Share token ID</p>
                  <p className="text-slate-200 font-mono text-sm">
                    {investment.shareTokenId}
                  </p>
                </div>
              )}
              <div>
                <p className="text-sm text-slate-400 mb-1">Invested on</p>
                <p className="text-white text-lg font-semibold">
                  {new Date(investment.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="bg-slate-800 rounded-xl border border-slate-700 p-5 space-y-4">
              <div>
                <p className="text-sm text-slate-400 mb-1">Event date range</p>
                <p className="text-white text-lg font-semibold">
                  {investment.eventId?.startDate
                    ? new Date(
                        investment.eventId.startDate,
                      ).toLocaleDateString()
                    : "N/A"}
                  {" - "}
                  {investment.eventId?.endDate
                    ? new Date(investment.eventId.endDate).toLocaleDateString()
                    : "N/A"}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Claimed rewards</p>
                <p className="text-green-400 text-lg font-semibold">
                  {formatIntegerWithUnit(investment.claimedReward, "wei")}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Pending rewards</p>
                <p className="text-yellow-400 text-lg font-semibold">
                  {formatIntegerWithUnit(investment.pendingReward, "wei")}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Total returns</p>
                <p className="text-white text-lg font-bold">
                  {formatIntegerWithUnit(totalReturns, "wei")}
                </p>
              </div>
              <div>
                <p className="text-sm text-slate-400 mb-1">Profit / loss</p>
                <p className="text-white text-lg font-semibold">
                  {formatIntegerWithUnit(profitLoss, "wei")}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">ROI</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 text-white">
                  <ChartLine className="w-5 h-5 text-purple-400" />
                  <span className="text-3xl font-bold">{roi}%</span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Claimed</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 text-white">
                  <Award className="w-5 h-5 text-green-400" />
                  <span className="text-3xl font-bold">
                    {formatIntegerWithUnit(investment.claimedReward, "wei")}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3 text-white">
                  <DollarSign className="w-5 h-5 text-yellow-400" />
                  <span className="text-3xl font-bold">
                    {formatIntegerWithUnit(investment.pendingReward, "wei")}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {investment.eventId?.description && (
            <Card className="bg-slate-800 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-lg">
                  Event description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-slate-400 leading-relaxed">
                  {investment.eventId.description}
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default InvestmentDetail;
