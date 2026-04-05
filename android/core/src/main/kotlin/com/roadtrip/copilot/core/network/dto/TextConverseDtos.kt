package com.roadtrip.copilot.core.network.dto

import com.squareup.moshi.JsonClass

@JsonClass(generateAdapter = true)
data class TextConverseRequest(val text: String, val trip_id: Int? = null)

@JsonClass(generateAdapter = true)
data class TextConverseResponse(val user_text: String, val assistant_text: String)

@JsonClass(generateAdapter = true)
data class VoiceConverseJsonResponse(
    val user_transcript: String? = null,
    val assistant_text: String? = null,
    val audio: String? = null
)
