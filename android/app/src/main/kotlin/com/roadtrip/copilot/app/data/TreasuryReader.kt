package com.roadtrip.copilot.app.data

import android.content.SharedPreferences
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.json.JSONObject
import java.math.BigInteger
import java.net.HttpURLConnection
import java.net.URL
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TreasuryReader @Inject constructor(
    private val prefs: SharedPreferences
) {
    companion object {
        private const val USDC_DECIMALS = 6
        private val USDC_DIVISOR = BigInteger.TEN.pow(USDC_DECIMALS)
        private const val DEFAULT_BASE_URL = "http://10.0.2.2:8080"
    }

    /**
     * Fetches the USDC balance from the orchestrator's treasury endpoint.
     * Returns a formatted string like "12.50" or null on failure.
     */
    suspend fun getBalance(treasuryAddress: String?): String? {
        if (treasuryAddress.isNullOrBlank()) return null
        return withContext(Dispatchers.IO) {
            try {
                val baseUrl = prefs.getString("base_url", DEFAULT_BASE_URL)?.trimEnd('/') ?: DEFAULT_BASE_URL
                val url = URL("$baseUrl/v1/treasury/$treasuryAddress/balance")
                val connection = url.openConnection() as HttpURLConnection
                connection.connectTimeout = 5000
                connection.readTimeout = 5000
                connection.requestMethod = "GET"
                // Add auth token if available
                val token = prefs.getString("auth_token", null)
                if (!token.isNullOrBlank()) {
                    connection.setRequestProperty("Authorization", "Bearer $token")
                }
                try {
                    if (connection.responseCode != 200) return@withContext null
                    val body = connection.inputStream.bufferedReader().readText()
                    val json = JSONObject(body)
                    // Expected: { "balance": "12500000" } (raw USDC with 6 decimals)
                    val raw = json.optString("balance", null) ?: return@withContext null
                    val bigInt = BigInteger(raw)
                    val whole = bigInt.divide(USDC_DIVISOR)
                    val remainder = bigInt.remainder(USDC_DIVISOR)
                    val decimals = remainder.toLong().toString().padStart(USDC_DECIMALS, '0').take(2)
                    "$whole.$decimals"
                } finally {
                    connection.disconnect()
                }
            } catch (_: Exception) {
                null
            }
        }
    }
}
