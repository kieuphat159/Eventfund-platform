import * as userRepo from "../../repositories/user.repo.js";
import * as ticketRepo from "../../repositories/ticket.repo.js";
import * as shareRepo from "../../repositories/share.repo.js";
import * as rewardRepo from "../../repositories/rewardClaim.repo.js";
import { addBigInt } from "../../utils/bigint.js";
import { NotFoundError, ConflictError } from "../../utils/customErrors.js";
import UploadService from "../upload/upload.service.js";

// Default upload service instance (can be overridden via DI)
let defaultUploadService = null;
function getDefaultUploadService() {
  if (!defaultUploadService) {
    defaultUploadService = new UploadService();
  }
  return defaultUploadService;
}

/**
 * Get user profile by wallet address
 */
export async function getProfile(walletAddress, repos = {}) {
  const repository = repos.userRepo || userRepo;
  return await repository.findByWalletAddress(walletAddress);
}

/**
 * Update user profile
 */
export async function updateProfile(walletAddress, updates, repos = {}) {
  const repository = repos.userRepo || userRepo;

  const user = await repository.findByWalletAddress(walletAddress);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  // Check duplicate username
  if (updates.username !== undefined && updates.username !== user.username) {
    const existingUser = await repository.findUsers(
      { username: updates.username },
      { limit: 1, lean: true },
    );
    if (existingUser.docs.length > 0) {
      throw new ConflictError("Username already exists");
    }
  }

  // Check duplicate email
  if (updates.email !== undefined && updates.email !== user.email) {
    const normalizedEmail = updates.email.toLowerCase();
    const existingUser = await repository.findUsers(
      { email: normalizedEmail },
      { limit: 1, lean: true },
    );
    if (existingUser.docs.length > 0) {
      throw new ConflictError("Email already exists");
    }
  }

  // Bỏ qua toàn bộ các trường nhạy cảm như role, walletAddress, password...
  const { username, email, avatarUrl } = updates;
  const filteredUpdates = {
    ...(username !== undefined && { username }),
    ...(email !== undefined && { email }),
    ...(avatarUrl !== undefined && { avatarUrl }),
  };

  return await repository.updateProfile(walletAddress, filteredUpdates);
}

/**
 * Update user profile with avatar upload
 */
export async function updateProfileWithAvatar(
  walletAddress,
  updates,
  file,
  repos = {},
  uploadSvc = null,
) {
  const repository = repos.userRepo || userRepo;
  const uploadService = uploadSvc || getDefaultUploadService();

  const user = await repository.findByWalletAddress(walletAddress);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  // Check duplicate username
  if (updates.username !== undefined && updates.username !== user.username) {
    const existingUser = await repository.findUsers(
      { username: updates.username },
      { limit: 1, lean: true },
    );
    if (existingUser.docs.length > 0) {
      throw new ConflictError("Username already exists");
    }
  }

  // Check duplicate email
  if (updates.email !== undefined && updates.email !== user.email) {
    const normalizedEmail = updates.email.toLowerCase();
    const existingUser = await repository.findUsers(
      { email: normalizedEmail },
      { limit: 1, lean: true },
    );
    if (existingUser.docs.length > 0) {
      throw new ConflictError("Email already exists");
    }
  }

  // Handle avatar upload if file is provided
  let avatarData = null;
  if (file) {
    const uploadResult = await uploadService.uploadAvatar(
      file,
      user._id.toString(),
      user.avatarUrl,
    );
    avatarData = {
      avatarUrl: uploadResult.url,
      publicId: uploadResult.publicId,
      width: uploadResult.width,
      height: uploadResult.height,
      format: uploadResult.format,
      bytes: uploadResult.bytes,
    };
  }

  // Merge updates with avatar data
  const { username, email, avatarUrl } = updates;
  const filteredUpdates = {
    ...(username !== undefined && { username }),
    ...(email !== undefined && { email }),
    ...(avatarUrl !== undefined && { avatarUrl }),
    ...(avatarData && { avatarUrl: avatarData.avatarUrl }),
  };

  const updatedUser = await repository.updateProfile(
    walletAddress,
    filteredUpdates,
  );

  // Return user data with upload metadata if avatar was uploaded
  if (avatarData) {
    return {
      ...updatedUser,
      ...avatarData,
    };
  }

  return updatedUser;
}

/**
 * Get user portfolio (tickets, shares, rewards)
 */
export async function getUserPortfolio(walletAddress, repos = {}) {
  const tRepo = repos.ticketRepo || ticketRepo;
  const sRepo = repos.shareRepo || shareRepo;
  const rRepo = repos.rewardRepo || rewardRepo;

  const normalizedAddress = walletAddress.toLowerCase();

  const [tickets, shares, rewards] = await Promise.all([
    tRepo.findTickets(
      { currentOwner: normalizedAddress },
      { populate: "eventId" },
    ),
    sRepo.findShares({ holder: normalizedAddress }, { populate: "eventId" }),
    rRepo.findRewards({ claimer: normalizedAddress }, { populate: "eventId" }),
  ]);

  return { tickets, shares, rewards };
}

/**
 * Get user shares across all events
 */
export async function getUserShares(walletAddress, repos = {}) {
  const repository = repos.shareRepo || shareRepo;

  const shares = await repository.findShares(
    { holder: walletAddress.toLowerCase() },
    { populate: "eventId" },
  );

  return Array.isArray(shares.docs) ? shares.docs : shares;
}

export async function getUserShareById(walletAddress, shareId, repos = {}) {
  const repository = repos.shareRepo || shareRepo;
  const normalizedAddress = walletAddress.toLowerCase();

  const share = await repository.findById(shareId, {
    populate: "eventId",
  });

  if (!share || share.holder !== normalizedAddress) {
    throw new NotFoundError("Investment not found");
  }

  return share;
}

/**
 * Get user rewards (claimed and pending)
 */
export async function getUserRewards(walletAddress, repos = {}) {
  const repository = repos.rewardRepo || rewardRepo;

  const rewards = await repository.findRewards(
    { claimer: walletAddress.toLowerCase() },
    { populate: "eventId distributionId" },
  );

  const claimed = rewards.filter((r) => r.status === "confirmed");
  const pending = rewards.filter((r) => r.status === "pending");

  const totalClaimed = claimed.reduce(
    (sum, r) => addBigInt(sum, r.rewardAmount),
    "0",
  );
  const totalPending = pending.reduce(
    (sum, r) => addBigInt(sum, r.rewardAmount),
    "0",
  );

  return { claimed, pending, totalClaimed, totalPending };
}

/**
 * Get user by wallet address (public profile)
 */
export async function getUserByWallet(walletAddress, repos = {}) {
  const repository = repos.userRepo || userRepo;

  const user = await repository.findByWalletAddress(walletAddress);
  if (!user) {
    throw new NotFoundError("User not found");
  }

  return user;
}
