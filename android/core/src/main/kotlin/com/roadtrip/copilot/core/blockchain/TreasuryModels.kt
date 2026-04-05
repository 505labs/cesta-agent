package com.roadtrip.copilot.core.blockchain

import java.math.BigInteger

data class TreasuryTrip(
    val organizer: String,
    val agent: String,
    val usdc: String,
    val spendLimit: BigInteger,
    val dailyCap: BigInteger,
    val totalDeposited: BigInteger,
    val totalSpent: BigInteger,
    val status: Int, // 0=Active, 1=Settled
    val memberCount: BigInteger
)

data class TreasurySpend(
    val recipient: String,
    val amount: BigInteger,
    val category: String,
    val description: String,
    val timestamp: BigInteger
)
