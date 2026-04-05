package com.roadtrip.copilot.core.di

import com.roadtrip.copilot.core.blockchain.ContractConstants
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import org.web3j.protocol.Web3j
import org.web3j.protocol.http.HttpService
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object BlockchainModule {
    @Provides
    @Singleton
    fun provideWeb3j(): Web3j = Web3j.build(HttpService(ContractConstants.RPC_URL))
}
