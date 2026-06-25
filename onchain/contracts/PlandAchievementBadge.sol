// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract PlandAchievementBadge is ERC721, Ownable {
    uint256 private _nextTokenId;

    mapping(uint256 => string) private _tokenURIs;

    event Locked(uint256 tokenId);

    constructor() ERC721("Pland Achievement Badge", "PAB") Ownable(msg.sender) {}

    function mint(address to, string calldata uri) external onlyOwner returns (uint256) {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _tokenURIs[tokenId] = uri;
        emit Locked(tokenId);
        return tokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return _tokenURIs[tokenId];
    }

    // Soulbound: not transferable
    function transferFrom(address, address, uint256) public pure override {
        revert("Soulbound: non-transferable");
    }

    function locked(uint256) external pure returns (bool) {
        return true;
    }
}