package com.roadtrip.copilot.auto

import android.content.Intent
import androidx.car.app.Screen
import androidx.car.app.Session
import com.roadtrip.copilot.auto.di.AutoEntryPoint
import com.roadtrip.copilot.auto.screen.AuthPromptScreen
import com.roadtrip.copilot.auto.screen.TripListScreen
import dagger.hilt.android.EntryPointAccessors

class RoadTripSession : Session() {

    override fun onCreateScreen(intent: Intent): Screen {
        val entryPoint = EntryPointAccessors.fromApplication(
            carContext.applicationContext,
            AutoEntryPoint::class.java
        )
        val authRepository = entryPoint.authRepository()

        return if (authRepository.isAuthenticated) {
            TripListScreen(carContext)
        } else {
            AuthPromptScreen(carContext)
        }
    }
}
