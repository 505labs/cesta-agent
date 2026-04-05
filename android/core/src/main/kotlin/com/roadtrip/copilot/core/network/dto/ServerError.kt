package com.roadtrip.copilot.core.network.dto

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class ServerError(
    val error: ErrorDetail
)

@JsonClass(generateAdapter = true)
data class ErrorDetail(
    val code: String,
    val message: String
)
