package com.roadtrip.copilot.core.di

import com.roadtrip.copilot.core.audio.AudioPlayer
import com.roadtrip.copilot.core.audio.AudioPlayerImpl
import com.roadtrip.copilot.core.audio.AudioRecorder
import com.roadtrip.copilot.core.audio.AudioRecorderImpl
import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent

@Module
@InstallIn(SingletonComponent::class)
abstract class CoreModule {

    @Binds
    abstract fun bindAudioRecorder(impl: AudioRecorderImpl): AudioRecorder

    @Binds
    abstract fun bindAudioPlayer(impl: AudioPlayerImpl): AudioPlayer
}
