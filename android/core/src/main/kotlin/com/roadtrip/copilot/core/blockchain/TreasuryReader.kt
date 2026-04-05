package com.roadtrip.copilot.core.blockchain

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.web3j.protocol.Web3j
import org.web3j.protocol.core.DefaultBlockParameterName
import org.web3j.protocol.core.methods.request.Transaction
import java.math.BigInteger
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TreasuryReader @Inject constructor(private val web3j: Web3j) {

    companion object {
        // balanceOf(address) selector
        private const val BALANCE_OF_SELECTOR = "0x70a08231"
        // getBalance(uint256) selector
        private const val GET_BALANCE_SELECTOR = "0x3a51cf25"
        private const val USDC_DECIMALS = 6
    }

    /**
     * Encode an address as a 32-byte padded hex argument (without 0x prefix).
     */
    private fun encodeAddress(address: String): String {
        val stripped = address.removePrefix("0x").lowercase()
        return stripped.padStart(64, '0')
    }

    /**
     * Encode a uint256 as a 32-byte padded hex argument (without 0x prefix).
     */
    private fun encodeUint256(value: BigInteger): String {
        return value.toString(16).padStart(64, '0')
    }

    /**
     * Decode a uint256 from a 32-byte padded hex response.
     */
    private fun decodeUint256(hex: String): BigInteger {
        val cleaned = hex.removePrefix("0x").trimStart('0')
        return if (cleaned.isEmpty()) BigInteger.ZERO else BigInteger(cleaned, 16)
    }

    private suspend fun ethCall(to: String, data: String): String {
        return withContext(Dispatchers.IO) {
            val response = web3j.ethCall(
                Transaction.createEthCallTransaction(null, to, data),
                DefaultBlockParameterName.LATEST
            ).send()
            response.value ?: "0x"
        }
    }

    suspend fun getBalance(tripId: BigInteger): BigInteger {
        return try {
            val data = GET_BALANCE_SELECTOR + encodeUint256(tripId)
            val result = ethCall(ContractConstants.TREASURY_ADDRESS, data)
            decodeUint256(result)
        } catch (_: Exception) {
            BigInteger.ZERO
        }
    }

    suspend fun getUsdcBalance(address: String): BigInteger {
        return try {
            val data = BALANCE_OF_SELECTOR + encodeAddress(address)
            val result = ethCall(ContractConstants.USDC_ADDRESS, data)
            decodeUint256(result)
        } catch (_: Exception) {
            BigInteger.ZERO
        }
    }

    suspend fun getMemberDeposit(tripId: BigInteger, member: String): BigInteger {
        return try {
            // getMemberDeposit(uint256, address) selector
            val selector = "0x7d5b4a3d"
            val data = selector + encodeUint256(tripId) + encodeAddress(member)
            val result = ethCall(ContractConstants.TREASURY_ADDRESS, data)
            decodeUint256(result)
        } catch (_: Exception) {
            BigInteger.ZERO
        }
    }
}
