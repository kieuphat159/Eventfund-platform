import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { MapPin, Upload, Plus, Trash2 } from "lucide-react";
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
import { createEventOnChain } from "../../services/events.service";
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
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [fundingDeadlineAt, setFundingDeadlineAt] = useState("");
  const [ticketingStartAt, setTicketingStartAt] = useState("");
  const [ticketingEndAt, setTicketingEndAt] = useState("");
  const [location, setLocation] = useState("");
  const [category, setCategory] = useState("");

  const [fundingGoal, setFundingGoal] = useState("");
  const [minStakeRequired, setMinStakeRequired] = useState("");
  const [minInvestmentAmount, setMinInvestmentAmount] = useState("");
  const [investmentEnabled, setInvestmentEnabled] = useState(true);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [ticketTiers, setTicketTiers] = useState<TicketTierForm[]>([
    { name: "General", price: "", supply: "" },
  ]);

  // Image upload state
  const [selectedImages, setSelectedImages] = useState<File[]>([]);
  const [imagePreviewUrls, setImagePreviewUrls] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cleanup preview URLs on unmount
  React.useEffect(() => {
    return () => {
      imagePreviewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [imagePreviewUrls]);

  const resetForm = () => {
    setTitle("");
    setDescription("");
    setStartAt("");
    setEndAt("");
    setFundingDeadlineAt("");
    setTicketingStartAt("");
    setTicketingEndAt("");
    setLocation("");
    setCategory("");
    setFundingGoal("");
    setMinStakeRequired("");
    setMinInvestmentAmount("");
    setInvestmentEnabled(true);
    setTicketTiers([{ name: "General", price: "", supply: "" }]);
    setSelectedImages([]);
    setImagePreviewUrls([]);
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

  // Calculate total ticket value (price in wei)
  const calculateTotalTicketValue = () => {
    return ticketTiers.reduce((total, tier) => {
      try {
        const price = BigInt(tier.price || "0");
        const supply = BigInt(tier.supply || "0");
        return total + price * supply;
      } catch {
        return total;
      }
    }, 0n);
  };

  // Creation fee is fixed at 5% of total ticket value for all event modes.
  const calculateCreationFeeWei = () => {
    const totalValue = calculateTotalTicketValue();
    if (totalValue <= 0n) {
      return "0";
    }

    const minStakeInWei = totalValue / 20n; // 5% = divide by 20
    if (minStakeInWei <= 0n) {
      return "1";
    }

    return minStakeInWei.toString();
  };

  // Always keep creation fee synced with ticket tiers.
  useEffect(() => {
    setMinStakeRequired(calculateCreationFeeWei());
  }, [ticketTiers]);

  const buildStartDate = () => {
    return parseOptionalDateTime(startAt);
  };

  const buildEndDate = () => {
    return parseOptionalDateTime(endAt);
  };

  const buildFundingDeadline = () => {
    return parseOptionalDateTime(fundingDeadlineAt);
  };

  const parseOptionalDateTime = (value: string) => {
    if (!value) return null;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed;
  };

  const isPositiveWeiInteger = (value: string) => {
    const trimmed = value.trim();
    return /^[0-9]+$/.test(trimmed) && BigInt(trimmed) > 0n;
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const maxImages = 10;
    const maxSizeMB = 5;
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    const validTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];

    const newFiles: File[] = [];
    const errors: string[] = [];

    // Check total count
    if (selectedImages.length + files.length > maxImages) {
      setError(`Maximum ${maxImages} images allowed`);
      return;
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file type
      if (!validTypes.includes(file.type)) {
        errors.push(`${file.name}: Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.`);
        continue;
      }

      // Validate file size
      if (file.size > maxSizeBytes) {
        errors.push(`${file.name}: File size exceeds ${maxSizeMB}MB limit.`);
        continue;
      }

      newFiles.push(file);
    }

    if (errors.length > 0) {
      setError(errors.join(" "));
      return;
    }

    // Create preview URLs
    const newPreviewUrls = newFiles.map((file) => URL.createObjectURL(file));

    setSelectedImages((prev) => [...prev, ...newFiles]);
    setImagePreviewUrls((prev) => [...prev, ...newPreviewUrls]);
    setError("");

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeImage = (index: number) => {
    // Revoke object URL to free memory
    URL.revokeObjectURL(imagePreviewUrls[index]);

    setSelectedImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviewUrls((prev) => prev.filter((_, i) => i !== index));
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

    if (!startAt) {
      errors.startAt = "Event start date and time are required.";
    }

    if (!endAt) {
      errors.endAt = "Event end date and time are required.";
    }

    const start = buildStartDate();
    if (startAt && (!start || Number.isNaN(start.getTime()))) {
      errors.startAt = "Event start date and time are invalid.";
    }

    const end = buildEndDate();
    if (endAt && (!end || Number.isNaN(end.getTime()))) {
      errors.endAt = "Event end date and time are invalid.";
    }

    if (start && end && end <= start) {
      errors.endAt = "Event end must be after the start time.";
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

      if (!minInvestmentAmount.trim()) {
        errors.minInvestmentAmount = "Minimum investment amount is required.";
      } else if (!isPositiveWeiInteger(minInvestmentAmount)) {
        errors.minInvestmentAmount =
          "Minimum investment amount must be a positive integer string.";
      }
    }

    if (!isPositiveWeiInteger(minStakeRequired || "0")) {
      errors.minStakeRequired =
        "Creation fee must be greater than 0. Please add ticket tiers with valid price and supply.";
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

    if (investmentEnabled) {
      if (!fundingDeadlineAt) {
        errors.fundingDeadlineAt =
          "Funding deadline date and time are required.";
      }

      const fundingDeadline = buildFundingDeadline();
      if (
        fundingDeadlineAt &&
        (!fundingDeadline || Number.isNaN(fundingDeadline.getTime()))
      ) {
        errors.fundingDeadlineAt =
          "Funding deadline date and time are invalid.";
      }

      if (start && fundingDeadline && fundingDeadline >= start) {
        errors.fundingDeadlineAt =
          "Funding deadline must be after the current time and before the event start time.";
      }

      if (fundingDeadline && fundingDeadline <= new Date()) {
        errors.fundingDeadlineAt =
          "Funding deadline must be after the current time and before the event start time.";
      }
    }

    const ticketingStart = parseOptionalDateTime(ticketingStartAt);
    const ticketingEnd = parseOptionalDateTime(ticketingEndAt);

    if (ticketingStartAt && !ticketingStart) {
      errors.ticketingStartAt = "Ticketing start time is invalid.";
    }

    if (ticketingEndAt && !ticketingEnd) {
      errors.ticketingEndAt = "Ticketing end time is invalid.";
    }

    if (ticketingEnd && !ticketingStartAt) {
      errors.ticketingStartAt =
        "Ticketing start time is required when ticketing end time is set.";
    }

    if (investmentEnabled && ticketingStart) {
      const fundingDeadline = buildFundingDeadline();
      if (fundingDeadline && ticketingStart <= fundingDeadline) {
        errors.ticketingStartAt =
          "Ticketing start time must be after funding deadline.";
      }
    }

    if (ticketingStart && ticketingEnd && ticketingEnd <= ticketingStart) {
      errors.ticketingEndAt =
        "Ticketing end time must be after ticketing start time.";
    }

    if (start && ticketingEnd && ticketingEnd >= start) {
      errors.ticketingEndAt =
        "Ticketing end time must be before event start time.";
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
        !/^\d+$/.test(tier.price.trim()) ||
        BigInt(tier.price.trim()) <= 0n
      ) {
        errors[`tier-${index}-price`] =
          `Tier ${tierNumber} price must be a positive integer (in wei).`;
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

      const end = buildEndDate();
      if (!end || Number.isNaN(end.getTime())) {
        setError("Event end date and time are invalid.");
        return;
      }

      if (end <= start) {
        setError("Event end must be after the start time.");
        return;
      }

      const fundingDeadline = buildFundingDeadline();
      if (investmentEnabled) {
        if (!fundingDeadline || Number.isNaN(fundingDeadline.getTime())) {
          setError("Funding deadline date and time are invalid.");
          return;
        }

        if (fundingDeadline <= new Date()) {
          setError(
            "Funding deadline must be after the current time and before the event start time.",
          );
          return;
        }

        if (fundingDeadline >= start) {
          setError(
            "Funding deadline must be after the current time and before the event start time.",
          );
          return;
        }
      }

      const parsedTicketingStart = parseOptionalDateTime(ticketingStartAt);
      const parsedTicketingEnd = parseOptionalDateTime(ticketingEndAt);

      const normalizedTiers = ticketTiers
        .filter(
          (tier) => tier.name.trim() || tier.price.trim() || tier.supply.trim(),
        )
        .map((tier) => ({
          name: tier.name.trim(),
          // Price is already in wei
          price: Number(tier.price),
          totalSupply: Number(tier.supply),
        }));

      const totalTickets = normalizedTiers.reduce(
        (sum, tier) => sum + tier.totalSupply,
        0,
      );
      const primaryTicketPriceWei =
        normalizedTiers[0]?.price?.toString() ?? "0";

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
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        ticketingStartAt: parsedTicketingStart?.toISOString(),
        ticketingEndAt: parsedTicketingEnd?.toISOString(),
        totalTickets,
        ticketPrice: primaryTicketPriceWei,
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
          fundingGoal: investmentEnabled ? fundingGoal.trim() : "0",
          minStakeRequired,
          minInvestmentAmount: investmentEnabled
            ? minInvestmentAmount.trim()
            : undefined,
          fundingDeadline: investmentEnabled
            ? fundingDeadline?.toISOString()
            : new Date(start.getTime() - 24 * 60 * 60 * 1000).toISOString(), // startDate - 1 day when investment disabled
        },
        user.walletAddress,
        user.smartAccountAddress,
        selectedImages.length > 0 ? selectedImages : undefined,
      );

      console.log('[CreateEvent] Selected images count:', selectedImages.length);
      console.log('[CreateEvent] Passing images to createEventOnChain:', selectedImages.length > 0 ? 'YES' : 'NO');

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
          Every event charges a fixed creation fee equal to 5% of total ticket
          value. If investment is off, organizer receives 100% of net revenue.
          If investment is on, revenue is split 70% organizer and 30% investors.
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
              <Label htmlFor="start-at" className="text-white">
                Event Start At *
              </Label>
              <Input
                id="start-at"
                type="datetime-local"
                value={startAt}
                onChange={(e) => {
                  setStartAt(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.startAt;
                    delete next.ticketingStartAt;
                    delete next.ticketingEndAt;
                    return next;
                  });
                }}
                className={getInputClass(
                  !!fieldErrors.startAt ||
                    !!fieldErrors.ticketingStartAt ||
                    !!fieldErrors.ticketingEndAt,
                )}
              />
              {fieldErrors.startAt && (
                <p className="mt-1 text-sm text-red-400">
                  {fieldErrors.startAt}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="end-at" className="text-white">
                Event End At *
              </Label>
              <Input
                id="end-at"
                type="datetime-local"
                value={endAt}
                onChange={(e) => {
                  setEndAt(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.endAt;
                    return next;
                  });
                }}
                className={getInputClass(!!fieldErrors.endAt)}
              />
              {fieldErrors.endAt && (
                <p className="mt-1 text-sm text-red-400">{fieldErrors.endAt}</p>
              )}
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="ticketing-start-at" className="text-white">
                Ticketing Start At
              </Label>
              <Input
                id="ticketing-start-at"
                type="datetime-local"
                value={ticketingStartAt}
                onChange={(e) => {
                  setTicketingStartAt(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.ticketingStartAt;
                    delete next.ticketingEndAt;
                    return next;
                  });
                }}
                className={getInputClass(
                  !!fieldErrors.ticketingStartAt ||
                    !!fieldErrors.ticketingEndAt,
                )}
              />
              {fieldErrors.ticketingStartAt && (
                <p className="mt-1 text-sm text-red-400">
                  {fieldErrors.ticketingStartAt}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="ticketing-end-at" className="text-white">
                Ticketing End At
              </Label>
              <Input
                id="ticketing-end-at"
                type="datetime-local"
                value={ticketingEndAt}
                onChange={(e) => {
                  setTicketingEndAt(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.ticketingEndAt;
                    return next;
                  });
                }}
                className={getInputClass(!!fieldErrors.ticketingEndAt)}
              />
              {fieldErrors.ticketingEndAt && (
                <p className="mt-1 text-sm text-red-400">
                  {fieldErrors.ticketingEndAt}
                </p>
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
            Upload cover images for your event (max 10 images, 5MB each)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Upload Area */}
            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-700 rounded-lg p-8 text-center cursor-pointer hover:border-cyan-500 transition-colors"
            >
              <Upload className="w-12 h-12 text-cyan-300 mx-auto mb-4" />
              <p className="text-white mb-2">
                Click to upload event images
              </p>
              <p className="text-sm text-slate-400">
                JPEG, PNG, GIF, or WebP (max 5MB each)
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                multiple
                onChange={handleImageSelect}
                className="hidden"
              />
            </div>

            {/* Image Previews */}
            {imagePreviewUrls.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {imagePreviewUrls.map((url, index) => (
                  <div
                    key={index}
                    className="relative aspect-video rounded-lg overflow-hidden bg-slate-800 group"
                  >
                    <img
                      src={url}
                      alt={`Preview ${index + 1}`}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(index)}
                      className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4 text-white" />
                    </button>
                    <div className="absolute bottom-2 left-2 px-2 py-1 bg-black/60 rounded text-xs text-white">
                      {selectedImages[index]?.name}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {selectedImages.length > 0 && (
              <p className="text-sm text-slate-400">
                {selectedImages.length} image(s) selected
              </p>
            )}
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
                    Price (wei)
                  </Label>
                  <Input
                    id={`tier-price-${index}`}
                    type="number"
                    step="1"
                    placeholder="800000000000000000"
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
                  <p className="mt-1 text-xs text-slate-500">
                    Enter wei as an integer string.
                  </p>
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
            Every event pays 5% creation fee from total ticket value. Investment
            mode adds outside investors and applies a 70/30 split.
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
                  setFundingGoal("0");
                  setFundingDeadlineAt("");
                  setMinInvestmentAmount("");
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.fundingGoal;
                    delete next.minInvestmentAmount;
                    delete next.fundingDeadlineAt;
                    return next;
                  });
                } else {
                  setFundingGoal("");
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
                Event Creation Fee (wei)
                <span className="text-xs text-slate-400 ml-2">
                  (Auto-calculated: 5% of total ticket value)
                </span>
              </Label>
              <Input
                id="min-stake-required"
                value={minStakeRequired}
                placeholder="Auto-calculated based on ticket tiers"
                className={`mt-1.5 bg-slate-800 text-white ${
                  fieldErrors.minStakeRequired
                    ? "border-red-500 focus-visible:ring-red-500"
                    : "border-slate-700"
                } bg-slate-700 text-slate-300`}
                readOnly
              />
              {fieldErrors.minStakeRequired && (
                <p className="mt-1 text-sm text-red-400">
                  {fieldErrors.minStakeRequired}
                </p>
              )}
            </div>
          </div>

          {investmentEnabled && (
            <div>
              <Label htmlFor="min-investment-amount" className="text-slate-300">
                Minimum Investment Amount (wei) *
              </Label>
              <Input
                id="min-investment-amount"
                value={minInvestmentAmount}
                onChange={(e) => {
                  setMinInvestmentAmount(e.target.value);
                  if (fieldErrors.minInvestmentAmount) {
                    setFieldErrors((prev) => {
                      const next = { ...prev };
                      delete next.minInvestmentAmount;
                      return next;
                    });
                  }
                }}
                placeholder="100000000000000000"
                className={`mt-1.5 bg-slate-800 text-white ${
                  fieldErrors.minInvestmentAmount
                    ? "border-red-500 focus-visible:ring-red-500"
                    : "border-slate-700"
                }`}
              />
              {fieldErrors.minInvestmentAmount && (
                <p className="mt-1 text-sm text-red-400">
                  {fieldErrors.minInvestmentAmount}
                </p>
              )}
            </div>
          )}

          {investmentEnabled && (
            <div>
              <Label htmlFor="funding-deadline-at" className="text-slate-300">
                Funding Deadline At *
              </Label>
              <Input
                id="funding-deadline-at"
                type="datetime-local"
                value={fundingDeadlineAt}
                onChange={(e) => {
                  setFundingDeadlineAt(e.target.value);
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.fundingDeadlineAt;
                    delete next.ticketingStartAt;
                    return next;
                  });
                }}
                className={getInputClass(
                  !!fieldErrors.fundingDeadlineAt ||
                    !!fieldErrors.ticketingStartAt,
                )}
              />
              {fieldErrors.fundingDeadlineAt && (
                <p className="mt-1 text-sm text-red-400">
                  {fieldErrors.fundingDeadlineAt}
                </p>
              )}
            </div>
          )}

          {investmentEnabled && (
            <p className="text-xs text-slate-500">
              Funding deadline must be entered manually and must fall between
              the current time and the event start time.
            </p>
          )}

          <p className="text-xs text-slate-500">
            Ticket tier prices, funding goal, and minimum investment amount use
            integer wei values.
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
          {submitting ? "Submitting..." : "Submit"}
        </Button>
      </div>
    </div>
  );
};
