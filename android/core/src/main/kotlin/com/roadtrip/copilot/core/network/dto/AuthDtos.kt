package com.roadtrip.copilot.core.network.dto

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class NonceResponse(val nonce: String)

@JsonClass(generateAdapter = true)
data class VerifyRequest(val message: String, val signature: String)

@JsonClass(generateAdapter = true)
data class VerifyResponse(val token: String, val wallet_address: String)
