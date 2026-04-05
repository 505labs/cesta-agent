package com.roadtrip.copilot.app.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.roadtrip.copilot.app.R
import com.roadtrip.copilot.core.auth.AuthRepository
import com.roadtrip.copilot.core.auth.AuthState
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class WalletFragment : Fragment() {

    @Inject lateinit var authRepository: AuthRepository

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_wallet, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val txtAuthStatus = view.findViewById<TextView>(R.id.txtAuthStatus)
        val txtWalletAddress = view.findViewById<TextView>(R.id.txtWalletAddress)
        val statusDot = view.findViewById<View>(R.id.statusDot)
        val btnCopy = view.findViewById<ImageView>(R.id.btnCopyAddress)

        btnCopy.setOnClickListener {
            val address = txtWalletAddress.text.toString()
            if (address.isNotBlank()) {
                val clipboard = requireContext().getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                clipboard.setPrimaryClip(ClipData.newPlainText("Wallet Address", address))
                Toast.makeText(requireContext(), "Address copied", Toast.LENGTH_SHORT).show()
            }
        }

        viewLifecycleOwner.lifecycleScope.launch {
            authRepository.authState.collect { state ->
                when (state) {
                    is AuthState.Authenticated -> {
                        txtAuthStatus.text = getString(R.string.authenticated)
                        txtAuthStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.status_active))
                        statusDot.backgroundTintList = ContextCompat.getColorStateList(requireContext(), R.color.status_active)
                        txtWalletAddress.text = state.walletAddress
                    }
                    is AuthState.Unauthenticated -> {
                        txtAuthStatus.text = getString(R.string.not_authenticated)
                        txtAuthStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.status_pending))
                        statusDot.backgroundTintList = ContextCompat.getColorStateList(requireContext(), R.color.status_pending)
                        txtWalletAddress.text = AuthRepository.DEMO_WALLET
                    }
                }
            }
        }
    }
}
