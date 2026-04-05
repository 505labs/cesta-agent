package com.roadtrip.copilot.app.ui

import android.os.Bundle
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.AnimationUtils
import android.widget.FrameLayout
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.google.android.material.floatingactionbutton.FloatingActionButton
import com.roadtrip.copilot.app.R
import com.roadtrip.copilot.app.data.TreasuryReader
import com.roadtrip.copilot.core.audio.AudioForegroundService
import com.roadtrip.copilot.core.network.PaymentRepository
import com.roadtrip.copilot.core.network.TripRepository
import com.roadtrip.copilot.core.network.dto.PaymentInfo
import com.roadtrip.copilot.core.network.dto.TripInfo
import com.roadtrip.copilot.core.network.dto.TripMember
import com.roadtrip.copilot.core.state.ConversationRepository
import com.roadtrip.copilot.core.state.ConversationState
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import java.math.BigInteger
import javax.inject.Inject

@AndroidEntryPoint
class TripDetailFragment : Fragment() {

    @Inject lateinit var tripRepository: TripRepository
    @Inject lateinit var paymentRepository: PaymentRepository
    @Inject lateinit var treasuryReader: TreasuryReader
    @Inject lateinit var conversationRepository: ConversationRepository

    private lateinit var txtTripName: TextView
    private lateinit var txtOrganizer: TextView
    private lateinit var txtBalance: TextView
    private lateinit var txtSpendLimit: TextView
    private lateinit var membersContainer: LinearLayout
    private lateinit var paymentsContainer: LinearLayout
    private lateinit var fabVoice: FloatingActionButton

    // Voice UI
    private lateinit var voicePanel: View
    private lateinit var voiceIndicator: View
    private lateinit var txtVoiceStatus: TextView
    private lateinit var txtVoiceTranscript: TextView
    private lateinit var btnVoiceCancel: ImageView

    private var tripId: Int = -1

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_trip_detail, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        tripId = arguments?.getInt("tripId") ?: -1

        txtTripName = view.findViewById(R.id.txtDetailTripName)
        txtOrganizer = view.findViewById(R.id.txtDetailOrganizer)
        txtBalance = view.findViewById(R.id.txtDetailBalance)
        txtSpendLimit = view.findViewById(R.id.txtDetailSpendLimit)
        membersContainer = view.findViewById(R.id.membersContainer)
        paymentsContainer = view.findViewById(R.id.paymentsContainer)
        fabVoice = view.findViewById(R.id.fabVoice)

        // Voice UI
        voicePanel = view.findViewById(R.id.voicePanel)
        voiceIndicator = view.findViewById(R.id.voiceIndicator)
        txtVoiceStatus = view.findViewById(R.id.txtVoiceStatus)
        txtVoiceTranscript = view.findViewById(R.id.txtVoiceTranscript)
        btnVoiceCancel = view.findViewById(R.id.btnVoiceCancel)

        setupVoice()

        // Animate FAB
        fabVoice.post {
            val anim = AnimationUtils.loadAnimation(requireContext(), R.anim.fab_scale_in)
            fabVoice.startAnimation(anim)
        }

