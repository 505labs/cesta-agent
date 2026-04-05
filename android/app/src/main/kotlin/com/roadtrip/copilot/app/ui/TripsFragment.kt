package com.roadtrip.copilot.app.ui

import android.os.Bundle
import android.text.InputType
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.view.animation.AnimationUtils
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.core.os.bundleOf
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.floatingactionbutton.FloatingActionButton
import com.google.android.material.textfield.TextInputEditText
import com.google.android.material.textfield.TextInputLayout
import com.roadtrip.copilot.app.R
import com.roadtrip.copilot.core.network.TripRepository
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class TripsFragment : Fragment() {

    @Inject lateinit var tripRepository: TripRepository

    private lateinit var adapter: TripListAdapter
    private lateinit var recyclerView: RecyclerView
    private lateinit var swipeRefresh: SwipeRefreshLayout
    private lateinit var emptyState: View
    private lateinit var fabCreate: FloatingActionButton

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View = inflater.inflate(R.layout.fragment_trips, container, false)

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        recyclerView = view.findViewById(R.id.recyclerTrips)
        swipeRefresh = view.findViewById(R.id.swipeRefresh)
        emptyState = view.findViewById(R.id.emptyState)
        fabCreate = view.findViewById(R.id.fabCreateTrip)

        // Style the swipe refresh colors
        swipeRefresh.setColorSchemeResources(R.color.primary, R.color.secondary)
        swipeRefresh.setProgressBackgroundColorSchemeResource(R.color.surface_elevated)

        adapter = TripListAdapter(
            onItemClick = { trip ->
                tripRepository.setActiveTrip(trip.id)
                val bundle = bundleOf("tripId" to trip.id)
                findNavController().navigate(R.id.action_trips_to_tripDetail, bundle)
            },
            onItemLongClick = {
                showJoinTripDialog()
                true
            }
        )

        recyclerView.layoutManager = LinearLayoutManager(requireContext())
        recyclerView.adapter = adapter

        // Add item spacing
        recyclerView.addItemDecoration(object : RecyclerView.ItemDecoration() {
            override fun getItemOffsets(
                outRect: android.graphics.Rect,
                view: View,
                parent: RecyclerView,
                state: RecyclerView.State
            ) {
                outRect.bottom = resources.getDimensionPixelSize(R.dimen.spacing_sm)
            }
        })

        swipeRefresh.setOnRefreshListener { loadTrips() }

        fabCreate.setOnClickListener { showCreateTripDialog() }

        // Animate FAB entrance
        fabCreate.post {
            val anim = AnimationUtils.loadAnimation(requireContext(), R.anim.fab_scale_in)
            fabCreate.startAnimation(anim)
        }

        // Observe trips state
        viewLifecycleOwner.lifecycleScope.launch {
            tripRepository.trips.collect { trips ->
                adapter.submitList(trips)
                emptyState.visibility = if (trips.isEmpty()) View.VISIBLE else View.GONE
                recyclerView.visibility = if (trips.isEmpty()) View.GONE else View.VISIBLE

                // Re-run layout animation when data changes
                if (trips.isNotEmpty()) {
                    recyclerView.scheduleLayoutAnimation()
                }
            }
        }

        loadTrips()
    }

    private fun loadTrips() {
        viewLifecycleOwner.lifecycleScope.launch {
            swipeRefresh.isRefreshing = true
            tripRepository.refresh()
            swipeRefresh.isRefreshing = false
        }
    }

    private fun showCreateTripDialog() {
        val ctx = requireContext()
        val padding = resources.getDimensionPixelSize(R.dimen.spacing_xl)

        val nameInputLayout = TextInputLayout(ctx).apply {
            hint = getString(R.string.trip_name_hint)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            ).apply { bottomMargin = resources.getDimensionPixelSize(R.dimen.spacing_lg) }
        }
        val nameInput = TextInputEditText(ctx).apply {
            textSize = 15f
        }
        nameInputLayout.addView(nameInput)

        val limitInputLayout = TextInputLayout(ctx).apply {
            hint = getString(R.string.spend_limit_hint)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
        val limitInput = TextInputEditText(ctx).apply {
            inputType = InputType.TYPE_CLASS_NUMBER or InputType.TYPE_NUMBER_FLAG_DECIMAL
            textSize = 15f
        }
        limitInputLayout.addView(limitInput)

        val layout = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, resources.getDimensionPixelSize(R.dimen.spacing_lg), padding, 0)
            addView(nameInputLayout)
            addView(limitInputLayout)
        }

        MaterialAlertDialogBuilder(ctx)
            .setTitle(getString(R.string.create_trip))
            .setView(layout)
            .setPositiveButton("Create") { _, _ ->
                val name = nameInput.text.toString().trim()
                val limitText = limitInput.text.toString().trim()
                if (name.isBlank()) {
                    Toast.makeText(ctx, "Please enter a trip name", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                val limit = limitText.toDoubleOrNull() ?: 1000.0
                viewLifecycleOwner.lifecycleScope.launch {
                    val result = tripRepository.createTrip(name, limit)
                    if (result.isSuccess) {
                        Toast.makeText(ctx, getString(R.string.trip_created), Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(ctx, getString(R.string.error_generic), Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun showJoinTripDialog() {
        val ctx = requireContext()
        val padding = resources.getDimensionPixelSize(R.dimen.spacing_xl)

        val idInputLayout = TextInputLayout(ctx).apply {
            hint = getString(R.string.join_trip_id_hint)
            layoutParams = LinearLayout.LayoutParams(
                LinearLayout.LayoutParams.MATCH_PARENT,
                LinearLayout.LayoutParams.WRAP_CONTENT
            )
        }
        val idInput = TextInputEditText(ctx).apply {
            inputType = InputType.TYPE_CLASS_NUMBER
            textSize = 15f
        }
        idInputLayout.addView(idInput)

        val layout = LinearLayout(ctx).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(padding, resources.getDimensionPixelSize(R.dimen.spacing_lg), padding, 0)
            addView(idInputLayout)
        }

        MaterialAlertDialogBuilder(ctx)
            .setTitle(getString(R.string.join_trip))
            .setView(layout)
            .setPositiveButton("Join") { _, _ ->
                val tripId = idInput.text.toString().trim().toIntOrNull()
                if (tripId == null) {
                    Toast.makeText(ctx, "Enter a valid Trip ID", Toast.LENGTH_SHORT).show()
                    return@setPositiveButton
                }
                viewLifecycleOwner.lifecycleScope.launch {
                    val result = tripRepository.joinTrip(tripId)
                    if (result.isSuccess) {
                        Toast.makeText(ctx, getString(R.string.trip_joined), Toast.LENGTH_SHORT).show()
                    } else {
                        Toast.makeText(ctx, getString(R.string.error_generic), Toast.LENGTH_SHORT).show()
                    }
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }
}
