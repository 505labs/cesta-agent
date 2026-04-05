package com.roadtrip.copilot.core.audio

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.File
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AudioStore @Inject constructor(
    @ApplicationContext private val context: Context
) {
    private val audioDir: File
        get() = File(context.filesDir, "audio_responses").also { it.mkdirs() }

    fun save(audioData: ByteArray, timestamp: Long): String {
        val file = File(audioDir, "response_$timestamp.wav")
        file.writeBytes(audioData)
        return file.absolutePath
    }

    fun load(filePath: String): ByteArray? {
        val file = File(filePath)
        return if (file.exists()) file.readBytes() else null
    }

    fun delete(filePath: String) {
        File(filePath).delete()
    }

    fun deleteAll() {
        audioDir.listFiles()?.forEach { it.delete() }
    }
}
