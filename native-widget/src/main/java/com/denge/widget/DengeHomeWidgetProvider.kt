package com.denge.widget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.widget.RemoteViews
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** Native launcher widget. Finance values are pushed by the trusted WebView bridge. */
class DengeHomeWidgetProvider : AppWidgetProvider() {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) {
        ids.forEach { updateOne(context, manager, it) }
    }

    override fun onAppWidgetOptionsChanged(
        context: Context, manager: AppWidgetManager, appWidgetId: Int, newOptions: Bundle
    ) {
        updateOne(context, manager, appWidgetId)
    }

    companion object {
        private const val PREFS = "denge_home_widget"

        @JvmStatic
        fun updateFromJson(context: Context, payload: String) {
            val json = JSONObject(payload)
            context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
                .putString("balance", json.optString("balance", ""))
                .putString("cash", json.optString("cash", ""))
                .putString("bank", json.optString("bank", ""))
                .putString("income", json.optString("income", ""))
                .putString("expense", json.optString("expense", ""))
                .putString("theme", json.optString("theme", "light"))
                .putString("updatedAt", json.optString("updatedAt", ""))
                .apply()
            refreshAll(context)
        }

        private fun refreshAll(context: Context) {
            val manager = AppWidgetManager.getInstance(context)
            val component = ComponentName(context, DengeHomeWidgetProvider::class.java)
            manager.getAppWidgetIds(component).forEach { updateOne(context, manager, it) }
        }

        private fun updateOne(context: Context, manager: AppWidgetManager, appWidgetId: Int) {
            val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
            val options = manager.getAppWidgetOptions(appWidgetId)
            val minWidth = options.getInt(AppWidgetManager.OPTION_APPWIDGET_MIN_WIDTH, 180)
            val expanded = minWidth >= 250
            val dark = prefs.getString("theme", "light") == "dark"
            val layout = if (expanded) R.layout.denge_home_widget_expanded else R.layout.denge_home_widget_compact
            val views = RemoteViews(context.packageName, layout)

            views.setTextViewText(R.id.widget_balance, prefs.getString("balance", null) ?: "Denge'yi aç")
            views.setTextViewText(R.id.widget_cash, prefs.getString("cash", null) ?: "—")
            views.setTextViewText(R.id.widget_bank, prefs.getString("bank", null) ?: "—")
            views.setTextViewText(R.id.widget_updated, updatedLabel(prefs.getString("updatedAt", null)))
            if (expanded) {
                views.setTextViewText(R.id.widget_income, prefs.getString("income", null) ?: "—")
                views.setTextViewText(R.id.widget_expense, prefs.getString("expense", null) ?: "—")
            }

            views.setInt(
                R.id.widget_root,
                "setBackgroundResource",
                if (dark) R.drawable.denge_widget_bg_dark else R.drawable.denge_widget_bg_light
            )
            val primary = Color.parseColor(if (dark) "#F4F1FF" else "#24213A")
            val secondary = Color.parseColor(if (dark) "#B8B2D0" else "#77738F")
            listOf(R.id.widget_title, R.id.widget_balance).forEach { views.setTextColor(it, primary) }
            listOf(R.id.widget_cash_label, R.id.widget_bank_label, R.id.widget_updated)
                .forEach { views.setTextColor(it, secondary) }
            if (expanded) {
                listOf(R.id.widget_month_summary, R.id.widget_income_label, R.id.widget_expense_label)
                    .forEach { views.setTextColor(it, secondary) }
                views.setTextColor(R.id.widget_income, Color.parseColor(if (dark) "#70D6A8" else "#16845A"))
                views.setTextColor(R.id.widget_expense, Color.parseColor(if (dark) "#FF8996" else "#D64C5B"))
            }

            val launchIntent = context.packageManager.getLaunchIntentForPackage(context.packageName)
            if (launchIntent != null) {
                launchIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_NEW_TASK)
                val clickIntent = PendingIntent.getActivity(
                    context, appWidgetId, launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
                )
                views.setOnClickPendingIntent(R.id.widget_root, clickIntent)
            }
            manager.updateAppWidget(appWidgetId, views)
        }

        private fun updatedLabel(raw: String?): String {
            if (raw.isNullOrBlank()) return "Uygulamayı açarak güncelle"
            return try {
                val time = Instant.parse(raw).atZone(ZoneId.systemDefault())
                    .format(DateTimeFormatter.ofPattern("HH:mm"))
                "Son güncelleme · $time"
            } catch (_: Exception) {
                "Denge · Güncel"
            }
        }
    }
}
