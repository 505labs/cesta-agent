package com.roadtrip.copilot.core.network

import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.Response
import retrofit2.http.*

interface OrchestratorApiService {
    // Auth
    @GET("v1/auth/nonce")
    suspend fun getNonce(): Response<ResponseBody>

    @POST("v1/auth/verify")
    suspend fun verifySiwe(@Body body: RequestBody): Response<ResponseBody>

    // Trips
    @POST("v1/trips")
    suspend fun createTrip(@Body body: RequestBody): Response<ResponseBody>

    @GET("v1/trips")
    suspend fun listTrips(): Response<ResponseBody>

    @GET("v1/trips/{trip_id}")
    suspend fun getTrip(@Path("trip_id") tripId: Int): Response<ResponseBody>

    @POST("v1/trips/{trip_id}/join")
    suspend fun joinTrip(@Path("trip_id") tripId: Int, @Body body: RequestBody): Response<ResponseBody>

    // Payments
    @POST("v1/trips/{trip_id}/payments")
    suspend fun createPayment(@Path("trip_id") tripId: Int, @Body body: RequestBody): Response<ResponseBody>

    @GET("v1/trips/{trip_id}/payments")
    suspend fun listPayments(@Path("trip_id") tripId: Int): Response<ResponseBody>

    @POST("v1/trips/{trip_id}/payments/{payment_id}/approve")
    suspend fun approvePayment(@Path("trip_id") tripId: Int, @Path("payment_id") paymentId: String): Response<ResponseBody>

    // Voice
    @Multipart
    @POST("v1/voice/converse")
    suspend fun voiceConverse(
        @Part audio: MultipartBody.Part,
        @Part("trip_id") tripId: RequestBody?,
        @Part("detail_level") detailLevel: RequestBody
    ): Response<ResponseBody>

    // Text
    @POST("v1/text/converse")
    suspend fun textConverse(@Body body: RequestBody): Response<ResponseBody>

    // Health
    @GET("health")
    suspend fun healthCheck(): Response<ResponseBody>
}
