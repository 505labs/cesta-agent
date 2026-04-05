package com.roadtrip.copilot.app.ui

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.widget.TextView
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.roadtrip.copilot.app.R
import com.roadtrip.copilot.core.network.dto.TripInfo

class TripListAdapter(
    private val onItemClick: (TripInfo) -> Unit,
    private val onItemLongClick: (TripInfo) -> Boolean = { false }
) : ListAdapter<TripInfo, TripListAdapter.TripViewHolder>(DIFF_CALLBACK) {

    companion object {
        private val DIFF_CALLBACK = object : DiffUtil.ItemCallback<TripInfo>() {
            override fun areItemsTheSame(old: TripInfo, new: TripInfo) = old.id == new.id
            override fun areContentsTheSame(old: TripInfo, new: TripInfo) = old == new
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): TripViewHolder {
        val view = LayoutInflater.from(parent.context)
            .inflate(R.layout.item_trip, parent, false)
        return TripViewHolder(view)
    }

    override fun onBindViewHolder(holder: TripViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    inner class TripViewHolder(itemView: View) : RecyclerView.ViewHolder(itemView) {
        private val txtName: TextView = itemView.findViewById(R.id.txtTripName)
        private val txtStatus: TextView = itemView.findViewById(R.id.txtTripStatus)
        private val txtSpendLimit: TextView = itemView.findViewById(R.id.txtSpendLimit)
        private val accentBar: View = itemView.findViewById(R.id.accentBar)

        fun bind(trip: TripInfo) {
            txtName.text = trip.name
            txtStatus.text = trip.status.uppercase()
            txtSpendLimit.text = "Spend limit: $${String.format("%.2f", trip.spend_limit_usd)}"

            // Color the status chip and accent bar based on status
            val ctx = itemView.context
            when (trip.status.lowercase()) {
                "active" -> {
                    txtStatus.setTextColor(ContextCompat.getColor(ctx, R.color.status_active))
                    txtStatus.setBackgroundResource(R.drawable.bg_status_chip)
                    accentBar.setBackgroundColor(ContextCompat.getColor(ctx, R.color.status_active))
                }
                "pending" -> {
                    txtStatus.setTextColor(ContextCompat.getColor(ctx, R.color.status_pending))
                    txtStatus.setBackgroundResource(R.drawable.bg_status_pending)
                    accentBar.setBackgroundColor(ContextCompat.getColor(ctx, R.color.status_pending))
                }
                "completed" -> {
                    txtStatus.setTextColor(ContextCompat.getColor(ctx, R.color.status_completed))
                    txtStatus.setBackgroundResource(R.drawable.bg_status_completed)
                    accentBar.setBackgroundColor(ContextCompat.getColor(ctx, R.color.status_completed))
                }
                else -> {
                    txtStatus.setTextColor(ContextCompat.getColor(ctx, R.color.primary))
                    txtStatus.setBackgroundResource(R.drawable.bg_status_chip)
                    accentBar.setBackgroundColor(ContextCompat.getColor(ctx, R.color.primary))
                }
            }

            itemView.setOnClickListener { onItemClick(trip) }
            itemView.setOnLongClickListener { onItemLongClick(trip) }
        }
    }
}
