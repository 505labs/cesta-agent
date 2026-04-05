package com.roadtrip.copilot.core.network

import com.roadtrip.copilot.core.network.dto.*
import com.squareup.moshi.Moshi
import com.squareup.moshi.Types
import com.squareup.moshi.kotlin.reflect.KotlinJsonAdapterFactory
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.toRequestBody
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class OrchestratorApiClient @Inject constructor(
    private val apiService: OrchestratorApiService
) {
    private val moshi: Moshi = Moshi.Builder().addLast(KotlinJsonAdapterFactory()).build()

    suspend fun sendAudio(wavData: ByteArray, tripId: Int?, detailLevel: String = "standard"): Result<AudioResponse> {
        return try {
            val audioPart = MultipartBody.Part.createFormData(
                "audio", "recording.wav",
                wavData.toRequestBody("audio/wav".toMediaType())
            )
            val tripIdBody = tripId?.toString()?.toRequestBody("text/plain".toMediaType())
            val detailLevelBody = detailLevel.toRequestBody("text/plain".toMediaType())

            val response = apiService.voiceConverse(audioPart, tripIdBody, detailLevelBody)

            if (!response.isSuccessful) {
                return Result.failure(Exception("Voice error ${response.code()}: ${response.errorBody()?.string()}"))
            }

            val contentType = response.headers()["Content-Type"] ?: ""
            if (contentType.contains("audio/wav") || contentType.contains("audio/x-wav")) {
                val audioBytes = response.body()?.bytes() ?: return Result.failure(Exception("Empty audio body"))
                val userTranscript = response.headers()["X-User-Transcript"]
                Result.success(AudioResponse(audioBytes, userTranscript, null))
            } else {
                // JSON fallback (TTS failed)
                val body = response.body()?.string() ?: return Result.failure(Exception("Empty response"))
                val json = moshi.adapter(VoiceConverseJsonResponse::class.java).fromJson(body)
                Result.success(AudioResponse(ByteArray(0), json?.user_transcript, json?.assistant_text))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // --- Async voice submit + poll ---

    suspend fun submitAudio(wavData: ByteArray, tripId: Int?, detailLevel: String = "standard"): Result<VoiceSubmitResponse> {
        return try {
            val audioPart = MultipartBody.Part.createFormData(
                "audio", "recording.wav",
                wavData.toRequestBody("audio/wav".toMediaType())
            )
            val tripIdBody = tripId?.toString()?.toRequestBody("text/plain".toMediaType())
            val detailLevelBody = detailLevel.toRequestBody("text/plain".toMediaType())

            val response = apiService.voiceSubmit(audioPart, tripIdBody, detailLevelBody)

            if (!response.isSuccessful) {
                return Result.failure(Exception("Submit error ${response.code()}: ${response.errorBody()?.string()}"))
            }

            val body = response.body()?.string() ?: return Result.failure(Exception("Empty response"))
            val parsed = moshi.adapter(VoiceSubmitResponse::class.java).fromJson(body)
                ?: return Result.failure(Exception("Parse error"))
            Result.success(parsed)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    /**
     * Poll for async voice result. Returns:
     * - AudioResponse with audio if completed with TTS
     * - AudioResponse with empty audio + assistant transcript if TTS failed
     * - null if still processing
     * - throws on error
     */
    suspend fun pollVoiceResult(requestId: String): Result<AudioResponse?> {
        return try {
            val response = apiService.voicePoll(requestId)

            if (!response.isSuccessful) {
                return Result.failure(Exception("Poll error ${response.code()}"))
            }

            val contentType = response.headers()["Content-Type"] ?: ""

            if (contentType.contains("audio/wav") || contentType.contains("audio/x-wav")) {
                // Completed with audio
                val audioBytes = response.body()?.bytes() ?: return Result.failure(Exception("Empty audio body"))
                val userTranscript = response.headers()["X-User-Transcript"]
                val assistantText = response.headers()["X-Assistant-Text"]
                Result.success(AudioResponse(audioBytes, userTranscript, assistantText))
            } else {
                // JSON response — either still processing, error, or completed without audio
                val body = response.body()?.string() ?: return Result.failure(Exception("Empty response"))
                val parsed = moshi.adapter(VoicePollResponse::class.java).fromJson(body)
                    ?: return Result.failure(Exception("Parse error"))

                when (parsed.status) {
                    "processing" -> Result.success(null) // still working
                    "completed" -> Result.success(AudioResponse(ByteArray(0), parsed.user_transcript, parsed.assistant_text))
                    "error" -> Result.failure(Exception(parsed.error ?: "Voice processing failed"))
                    else -> Result.failure(Exception("Unknown status: ${parsed.status}"))
                }
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    // Auth
    suspend fun getNonce(): Result<String> {
        return try {
            val response = apiService.getNonce()
            if (!response.isSuccessful) return Result.failure(Exception("Nonce error ${response.code()}"))
            val body = response.body()?.string() ?: return Result.failure(Exception("Empty response"))
            val parsed = moshi.adapter(NonceResponse::class.java).fromJson(body)
            Result.success(parsed?.nonce ?: "")
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun verifySiwe(message: String, signature: String): Result<VerifyResponse> {
        return try {
            val json = moshi.adapter(VerifyRequest::class.java).toJson(VerifyRequest(message, signature))
            val body = json.toRequestBody("application/json".toMediaType())
            val response = apiService.verifySiwe(body)
            if (!response.isSuccessful) return Result.failure(Exception("Verify error ${response.code()}: ${response.errorBody()?.string()}"))
            val respBody = response.body()?.string() ?: return Result.failure(Exception("Empty response"))
            val parsed = moshi.adapter(VerifyResponse::class.java).fromJson(respBody)
                ?: return Result.failure(Exception("Parse error"))
            Result.success(parsed)
        } catch (e: Exception) { Result.failure(e) }
    }

    // Trips
    suspend fun listTrips(): Result<List<TripInfo>> {
        return try {
            val response = apiService.listTrips()
            if (!response.isSuccessful) return Result.failure(Exception("Error ${response.code()}"))
            val body = response.body()?.string() ?: return Result.failure(Exception("Empty response"))
            val listType = Types.newParameterizedType(List::class.java, TripInfo::class.java)
            val parsed: List<TripInfo> = moshi.adapter<List<TripInfo>>(listType).fromJson(body) ?: emptyList()
            Result.success(parsed)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun getTrip(tripId: Int): Result<TripInfo> {
        return try {
            val response = apiService.getTrip(tripId)
            if (!response.isSuccessful) return Result.failure(Exception("Error ${response.code()}"))
            val body = response.body()?.string() ?: return Result.failure(Exception("Empty"))
            val parsed = moshi.adapter(TripInfo::class.java).fromJson(body) ?: return Result.failure(Exception("Parse error"))
            Result.success(parsed)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun createTrip(name: String, spendLimit: Double, contractTripId: Int? = null, treasuryAddress: String? = null): Result<TripInfo> {
        return try {
            val json = moshi.adapter(CreateTripRequest::class.java).toJson(CreateTripRequest(name, spendLimit, contractTripId, treasuryAddress))
            val body = json.toRequestBody("application/json".toMediaType())
            val response = apiService.createTrip(body)
            if (!response.isSuccessful) return Result.failure(Exception("Error ${response.code()}: ${response.errorBody()?.string()}"))
            val respBody = response.body()?.string() ?: return Result.failure(Exception("Empty"))
            val parsed = moshi.adapter(TripInfo::class.java).fromJson(respBody) ?: return Result.failure(Exception("Parse error"))
            Result.success(parsed)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun joinTrip(tripId: Int, displayName: String? = null): Result<Unit> {
        return try {
            val json = moshi.adapter(JoinTripRequest::class.java).toJson(JoinTripRequest(displayName))
            val body = json.toRequestBody("application/json".toMediaType())
            val response = apiService.joinTrip(tripId, body)
            if (!response.isSuccessful) return Result.failure(Exception("Error ${response.code()}: ${response.errorBody()?.string()}"))
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    // Payments
    suspend fun listPayments(tripId: Int): Result<List<PaymentInfo>> {
        return try {
            val response = apiService.listPayments(tripId)
            if (!response.isSuccessful) return Result.failure(Exception("Error ${response.code()}"))
            val body = response.body()?.string() ?: return Result.failure(Exception("Empty"))
            val listType = Types.newParameterizedType(List::class.java, PaymentInfo::class.java)
            val parsed: List<PaymentInfo> = moshi.adapter<List<PaymentInfo>>(listType).fromJson(body) ?: emptyList()
            Result.success(parsed)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun createPayment(tripId: Int, amount: String, recipient: String, category: String? = null, description: String? = null): Result<PaymentInfo> {
        return try {
            val json = moshi.adapter(CreatePaymentRequest::class.java).toJson(CreatePaymentRequest(amount, category, description, recipient))
            val body = json.toRequestBody("application/json".toMediaType())
            val response = apiService.createPayment(tripId, body)
            if (!response.isSuccessful) return Result.failure(Exception("Error ${response.code()}: ${response.errorBody()?.string()}"))
            val respBody = response.body()?.string() ?: return Result.failure(Exception("Empty"))
            val parsed = moshi.adapter(PaymentInfo::class.java).fromJson(respBody) ?: return Result.failure(Exception("Parse error"))
            Result.success(parsed)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun approvePayment(tripId: Int, paymentId: String): Result<Unit> {
        return try {
            val response = apiService.approvePayment(tripId, paymentId)
            if (!response.isSuccessful) return Result.failure(Exception("Error ${response.code()}: ${response.errorBody()?.string()}"))
            Result.success(Unit)
        } catch (e: Exception) { Result.failure(e) }
    }

    // Text converse
    suspend fun textConverse(text: String, tripId: Int? = null): Result<TextConverseResponse> {
        return try {
            val json = moshi.adapter(TextConverseRequest::class.java).toJson(TextConverseRequest(text, tripId))
            val body = json.toRequestBody("application/json".toMediaType())
            val response = apiService.textConverse(body)
            if (!response.isSuccessful) return Result.failure(Exception("Error ${response.code()}"))
            val respBody = response.body()?.string() ?: return Result.failure(Exception("Empty"))
            val parsed = moshi.adapter(TextConverseResponse::class.java).fromJson(respBody) ?: return Result.failure(Exception("Parse error"))
            Result.success(parsed)
        } catch (e: Exception) { Result.failure(e) }
    }

    suspend fun healthCheck(): Boolean {
        return try { apiService.healthCheck().isSuccessful } catch (_: Exception) { false }
    }
}
