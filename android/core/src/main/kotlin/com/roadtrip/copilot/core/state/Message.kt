package com.roadtrip.copilot.core.state

data class Message(
    val role: Role,
    val text: String,
    val timestamp: Long = System.currentTimeMillis(),
    val audioFile: String? = null
) {
    enum class Role { USER, ASSISTANT }
}
