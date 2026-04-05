package com.roadtrip.copilot.core.auth

import com.roadtrip.copilot.core.network.OrchestratorApiClient
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

sealed class AuthState {
    data object Unauthenticated : AuthState()
    data class Authenticated(val walletAddress: String) : AuthState()
}

@Singleton
class AuthRepository @Inject constructor(
    private val apiClient: OrchestratorApiClient,
    private val tokenStore: AuthTokenStore
) {
    companion object {
        // Hardcoded demo wallet for hackathon — skip SIWE auth
        const val DEMO_WALLET = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
    }

    // Always start authenticated with demo wallet for hackathon
    private val _authState = MutableStateFlow<AuthState>(
        AuthState.Authenticated(tokenStore.getWalletAddress() ?: DEMO_WALLET)
    )
    val authState: StateFlow<AuthState> = _authState.asStateFlow()

    // Always true for hackathon demo
    val isAuthenticated: Boolean
        get() = true

    suspend fun signIn(walletAddress: String, signMessage: suspend (String) -> String): Result<Unit> {
        return try {
            val nonce = apiClient.getNonce().getOrThrow()
            val message = SiweMessageBuilder.build(address = walletAddress, nonce = nonce)
            val signature = signMessage(message)
            val verifyResult = apiClient.verifySiwe(message, signature).getOrThrow()
            tokenStore.saveToken(verifyResult.token, verifyResult.wallet_address)
            _authState.value = AuthState.Authenticated(verifyResult.wallet_address)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun pasteToken(token: String, walletAddress: String) {
        tokenStore.saveToken(token, walletAddress)
        _authState.value = AuthState.Authenticated(walletAddress)
    }

    fun signOut() {
        tokenStore.clear()
        _authState.value = AuthState.Authenticated(DEMO_WALLET)
    }
}
