package com.roadtrip.copilot.core.auth

import android.content.SharedPreferences
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthTokenStore @Inject constructor(private val prefs: SharedPreferences) {
    companion object {
        private const val KEY_TOKEN = "auth_token"
        private const val KEY_WALLET = "auth_wallet"
    }

    fun saveToken(token: String, walletAddress: String) {
        prefs.edit()
            .putString(KEY_TOKEN, token)
            .putString(KEY_WALLET, walletAddress.lowercase())
            .apply()
    }

    fun getToken(): String? = prefs.getString(KEY_TOKEN, null)
    fun getWalletAddress(): String? = prefs.getString(KEY_WALLET, null)

    fun clear() {
        prefs.edit().remove(KEY_TOKEN).remove(KEY_WALLET).apply()
    }

    fun isAuthenticated(): Boolean = !getToken().isNullOrBlank()
}
