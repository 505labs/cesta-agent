# Keep Moshi adapters
-keep class com.roadtrip.copilot.core.network.dto.** { *; }
-keepclassmembers class com.roadtrip.copilot.core.network.dto.** { *; }

# Keep Car App Service
-keep class com.roadtrip.copilot.auto.RoadTripCarAppService { *; }

# OkHttp
-dontwarn okhttp3.**
-dontwarn okio.**

# Retrofit
-keepattributes Signature
-keepattributes *Annotation*
-keep class retrofit2.** { *; }

# Suppress warnings for missing optional dependencies
-dontwarn com.fasterxml.jackson.core.JsonParser$Feature
-dontwarn com.fasterxml.jackson.databind.DeserializationFeature
-dontwarn com.fasterxml.jackson.databind.Module
-dontwarn com.fasterxml.jackson.databind.ObjectMapper
-dontwarn com.fasterxml.jackson.databind.deser.BeanDeserializerModifier
-dontwarn com.fasterxml.jackson.databind.module.SimpleModule
-dontwarn io.reactivex.Scheduler
-dontwarn io.reactivex.schedulers.Schedulers
-dontwarn org.slf4j.Logger
-dontwarn org.slf4j.LoggerFactory
