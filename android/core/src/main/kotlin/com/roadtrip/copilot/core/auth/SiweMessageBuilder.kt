package com.roadtrip.copilot.core.auth

import java.time.Instant
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

object SiweMessageBuilder {
    fun build(
        address: String,
        chainId: Int = 5042002,
        nonce: String,
        domain: String = "roadtrip-copilot.xyz",
        uri: String = "https://roadtrip-copilot.xyz"
    ): String {
        val issuedAt = DateTimeFormatter.ISO_INSTANT.format(Instant.now().atOffset(ZoneOffset.UTC))
        return listOf(
            "$domain wants you to sign in with your Ethereum account:",
            address,
            "",
            "Sign in to RoadTrip Co-Pilot",
            "",
            "URI: $uri",
            "Version: 1",
            "Chain ID: $chainId",
            "Nonce: $nonce",
            "Issued At: $issuedAt"
        ).joinToString("\n")
    }
}
