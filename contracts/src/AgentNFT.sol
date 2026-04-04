// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "lib/openzeppelin-contracts/contracts/token/ERC721/ERC721.sol";

/**
 * @title AgentNFT — Simplified ERC-7857 iNFT for AI Agent Identity
 * @notice Mints AI agent identities as NFTs on 0G Chain. Each token stores
 *         encrypted agent metadata via a 0G Storage root hash, making the
 *         agent's intelligence ownable, transferable, and composable.
 */
contract AgentNFT is ERC721 {
    struct AgentMetadata {
        string name;              // Agent display name
        string metadataURI;       // 0G Storage root hash or URI for encrypted agent data
        string descriptionURI;    // 0G Storage root hash for agent description
        address creator;          // Original minter
        uint256 createdAt;
    }

    uint256 public nextTokenId;
    mapping(uint256 => AgentMetadata) public agents;

    event AgentMinted(uint256 indexed tokenId, address indexed owner, string name, string metadataURI);
    event AgentMetadataUpdated(uint256 indexed tokenId, string metadataURI);

    constructor() ERC721("RoadTrip Agent", "RTAGENT") {}

    /**
     * @notice Mint a new agent iNFT.
     * @param _name Human-readable agent name
     * @param _metadataURI 0G Storage root hash pointing to encrypted agent config (character.json)
     * @param _descriptionURI 0G Storage root hash pointing to agent description
     */
    function mintAgent(
        string calldata _name,
        string calldata _metadataURI,
        string calldata _descriptionURI
    ) external returns (uint256 tokenId) {
        tokenId = nextTokenId++;
        _mint(msg.sender, tokenId);

        agents[tokenId] = AgentMetadata({
            name: _name,
            metadataURI: _metadataURI,
            descriptionURI: _descriptionURI,
            creator: msg.sender,
            createdAt: block.timestamp
        });

        emit AgentMinted(tokenId, msg.sender, _name, _metadataURI);
    }

    /**
     * @notice Update the metadata URI (e.g., after re-encrypting for a new owner).
     *         Only the current token owner can update.
     */
    function updateMetadata(uint256 _tokenId, string calldata _metadataURI) external {
        require(ownerOf(_tokenId) == msg.sender, "Not token owner");
        agents[_tokenId].metadataURI = _metadataURI;
        emit AgentMetadataUpdated(_tokenId, _metadataURI);
    }

    /**
     * @notice Get full agent metadata for a given token.
     */
    function getAgent(uint256 _tokenId) external view returns (AgentMetadata memory) {
        require(_ownerOf(_tokenId) != address(0), "Token does not exist");
        return agents[_tokenId];
    }

    /**
     * @notice ERC-165: declare support for ERC-721 + ERC-7857 interface.
     */
    function supportsInterface(bytes4 interfaceId) public view override returns (bool) {
        // 0x7857aaaa is a placeholder for ERC-7857 interface ID
        return interfaceId == 0x7857aaaa || super.supportsInterface(interfaceId);
    }
}
