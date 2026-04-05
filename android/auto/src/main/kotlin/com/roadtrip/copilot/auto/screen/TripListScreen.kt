package com.roadtrip.copilot.auto.screen

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.*
import androidx.lifecycle.DefaultLifecycleObserver
import androidx.lifecycle.LifecycleOwner
import com.roadtrip.copilot.auto.di.AutoEntryPoint
import com.roadtrip.copilot.core.network.TripRepository
import com.roadtrip.copilot.core.network.dto.TripInfo
import com.roadtrip.copilot.core.state.ConversationRepository
import dagger.hilt.android.EntryPointAccessors
import kotlinx.coroutines.*
import kotlinx.coroutines.flow.collectLatest

class TripListScreen(carContext: CarContext) : Screen(carContext) {

    private val tripRepository: TripRepository
    private val conversationRepository: ConversationRepository
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var trips: List<TripInfo> = emptyList()
    private var isLoading: Boolean = true
    private var isSwitching: Boolean = false

    init {
        val entryPoint = EntryPointAccessors.fromApplication(
            carContext.applicationContext,
            AutoEntryPoint::class.java
        )
        tripRepository = entryPoint.tripRepository()
        conversationRepository = entryPoint.conversationRepository()

        lifecycle.addObserver(object : DefaultLifecycleObserver {
            override fun onCreate(owner: LifecycleOwner) {
                scope.launch {
                    tripRepository.trips.collectLatest { list ->
                        trips = list
                        invalidate()
                    }
                }
                scope.launch {
                    tripRepository.isLoading.collectLatest { loading ->
                        isLoading = loading
                        invalidate()
                    }
                }
                scope.launch {
                    tripRepository.refresh()
                }
            }

            override fun onDestroy(owner: LifecycleOwner) {
                scope.cancel()
            }
        })
    }

    override fun onGetTemplate(): Template {
        if (isSwitching || (isLoading && trips.isEmpty())) {
            return ListTemplate.Builder()
                .setTitle("Trips")
                .setHeaderAction(Action.BACK)
                .setLoading(true)
                .build()
        }

        if (trips.isEmpty()) {
            return MessageTemplate.Builder("No trips found.\nCreate one in the phone app.")
                .setTitle("Trips")
                .setHeaderAction(Action.BACK)
                .addAction(
                    Action.Builder()
                        .setTitle("Refresh")
                        .setOnClickListener {
                            scope.launch { tripRepository.refresh() }
                        }
                        .build()
                )
                .build()
        }

        val listBuilder = ItemList.Builder()

        // Android Auto caps list items at 6
        trips.take(6).forEach { trip ->
            val subtitle = "${"%.2f".format(trip.spend_limit_usd)} USDC limit"

            listBuilder.addItem(
                Row.Builder()
                    .setTitle(trip.name)
                    .addText(subtitle)
                    .setOnClickListener {
                        isSwitching = true
                        invalidate()
                        scope.launch {
                            conversationRepository.resetForTripSwitch()
                            tripRepository.setActiveTrip(trip.id)
                            isSwitching = false
                            screenManager.push(MainScreen(carContext))
                        }
                    }
                    .build()
            )
        }

        val actionStrip = ActionStrip.Builder()
            .addAction(
                Action.Builder()
                    .setTitle("Refresh")
                    .setOnClickListener {
                        scope.launch { tripRepository.refresh() }
                    }
                    .build()
            )
            .build()

        return ListTemplate.Builder()
            .setTitle("Trips")
            .setHeaderAction(Action.BACK)
            .setSingleList(listBuilder.build())
            .setActionStrip(actionStrip)
            .build()
    }
}
