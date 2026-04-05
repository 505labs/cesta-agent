package com.roadtrip.copilot.auto.screen

import androidx.car.app.CarContext
import androidx.car.app.Screen
import androidx.car.app.model.*
import com.roadtrip.copilot.auto.di.AutoEntryPoint
import dagger.hilt.android.EntryPointAccessors

class AuthPromptScreen(carContext: CarContext) : Screen(carContext) {

    private val authRepository = EntryPointAccessors.fromApplication(
        carContext.applicationContext,
        AutoEntryPoint::class.java
    ).authRepository()

    override fun onGetTemplate(): Template {
        return MessageTemplate.Builder("Sign in on your phone app to get started")
            .setTitle("RoadTrip Co-Pilot")
            .setHeaderAction(Action.APP_ICON)
            .addAction(
                Action.Builder()
                    .setTitle("Refresh")
                    .setOnClickListener {
                        // Re-check auth — if now authenticated, replace with TripListScreen
                        if (authRepository.isAuthenticated) {
                            screenManager.push(TripListScreen(carContext))
                        } else {
                            invalidate()
                        }
                    }
                    .build()
            )
            .build()
    }
}
