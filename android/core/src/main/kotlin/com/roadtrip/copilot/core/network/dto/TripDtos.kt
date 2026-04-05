package com.roadtrip.copilot.core.network.dto

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class TripInfo(
    val id: Int,
    val name: String,
    val organizer_wallet: String,
    val contract_trip_id: Int? = null,
    val treasury_address: String? = null,
    val spend_limit_usd: Double,
    val status: String,
    val created_at: Double,
    val members: List<TripMember>? = null
)

@JsonClass(generateAdapter = true)
data class TripMember(
    val wallet_address: String,
    val display_name: String? = null,
    val joined_at: Double? = null
)

@JsonClass(generateAdapter = true)
data class CreateTripRequest(
    val name: String,
    val spend_limit_usd: Double,
    val contract_trip_id: Int? = null,
    val treasury_address: String? = null
)

@JsonClass(generateAdapter = true)
data class JoinTripRequest(val display_name: String? = null)
