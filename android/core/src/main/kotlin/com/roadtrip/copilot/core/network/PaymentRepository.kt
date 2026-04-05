package com.roadtrip.copilot.core.network

import com.roadtrip.copilot.core.network.dto.PaymentInfo
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class PaymentRepository @Inject constructor(
    private val apiClient: OrchestratorApiClient
) {
    private val _payments = MutableStateFlow<List<PaymentInfo>>(emptyList())
    val payments: StateFlow<List<PaymentInfo>> = _payments.asStateFlow()

    suspend fun refresh(tripId: Int) {
        apiClient.listPayments(tripId).fold(
            onSuccess = { _payments.value = it },
            onFailure = { /* keep existing */ }
        )
    }

    suspend fun createPayment(tripId: Int, amount: String, recipient: String, category: String?, description: String?): Result<PaymentInfo> {
        val result = apiClient.createPayment(tripId, amount, recipient, category, description)
        result.onSuccess { refresh(tripId) }
        return result
    }

    suspend fun approvePayment(tripId: Int, paymentId: String): Result<Unit> {
        val result = apiClient.approvePayment(tripId, paymentId)
        result.onSuccess { refresh(tripId) }
        return result
    }
}
