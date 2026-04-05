package com.roadtrip.copilot.core.di

import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
object AudioModule {
    // AudioFocusManager is constructor-injected via @Inject + @Singleton
    // AudioForegroundService is started/stopped directly, not injected
}
