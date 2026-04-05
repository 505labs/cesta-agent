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
