package com.roadtrip.copilot.auto.screen

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.*
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.roadtrip.copilot.auto.di.AutoEntryPoint
import com.roadtrip.copilot.core.state.ConversationRepository
import com.roadtrip.copilot.core.state.ConversationState
import com.roadtrip.copilot.core.state.Message
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collectLatest

class ConversationScreen(carContext: CarContext) : Screen(carContext) {

    private val repository: ConversationRepository
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var messages: List<Message> = emptyList()
    private var isPlaying = false

    init {
        val entryPoint = EntryPointAccessors.fromApplication(
            carContext.applicationContext,
            AutoEntryPoint::class.java
        )
        repository = entryPoint.conversationRepository()

        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onCreate(owner: LifecycleOwner) {
                scope.launch {
                    repository.messages.collectLatest { msgs ->
                        messages = msgs
                        invalidate()
                    }
                }
                scope.launch {
                    repository.state.collectLatest { state ->
                        isPlaying = state is ConversationState.Playing
                        invalidate()
                    }
                }
            }

            override fun onDestroy(owner: LifecycleOwner) {
                scope.cancel()
            }
        })
    }

    override fun onGetTemplate(): Template {
        if (messages.isEmpty()) {
            return MessageTemplate.Builder("No conversation history yet.")
                .setTitle("History")
                .setHeaderAction(Action.BACK)
                .build()
        }

        val listBuilder = ItemList.Builder()

        // Show last 10 messages (Android Auto list limit)
        messages.takeLast(10).forEach { message ->
            val prefix = when (message.role) {
                Message.Role.USER -> "You"
                Message.Role.ASSISTANT -> "Co-Pilot"
            }

            val rowBuilder = Row.Builder()
                .setTitle(prefix)
                .addText(truncate(message.text, 100))

            // Make assistant messages with audio tappable for replay
            if (message.role == Message.Role.ASSISTANT && message.audioFile != null) {
                rowBuilder.setOnClickListener {
                    if (isPlaying) {
                        repository.stopPlayback()
                    } else {
                        repository.replayMessage(message)
                    }
                }
            }

            listBuilder.addItem(rowBuilder.build())
        }

        val builder = ListTemplate.Builder()
            .setTitle("History")
            .setHeaderAction(Action.BACK)
            .setSingleList(listBuilder.build())

        if (isPlaying) {
            builder.setActionStrip(
                ActionStrip.Builder()
                    .addAction(
                        Action.Builder()
                            .setTitle("Stop")
                            .setOnClickListener { repository.stopPlayback() }
                            .build()
                    )
                    .build()
            )
        }

        return builder.build()
    }

    private fun truncate(text: String, maxLength: Int): String {
        return if (text.length > maxLength) text.take(maxLength - 3) + "..." else text
    }
}
