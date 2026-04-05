package com.roadtrip.copilot.core.audio

import android.annotation.SuppressLint
import android.media.AudioFormat
import android.media.AudioRecord
import android.media.MediaRecorder
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AudioRecorderImpl @Inject constructor() : AudioRecorder {

    companion object {
        const val SAMPLE_RATE = 16000
        const val CHANNEL_CONFIG = AudioFormat.CHANNEL_IN_MONO
        const val AUDIO_FORMAT = AudioFormat.ENCODING_PCM_16BIT
    }

    @Volatile
    private var isRecording = false
    private var audioRecord: AudioRecord? = null

    @SuppressLint("MissingPermission")
    override fun startRecording(): Flow<ByteArray> = callbackFlow {
        val bufferSize = maxOf(
            AudioRecord.getMinBufferSize(SAMPLE_RATE, CHANNEL_CONFIG, AUDIO_FORMAT),
            4096
        )

        val recorder = AudioRecord(
            MediaRecorder.AudioSource.VOICE_RECOGNITION,
            SAMPLE_RATE,
            CHANNEL_CONFIG,
            AUDIO_FORMAT,
            bufferSize
        )

        audioRecord = recorder
        isRecording = true
        recorder.startRecording()

        // Read from mic on IO thread, send chunks to flow
        launch(Dispatchers.IO) {
            val buffer = ByteArray(bufferSize)
            while (isActive && isRecording) {
                val bytesRead = recorder.read(buffer, 0, buffer.size)
                if (bytesRead > 0) {
                    trySend(buffer.copyOf(bytesRead))
                }
            }
        }

        awaitClose {
            isRecording = false
            try {
                recorder.stop()
                recorder.release()
            } catch (_: IllegalStateException) {}
            audioRecord = null
        }
    }

    override fun stopRecording() {
        isRecording = false
    }

    override fun isRecording(): Boolean = isRecording
}
