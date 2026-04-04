// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import {AgentNFT} from "../src/AgentNFT.sol";

contract AgentNFTTest is Test {
    AgentNFT nft;

    address alice = makeAddr("alice");
    address bob = makeAddr("bob");

    string constant NAME = "RoadTrip Co-Pilot";
    string constant META_URI = "0g://abc123def456";
    string constant DESC_URI = "0g://desc789xyz";

    function setUp() public {
        nft = new AgentNFT();
    }

    // --- Minting ---

    function test_mintAgent() public {
        vm.prank(alice);
        uint256 tokenId = nft.mintAgent(NAME, META_URI, DESC_URI);

        assertEq(tokenId, 0);
        assertEq(nft.ownerOf(tokenId), alice);

        AgentNFT.AgentMetadata memory agent = nft.getAgent(tokenId);
        assertEq(agent.name, NAME);
        assertEq(agent.metadataURI, META_URI);
        assertEq(agent.descriptionURI, DESC_URI);
        assertEq(agent.creator, alice);
        assertGt(agent.createdAt, 0);
    }

    function test_mintAgent_incrementsId() public {
        vm.prank(alice);
        uint256 id1 = nft.mintAgent("Agent 1", "uri1", "desc1");
        vm.prank(bob);
        uint256 id2 = nft.mintAgent("Agent 2", "uri2", "desc2");

        assertEq(id1, 0);
        assertEq(id2, 1);
        assertEq(nft.nextTokenId(), 2);
    }

    function test_mintAgent_emitsEvent() public {
        vm.expectEmit(true, true, false, true);
        emit AgentNFT.AgentMinted(0, alice, NAME, META_URI);

        vm.prank(alice);
        nft.mintAgent(NAME, META_URI, DESC_URI);
    }

    // --- Metadata Update ---

    function test_updateMetadata() public {
        vm.prank(alice);
        uint256 tokenId = nft.mintAgent(NAME, META_URI, DESC_URI);

        string memory newURI = "0g://updated999";
        vm.prank(alice);
        nft.updateMetadata(tokenId, newURI);

        assertEq(nft.getAgent(tokenId).metadataURI, newURI);
    }

    function test_updateMetadata_revertNotOwner() public {
        vm.prank(alice);
        uint256 tokenId = nft.mintAgent(NAME, META_URI, DESC_URI);

        vm.prank(bob);
        vm.expectRevert("Not token owner");
        nft.updateMetadata(tokenId, "0g://hacked");
    }

    function test_updateMetadata_emitsEvent() public {
        vm.prank(alice);
        uint256 tokenId = nft.mintAgent(NAME, META_URI, DESC_URI);

        string memory newURI = "0g://updated999";
        vm.expectEmit(true, false, false, true);
        emit AgentNFT.AgentMetadataUpdated(tokenId, newURI);

        vm.prank(alice);
        nft.updateMetadata(tokenId, newURI);
    }

    // --- Transfer ---

    function test_transfer_preservesMetadata() public {
        vm.prank(alice);
        uint256 tokenId = nft.mintAgent(NAME, META_URI, DESC_URI);

        vm.prank(alice);
        nft.transferFrom(alice, bob, tokenId);

        assertEq(nft.ownerOf(tokenId), bob);
        AgentNFT.AgentMetadata memory agent = nft.getAgent(tokenId);
        assertEq(agent.name, NAME);
        assertEq(agent.creator, alice); // creator stays the same
    }

    function test_newOwnerCanUpdateMetadata() public {
        vm.prank(alice);
        uint256 tokenId = nft.mintAgent(NAME, META_URI, DESC_URI);

        vm.prank(alice);
        nft.transferFrom(alice, bob, tokenId);

        vm.prank(bob);
        nft.updateMetadata(tokenId, "0g://bob-encrypted");
        assertEq(nft.getAgent(tokenId).metadataURI, "0g://bob-encrypted");
    }

    // --- View ---

    function test_getAgent_revertNonexistent() public {
        vm.expectRevert("Token does not exist");
        nft.getAgent(999);
    }

    // --- ERC-165 ---

    function test_supportsInterface_ERC721() public view {
        assertTrue(nft.supportsInterface(0x80ac58cd)); // ERC-721
    }

    function test_supportsInterface_ERC7857() public view {
        assertTrue(nft.supportsInterface(0x7857aaaa)); // ERC-7857 placeholder
    }

    function test_supportsInterface_ERC165() public view {
        assertTrue(nft.supportsInterface(0x01ffc9a7)); // ERC-165
    }
}
