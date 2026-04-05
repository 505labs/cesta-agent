package com.roadtrip.copilot.core.audio

interface AudioPlayer {
    suspend fun play(audioData: ByteArray, sampleRate: Int = 16000)
    fun stop()
    fun isPlaying(): Boolean
}
