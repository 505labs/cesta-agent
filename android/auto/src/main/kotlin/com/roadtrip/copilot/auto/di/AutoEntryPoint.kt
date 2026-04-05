package com.roadtrip.copilot.auto.di

import com.roadtrip.copilot.core.auth.AuthRepository
import com.roadtrip.copilot.core.blockchain.TreasuryReader
import com.roadtrip.copilot.core.network.TripRepository
import com.roadtrip.copilot.core.state.ConversationRepository
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@EntryPoint
@InstallIn(SingletonComponent::class)
interface AutoEntryPoint {
    fun conversationRepository(): ConversationRepository
    fun tripRepository(): TripRepository
    fun authRepository(): AuthRepository
    fun treasuryReader(): TreasuryReader
}
