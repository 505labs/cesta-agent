package com.roadtrip.copilot.core.audio

import android.media.AudioAttributes
import android.media.AudioFormat
import android.media.AudioTrack
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AudioPlayerImpl @Inject constructor() : AudioPlayer {

    @Volatile
    private var isPlaying = false
    private var audioTrack: AudioTrack? = null

    override suspend fun play(audioData: ByteArray, sampleRate: Int) = withContext(Dispatchers.IO) {
        stop()

        val effectiveSampleRate: Int
        val pcmData: ByteArray
        if (isWavFormat(audioData)) {
            effectiveSampleRate = wavSampleRate(audioData) ?: sampleRate
            pcmData = audioData.copyOfRange(44, audioData.size)
        } else {
            effectiveSampleRate = sampleRate
            pcmData = audioData
        }

        val bufferSize = AudioTrack.getMinBufferSize(
            effectiveSampleRate,
            AudioFormat.CHANNEL_OUT_MONO,
            AudioFormat.ENCODING_PCM_16BIT
        )

        val track = AudioTrack.Builder()
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(AudioAttributes.USAGE_ASSISTANT)
                    .setContentType(AudioAttributes.CONTENT_TYPE_SPEECH)
                    .build()
            )
            .setAudioFormat(
                AudioFormat.Builder()
                    .setEncoding(AudioFormat.ENCODING_PCM_16BIT)
                    .setSampleRate(effectiveSampleRate)
                    .setChannelMask(AudioFormat.CHANNEL_OUT_MONO)
                    .build()
            )
            .setBufferSizeInBytes(maxOf(bufferSize, 4096))
            .setTransferMode(AudioTrack.MODE_STREAM)
            .build()

        audioTrack = track
        isPlaying = true
        track.play()

        var offset = 0
        val chunkSize = bufferSize
        while (offset < pcmData.size && isPlaying) {
            val bytesToWrite = minOf(chunkSize, pcmData.size - offset)
            track.write(pcmData, offset, bytesToWrite)
            offset += bytesToWrite
        }

        track.stop()
        track.release()
        audioTrack = null
        isPlaying = false
    }

    override fun stop() {
        isPlaying = false
        audioTrack?.let {
            try {
                it.stop()
                it.release()
            } catch (_: IllegalStateException) {}
        }
        audioTrack = null
    }

    override fun isPlaying(): Boolean = isPlaying

    private fun isWavFormat(data: ByteArray): Boolean {
        return data.size > 44 &&
            data[0] == 'R'.code.toByte() &&
            data[1] == 'I'.code.toByte() &&
            data[2] == 'F'.code.toByte() &&
            data[3] == 'F'.code.toByte()
    }

    /** Read sample rate from WAV header bytes 24-27 (little-endian uint32). */
    private fun wavSampleRate(data: ByteArray): Int? {
        if (data.size < 28) return null
        return (data[24].toInt() and 0xFF) or
            ((data[25].toInt() and 0xFF) shl 8) or
            ((data[26].toInt() and 0xFF) shl 16) or
            ((data[27].toInt() and 0xFF) shl 24)
    }
}
