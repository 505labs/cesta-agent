package com.roadtrip.copilot.core.network.dto

data class AudioResponse(
    val audioData: ByteArray,
    val userTranscript: String?,
    val assistantTranscript: String?
) {
    override fun equals(other: Any?): Boolean {
        if (this === other) return true
        if (other !is AudioResponse) return false
        return audioData.contentEquals(other.audioData) &&
            userTranscript == other.userTranscript &&
            assistantTranscript == other.assistantTranscript
    }

    override fun hashCode(): Int {
        var result = audioData.contentHashCode()
        result = 31 * result + (userTranscript?.hashCode() ?: 0)
        result = 31 * result + (assistantTranscript?.hashCode() ?: 0)
        return result
    }
}
