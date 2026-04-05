package com.roadtrip.copilot.core.di

import android.content.Context
import android.content.SharedPreferences
import com.roadtrip.copilot.core.auth.AuthTokenStore
import com.roadtrip.copilot.core.network.OrchestratorApiService
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.Interceptor
import okhttp3.OkHttpClient
import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.moshi.MoshiConverterFactory
import java.util.concurrent.TimeUnit
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    private const val PREFS_NAME = "roadtrip_copilot_prefs"
    private const val KEY_BASE_URL = "base_url"
    private const val DEFAULT_BASE_URL = ""
    private const val PLACEHOLDER_BASE_URL = "http://localhost/"

    @Provides
    @Singleton
    fun provideSharedPreferences(@ApplicationContext context: Context): SharedPreferences {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
    }

    @Provides
    @Singleton
    fun provideAuthTokenStore(prefs: SharedPreferences): AuthTokenStore {
        return AuthTokenStore(prefs)
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(prefs: SharedPreferences, authTokenStore: AuthTokenStore): OkHttpClient {
        val dynamicBaseUrlInterceptor = Interceptor { chain ->
            val originalRequest = chain.request()
            val baseUrl = prefs.getString(KEY_BASE_URL, DEFAULT_BASE_URL)?.trim() ?: DEFAULT_BASE_URL
            val parsed = baseUrl.toHttpUrlOrNull() ?: PLACEHOLDER_BASE_URL.toHttpUrlOrNull()!!
            val newUrl = originalRequest.url.newBuilder()
                .scheme(parsed.scheme)
                .host(parsed.host)
                .port(parsed.port)
                .build()
            val newRequest = originalRequest.newBuilder().url(newUrl).build()
            chain.proceed(newRequest)
        }

        val authInterceptor = Interceptor { chain ->
            val token = authTokenStore.getToken()
            val request = if (!token.isNullOrBlank()) {
                chain.request().newBuilder()
                    .addHeader("Authorization", "Bearer $token")
                    .build()
            } else {
                chain.request()
            }
            chain.proceed(request)
        }

        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.HEADERS
        }

        return OkHttpClient.Builder()
            .addInterceptor(dynamicBaseUrlInterceptor)
            .addInterceptor(authInterceptor)
            .addInterceptor(loggingInterceptor)
            .connectTimeout(30, TimeUnit.SECONDS)
            .readTimeout(120, TimeUnit.SECONDS)
            .writeTimeout(30, TimeUnit.SECONDS)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(PLACEHOLDER_BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(MoshiConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideOrchestratorApiService(retrofit: Retrofit): OrchestratorApiService {
        return retrofit.create(OrchestratorApiService::class.java)
    }
}
