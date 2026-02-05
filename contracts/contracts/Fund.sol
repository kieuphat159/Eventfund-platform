
pragma solidity ^0.8.20;


contract Fund {
    error NotAdmin();
    error NotOrganizer();
    error EventNotFound();
    error BadParam();
    error NotOpen();
    error FundingClosed();
    error FundingNotSuccessful();
    error AlreadyFinalized();
    error NothingToClaim();
    error RefundsNotEnabled();
    error TransferFailed();
    error Unsafe();
    error ExceedsMax();
    error NotEnoughValue();
    address public immutable admin;

    address public ticketContract;

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    modifier onlyTicketContract() {
        if (msg.sender != ticketContract) revert NotAdmin();
        _;
    }

    function setTicketContract(address _ticketContract) external onlyAdmin {
        ticketContract = _ticketContract;
    }


    uint256 public constant PLATFORM_FEE_BPS = 500; 
    uint256 public constant BPS_DENOM = 10_000;

    enum EventStatus {
        None,
        Funding,
        Funded,    
        Ticketing,  
        Completed,
        Cancelled
    }

    enum PenaltyReason {
        cancelled,
        fraud,
        threshold_not_met
    }

    struct EventConfig {
        address organizer;

        
        uint256 fundingGoal;
        uint256 currentFunding;
        uint256 fundingDeadline; 
        uint256 minStakeRequired;
        uint256 organizerStakeLocked;

        
        uint256 ticketPrice;
        uint256 maxTickets;
        uint256 ticketsSold;

        
        uint256 ticketEscrow; 
        uint256 refundPool;   
        bool refundsEnabled;

        
        uint256 organizerShareBps; 
        bool sharesFinalized;      

        
        uint256 totalShares;
        mapping(address => uint256) shareOf;

        
        uint256 accRewardPerShare;               
        mapping(address => uint256) rewardDebt;  
        mapping(address => uint256) pending;     
        bool revenueReleased;
        EventStatus status;
    }

    uint256 public nextEventId = 1;
    mapping(uint256 => EventConfig) private events_;

   
    event EventCreated(
        uint256 indexed eventId,
        address indexed organizer,
        uint256 stakeAmount,
        uint256 minStakeRequired,
        uint256 fundingGoal,
        uint256 fundingDeadline,
        uint256 organizerShareBps,
        uint256 ticketPrice,
        uint256 maxTickets
    );

    event ContributionMade(uint256 indexed eventId, address indexed donator, uint256 amount);
    event SharesIssued(uint256 indexed eventId, address indexed donator, uint256 sharesMinted); // :contentReference[oaicite:3]{index=3}

    event FundingSuccessful(uint256 indexed eventId);
    event FundingFinalized(uint256 indexed eventId, uint256 totalShares);

    event TicketPurchased(uint256 indexed eventId, address indexed buyer, uint256 quantity, uint256 paid);

    event RevenueReleased(
        uint256 indexed eventId,
        uint256 totalRevenue,
        uint256 platformFee,
        uint256 organizerShare,
        uint256 donatorPool,
        uint256 newAccRewardPerShare
    ); 

    event RewardClaimed(uint256 indexed eventId, address indexed donator, uint256 amount); // :contentReference[oaicite:5]{index=5}

    event RefundsEnabled(uint256 indexed eventId, uint256 refundPoolAmount);
    event TicketRefunded(uint256 indexed eventId, address indexed buyer, uint256 qty, uint256 amount); // :contentReference[oaicite:6]{index=6}

    event PenaltyApplied(
        uint256 indexed eventId,
        uint256 amount,
        uint256 penaltyBps,
        PenaltyReason reason
    ); 

    
    function getEventBasic(uint256 eventId)
        external
        view
        returns (
            address organizer,
            EventStatus status,
            uint256 fundingGoal,
            uint256 currentFunding,
            uint256 fundingDeadline,
            uint256 minStakeRequired,
            uint256 organizerStakeLocked,
            uint256 ticketPrice,
            uint256 maxTickets,
            uint256 ticketsSold,
            bool refundsEnabled,
            uint256 refundPool,
            uint256 organizerShareBps,
            bool sharesFinalized,
            uint256 totalShares,
            bool revenueReleased
        )
    {
        EventConfig storage e = events_[eventId];
        if (e.status == EventStatus.None) revert EventNotFound();

        organizer = e.organizer;
        status = e.status;
        fundingGoal = e.fundingGoal;
        currentFunding = e.currentFunding;
        fundingDeadline = e.fundingDeadline;
        minStakeRequired = e.minStakeRequired;
        organizerStakeLocked = e.organizerStakeLocked;
        ticketPrice = e.ticketPrice;
        maxTickets = e.maxTickets;
        ticketsSold = e.ticketsSold;
        refundsEnabled = e.refundsEnabled;
        refundPool = e.refundPool;
        organizerShareBps = e.organizerShareBps;
        sharesFinalized = e.sharesFinalized;
        totalShares = e.totalShares;
        revenueReleased = e.revenueReleased;
    }

    function shareOf(uint256 eventId, address user) external view returns (uint256) {
        EventConfig storage e = events_[eventId];
        if (e.status == EventStatus.None) revert EventNotFound();
        return e.shareOf[user];
    }

    function pendingReward(uint256 eventId, address user) external view returns (uint256) {
        EventConfig storage e = events_[eventId];
        if (e.status == EventStatus.None) revert EventNotFound();

        uint256 shares = e.shareOf[user];
        uint256 accumulated = (shares * e.accRewardPerShare) / 1e18;
        uint256 debt = e.rewardDebt[user];
        uint256 p = e.pending[user];
        if (accumulated > debt) p += (accumulated - debt);
        return p;
    }

    
    function createEvent(
        uint256 fundingGoal,
        uint256 fundingDeadline,
        uint256 minStakeRequired,
        uint256 organizerShareBps,
        uint256 ticketPrice,
        uint256 maxTickets
    ) external payable returns (uint256 eventId) {
        if (fundingGoal == 0) revert BadParam();
        if (fundingDeadline == 0 || fundingDeadline <= block.timestamp) revert BadParam();
        if (minStakeRequired == 0) revert BadParam();
        if (msg.value < minStakeRequired) revert BadParam();
        if (organizerShareBps > BPS_DENOM) revert BadParam();
        if (ticketPrice == 0 || maxTickets == 0) revert BadParam();

        eventId = nextEventId++;
        EventConfig storage e = events_[eventId];

        e.organizer = msg.sender;
        e.fundingGoal = fundingGoal;
        e.fundingDeadline = fundingDeadline;
        e.minStakeRequired = minStakeRequired;
        e.organizerStakeLocked = msg.value;
        e.organizerShareBps = organizerShareBps;

        e.ticketPrice = ticketPrice;
        e.maxTickets = maxTickets;

        e.status = EventStatus.Funding;

        emit EventCreated(
            eventId,
            msg.sender,
            msg.value,
            minStakeRequired,
            fundingGoal,
            fundingDeadline,
            organizerShareBps,
            ticketPrice,
            maxTickets
        );
    }

    function contribute(uint256 eventId) external payable {
        EventConfig storage e = _mustGet(eventId);

        if (e.status != EventStatus.Funding) revert NotOpen();
        if (block.timestamp > e.fundingDeadline) revert FundingClosed();
        if (e.sharesFinalized) revert AlreadyFinalized();
        if (msg.value == 0) revert NotEnoughValue();

        _updateUser(e, msg.sender);

       
        uint256 shares = msg.value;
        e.shareOf[msg.sender] += shares;
        e.totalShares += shares;

        e.currentFunding += msg.value;

        emit ContributionMade(eventId, msg.sender, msg.value);
        emit SharesIssued(eventId, msg.sender, shares);

        if (e.currentFunding >= e.fundingGoal) {
            e.status = EventStatus.Funded;
            emit FundingSuccessful(eventId);
        }
    }

    
    function finalizeFunding(uint256 eventId) external {
        EventConfig storage e = _mustGet(eventId);

        if (e.sharesFinalized) revert AlreadyFinalized();
        if (e.status != EventStatus.Funded && block.timestamp <= e.fundingDeadline) revert Unsafe();

        e.sharesFinalized = true;

       
        if (e.status != EventStatus.Funded && block.timestamp > e.fundingDeadline) {
            e.status = EventStatus.Cancelled;
        }

        emit FundingFinalized(eventId, e.totalShares);
    }

    function buyTicket(uint256 eventId, uint256 quantity) external payable {
        EventConfig storage e = _mustGet(eventId);

        
        if (e.status != EventStatus.Funded && e.status != EventStatus.Ticketing) revert NotOpen();
        if (quantity == 0) revert BadParam();
        if (e.ticketsSold + quantity > e.maxTickets) revert ExceedsMax();

        uint256 cost = e.ticketPrice * quantity;
        if (msg.value < cost) revert NotEnoughValue();

        e.ticketsSold += quantity;
        e.ticketEscrow += cost;

        
        uint256 extra = msg.value - cost;
        if (extra > 0) {
            (bool ok, ) = msg.sender.call{value: extra}("");
            if (!ok) revert TransferFailed();
        }

        emit TicketPurchased(eventId, msg.sender, quantity, cost);
    }

    
    function recordTicketSale(uint256 eventId) external payable onlyTicketContract {
        EventConfig storage e = _mustGet(eventId);
        if (msg.value == 0) revert BadParam();
        e.ticketEscrow += msg.value;
    }

    
    function releaseRevenue(uint256 eventId) external {
        EventConfig storage e = _mustGet(eventId);
        if (msg.sender != e.organizer) revert NotOrganizer();
        if (e.refundsEnabled) revert Unsafe();
        if (!e.sharesFinalized) revert Unsafe();
        if (e.revenueReleased) revert AlreadyFinalized();
        if (e.totalShares == 0) revert BadParam();

        
        uint256 totalRevenue = e.ticketEscrow;
        if (totalRevenue == 0) revert BadParam();

        
        e.ticketEscrow = 0;
        e.revenueReleased = true;

        uint256 platformFee = (totalRevenue * PLATFORM_FEE_BPS) / BPS_DENOM; 
        uint256 afterFee = totalRevenue - platformFee;

       
        uint256 organizerShare = (afterFee * e.organizerShareBps) / BPS_DENOM;
        uint256 donatorPool = afterFee - organizerShare;

        
        if (platformFee > 0) {
            (bool okFee, ) = admin.call{value: platformFee}("");
            if (!okFee) revert TransferFailed();
        }

        
        if (organizerShare > 0) {
            (bool okOrg, ) = e.organizer.call{value: organizerShare}("");
            if (!okOrg) revert TransferFailed();
        }

       
        e.accRewardPerShare += (donatorPool * 1e18) / e.totalShares;

        emit RevenueReleased(eventId, totalRevenue, platformFee, organizerShare, donatorPool, e.accRewardPerShare);
    }


    function claimReward(uint256 eventId) external {
        EventConfig storage e = _mustGet(eventId);
        _updateUser(e, msg.sender);

        uint256 amt = e.pending[msg.sender];
        if (amt == 0) revert NothingToClaim();

        e.pending[msg.sender] = 0;
        (bool ok, ) = msg.sender.call{value: amt}("");
        if (!ok) revert TransferFailed();

        emit RewardClaimed(eventId, msg.sender, amt); // :contentReference[oaicite:15]{index=15}
    }


    function refundTickets(uint256 eventId) external {
        EventConfig storage e = _mustGet(eventId);
        if (msg.sender != admin && msg.sender != e.organizer) revert NotAdmin();

        e.refundsEnabled = true;


        e.refundPool += e.ticketEscrow;
        e.ticketEscrow = 0;

        emit RefundsEnabled(eventId, e.refundPool);
    }


    function claimTicketRefund(uint256 eventId, uint256 qty) external {
        EventConfig storage e = _mustGet(eventId);
        if (!e.refundsEnabled) revert RefundsNotEnabled();
        if (qty == 0) revert BadParam();

       
        uint256 amount = e.ticketPrice * qty;
        if (amount > e.refundPool) revert BadParam();

        e.refundPool -= amount;

        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit TicketRefunded(eventId, msg.sender, qty, amount); // :contentReference[oaicite:18]{index=18}
    }

    
    function applyPenalty(
        uint256 eventId,
        uint256 penaltyBps,
        PenaltyReason reason
    ) external onlyAdmin {
        EventConfig storage e = _mustGet(eventId);
        if (penaltyBps > BPS_DENOM) revert BadParam();

        uint256 amount = (e.organizerStakeLocked * penaltyBps) / BPS_DENOM;
        if (amount == 0) revert BadParam();

        e.organizerStakeLocked -= amount;
        e.refundPool += amount;

        emit PenaltyApplied(eventId, amount, penaltyBps, reason);
    }

   
    function withdrawStake(uint256 eventId, uint256 amount) external {
        EventConfig storage e = _mustGet(eventId);
        if (msg.sender != e.organizer) revert NotOrganizer();
        if (e.refundsEnabled) revert Unsafe();

       
        if (!e.revenueReleased && e.status != EventStatus.Completed) revert Unsafe();

        if (amount == 0 || amount > e.organizerStakeLocked) revert BadParam();
        e.organizerStakeLocked -= amount;

        (bool ok, ) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }


    function _updateUser(EventConfig storage e, address user) internal {
        uint256 shares = e.shareOf[user];
        uint256 accumulated = (shares * e.accRewardPerShare) / 1e18;
        uint256 debt = e.rewardDebt[user];

        if (accumulated > debt) {
            e.pending[user] += (accumulated - debt);
        }
        e.rewardDebt[user] = accumulated;
    }

    function _mustGet(uint256 eventId) internal view returns (EventConfig storage e) {
        e = events_[eventId];
        if (e.status == EventStatus.None) revert EventNotFound();
    }

    receive() external payable {}
}
