package com.roadtrip.copilot.core.state

import android.content.SharedPreferences
import com.roadtrip.copilot.core.audio.*
import com.roadtrip.copilot.core.network.OrchestratorApiClient
import com.roadtrip.copilot.core.network.TripRepository
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.*
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ConversationRepository @Inject constructor(
    private val audioRecorder: AudioRecorder,
    private val audioPlayer: AudioPlayer,
    private val audioFocusManager: AudioFocusManager,
    private val apiClient: OrchestratorApiClient,
    private val pcmToWavConverter: PcmToWavConverterWrapper,
    private val audioStore: AudioStore,
    private val prefs: SharedPreferences,
    private val tripRepository: TripRepository
) {
    private val _state = MutableStateFlow<ConversationState>(ConversationState.Idle)
    val state: StateFlow<ConversationState> = _state.asStateFlow()

    private val _messages = MutableStateFlow<List<Message>>(emptyList())
    val messages: StateFlow<List<Message>> = _messages.asStateFlow()

    private var recordingJob: Job? = null
    private var pcmChunks = mutableListOf<ByteArray>()
    private var pendingWavData: ByteArray? = null
    private var recordingStartTime: Long = 0L
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    val lastAssistantMessage: String?
        get() = _messages.value.lastOrNull { it.role == Message.Role.ASSISTANT }?.text

    fun startRecording() {
        if (_state.value != ConversationState.Idle) return
        if (!audioFocusManager.requestFocus()) {
            _state.value = ConversationState.Error("Could not acquire audio focus")
            return
        }

        pcmChunks.clear()
        pendingWavData = null
        recordingStartTime = System.currentTimeMillis()
        _state.value = ConversationState.Recording

        recordingJob = scope.launch {
            audioRecorder.startRecording().collect { chunk ->
                pcmChunks.add(chunk)
            }
        }
    }

    fun stopRecordingForReview() {
        if (_state.value != ConversationState.Recording) return

        audioRecorder.stopRecording()
        recordingJob?.cancel()
        recordingJob = null

        val pcmData = mergePcmChunks()
        if (pcmData.isEmpty()) {
            _state.value = ConversationState.Error("No audio recorded")
            audioFocusManager.abandonFocus()
            return
        }

        pendingWavData = pcmToWavConverter.convert(pcmData)
        val durationSeconds = ((System.currentTimeMillis() - recordingStartTime) / 1000).toInt()
        _state.value = ConversationState.ReviewingRecording(durationSeconds)
    }

    fun approveAndSend() {
        val wavData = pendingWavData ?: return
        if (_state.value !is ConversationState.ReviewingRecording) return

        pendingWavData = null
        _state.value = ConversationState.Processing

        scope.launch {
            try {
                val detailLevel = prefs.getString("detail_level", "standard") ?: "standard"
                val result = apiClient.sendAudio(wavData, tripRepository.activeTripId.value, detailLevel)

                result.fold(
                    onSuccess = { response ->
                        response.userTranscript?.let { transcript ->
                            addMessage(Message(Message.Role.USER, transcript))
                        }

                        val timestamp = System.currentTimeMillis()
                        val audioPath = audioStore.save(response.audioData, timestamp)

                        response.assistantTranscript?.let { transcript ->
                            addMessage(Message(
                                role = Message.Role.ASSISTANT,
                                text = transcript,
                                timestamp = timestamp,
                                audioFile = audioPath
                            ))
                        }

                        _state.value = ConversationState.Playing(response.assistantTranscript)
                        audioPlayer.play(response.audioData)
                        _state.value = ConversationState.Idle
                        audioFocusManager.abandonFocus()
                    },
                    onFailure = { error ->
                        _state.value = ConversationState.Error(
                            error.message ?: "Failed to communicate with server"
                        )
                        audioFocusManager.abandonFocus()
                    }
                )
            } catch (e: CancellationException) {
                throw e
            } catch (e: Exception) {
                _state.value = ConversationState.Error(e.message ?: "Unexpected error")
                audioFocusManager.abandonFocus()
            }
        }
    }

    fun discardRecording() {
        pendingWavData = null
        audioFocusManager.abandonFocus()
        _state.value = ConversationState.Idle
    }

    fun cancelRecording() {
        audioRecorder.stopRecording()
        recordingJob?.cancel()
        recordingJob = null
        pcmChunks.clear()
        pendingWavData = null
        audioFocusManager.abandonFocus()
        _state.value = ConversationState.Idle
    }

    fun replayMessage(message: Message) {
        val audioPath = message.audioFile ?: return
        val audioData = audioStore.load(audioPath) ?: return

        if (!audioFocusManager.requestFocus()) return

        _state.value = ConversationState.Playing(message.text)
        scope.launch {
            audioPlayer.play(audioData)
            _state.value = ConversationState.Idle
            audioFocusManager.abandonFocus()
        }
    }

    fun stopPlayback() {
        audioPlayer.stop()
        audioFocusManager.abandonFocus()
        _state.value = ConversationState.Idle
    }

    fun retry() {
        _state.value = ConversationState.Idle
    }

    fun dismiss() {
        _state.value = ConversationState.Idle
    }

    fun resetForTripSwitch() {
        audioRecorder.stopRecording()
        recordingJob?.cancel()
        recordingJob = null
        audioPlayer.stop()
        pcmChunks.clear()
        pendingWavData = null
        _messages.value = emptyList()
        _state.value = ConversationState.Idle
    }

    private fun addMessage(message: Message) {
        _messages.value = _messages.value + message
    }

    private fun mergePcmChunks(): ByteArray {
        val totalSize = pcmChunks.sumOf { it.size }
        val result = ByteArray(totalSize)
        var offset = 0
        for (chunk in pcmChunks) {
            chunk.copyInto(result, offset)
            offset += chunk.size
        }
        return result
    }
}

/** Thin wrapper so PcmToWavConverter (an object) can be injected in tests. */
class PcmToWavConverterWrapper @Inject constructor() {
    fun convert(pcmData: ByteArray): ByteArray = PcmToWavConverter.convert(pcmData)
}
