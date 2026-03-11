import {
  time,
  loadFixture,
} from "@nomicfoundation/hardhat-toolbox/network-helpers.js";
import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("Fund Smart Contract", () => {
  // ---------------------------------------------------------
  // FIXTURES: Thiết lập trạng thái ban đầu
  // ---------------------------------------------------------
  async function deployFundFixture() {
    const [admin, organizer, donator1, donator2, buyer, resaleBuyer, verifier, stranger] =
      await ethers.getSigners();

    const Fund = await ethers.getContractFactory("Fund");
    const fund = await Fund.deploy();

    const Ticket = await ethers.getContractFactory("Ticket");
    const ticket = await Ticket.deploy();

    const initialRoyaltyBps = 1000; // 10%
    const Marketplace = await ethers.getContractFactory("Marketplace");
    const marketplace = await Marketplace.deploy(
      ticket.target,
      fund.target,
      initialRoyaltyBps,
    );

    // Wiring: Kết nối các Contract
    await fund.setTicketContract(ticket.target);
    await fund.setMarketplaceContract(marketplace.target);
    await ticket.setFundContract(fund.target);

    // Roles Setup
    const ORGANIZER_ROLE = await ticket.ORGANIZER_ROLE();
    await ticket.grantRole(ORGANIZER_ROLE, fund.target);
    await ticket.grantRole(ORGANIZER_ROLE, organizer.address);

    // Use numbers that produce clean integer math for reward distribution.
    const params = {
      fundingGoal: ethers.parseEther("10"),
      minStake: ethers.parseEther("1"),
      deadline: (await time.latest()) + 7 * 24 * 60 * 60,
      organizerShareBps: 8000n,
      ticketPrice: ethers.parseEther("1"),
      maxTickets: 10n,
      usedThreshold: 2n,
      initialRoyaltyBps,
    };

    return {
      fund,
      ticket,
      marketplace,
      admin,
      organizer,
      donator1,
      donator2,
      buyer,
      resaleBuyer,
      verifier,
      stranger,
      params,
    };
  }

  async function getContractSigner(targetAddress) {
    await pkg.network.provider.send("hardhat_setBalance", [
      targetAddress,
      "0x56BC75E2D63100000", // 100 eth
    ]);
    return await ethers.getImpersonatedSigner(targetAddress);
  }

  async function eventCreatedFixture() {
    const base = await loadFixture(deployFundFixture);
    const { fund, organizer, params } = base;

    await expect(
      fund
        .connect(organizer)
        .createEvent(
          params.fundingGoal,
          params.deadline,
          params.minStake,
          params.organizerShareBps,
          params.ticketPrice,
          params.maxTickets,
          params.usedThreshold,
          { value: params.minStake },
        ),
    )
      .to.emit(fund, "EventCreated")
      .withArgs(
        1,
        organizer.address,
        params.minStake,
        params.minStake,
        params.fundingGoal,
        params.deadline,
        params.organizerShareBps,
        params.ticketPrice,
        params.maxTickets,
        params.usedThreshold,
      );
    return { ...base, eventId: 1 };
  }

  function bpsOf(amount, bps) {
    return (amount * BigInt(bps)) / 10000n;
  }

  // ---------------------------------------------------------
  // 1. NHÓM ADMIN & CẤU HÌNH (TC1 - TC4)
  // ---------------------------------------------------------
  describe("Group 1: Admin & Setup", () => {
    it("TC1 & TC2: Only admin can set contracts + emits events", async () => {
      const { fund, ticket, organizer, stranger } = await loadFixture(
        deployFundFixture,
      );

      await expect(
        fund.connect(organizer).setTicketContract(organizer.address),
      ).to.be.revertedWithCustomError(fund, "NotAdmin");
      await expect(
        fund.connect(stranger).setMarketplaceContract(stranger.address),
      ).to.be.revertedWithCustomError(fund, "NotAdmin");

      // Admin is deployer, so ticket wiring should emit
      await expect(fund.setTicketContract(ticket.target))
        .to.emit(fund, "TicketContractSet")
        .withArgs(ticket.target);
    });

    it("TC3: Fail if address(0) for both ticket/marketplace", async () => {
      const { fund, admin } = await loadFixture(deployFundFixture);
      await expect(
        fund.connect(admin).setTicketContract(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(fund, "BadParam");

      await expect(
        fund.connect(admin).setMarketplaceContract(ethers.ZeroAddress),
      ).to.be.revertedWithCustomError(fund, "BadParam");
    });

    it("TC4: Escrow deposits restricted to Ticket/Marketplace", async () => {
      const { fund, ticket, marketplace, stranger, eventId } =
        await loadFixture(eventCreatedFixture);

      await expect(
        fund.connect(stranger).depositTicketRevenue(eventId, { value: 100 }),
      ).to.be.revertedWithCustomError(fund, "OnlyTicketContract");

      await expect(
        fund.connect(stranger).depositRoyalty(eventId, { value: 100 }),
      ).to.be.revertedWithCustomError(fund, "NotAuthorized");

      const ticketSigner = await getContractSigner(ticket.target);
      await expect(
        fund.connect(ticketSigner).depositTicketRevenue(eventId, { value: 123 }),
      )
        .to.emit(fund, "TicketRevenueDeposited")
        .withArgs(eventId, ticket.target, 123, 123);

      const marketplaceSigner = await getContractSigner(marketplace.target);
      await expect(
        fund
          .connect(marketplaceSigner)
          .depositRoyalty(eventId, { value: 7 }),
      )
        .to.emit(fund, "RoyaltyDeposited")
        .withArgs(eventId, marketplace.target, 7, 130);
    });
  });

  // ---------------------------------------------------------
  // 2. NHÓM KHỞI TẠO SỰ KIỆN (TC5 - TC8)
  // ---------------------------------------------------------
  describe("Group 2: createEvent()", () => {
    it("TC5: Create success and lock stake", async () => {
      const { fund, organizer, params } = await loadFixture(deployFundFixture);
      const tx = fund
        .connect(organizer)
        .createEvent(
          params.fundingGoal,
          params.deadline,
          params.minStake,
          params.organizerShareBps,
          params.ticketPrice,
          params.maxTickets,
          params.usedThreshold,
          { value: params.minStake },
        );

      await expect(tx).to.changeEtherBalance(fund, params.minStake);
      await expect(tx).to.emit(fund, "EventCreated");
    });

    it("TC6: Fail if stake < minStake", async () => {
      const { fund, organizer, params } = await loadFixture(deployFundFixture);
      await expect(
        fund
          .connect(organizer)
          .createEvent(
            params.fundingGoal,
            params.deadline,
            params.minStake,
            8000n,
            params.ticketPrice,
            100n,
            2n,
            { value: ethers.parseEther("0.5") },
          ),
      ).to.be.revertedWithCustomError(fund, "BadParam");
    });

    it("TC7: Fail if deadline in past", async () => {
      const { fund, organizer, params } = await loadFixture(deployFundFixture);
      await expect(
        fund
          .connect(organizer)
          .createEvent(
            params.fundingGoal,
            (await time.latest()) - 1,
            params.minStake,
            8000n,
            params.ticketPrice,
            100n,
            2n,
            { value: params.minStake },
          ),
      ).to.be.revertedWithCustomError(fund, "BadParam");
    });

    it("TC8: Fail if invalid params (usedThreshold = 0)", async () => {
      const { fund, organizer, params } = await loadFixture(deployFundFixture);
      await expect(
        fund
          .connect(organizer)
          .createEvent(
            params.fundingGoal,
            params.deadline,
            params.minStake,
            8000n,
            params.ticketPrice,
            100n,
            0n,
            { value: params.minStake },
          ),
      ).to.be.revertedWithCustomError(fund, "BadParam");
    });
  });

  // ---------------------------------------------------------
  // 3. NHÓM HUY ĐỘNG VỐN (TC9 - TC13)
  // ---------------------------------------------------------
  describe("Group 3: contribute()", () => {
    it("TC9 & TC10: Shares mint 1:1 and transitions to Funded at goal", async () => {
      const { fund, organizer, donator1, donator2, eventId, params } =
        await loadFixture(eventCreatedFixture);

      const c1 = ethers.parseEther("7");
      const c2 = ethers.parseEther("3");

      await expect(
        fund.connect(donator1).contribute(eventId, { value: c1 }),
      )
        .to.emit(fund, "ContributionMade")
        .withArgs(eventId, donator1.address, c1);

      await expect(
        fund.connect(donator2).contribute(eventId, { value: c2 }),
      ).to.emit(fund, "FundingSuccessful");

      // Once Funded, further contributions should be blocked.
      await expect(
        fund.connect(donator1).contribute(eventId, { value: 1 }),
      ).to.be.revertedWithCustomError(fund, "NotFunding");

      // Finalize should report totalShares == total contributed wei.
      await expect(fund.connect(organizer).finalizeFunding(eventId))
        .to.emit(fund, "FundingFinalized")
        .withArgs(eventId, c1 + c2, 2); // Funded
    });

    it("TC11: Fail after deadline", async () => {
      const { fund, donator1, eventId, params } = await loadFixture(
        eventCreatedFixture,
      );
      await time.increaseTo(params.deadline + 1);
      await expect(
        fund.connect(donator1).contribute(eventId, { value: 100 }),
      ).to.be.revertedWithCustomError(fund, "FundingClosed");
    });

    it("TC12 & TC13: Fail if status is not Funding", async () => {
      const { fund, organizer, donator1, eventId, params } = await loadFixture(
        eventCreatedFixture,
      );
      await fund
        .connect(donator1)
        .contribute(eventId, { value: params.fundingGoal });
      await fund.connect(organizer).finalizeFunding(eventId);
      await expect(
        fund.connect(donator1).contribute(eventId, { value: 100 }),
      ).to.be.revertedWithCustomError(fund, "NotFunding");
    });
  });

  // ---------------------------------------------------------
  // 4. NHÓM CHỐT VỐN & BÁN VÉ (TC14 - TC17)
  // ---------------------------------------------------------
  describe("Group 4: Finalize & Ticketing", () => {
    it("TC14: After deadline without goal => Cancelled + refunds enabled by claimContributionRefund", async () => {
      const { fund, organizer, donator1, eventId, params } = await loadFixture(
        eventCreatedFixture,
      );

      await fund.connect(donator1).contribute(eventId, { value: 500n });
      await time.increaseTo(params.deadline + 1);

      await expect(fund.connect(organizer).finalizeFunding(eventId))
        .to.emit(fund, "FundingFinalized")
        .withArgs(eventId, 500n, 5); // Cancelled

      await expect(
        fund.connect(donator1).claimContributionRefund(eventId),
      )
        .to.emit(fund, "ContributionRefunded")
        .withArgs(eventId, donator1.address, 500n);
    });

    it("TC15: Before deadline, finalize requires Funded", async () => {
      const { fund, organizer, eventId } = await loadFixture(
        eventCreatedFixture,
      );
      await expect(
        fund.connect(organizer).finalizeFunding(eventId),
      ).to.be.revertedWithCustomError(fund, "Unsafe");
    });

    it("TC16 & TC17: startTicketing() mints, supports multiple batches, enforces maxTickets", async () => {
      const { fund, ticket, organizer, donator1, eventId, params } =
        await loadFixture(eventCreatedFixture);

      await fund
        .connect(donator1)
        .contribute(eventId, { value: params.fundingGoal });
      await fund.connect(organizer).finalizeFunding(eventId);

      await expect(fund.connect(organizer).startTicketing(eventId, 0, 3))
        .to.emit(fund, "TicketingStarted")
        .withArgs(eventId, 3, 0);

      let tokenIds = await ticket.getEventTokenIds(eventId);
      expect(tokenIds.length).to.equal(3);
      expect(await ticket.ownerOf(tokenIds[0])).to.equal(organizer.address);

      // Second batch still allowed (status Ticketing)
      await expect(fund.connect(organizer).startTicketing(eventId, 1, 2))
        .to.emit(fund, "TicketingStarted")
        .withArgs(eventId, 2, 1);

      tokenIds = await ticket.getEventTokenIds(eventId);
      expect(tokenIds.length).to.equal(5);

      // Exceed maxTickets
      await expect(
        fund.connect(organizer).startTicketing(eventId, 0, params.maxTickets),
      ).to.be.revertedWithCustomError(fund, "ExceedsMaxTickets");
    });
  });

  // ---------------------------------------------------------
  // 5. NHÓM DOANH THU & CHIA THƯỞNG (TC18 - TC22)
  // ---------------------------------------------------------
  describe("Group 5: Revenue & Rewards", () => {
    it("TC18-TC22: Full flow (primary + secondary royalty) => deterministic distribution + claims", async () => {
      const {
        fund,
        ticket,
        marketplace,
        admin,
        organizer,
        donator1,
        donator2,
        buyer,
        resaleBuyer,
        verifier,
        eventId,
        params,
      } = await loadFixture(eventCreatedFixture);

      // Funding (7 ETH + 3 ETH)
      const c1 = ethers.parseEther("7");
      const c2 = ethers.parseEther("3");
      await fund.connect(donator1).contribute(eventId, { value: c1 });
      await expect(
        fund.connect(donator2).contribute(eventId, { value: c2 }),
      ).to.emit(fund, "FundingSuccessful");
      await fund.connect(organizer).finalizeFunding(eventId);

      // Ticketing
      await fund.connect(organizer).startTicketing(eventId, 0, 3);

      // 3 primary purchases => 3 ETH escrow
      await expect(
        ticket.connect(buyer).purchaseTicket(1, { value: params.ticketPrice }),
      )
        .to.emit(fund, "TicketRevenueDeposited")
        .withArgs(eventId, ticket.target, params.ticketPrice, params.ticketPrice);

      await expect(
        ticket.connect(buyer).purchaseTicket(2, { value: params.ticketPrice }),
      )
        .to.emit(fund, "TicketRevenueDeposited")
        .withArgs(eventId, ticket.target, params.ticketPrice, params.ticketPrice * 2n);

      await expect(
        ticket.connect(buyer).purchaseTicket(3, { value: params.ticketPrice }),
      )
        .to.emit(fund, "TicketRevenueDeposited")
        .withArgs(eventId, ticket.target, params.ticketPrice, params.ticketPrice * 3n);

      // Secondary sale of token 3 at 1.5x price => royalty escrow
      const resalePrice = (params.ticketPrice * 150n) / 100n;
      await ticket.connect(buyer).approve(marketplace.target, 3);
      await marketplace.connect(buyer).createListing(3, resalePrice);

      const expectedRoyalty = bpsOf(resalePrice, params.initialRoyaltyBps);
      await expect(
        marketplace.connect(resaleBuyer).buyListing(1, { value: resalePrice }),
      )
        .to.emit(fund, "RoyaltyDeposited")
        .withArgs(eventId, marketplace.target, expectedRoyalty, params.ticketPrice * 3n + expectedRoyalty);

      // Check-in 2 tickets => reach threshold
      await ticket.connect(admin).addEventVerifier(eventId, verifier.address);
      await ticket.connect(verifier).markAsUsed(1);
      await ticket.connect(verifier).markAsUsed(2);
      await expect(fund.connect(organizer).setCompletedIfThresholdMet(eventId))
        .to.emit(fund, "Completed")
        .withArgs(eventId, 2);

      // Compute expected distribution
      const totalRevenue = params.ticketPrice * 3n + expectedRoyalty;
      const platformFee = bpsOf(totalRevenue, 500);
      const afterFee = totalRevenue - platformFee;
      const organizerShare = bpsOf(afterFee, Number(params.organizerShareBps));
      const donatorPool = afterFee - organizerShare;
      const totalShares = c1 + c2;
      const expectedAcc = (donatorPool * 1000000000000000000n) / totalShares;

      // Release + assert event args (incl. newAccRewardPerShare)
      await expect(fund.connect(organizer).releaseRevenue(eventId))
        .to.emit(fund, "RevenueReleased")
        .withArgs(eventId, totalRevenue, platformFee, organizerShare, donatorPool, expectedAcc);

      // Pending reward math matches share ratio
      const expectedReward1 = (donatorPool * c1) / totalShares;
      const expectedReward2 = (donatorPool * c2) / totalShares;
      expect(await fund.pendingReward(eventId, donator1.address)).to.equal(
        expectedReward1,
      );
      expect(await fund.pendingReward(eventId, donator2.address)).to.equal(
        expectedReward2,
      );

      await expect(fund.connect(donator1).claimReward(eventId))
        .to.emit(fund, "RewardClaimed")
        .withArgs(eventId, donator1.address, expectedReward1);
      expect(await fund.pendingReward(eventId, donator1.address)).to.equal(0);

      await expect(fund.connect(donator1).claimReward(eventId)).to.be.revertedWithCustomError(
        fund,
        "NothingToClaim",
      );

      await expect(fund.connect(donator2).claimReward(eventId))
        .to.emit(fund, "RewardClaimed")
        .withArgs(eventId, donator2.address, expectedReward2);
    });
  });

  // ---------------------------------------------------------
  // 6. NHÓM HOÀN TIỀN VÉ (REFUND END-TO-END)
  // ---------------------------------------------------------
  describe("Group 6: Ticket Refunds", () => {
    it("Enabling refunds migrates escrow to refundPool; ticket owner can claimRefund() exactly once", async () => {
      const { fund, ticket, organizer, donator1, buyer, eventId, params } =
        await loadFixture(eventCreatedFixture);

      // Funding -> Funded -> sharesFinalized
      await fund
        .connect(donator1)
        .contribute(eventId, { value: params.fundingGoal });
      await fund.connect(organizer).finalizeFunding(eventId);

      // Ticketing + 1 primary purchase => escrowedRevenue = ticketPrice
      await fund.connect(organizer).startTicketing(eventId, 0, 1);
      await ticket
        .connect(buyer)
        .purchaseTicket(1, { value: params.ticketPrice });

      // Cannot refund until Fund enables refunds
      await expect(ticket.connect(buyer).claimRefund(1)).to.be
        .revertedWithCustomError(fund, "RefundsNotEnabled");

      // Enable refunds: escrowedRevenue should be migrated into refundPool
      await expect(fund.connect(organizer).refundTickets(eventId))
        .to.emit(fund, "RefundsEnabled")
        .withArgs(eventId, params.ticketPrice);

      // Claim refund through Ticket => Fund pays out + Ticket marks Refunded
      const tx = ticket.connect(buyer).claimRefund(1);
      await expect(tx)
        .to.emit(fund, "TicketRefundPaid")
        .withArgs(eventId, 1, buyer.address, params.ticketPrice);
      await expect(tx)
        .to.emit(ticket, "TicketRefunded")
        .withArgs(1, eventId, buyer.address, params.ticketPrice);
      await expect(tx)
        .to.emit(ticket, "TicketRefundClaimed")
        .withArgs(1, eventId, buyer.address, params.ticketPrice);

      expect(await ticket.getTicketStatus(1)).to.equal(4); // Refunded

      // Double-claim blocked
      await expect(ticket.connect(buyer).claimRefund(1)).to.be
        .revertedWithCustomError(ticket, "InvalidTicketStatus");

      // Refunded ticket cannot be transferred
      await expect(
        ticket.connect(buyer).transferFrom(buyer.address, organizer.address, 1),
      ).to.be.revertedWithCustomError(ticket, "InvalidTicketStatus");
    });
  });

  // ---------------------------------------------------------
  // 6. NHÓM HOÀN TIỀN & BẢO MẬT (TC23 - TC31)
  // ---------------------------------------------------------
  describe("Group 6: Refunds & Security", () => {
    it("TC23 & TC24: Refund and double claim block", async () => {
      const { fund, donator1, organizer, eventId, params } = await loadFixture(
        eventCreatedFixture,
      );
      await fund.connect(donator1).contribute(eventId, { value: 500 });
      await time.increaseTo(params.deadline + 1);
      await fund.connect(organizer).finalizeFunding(eventId);

      await expect(
        fund.connect(donator1).claimContributionRefund(eventId),
      ).to.changeEtherBalance(donator1, 500);
      await expect(
        fund.connect(donator1).claimContributionRefund(eventId),
      ).to.be.revertedWithCustomError(fund, "NothingToClaim");
    });

    it("TC25: applyPenalty() logic", async () => {
      const { fund, admin, eventId } = await loadFixture(eventCreatedFixture);
      await expect(fund.connect(admin).applyPenalty(eventId, 5000, 1))
        .to.emit(fund, "PenaltyApplied")
        .withArgs(eventId, ethers.parseEther("0.5"), 5000, 1);
    });

    it("TC27, 28, 29: Stake withdrawal constraints", async () => {
      const { fund, organizer, stranger, eventId, params } = await loadFixture(
        eventCreatedFixture,
      );
      await expect(
        fund.connect(organizer).withdrawStake(eventId),
      ).to.be.revertedWithCustomError(fund, "Unsafe");
      await time.increaseTo(params.deadline + 1);
      await fund.connect(organizer).finalizeFunding(eventId);
      await expect(
        fund.connect(stranger).withdrawStake(eventId),
      ).to.be.revertedWithCustomError(fund, "NotOrganizer");
      await expect(
        fund.connect(organizer).withdrawStake(eventId),
      ).to.changeEtherBalance(organizer, params.minStake);
    });

    it("TC31: Block release if usedThreshold not met", async () => {
      const { fund, organizer, donator1, eventId, params, ticket } =
        await loadFixture(eventCreatedFixture);
      await fund
        .connect(donator1)
        .contribute(eventId, { value: params.fundingGoal });
      await fund.connect(organizer).finalizeFunding(eventId);
      const ts = await getContractSigner(ticket.target);
      await fund.connect(ts).depositTicketRevenue(eventId, { value: 100 });

      // Revert vì chưa đạt Threshold
      await expect(
        fund.connect(organizer).releaseRevenue(eventId),
      ).to.be.revertedWithCustomError(fund, "NotCompleted");
    });

    it("TC30: Reentrancy check (NothingToClaim)", async () => {
      const { fund, donator1, eventId } = await loadFixture(
        eventCreatedFixture,
      );
      await expect(
        fund.connect(donator1).claimReward(eventId),
      ).to.be.revertedWithCustomError(fund, "NothingToClaim");
    });
  });
});