        if (tripId != -1) {
            loadTripDetail()
        }
    }

    // ── Voice interaction ────────────────────────────────────────────

    private fun setupVoice() {
        fabVoice.setOnClickListener { onFabTapped() }

        btnVoiceCancel.setOnClickListener {
            val state = conversationRepository.state.value
            when (state) {
                is ConversationState.Recording -> {
                    AudioForegroundService.stop(requireContext())
                    conversationRepository.cancelRecording()
                }
                is ConversationState.Playing -> {
                    AudioForegroundService.stop(requireContext())
                    conversationRepository.stopPlayback()
                }
                is ConversationState.ReviewingRecording -> {
                    conversationRepository.discardRecording()
                }
                is ConversationState.Error -> {
                    conversationRepository.dismiss()
                }
                else -> {}
            }
        }

        // Observe conversation state
        viewLifecycleOwner.lifecycleScope.launch {
            conversationRepository.state.collect { state ->
                updateVoiceUI(state)
            }
        }
    }

    private fun onFabTapped() {
        when (conversationRepository.state.value) {
            is ConversationState.Idle -> {
                AudioForegroundService.start(requireContext())
                conversationRepository.startRecording()
            }
            is ConversationState.Recording -> {
                AudioForegroundService.stop(requireContext())
                conversationRepository.stopRecordingForReview()
            }
            is ConversationState.ReviewingRecording -> {
                // Tap FAB to send
                conversationRepository.approveAndSend()
            }
            is ConversationState.Playing -> {
                AudioForegroundService.stop(requireContext())
                conversationRepository.stopPlayback()
            }
            is ConversationState.Error -> {
                conversationRepository.retry()
            }
            is ConversationState.Processing -> {
                // Do nothing while processing
            }
        }
    }

    private fun updateVoiceUI(state: ConversationState) {
        val ctx = context ?: return
        when (state) {
            is ConversationState.Idle -> {
                voicePanel.visibility = View.GONE
                fabVoice.setImageResource(R.drawable.ic_mic_large)
                fabVoice.backgroundTintList = ContextCompat.getColorStateList(ctx, R.color.primary)
                // Show last assistant message if any
                val lastMsg = conversationRepository.lastAssistantMessage
                if (lastMsg != null) {
                    voicePanel.visibility = View.VISIBLE
                    voiceIndicator.backgroundTintList = ContextCompat.getColorStateList(ctx, R.color.secondary)
                    txtVoiceStatus.text = "Co-Pilot"
                    txtVoiceTranscript.visibility = View.VISIBLE
                    txtVoiceTranscript.text = lastMsg
                    btnVoiceCancel.visibility = View.GONE
                }
            }
            is ConversationState.Recording -> {
                voicePanel.visibility = View.VISIBLE
                voiceIndicator.backgroundTintList = ContextCompat.getColorStateList(ctx, R.color.status_error)
                txtVoiceStatus.text = "Listening... tap mic when done"
                txtVoiceTranscript.visibility = View.GONE
                btnVoiceCancel.visibility = View.VISIBLE
                fabVoice.setImageResource(R.drawable.ic_stop)
                fabVoice.backgroundTintList = ContextCompat.getColorStateList(ctx, R.color.status_error)
            }
            is ConversationState.ReviewingRecording -> {
                voicePanel.visibility = View.VISIBLE
                voiceIndicator.backgroundTintList = ContextCompat.getColorStateList(ctx, R.color.status_pending)
                txtVoiceStatus.text = "Recorded ${state.durationSeconds}s — tap mic to send"
                txtVoiceTranscript.visibility = View.GONE
                btnVoiceCancel.visibility = View.VISIBLE
                fabVoice.setImageResource(R.drawable.ic_check)
                fabVoice.backgroundTintList = ContextCompat.getColorStateList(ctx, R.color.secondary)
            }
            is ConversationState.Processing -> {
                voicePanel.visibility = View.VISIBLE
                voiceIndicator.backgroundTintList = ContextCompat.getColorStateList(ctx, R.color.primary)
                txtVoiceStatus.text = "Thinking..."
                txtVoiceTranscript.visibility = View.GONE
                btnVoiceCancel.visibility = View.GONE
                fabVoice.setImageResource(R.drawable.ic_mic_large)
                fabVoice.backgroundTintList = ContextCompat.getColorStateList(ctx, R.color.surface_variant)
            }
            is ConversationState.Playing -> {
                voicePanel.visibility = View.VISIBLE
                voiceIndicator.backgroundTintList = ContextCompat.getColorStateList(ctx, R.color.secondary)
                txtVoiceStatus.text = "Co-Pilot is speaking"
                btnVoiceCancel.visibility = View.VISIBLE
                if (!state.transcript.isNullOrBlank()) {
                    txtVoiceTranscript.visibility = View.VISIBLE
                    txtVoiceTranscript.text = state.transcript
                } else {
                    txtVoiceTranscript.visibility = View.GONE
                }
                fabVoice.setImageResource(R.drawable.ic_stop)
                fabVoice.backgroundTintList = ContextCompat.getColorStateList(ctx, R.color.secondary)
            }
            is ConversationState.Error -> {
                voicePanel.visibility = View.VISIBLE
                voiceIndicator.backgroundTintList = ContextCompat.getColorStateList(ctx, R.color.status_error)
                txtVoiceStatus.text = "Error"
                txtVoiceTranscript.visibility = View.VISIBLE
                txtVoiceTranscript.text = state.message
                btnVoiceCancel.visibility = View.VISIBLE
                fabVoice.setImageResource(R.drawable.ic_mic_large)
                fabVoice.backgroundTintList = ContextCompat.getColorStateList(ctx, R.color.primary)
            }
        }
    }

    // ── Trip data ────────────────────────────────────────────────────

    private fun loadTripDetail() {
        viewLifecycleOwner.lifecycleScope.launch {
            val trip = tripRepository.trips.value.find { it.id == tripId }
                ?: tripRepository.getTrip(tripId).getOrNull()

            if (trip != null) {
                bindTrip(trip)
                loadBalance(trip.treasury_address)
            } else {
                Toast.makeText(requireContext(), getString(R.string.error_generic), Toast.LENGTH_SHORT).show()
            }

            paymentRepository.refresh(tripId)
        }

        viewLifecycleOwner.lifecycleScope.launch {
            paymentRepository.payments.collect { payments ->
                bindPayments(payments.filter { it.trip_id == tripId })
            }
        }
    }

    private fun bindTrip(trip: TripInfo) {
        txtTripName.text = trip.name
        val orgShort = if (trip.organizer_wallet.length > 12) {
            trip.organizer_wallet.take(12) + "..."
        } else {
            trip.organizer_wallet
        }
        txtOrganizer.text = getString(R.string.organizer_format, orgShort)
        txtSpendLimit.text = getString(R.string.spend_limit_format, trip.spend_limit_usd)

        // Members
        membersContainer.removeAllViews()
        val members = trip.members
        if (members.isNullOrEmpty()) {
            membersContainer.addView(makeEmptyText(getString(R.string.no_members)))
        } else {
            for (member in members) {
                membersContainer.addView(makeMemberRow(member))
            }
        }
    }

    private fun makeMemberRow(member: TripMember): View {
        val ctx = requireContext()
        val row = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(0, dp(8), 0, dp(8))
        }

        // Avatar circle with initial
        val avatarSize = dp(40)
        val avatar = FrameLayout(ctx).apply {
            layoutParams = LinearLayout.LayoutParams(avatarSize, avatarSize).apply {
                marginEnd = dp(12)
            }
        }

        val avatarBg = View(ctx).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT,
                FrameLayout.LayoutParams.MATCH_PARENT
            )
            background = ContextCompat.getDrawable(ctx, R.drawable.bg_member_avatar)
        }
        avatar.addView(avatarBg)

        val displayName = member.display_name ?: member.wallet_address.take(6)
        val initial = displayName.firstOrNull()?.uppercase() ?: "?"
        val initialText = TextView(ctx).apply {
            layoutParams = FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT,
                FrameLayout.LayoutParams.WRAP_CONTENT,
                Gravity.CENTER
            )
            text = initial
            textSize = 16f
            setTextColor(ContextCompat.getColor(ctx, R.color.primary))
            typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
        }
        avatar.addView(initialText)
        row.addView(avatar)

        // Name + wallet info
        val infoColumn = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }

        val nameText = TextView(ctx).apply {
            text = member.display_name ?: member.wallet_address.take(10) + "..."
            textSize = 15f
            setTextColor(ContextCompat.getColor(ctx, R.color.text_primary))
            typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
        }
        infoColumn.addView(nameText)

        val walletText = TextView(ctx).apply {
            text = member.wallet_address.take(8) + "..." + member.wallet_address.takeLast(4)
            textSize = 12f
            setTextColor(ContextCompat.getColor(ctx, R.color.text_tertiary))
            typeface = android.graphics.Typeface.create("monospace", android.graphics.Typeface.NORMAL)
        }
        infoColumn.addView(walletText)

        row.addView(infoColumn)
        return row
    }

    private fun loadBalance(treasuryAddress: String?) {
        viewLifecycleOwner.lifecycleScope.launch {
            val balance = treasuryReader.getBalance(treasuryAddress)
            txtBalance.text = if (balance != null) {
                getString(R.string.usdc_format, balance)
            } else {
                "--"
            }
        }
    }

    private fun bindPayments(payments: List<PaymentInfo>) {
        paymentsContainer.removeAllViews()
        if (payments.isEmpty()) {
            paymentsContainer.addView(makeEmptyText(getString(R.string.no_payments)))
            return
        }

        for (payment in payments) {
            paymentsContainer.addView(makePaymentCard(payment))
        }
    }

    private fun makePaymentCard(payment: PaymentInfo): View {
        val ctx = requireContext()
        val card = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            background = ContextCompat.getDrawable(ctx, R.drawable.bg_payment_card)
            setPadding(dp(16), dp(14), dp(16), dp(14))
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(8) }
        }

        // Top row: category + status
        val topRow = LinearLayout(ctx).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(6) }
        }

        val categoryText = TextView(ctx).apply {
            text = payment.category ?: "Payment"
            textSize = 15f
            setTextColor(ContextCompat.getColor(ctx, R.color.text_primary))
            typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
            layoutParams = LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f)
        }
        topRow.addView(categoryText)

        // Status chip
        val isPending = payment.status == "pending"
        val statusChip = TextView(ctx).apply {
            text = payment.status.uppercase()
            textSize = 11f
            typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
            letterSpacing = 0.04f
            if (isPending) {
                setTextColor(ContextCompat.getColor(ctx, R.color.status_pending))
                background = ContextCompat.getDrawable(ctx, R.drawable.bg_status_pending)
            } else {
                setTextColor(ContextCompat.getColor(ctx, R.color.status_active))
                background = ContextCompat.getDrawable(ctx, R.drawable.bg_status_chip)
            }
        }
        topRow.addView(statusChip)
        card.addView(topRow)

        // Amount
        val amountDisplay = formatUsdc(payment.amount)
        val amountText = TextView(ctx).apply {
            text = amountDisplay
            textSize = 18f
            setTextColor(ContextCompat.getColor(ctx, R.color.primary))
            typeface = android.graphics.Typeface.create("sans-serif-medium", android.graphics.Typeface.NORMAL)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = dp(4) }
        }
        card.addView(amountText)

        // Description
        if (!payment.description.isNullOrBlank()) {
            val descText = TextView(ctx).apply {
                text = payment.description
                textSize = 13f
                setTextColor(ContextCompat.getColor(ctx, R.color.text_secondary))
            }
            card.addView(descText)
        }

        // Approve button for pending payments
        if (isPending) {
            val approveBtn = MaterialButton(ctx).apply {
                text = getString(R.string.approve)
                textSize = 13f
                cornerRadius = dp(12)
                layoutParams = LinearLayout.LayoutParams(
                    LinearLayout.LayoutParams.WRAP_CONTENT,
                    LinearLayout.LayoutParams.WRAP_CONTENT
                ).apply { topMargin = dp(10) }
                setOnClickListener {
                    viewLifecycleOwner.lifecycleScope.launch {
                        val result = paymentRepository.approvePayment(tripId, payment.id)
                        if (result.isSuccess) {
                            Toast.makeText(ctx, getString(R.string.approved), Toast.LENGTH_SHORT).show()
                            paymentRepository.refresh(tripId)
                        } else {
                            Toast.makeText(ctx, getString(R.string.payment_approve_error), Toast.LENGTH_SHORT).show()
                        }
                    }
                }
            }
            card.addView(approveBtn)
        }

        return card
    }

    private fun formatUsdc(rawAmount: String): String {
        return try {
            val raw = BigInteger(rawAmount)
            val divisor = BigInteger.TEN.pow(6)
            val whole = raw.divide(divisor)
            val rem = raw.remainder(divisor).toLong().toString().padStart(6, '0').take(2)
            "$whole.$rem USDC"
        } catch (_: Exception) {
            "$rawAmount USDC"
        }
    }

    private fun makeEmptyText(text: String): TextView {
        return TextView(requireContext()).apply {
            this.text = text
            textSize = 14f
            setTextColor(ContextCompat.getColor(requireContext(), R.color.text_tertiary))
            setPadding(0, dp(12), 0, dp(12))
        }
    }

    private fun dp(value: Int): Int {
        return (value * resources.displayMetrics.density).toInt()
    }
}
