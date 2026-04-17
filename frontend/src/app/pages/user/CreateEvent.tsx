import React, { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Calendar, MapPin, Upload, Plus, Trash2 } from "lucide-react";
import { useWeb3Auth } from "@web3auth/modal/react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../../components/ui/card";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Textarea } from "../../components/ui/textarea";
import { Label } from "../../components/ui/label";
import {
  createEventOnChain,
} from "../../services/events.service";
import { useAuth } from "../../contexts/AuthContext";

type TicketTierForm = {
  name: string;
  price: string;
  supply: string;
};

type FieldErrors = Record<string, string>;

const createEmptyTier = (): TicketTierForm => ({
  name: "",
  price: "",
  supply: "",
});

export const CreateEvent: React.FC = () => {
  const navigate = useNavigate();
  const submitInFlightRef = useRef(false);
  const { web3Auth } = useWeb3Auth();
  const { user, connectWallet } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");

  const [fundingGoal, setFundingGoal] = useState("");
  const [minStakeRequired, setMinStakeRequired] = useState("");
  const [organizerStake, setOrganizerStake] = useState("");
  const [investmentEnabled, setInvestmentEnabled] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [ticketTiers, setTicketTiers] = useState<TicketTierForm[]>([
    { name: "General", price: "", supply: "" },
  ]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setDate("");
    setTime("");
    setLocation("");
    setCategory("");
    setFundingGoal("");
    setMinStakeRequired("");
    setOrganizerStake("");
    setInvestmentEnabled(true);
    setTicketTiers([{ name: "General", price: "", supply: "" }]);
    setFieldErrors({});
    setError("");
    setSuccess("");
  };

  const addTier = () => {
    setTicketTiers((prev) => [...prev, createEmptyTier()]);
  };

  const removeTier = (index: number) => {
    setTicketTiers((prev) => prev.filter((_, i) => i !== index));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`tier-${index}-name`];
      delete next[`tier-${index}-price`];
      delete next[`tier-${index}-supply`];
      return next;
    });
  };

  const updateTier = (
    index: number,
    field: "name" | "price" | "supply",
    value: string,
  ) => {
    setTicketTiers((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[`tier-${index}-${field}`];
      delete next.ticketTiers;
      return next;
    });
  };

  const buildStartDate = () => {
    if (!date || !time) return null;
    return new Date(`${date}T${time}`);
  };

  const getInputClass = (hasError?: boolean) =>
    `mt-1.5 bg-slate-800 text-white ${
      hasError
        ? "border-red-500 focus-visible:ring-red-500"
        : "border-slate-700"
    }`;

  const validateForm = () => {
    const errors: FieldErrors = {};

    if (!title.trim()) {
      errors.title = "Event title is required.";
    }

    if (!date) {
      errors.date = "Event date is required.";
    }

    if (!time) {
      errors.time = "Event time is required.";
    }

    const start = buildStartDate();
    if (date && time && (!start || Number.isNaN(start.getTime()))) {
      errors.dateTime = "Event date and time are invalid.";
    }

    if (investmentEnabled) {
      if (!fundingGoal.trim()) {
        errors.fundingGoal = "Funding goal is required.";
      } else if (
        !/^\d+$/.test(fundingGoal.trim()) ||
        BigInt(fundingGoal.trim()) <= 0n
      ) {
        errors.fundingGoal = "Funding goal must be a positive integer string.";
      }

      if (
        minStakeRequired.trim() &&
        (!/^\d+$/.test(minStakeRequired.trim()) ||
          BigInt(minStakeRequired.trim()) <= 0n)
      ) {
        errors.minStakeRequired =
          "Min stake required must be a positive integer string.";
      }

      if (
        organizerStake.trim() &&
        (!/^\d+$/.test(organizerStake.trim()) ||
          BigInt(organizerStake.trim()) <= 0n)
      ) {
        errors.organizerStake =
          "Organizer stake must be a positive integer string.";
      }

      if (
        minStakeRequired.trim() &&
        organizerStake.trim() &&
        /^\d+$/.test(minStakeRequired.trim()) &&
        /^\d+$/.test(organizerStake.trim()) &&
        BigInt(organizerStake.trim()) < BigInt(minStakeRequired.trim())
      ) {
        errors.organizerStake =
          "Organizer stake must be >= min stake required.";
      }
    }

    if (!investmentEnabled) {
      if (!organizerStake.trim()) {
        errors.organizerStake =
          "Organizer stake is required and must be a positive integer string.";
      } else if (
        !/^\d+$/.test(organizerStake.trim()) ||
        BigInt(organizerStake.trim()) <= 0n
      ) {
        errors.organizerStake =
          "Organizer stake is required and must be a positive integer string.";
      }
    }

    if (!description.trim()) {
      errors.description = "Event description is required.";
    }

    if (!location.trim()) {
      errors.location = "Location is required.";
    }

    if (!category) {
      errors.category = "Category is required.";
    }

    if (investmentEnabled && start) {
      const fundingDeadline = new Date(
        start.getTime() - 7 * 24 * 60 * 60 * 1000,
      );

      if (fundingDeadline <= new Date()) {
        errors.fundingDeadline =
          "The event must be scheduled at least 7 days from now to create a valid funding deadline.";
      }
    }

    const filledTiers = ticketTiers.filter(
      (tier) => tier.name.trim() || tier.price.trim() || tier.supply.trim(),
    );

    if (!filledTiers.length) {
      errors.ticketTiers = "At least one ticket tier is required.";
    }

    ticketTiers.forEach((tier, index) => {
      const tierNumber = index + 1;
      const hasAnyValue =
        tier.name.trim() || tier.price.trim() || tier.supply.trim();

      if (!hasAnyValue) {
        if (index === 0) {
          errors[`tier-${index}-name`] = "Tier name is required.";
          errors[`tier-${index}-price`] = "Tier price is required.";
          errors[`tier-${index}-supply`] = "Tier supply is required.";
        }
        return;
      }

      if (!tier.name.trim()) {
        errors[`tier-${index}-name`] = `Tier ${tierNumber} name is required.`;
      }

      if (tier.price.trim() === "") {
        errors[`tier-${index}-price`] = `Tier ${tierNumber} price is required.`;
      } else if (
        Number.isNaN(Number(tier.price)) ||
        !Number.isInteger(Number(tier.price)) ||
        Number(tier.price) <= 0
      ) {
        errors[`tier-${index}-price`] =
          `Tier ${tierNumber} price must be a positive integer.`;
      }

      if (tier.supply.trim() === "") {
        errors[`tier-${index}-supply`] =
          `Tier ${tierNumber} total supply is required.`;
      } else if (
        Number.isNaN(Number(tier.supply)) ||
        Number(tier.supply) <= 0
      ) {
        errors[`tier-${index}-supply`] =
          `Tier ${tierNumber} total supply must be greater than 0.`;
      }
    });

    return errors;
  };

  const submitEvent = async () => {
    if (submitInFlightRef.current) {
      return;
    }

    submitInFlightRef.current = true;

    try {
      setError("");
      setSuccess("");
      setFieldErrors({});

      const errors = validateForm();

      if (Object.keys(errors).length > 0) {
        setFieldErrors(errors);
        setError(Object.values(errors)[0]);
        return;
      }

      const start = buildStartDate();
      if (!start || Number.isNaN(start.getTime())) {
        setError("Event date and time are invalid.");
        return;
      }

      const end = new Date(start.getTime() + 2 * 60 * 60 * 1000);
      const fundingDeadline = new Date(
        start.getTime() - 7 * 24 * 60 * 60 * 1000,
      );

      const normalizedTiers = ticketTiers
        .filter(
          (tier) => tier.name.trim() || tier.price.trim() || tier.supply.trim(),
        )
        .map((tier) => ({
          name: tier.name.trim(),
          price: Number(tier.price),
          totalSupply: Number(tier.supply),
        }));

      const totalTickets = normalizedTiers.reduce(
        (sum, tier) => sum + tier.totalSupply,
        0,
      );

      setSubmitting(true);

      if (!user?.walletAddress) {
        await connectWallet();
        setError(
          investmentEnabled
            ? "Wallet connected. Please submit again to sign the create-event transaction."
            : "Wallet connected. Please submit again to continue.",
        );
        return;
      }

      const basePayload = {
        title: title.trim(),
        description: description.trim() || "Draft event",
        category: category || "conference",
        investmentEnabled,
        organizerStake: organizerStake.trim() || undefined,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        totalTickets,
        ticketPrice: String(normalizedTiers[0].price),
        venue: {
          address: location.trim() || "TBA",
        },
        ticketTiers: normalizedTiers,
      };

      const provider = web3Auth?.provider as
        | {
            request: (args: {
              method: string;
              params?: unknown[];
            }) => Promise<unknown>;
          }
        | undefined;

      if (!provider?.request) {
        setError(
          "Wallet provider is not ready. Please reconnect wallet and try again.",
        );
        return;
      }

      const created = await createEventOnChain(
        provider!,
        {
          ...basePayload,
          fundingGoal: investmentEnabled ? fundingGoal.trim() : undefined,
          minStakeRequired: investmentEnabled
            ? minStakeRequired.trim() || undefined
            : undefined,
          organizerStake: organizerStake.trim() || undefined,
          fundingDeadline: investmentEnabled
            ? fundingDeadline.toISOString()
            : undefined,
        },
        user.walletAddress,
        user.smartAccountAddress,
      );

      if (!created) {
        setError("Failed to create event.");
        return;
      }

      setSuccess(
        investmentEnabled
          ? `Event created on-chain successfully. Tx: ${created.txHash}`
          : `Self-funded event created on-chain successfully. Tx: ${created.txHash}`,
      );
      navigate("/app/events/my-events");
    } catch (err: any) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "An unexpected error occurred while creating the event.",
      );
    } finally {
      setSubmitting(false);
      submitInFlightRef.current = false;
    }
  };

  const handleSubmit = async () => {
    await submitEvent();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-white mb-2">Create Event</h1>
        <p className="text-slate-400">
          Investment-enabled events go through on-chain funding. If you turn
          investment off, the event is created on-chain in funded state so
          admins can move it straight into ticketing later.
        </p>
      </div>

      {!!error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {!!success && (
        <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm text-green-300">
          {success}
        </div>
      )}

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Event Details</CardTitle>
          <CardDescription className="text-slate-400">
            Basic information for your on-chain event
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="title" className="text-white">
              Event Title *
            </Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                if (fieldErrors.title) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.title;
                    return next;
                  });
                }
              }}
              placeholder="Enter event name"
              className={getInputClass(!!fieldErrors.title)}
            />
            {fieldErrors.title && (
              <p className="mt-1 text-sm text-red-400">{fieldErrors.title}</p>
            )}
          </div>

          <div>
            <Label htmlFor="description" className="text-white">
              Description *
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                if (fieldErrors.description) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.description;
                    return next;
                  });
                }
              }}
              placeholder="Describe your event..."
              className={`mt-1.5 bg-slate-800 text-white min-h-[120px] ${
                fieldErrors.description
                  ? "border-red-500 focus-visible:ring-red-500"
                  : "border-slate-700"
              }`}
            />
            {fieldErrors.description && (
              <p className="mt-1 text-sm text-red-400">
                {fieldErrors.description}
              </p>
            )}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="date" className="text-white">
                Event Date *
              </Label>
              <div className="relative mt-1.5">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-300" />
                <Input
                  id="date"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.date;
                      delete next.dateTime;
                      delete next.fundingDeadline;
                      return next;
                    });
                  }}
                  className={`pl-10 bg-slate-800 text-white ${
                    fieldErrors.date ||
                    fieldErrors.dateTime ||
                    fieldErrors.fundingDeadline
                      ? "border-red-500 focus-visible:ring-red-500"
                      : "border-slate-700"
                  }`}
                />
              </div>
              {fieldErrors.date && (
                <p className="mt-1 text-sm text-red-400">{fieldErrors.date}</p>
              )}
              {!fieldErrors.date && fieldErrors.dateTime && (
                <p className="mt-1 text-sm text-red-400">
                  {fieldErrors.dateTime}
                </p>
              )}
              {!fieldErrors.date &&
                !fieldErrors.dateTime &&
                fieldErrors.fundingDeadline && (
                  <p className="mt-1 text-sm text-red-400">
                    {fieldErrors.fundingDeadline}
                  </p>
                )}
            </div>

            <div>
              <Label htmlFor="time" className="text-white">
                Event Time *
              </Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => {
                  setTime(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.time;
                    delete next.dateTime;
                    delete next.fundingDeadline;
                    return next;
                  });
                }}
                className={`mt-1.5 bg-slate-800 text-white ${
                  fieldErrors.time ||
                  fieldErrors.dateTime ||
                  fieldErrors.fundingDeadline
                    ? "border-red-500 focus-visible:ring-red-500"
                    : "border-slate-700"
                }`}
              />
              {fieldErrors.time && (
                <p className="mt-1 text-sm text-red-400">{fieldErrors.time}</p>
              )}
            </div>
          </div>

          <div>
            <Label htmlFor="location" className="text-white">
              Location *
            </Label>
            <div className="relative mt-1.5">
              <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-300" />
              <Input
                id="location"
                value={location}
                onChange={(e) => {
                  setLocation(e.target.value);
                  if (fieldErrors.location) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.location;
                      return next;
                    });
                  }
                }}
                placeholder="Enter venue or address"
                className={`pl-10 bg-slate-800 text-white ${
                  fieldErrors.location
                    ? "border-red-500 focus-visible:ring-red-500"
                    : "border-slate-700"
                }`}
              />
            </div>
            {fieldErrors.location && (
              <p className="mt-1 text-sm text-red-400">
                {fieldErrors.location}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="category" className="text-white">
              Category *
            </Label>
            <select
              id="category"
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (fieldErrors.category) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.category;
                    return next;
                  });
                }
              }}
              className={`mt-1.5 w-full h-9 px-3 rounded-md bg-slate-800 text-white text-sm ${
                fieldErrors.category
                  ? "border border-red-500"
                  : "border border-slate-700"
              }`}
            >
              <option value="">Select a category</option>
              <option value="music">Music</option>
              <option value="tech">Technology</option>
              <option value="sports">Sports</option>
              <option value="art">Art &amp; Culture</option>
              <option value="business">Business</option>
              <option value="conference">Conference</option>
            </select>
            {fieldErrors.category && (
              <p className="mt-1 text-sm text-red-400">
                {fieldErrors.category}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Event Image</CardTitle>
          <CardDescription className="text-slate-400">
            Upload a cover image for your event
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="border-2 border-dashed border-slate-700 rounded-lg p-12 text-center opacity-90">
            <Upload className="w-12 h-12 text-fuchsia-300 mx-auto mb-4" />
            <p className="text-white mb-2">
              Image upload is not connected yet.
            </p>
            <p className="text-sm text-slate-400">
              The backend already supports image upload, but this form is not
              sending FormData yet.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <div className="flex items-center justify-between gap-4">
            <div>
              <CardTitle className="text-white">Ticket Tiers</CardTitle>
              <CardDescription className="text-slate-400">
                Create at least one ticket tier. Add more tiers only if your
                event has multiple ticket types.
              </CardDescription>
            </div>

            <Button
              type="button"
              onClick={addTier}
              variant="outline"
              size="sm"
              className="border-slate-700 hover:bg-slate-800 text-white whitespace-nowrap"
            >
              <Plus className="w-4 h-4 mr-2 text-cyan-300" />
              Add Another Tier
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {fieldErrors.ticketTiers && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {fieldErrors.ticketTiers}
            </div>
          )}

          {ticketTiers.map((tier, index) => (
            <div
              key={index}
              className="p-4 rounded-lg bg-slate-800/50 border border-slate-700"
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-white font-medium">Tier {index + 1}</h4>
                  {index === 0 && (
                    <p className="text-xs text-slate-400 mt-1">
                      This is your default ticket tier.
                    </p>
                  )}
                </div>

                {ticketTiers.length > 1 && (
                  <Button
                    type="button"
                    onClick={() => removeTier(index)}
                    variant="ghost"
                    size="sm"
                    className="text-red-300 hover:bg-red-900/20"
                  >
                    <Trash2 className="w-4 h-4 text-red-300" />
                  </Button>
                )}
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div>
                  <Label
                    htmlFor={`tier-name-${index}`}
                    className="text-slate-300"
                  >
                    Tier Name
                  </Label>
                  <Input
                    id={`tier-name-${index}`}
                    placeholder="e.g. VIP, General"
                    value={tier.name}
                    onChange={(e) => updateTier(index, "name", e.target.value)}
                    className={`mt-1.5 bg-slate-800 text-white ${
                      fieldErrors[`tier-${index}-name`]
                        ? "border-red-500 focus-visible:ring-red-500"
                        : "border-slate-700"
                    }`}
                  />
                  {fieldErrors[`tier-${index}-name`] && (
                    <p className="mt-1 text-sm text-red-400">
                      {fieldErrors[`tier-${index}-name`]}
                    </p>
                  )}
                </div>

                <div>
                  <Label
                    htmlFor={`tier-price-${index}`}
                    className="text-slate-300"
                  >
                    Price (ETH)
                  </Label>
                  <Input
                    id={`tier-price-${index}`}
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    value={tier.price}
                    onChange={(e) => updateTier(index, "price", e.target.value)}
                    className={`mt-1.5 bg-slate-800 text-white ${
                      fieldErrors[`tier-${index}-price`]
                        ? "border-red-500 focus-visible:ring-red-500"
                        : "border-slate-700"
                    }`}
                  />
                  {fieldErrors[`tier-${index}-price`] && (
                    <p className="mt-1 text-sm text-red-400">
                      {fieldErrors[`tier-${index}-price`]}
                    </p>
                  )}
                </div>

                <div>
                  <Label
                    htmlFor={`tier-supply-${index}`}
                    className="text-slate-300"
                  >
                    Total Supply
                  </Label>
                  <Input
                    id={`tier-supply-${index}`}
                    type="number"
                    placeholder="100"
                    value={tier.supply}
                    onChange={(e) =>
                      updateTier(index, "supply", e.target.value)
                    }
                    className={`mt-1.5 bg-slate-800 text-white ${
                      fieldErrors[`tier-${index}-supply`]
                        ? "border-red-500 focus-visible:ring-red-500"
                        : "border-slate-700"
                    }`}
                  />
                  {fieldErrors[`tier-${index}-supply`] && (
                    <p className="mt-1 text-sm text-red-400">
                      {fieldErrors[`tier-${index}-supply`]}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white">Investment Options</CardTitle>
          <CardDescription className="text-slate-400">
            Optional funding configuration. Disable investment if the organizer
            is already self-funded and does not need outside investors.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="flex items-center space-x-3">
            <input
              type="checkbox"
              id="enable-investment"
              checked={investmentEnabled}
              onChange={(e) => {
                const enabled = e.target.checked;
                setInvestmentEnabled(enabled);
                if (!enabled) {
                  setFundingGoal("");
                  setMinStakeRequired("");
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.fundingGoal;
                    delete next.minStakeRequired;
                    delete next.organizerStake;
                    delete next.fundingDeadline;
                    return next;
                  });
                }
              }}
              className="w-4 h-4 rounded border-slate-700 bg-slate-800 accent-cyan-400"
            />
            <Label htmlFor="enable-investment" className="text-white">
              Enable event investment
            </Label>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="funding-goal" className="text-slate-300">
                Funding Goal *
              </Label>
              <Input
                id="funding-goal"
                value={fundingGoal}
                onChange={(e) => {
                  setFundingGoal(e.target.value);
                  if (fieldErrors.fundingGoal) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.fundingGoal;
                      return next;
                    });
                  }
                }}
                placeholder="5000000000000000000"
                className={`mt-1.5 bg-slate-800 text-white ${
                  fieldErrors.fundingGoal
                    ? "border-red-500 focus-visible:ring-red-500"
                    : "border-slate-700"
                }`}
                disabled={!investmentEnabled}
              />
              {fieldErrors.fundingGoal && (
                <p className="mt-1 text-sm text-red-400">
                  {fieldErrors.fundingGoal}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="min-stake-required" className="text-slate-300">
                Minimum Organizer Stake
              </Label>
              <Input
                id="min-stake-required"
                value={minStakeRequired}
                onChange={(e) => {
                  setMinStakeRequired(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.minStakeRequired;
                    delete next.organizerStake;
                    return next;
                  });
                }}
                placeholder="1000000000000000000"
                className={`mt-1.5 bg-slate-800 text-white ${
                  fieldErrors.minStakeRequired || fieldErrors.organizerStake
                    ? "border-red-500 focus-visible:ring-red-500"
                    : "border-slate-700"
                }`}
                disabled={!investmentEnabled}
              />
              {fieldErrors.minStakeRequired && (
                <p className="mt-1 text-sm text-red-400">
                  {fieldErrors.minStakeRequired}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="organizer-stake" className="text-slate-300">
                Organizer Stake *
              </Label>
              <Input
                id="organizer-stake"
                value={organizerStake}
                onChange={(e) => {
                  setOrganizerStake(e.target.value);
                  if (fieldErrors.organizerStake) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.organizerStake;
                      return next;
                    });
                  }
                }}
                placeholder="1000000000000000000"
                className={`mt-1.5 bg-slate-800 text-white ${
                  fieldErrors.organizerStake
                    ? "border-red-500 focus-visible:ring-red-500"
                    : "border-slate-700"
                }`}
              />
              {fieldErrors.organizerStake && (
                <p className="mt-1 text-sm text-red-400">
                  {fieldErrors.organizerStake}
                </p>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-500">
            Stake and funding fields are stored as integer strings in wei.
            Organizer stake is always locked on-chain when the event is created.
          </p>
        </CardContent>
      </Card>

      <div className="flex items-center justify-between pt-4">
        <Button
          type="button"
          disabled={submitting}
          onClick={handleSubmit}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-8 disabled:opacity-50"
        >
          {submitting ? "Submitting..." : "Submit for Admin Review"}
        </Button>
      </div>
    </div>
  );
};
