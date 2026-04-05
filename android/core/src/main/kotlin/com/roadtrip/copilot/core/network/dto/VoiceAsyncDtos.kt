package com.roadtrip.copilot.core.network.dto

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class VoiceSubmitResponse(
    val request_id: String,
    val user_transcript: String,
    val status: String
)

@JsonClass(generateAdapter = true)
data class VoicePollResponse(
    val status: String,
    val elapsed_seconds: Int? = null,
    val user_transcript: String? = null,
    val assistant_text: String? = null,
    val error: String? = null
)
