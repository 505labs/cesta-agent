package com.roadtrip.copilot.core.audio

import kotlinx.coroutines.flow.Flow

interface AudioRecorder {
    fun startRecording(): Flow<ByteArray>
    fun stopRecording()
    fun isRecording(): Boolean
}
