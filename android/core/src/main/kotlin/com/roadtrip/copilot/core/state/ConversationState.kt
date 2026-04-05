package com.roadtrip.copilot.core.state

sealed class ConversationState {
    data object Idle : ConversationState()
    data object Recording : ConversationState()
    data class ReviewingRecording(val durationSeconds: Int) : ConversationState()
    data object Processing : ConversationState()
    data class Playing(val transcript: String?) : ConversationState()
    data class Error(val message: String) : ConversationState()
}
