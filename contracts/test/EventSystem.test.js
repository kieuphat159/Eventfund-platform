import { expect } from "chai";
import pkg from "hardhat";
const { ethers } = pkg;

describe("Event Funding & Ticketing System", function () {
  let Fund, Ticket, Marketplace;
  let fund, ticket, marketplace;
  let admin, organizer, donator, buyer, verifier;

  const FUNDING_GOAL = ethers.parseEther("10"); // 10 ETH
  const TICKET_PRICE = ethers.parseEther("0.1"); // 0.1 ETH
  const STAKE_AMOUNT = ethers.parseEther("1"); // 1 ETH
  const MAX_TICKETS = 100;

  beforeEach(async function () {
    [admin, organizer, donator, buyer, verifier] = await ethers.getSigners();

    // 1. Deploy Ticket
    Ticket = await ethers.getContractFactory("Ticket");
    ticket = await Ticket.deploy();

    // 2. Deploy Fund
    Fund = await ethers.getContractFactory("Fund");
    fund = await Fund.deploy();

    // 3. Deploy Marketplace
    Marketplace = await ethers.getContractFactory("Marketplace");
    marketplace = await Marketplace.deploy(
      await ticket.getAddress(),
      await fund.getAddress(),
      250,
    ); // 2.5% royalty

    // 4. Setup Wiring (Kết nối các hợp đồng)
    await fund.setTicketContract(await ticket.getAddress());
    await fund.setMarketplaceContract(await marketplace.getAddress());
    await ticket.setFundContract(await fund.getAddress());

    // 5. Setup Roles
    const ORGANIZER_ROLE = await ticket.ORGANIZER_ROLE();
    await ticket.grantRole(ORGANIZER_ROLE, organizer.address);
    await ticket.grantRole(ORGANIZER_ROLE, await fund.getAddress()); // Cho phép Fund mint vé
  });

  describe("Full Cycle Test", function () {
    it("Should complete a full event lifecycle successfully", async function () {
      // --- BƯỚC 1: CREATE EVENT ---
      const deadline = Math.floor(Date.now() / 1000) + 86400; // 24h later
      await fund.connect(organizer).createEvent(
        FUNDING_GOAL,
        deadline,
        STAKE_AMOUNT,
        2000, // 20% organizer share
        TICKET_PRICE,
        MAX_TICKETS,
        1, // usedThreshold: chỉ cần 1 vé dùng là hoàn thành
        { value: STAKE_AMOUNT },
      );
      const eventId = 1;

      // --- BƯỚC 2: CONTRIBUTION (Donator góp vốn) ---
      await fund.connect(donator).contribute(eventId, { value: FUNDING_GOAL });

      const eventInfo = await fund.pendingReward(eventId, donator.address);
      expect(await fund.nextEventId()).to.equal(2);

      // --- BƯỚC 3: FINALIZE & START TICKETING ---
      await fund.connect(organizer).finalizeFunding(eventId);
      await fund.connect(organizer).startTicketing(eventId, 0, 10); // Mint 10 vé cho organizer

      // --- BƯỚC 4: PRIMARY PURCHASE (User mua vé từ Organizer) ---
      // Organizer bán vé ID #1
      await ticket.connect(buyer).purchaseTicket(1, { value: TICKET_PRICE });
      expect(await ticket.ownerOf(1)).to.equal(buyer.address);

      // --- BƯỚC 5: SECONDARY MARKET (Bán lại vé) ---
      const resalePrice = ethers.parseEther("0.12"); // Bán cao hơn giá gốc (không quá cap 150%)
      await ticket.connect(buyer).approve(await marketplace.getAddress(), 1);
      await marketplace.connect(buyer).createListing(1, resalePrice);

      // Donator mua lại vé từ Buyer trên chợ
      await marketplace.connect(donator).buyListing(1, { value: resalePrice });
      expect(await ticket.ownerOf(1)).to.equal(donator.address);

      // --- BƯỚC 6: USAGE (Sử dụng vé) ---
      await ticket.connect(admin).addEventVerifier(eventId, verifier.address);
      await ticket.connect(verifier).markAsUsed(1);

      // --- BƯỚC 7: RELEASE REVENUE (Chia tiền) ---
      await fund.connect(organizer).setCompletedIfThresholdMet(eventId);

      const adminBalBefore = await ethers.provider.getBalance(admin.address);
      await fund.connect(organizer).releaseRevenue(eventId);
      const adminBalAfter = await ethers.provider.getBalance(admin.address);

      // Admin nhận được 5% platform fee
      expect(adminBalAfter).to.be.gt(adminBalBefore);

      // --- BƯỚC 8: CLAIM REWARD (Donator nhận hoa hồng) ---
      const rewardBefore = await ethers.provider.getBalance(donator.address);
      await fund.connect(donator).claimReward(eventId);
      const rewardAfter = await ethers.provider.getBalance(donator.address);

      expect(rewardAfter).to.be.gt(rewardBefore);
    });

    it("Should allow refund if funding failed", async function () {
      const currentTimestamp = (await ethers.provider.getBlock("latest"))
        .timestamp;
      const deadline = currentTimestamp + 1000;

      // 🔥 Lấy eventId từ event emit thay vì hardcode
      const txCreate = await fund
        .connect(organizer)
        .createEvent(
          FUNDING_GOAL,
          deadline,
          STAKE_AMOUNT,
          1000,
          TICKET_PRICE,
          MAX_TICKETS,
          10,
          { value: STAKE_AMOUNT },
        );

      const receiptCreate = await txCreate.wait();

      // Tìm log EventCreated
      const eventCreatedLog = receiptCreate.logs.find(
        (log) => log.fragment && log.fragment.name === "EventCreated",
      );

      const eventId = eventCreatedLog.args.eventId;

      // Góp vốn không đủ goal (1 ETH < 10 ETH)
      await fund
        .connect(donator)
        .contribute(eventId, { value: ethers.parseEther("1") });

      // ⏩ Tăng thời gian vượt deadline
      await ethers.provider.send("evm_increaseTime", [1001]);
      await ethers.provider.send("evm_mine");

      // Finalize để chuyển sang Cancelled
      await fund.connect(admin).finalizeFunding(eventId);

      const balBefore = await ethers.provider.getBalance(donator.address);

      // Refund
      const txRefund = await fund
        .connect(donator)
        .claimContributionRefund(eventId);

      const receiptRefund = await txRefund.wait();

      const gasUsed = receiptRefund.gasUsed * receiptRefund.gasPrice;

      const balAfter = await ethers.provider.getBalance(donator.address);

      expect(balAfter + gasUsed).to.equal(balBefore + ethers.parseEther("1"));
    });
    it("Should refund both investor and ticket buyer when ticket sales cancellation happens", async function () {
      const deadline = Math.floor(Date.now() / 1000) + 86400;

      await fund.connect(organizer).createEvent(
        FUNDING_GOAL,
        deadline,
        STAKE_AMOUNT,
        2000,
        TICKET_PRICE,
        MAX_TICKETS,
        1,
        { value: STAKE_AMOUNT },
      );

      const eventId = 1;
      await fund.connect(donator).contribute(eventId, { value: FUNDING_GOAL });
      await fund.connect(organizer).finalizeFunding(eventId);
      await fund.connect(organizer).startTicketing(eventId, 0, 1);
      await ticket.connect(buyer).purchaseTicket(1, { value: TICKET_PRICE });

      await fund.connect(organizer).cancelEvent(eventId, 2);

      await expect(
        fund.connect(donator).claimContributionRefund(eventId),
      ).to.changeEtherBalance(donator, FUNDING_GOAL);

      const buyerBalBefore = await ethers.provider.getBalance(buyer.address);
      const txRefund = await ticket.connect(buyer).claimRefund(1);
      const receiptRefund = await txRefund.wait();
      const gasUsed = receiptRefund.gasUsed * receiptRefund.gasPrice;
      const buyerBalAfter = await ethers.provider.getBalance(buyer.address);

      expect(buyerBalAfter + gasUsed).to.equal(buyerBalBefore + TICKET_PRICE);
    });
  });
});
