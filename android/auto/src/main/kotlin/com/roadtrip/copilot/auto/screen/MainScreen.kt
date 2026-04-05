package com.roadtrip.copilot.auto.screen

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.*
import androidx.core.graphics.drawable.IconCompat
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.roadtrip.copilot.auto.di.AutoEntryPoint
import com.roadtrip.copilot.core.audio.AudioForegroundService
import com.roadtrip.copilot.core.network.TripRepository
import com.roadtrip.copilot.core.state.ConversationState
import com.roadtrip.copilot.core.state.ConversationRepository
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collectLatest

class MainScreen(carContext: CarContext) : Screen(carContext) {

    private val repository: ConversationRepository
    private val tripRepository: TripRepository
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var currentState: ConversationState = ConversationState.Idle

    init {
        val entryPoint = EntryPointAccessors.fromApplication(
            carContext.applicationContext,
            AutoEntryPoint::class.java
        )
        repository = entryPoint.conversationRepository()
        tripRepository = entryPoint.tripRepository()

        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onCreate(owner: LifecycleOwner) {
                scope.launch {
                    repository.state.collectLatest { state ->
                        currentState = state
                        invalidate()
                    }
                }
            }

            override fun onResume(owner: LifecycleOwner) {
                scope.launch {
                    tripRepository.refresh()
                }
            }

            override fun onDestroy(owner: LifecycleOwner) {
                scope.cancel()
            }
        })
    }

    private val screenTitle: String
        get() {
            val name = tripRepository.activeTripName
            return if (name != null) "Co-Pilot — $name" else "Co-Pilot"
        }

    override fun onGetTemplate(): Template {
        return when (val state = currentState) {
            is ConversationState.Idle -> buildIdleTemplate()
            is ConversationState.Recording -> buildRecordingTemplate()
            is ConversationState.ReviewingRecording -> buildReviewTemplate(state)
            is ConversationState.Processing -> buildProcessingTemplate()
            is ConversationState.Playing -> buildPlayingTemplate(state)
            is ConversationState.Error -> buildErrorTemplate(state)
        }
    }

    private fun buildIdleTemplate(): Template {
        val actionStrip = ActionStrip.Builder()
            .addAction(
                Action.Builder()
                    .setTitle("Trips")
                    .setOnClickListener {
                        screenManager.push(TripListScreen(carContext))
                    }
                    .build()
            )
            .addAction(
                Action.Builder()
                    .setIcon(
                        CarIcon.Builder(IconCompat.createWithResource(carContext, android.R.drawable.ic_menu_recent_history))
                            .build()
                    )
                    .setOnClickListener {
                        screenManager.push(ConversationScreen(carContext))
                    }
                    .build()
            )
            .build()

        if (tripRepository.activeTripName == null) {
            return MessageTemplate.Builder("No active trip.\nTap Trips to select one.")
                .setTitle(screenTitle)
                .setHeaderAction(Action.BACK)
                .setActionStrip(actionStrip)
                .addAction(
                    Action.Builder()
                        .setTitle("Trips")
                        .setOnClickListener {
                            screenManager.push(TripListScreen(carContext))
                        }
                        .build()
                )
                .build()
        }

        val lastMessage = repository.lastAssistantMessage
        val paneBuilder = Pane.Builder()

        if (lastMessage != null) {
            paneBuilder.addRow(
                Row.Builder()
                    .setTitle("Last response")
                    .addText(truncate(lastMessage, 120))
                    .build()
            )
        } else {
            paneBuilder.addRow(
                Row.Builder()
                    .setTitle("Ready")
                    .addText("Tap the mic to talk to Co-Pilot")
                    .build()
            )
        }

        paneBuilder.addAction(
            Action.Builder()
                .setTitle("Record")
                .setIcon(
                    CarIcon.Builder(IconCompat.createWithResource(carContext, android.R.drawable.ic_btn_speak_now))
                        .build()
                )
                .setOnClickListener {
                    AudioForegroundService.start(carContext)
                    repository.startRecording()
                }
                .build()
        )

        return PaneTemplate.Builder(paneBuilder.build())
            .setTitle(screenTitle)
            .setHeaderAction(Action.BACK)
            .setActionStrip(actionStrip)
            .build()
    }

    private fun buildRecordingTemplate(): Template {
        return MessageTemplate.Builder("Listening...")
            .setTitle(screenTitle)
            .setHeaderAction(Action.APP_ICON)
            .setIcon(
                CarIcon.Builder(IconCompat.createWithResource(carContext, android.R.drawable.ic_btn_speak_now))
                    .build()
            )
            .addAction(
                Action.Builder()
                    .setTitle("Done")
                    .setOnClickListener {
                        AudioForegroundService.stop(carContext)
                        repository.stopRecordingForReview()
                    }
                    .build()
            )
            .addAction(
                Action.Builder()
                    .setTitle("Cancel")
                    .setOnClickListener {
                        AudioForegroundService.stop(carContext)
                        repository.cancelRecording()
                    }
                    .build()
            )
            .build()
    }

    private fun buildReviewTemplate(state: ConversationState.ReviewingRecording): Template {
        val seconds = state.durationSeconds
        val label = if (seconds > 0) "Recorded ${seconds}s" else "Recorded"

        return MessageTemplate.Builder("$label — Send to Co-Pilot?")
            .setTitle(screenTitle)
            .setHeaderAction(Action.APP_ICON)
            .addAction(
                Action.Builder()
                    .setTitle("Send")
                    .setOnClickListener {
                        repository.approveAndSend()
                    }
                    .build()
            )
            .addAction(
                Action.Builder()
                    .setTitle("Discard")
                    .setOnClickListener {
                        repository.discardRecording()
                    }
                    .build()
            )
            .build()
    }

    private fun buildProcessingTemplate(): Template {
        return MessageTemplate.Builder("Thinking...")
            .setTitle(screenTitle)
            .setHeaderAction(Action.APP_ICON)
            .setLoading(true)
            .build()
    }

    private fun buildPlayingTemplate(state: ConversationState.Playing): Template {
        val paneBuilder = Pane.Builder()

        paneBuilder.addRow(
            Row.Builder()
                .setTitle("Co-Pilot is speaking")
                .addText(truncate(state.transcript ?: "Playing response...", 120))
                .build()
        )

        paneBuilder.addAction(
            Action.Builder()
                .setTitle("Stop")
                .setOnClickListener {
                    AudioForegroundService.stop(carContext)
                    repository.stopPlayback()
                }
                .build()
        )

        return PaneTemplate.Builder(paneBuilder.build())
            .setTitle(screenTitle)
            .setHeaderAction(Action.APP_ICON)
            .build()
    }

    private fun buildErrorTemplate(state: ConversationState.Error): Template {
        return MessageTemplate.Builder(truncate(state.message, 200))
            .setTitle("Error")
            .setHeaderAction(Action.APP_ICON)
            .addAction(
                Action.Builder()
                    .setTitle("Try Again")
                    .setOnClickListener { repository.retry() }
                    .build()
            )
            .addAction(
                Action.Builder()
                    .setTitle("Dismiss")
                    .setOnClickListener { repository.dismiss() }
                    .build()
            )
            .build()
    }

    private fun truncate(text: String, maxLength: Int): String {
        return if (text.length > maxLength) text.take(maxLength - 3) + "..." else text
    }
}
