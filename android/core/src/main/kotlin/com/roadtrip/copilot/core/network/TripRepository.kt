package com.roadtrip.copilot.core.network

import com.roadtrip.copilot.core.network.dto.TripInfo
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class TripRepository @Inject constructor(
    private val apiClient: OrchestratorApiClient
) {
    private val _trips = MutableStateFlow<List<TripInfo>>(emptyList())
    val trips: StateFlow<List<TripInfo>> = _trips.asStateFlow()

    private val _activeTripId = MutableStateFlow<Int?>(null)
    val activeTripId: StateFlow<Int?> = _activeTripId.asStateFlow()

    private val _isLoading = MutableStateFlow(false)
    val isLoading: StateFlow<Boolean> = _isLoading.asStateFlow()

    val activeTrip: TripInfo?
        get() = _activeTripId.value?.let { id -> _trips.value.find { it.id == id } }

    val activeTripName: String?
        get() = activeTrip?.name

    suspend fun refresh() {
        _isLoading.value = true
        apiClient.listTrips().fold(
            onSuccess = { _trips.value = it },
            onFailure = { /* keep existing */ }
        )
        _isLoading.value = false
    }

    suspend fun createTrip(name: String, spendLimit: Double): Result<TripInfo> {
        val result = apiClient.createTrip(name, spendLimit)
        result.onSuccess { refresh() }
        return result
    }

    suspend fun joinTrip(tripId: Int, displayName: String? = null): Result<Unit> {
        val result = apiClient.joinTrip(tripId, displayName)
        result.onSuccess { refresh() }
        return result
    }

    fun setActiveTrip(tripId: Int) {
        _activeTripId.value = tripId
    }

    suspend fun getTrip(tripId: Int): Result<TripInfo> {
        return apiClient.getTrip(tripId)
    }
}
