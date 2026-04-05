package com.roadtrip.copilot.app.ui

import android.content.SharedPreferences
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ArrayAdapter
import android.widget.Spinner
import android.widget.TextView
import android.widget.Toast
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import com.google.android.material.button.MaterialButton
import com.google.android.material.textfield.TextInputEditText
import com.roadtrip.copilot.app.BuildConfig
import com.roadtrip.copilot.app.R
import com.roadtrip.copilot.core.network.OrchestratorApiClient
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class SettingsFragment : Fragment() {

    @Inject lateinit var prefs: SharedPreferences
    @Inject lateinit var apiClient: OrchestratorApiClient

    private lateinit var editServerUrl: TextInputEditText
    private lateinit var spinnerDetailLevel: Spinner
    private lateinit var btnSave: MaterialButton
    private lateinit var btnTest: MaterialButton
    private lateinit var txtStatus: TextView
    private lateinit var txtVersion: TextView

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_settings, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        editServerUrl = view.findViewById(R.id.editServerUrl)
        spinnerDetailLevel = view.findViewById(R.id.spinnerDetailLevel)
        btnSave = view.findViewById(R.id.btnSaveSettings)
        btnTest = view.findViewById(R.id.btnTestConnection)
        txtStatus = view.findViewById(R.id.txtConnectionStatus)
        txtVersion = view.findViewById(R.id.txtAppVersion)

        // Populate fields
        editServerUrl.setText(prefs.getString("base_url", ""))
        editServerUrl.hint = "e.g. http://192.168.1.100:8080"

        val detailLevelLabels = resources.getStringArray(R.array.detail_levels)
        val detailLevelValues = resources.getStringArray(R.array.detail_level_values)
        val adapter = ArrayAdapter(requireContext(), android.R.layout.simple_spinner_item, detailLevelLabels)
        adapter.setDropDownViewResource(android.R.layout.simple_spinner_dropdown_item)
        spinnerDetailLevel.adapter = adapter

        val savedDetailLevel = prefs.getString("detail_level", "standard") ?: "standard"
        val savedIndex = detailLevelValues.indexOf(savedDetailLevel)
        if (savedIndex >= 0) spinnerDetailLevel.setSelection(savedIndex)

        // Version
        txtVersion.text = "RoadTrip Co-Pilot v${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})"

        btnSave.setOnClickListener {
            val host = editServerUrl.text.toString().trim()
            val selectedIndex = spinnerDetailLevel.selectedItemPosition
            val detailLevel = if (selectedIndex >= 0) detailLevelValues[selectedIndex] else "standard"
            prefs.edit()
                .putString("base_url", host)
                .putString("detail_level", detailLevel)
                .apply()
            Toast.makeText(requireContext(), getString(R.string.settings_saved), Toast.LENGTH_SHORT).show()
        }

        btnTest.setOnClickListener {
            viewLifecycleOwner.lifecycleScope.launch {
                txtStatus.visibility = View.VISIBLE
                txtStatus.text = "Testing connection..."
                txtStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.text_secondary))
                val healthy = apiClient.healthCheck()
                if (healthy) {
                    txtStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.status_active))
                    txtStatus.text = getString(R.string.connection_success)
                } else {
                    txtStatus.setTextColor(ContextCompat.getColor(requireContext(), R.color.status_error))
                    txtStatus.text = getString(R.string.connection_failed)
                }
            }
        }
    }
}
