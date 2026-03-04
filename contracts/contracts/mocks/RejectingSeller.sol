// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";

interface IMarketplaceLike {
    function createListing(uint256 tokenId, uint256 price) external returns (uint256 listingId);
}

/// @notice Helper contract for tests: can receive ERC721 but rejects ETH transfers.
contract RejectingSeller is IERC721Receiver {
    receive() external payable {
        revert("NO_ETH");
    }

    function onERC721Received(
        address,
        address,
        uint256,
        bytes calldata
    ) external pure override returns (bytes4) {
        return IERC721Receiver.onERC721Received.selector;
    }

    function approveAndList(
        address ticket,
        address marketplace,
        uint256 tokenId,
        uint256 price
    ) external returns (uint256 listingId) {
        IERC721(ticket).approve(marketplace, tokenId);
        listingId = IMarketplaceLike(marketplace).createListing(tokenId, price);
    }
}
