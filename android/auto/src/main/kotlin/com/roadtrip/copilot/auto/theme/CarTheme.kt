package com.roadtrip.copilot.auto.theme

import android.graphics.Color
import androidx.car.app.model.CarColor

/**
 * Centralized color constants for the Android Auto UI.
 * Each CarColor defines a day-mode and dark-mode variant.
 */
object CarTheme {

    /** Amber primary – used for brand accents and primary actions */
    val PRIMARY: CarColor = CarColor.createCustom(
        Color.parseColor("#D97706"),   // day
        Color.parseColor("#F59E0B")    // dark
    )

    /** Teal accent – used for secondary/success indicators */
    val ACCENT: CarColor = CarColor.createCustom(
        Color.parseColor("#059669"),
        Color.parseColor("#10B981")
    )

    /** Green – used for active/success states */
    val SUCCESS: CarColor = CarColor.createCustom(
        Color.parseColor("#16A34A"),
        Color.parseColor("#22C55E")
    )

    /** Red – used for errors and destructive actions */
    val ERROR: CarColor = CarColor.createCustom(
        Color.parseColor("#DC2626"),
        Color.parseColor("#EF4444")
    )

    /** Red accent – used for recording state */
    val RECORDING: CarColor = CarColor.createCustom(
        Color.parseColor("#EF4444"),
        Color.parseColor("#F87171")
    )

    /** Blue – used for playback/info states */
    val PLAYING: CarColor = CarColor.createCustom(
        Color.parseColor("#2563EB"),
        Color.parseColor("#3B82F6")
    )

    /** Muted gray – used for inactive/disabled elements */
    val MUTED: CarColor = CarColor.createCustom(
        Color.parseColor("#6B7280"),
        Color.parseColor("#9CA3AF")
    )
}
