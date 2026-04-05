package com.roadtrip.copilot.core.state

sealed class ConversationState {
    data object Idle : ConversationState()
    data object Recording : ConversationState()
    data class ReviewingRecording(val durationSeconds: Int) : ConversationState()
    /** Brief state while uploading audio and getting STT back. */
    data object Processing : ConversationState()
    /** Audio submitted — waiting for Claude + TTS to finish (can take minutes). */
    data class WaitingForResponse(val userTranscript: String?) : ConversationState()
    data class Playing(val transcript: String?) : ConversationState()
    data class Error(val message: String) : ConversationState()
}
