package com.roadtrip.copilot.core.network.dto

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class PaymentInfo(
    val id: String,
    val trip_id: Int,
    val amount: String,
    val category: String? = null,
    val description: String? = null,
    val recipient: String,
    val status: String,
    val tx_hash: String? = null,
    val created_by: String,
    val created_at: Double
)

@JsonClass(generateAdapter = true)
data class CreatePaymentRequest(
    val amount: String,
    val category: String? = null,
    val description: String? = null,
    val recipient: String
)
