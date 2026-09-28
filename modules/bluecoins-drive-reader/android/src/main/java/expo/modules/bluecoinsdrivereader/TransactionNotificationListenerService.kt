package expo.modules.bluecoinsdrivereader

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.content.pm.PackageManager
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import java.security.MessageDigest
import java.util.Locale

class TransactionNotificationListenerService : NotificationListenerService() {
  companion object {
    private const val CHANNEL_ID = "redcoins_transaction_suggestions"
    private const val PREFS = "redcoins_detector"
    private const val DUPLICATE_WINDOW_MS = 120_000L
    private val amountPattern = Regex("(?i)(?:RM|MYR)\\s*([0-9][0-9,]*(?:\\.[0-9]{1,2})?)")
    private val transactionWords = Regex("(?i)paid|payment|purchase|spent|debit|charged|transaction|card|wallet|qr|merchant|bayaran|pembayaran|dibayar|transaksi|successful|approved")
    private val ignoredWords = Regex("(?i)otp|tac|verification|securetac|login|sign.in|received|credited|refund")
  }

  override fun onNotificationPosted(sbn: StatusBarNotification) {
    if (sbn.packageName == packageName || sbn.isOngoing) return
    val extras = sbn.notification.extras
    val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim().orEmpty()
    val body = listOfNotNull(
      extras.getCharSequence(Notification.EXTRA_TEXT)?.toString(),
      extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString(),
      extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString()
    ).filter { it.isNotBlank() }.distinct().joinToString(" ")
    val combined = "$title $body".trim()
    val amountMatch = amountPattern.find(combined) ?: return
    val knownPaymentSource = Regex("(?i)cimb|octo|maybank|mae|rhb|aeon|setel|wallet|pay").containsMatchIn(sbn.packageName)
    if ((!knownPaymentSource && !transactionWords.containsMatchIn(combined)) || ignoredWords.containsMatchIn(combined)) return
    val amount = amountMatch.groupValues[1].replace(",", "").toDoubleOrNull() ?: return
    if (amount <= 0.0) return

    val merchant = extractMerchant(title, body, amountMatch.value)
    val fingerprint = sha256("${sbn.packageName}|${"%.2f".format(Locale.US, amount)}|${combined.lowercase(Locale.US)}")
    val prefs = getSharedPreferences(PREFS, MODE_PRIVATE)
    val now = System.currentTimeMillis()
    if (prefs.getString("last_hash", null) == fingerprint && now - prefs.getLong("last_at", 0) < DUPLICATE_WINDOW_MS) return
    prefs.edit().putString("last_hash", fingerprint).putLong("last_at", now).apply()
    val accountHint = inferAccountHint(sbn.packageName, combined)
    TransactionDetectionStore.add(this, fingerprint, merchant, amount, accountHint, sbn.packageName, now)
    showSuggestion(merchant, amount, accountHint, sbn.packageName, fingerprint)
  }

  private fun extractMerchant(title: String, body: String, amountText: String): String {
    val atMerchant = Regex("(?i)(?:at|to|kepada|di)\\s+([A-Za-z0-9 &'._-]{2,50})").find(body)?.groupValues?.get(1)?.trim()?.split(Regex("(?i)\\s+(?:using|on|with|was|via)\\s+"))?.firstOrNull()
    if (!atMerchant.isNullOrBlank()) return atMerchant
    val cleanedTitle = title.replace(amountText, "", ignoreCase = true).trim(' ', '-', ':', '·')
    if (cleanedTitle.length in 2..60 && !transactionWords.matches(cleanedTitle)) return cleanedTitle
    return "Detected purchase"
  }

  private fun inferAccountHint(packageName: String, text: String): String {
    val source = "$packageName $text".lowercase(Locale.US)
    return when {
      ("cimb" in source || "octo" in source) && "platinum" in source -> "Cimb Platinum"
      "cimb" in source || "octo" in source -> "Cimb"
      "maybank" in source || "mae" in source -> "Maybank"
      "rhb" in source -> "Rhb"
      "aeon" in source -> "Aeon"
      else -> ""
    }
  }

  private fun showSuggestion(merchant: String, amount: Double, accountHint: String, sourcePackage: String, fingerprint: String) {
    val manager = getSystemService(NotificationManager::class.java)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      manager.createNotificationChannel(NotificationChannel(CHANNEL_ID, "Transaction suggestions", NotificationManager.IMPORTANCE_HIGH).apply {
        description = "Ask whether a detected payment should be recorded in RedCoins"
        enableLights(true); lightColor = Color.RED
      })
    }
    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
    val uri = Uri.parse("leanlog://redcoins/expense").buildUpon()
      .appendQueryParameter("item", merchant)
      .appendQueryParameter("amount", "%.2f".format(Locale.US, amount))
      .appendQueryParameter("accountHint", accountHint)
      .appendQueryParameter("detected", "1")
      .appendQueryParameter("fingerprint", fingerprint)
      .appendQueryParameter("source", sourcePackage).build()
    val launchIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply { action = Intent.ACTION_VIEW; data = uri; flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP } ?: return
    val pendingIntent = PendingIntent.getActivity(this, fingerprint.take(7).hashCode(), launchIntent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val notification = Notification.Builder(this, CHANNEL_ID)
      .setSmallIcon(applicationInfo.icon)
      .setContentTitle("Record ${"RM %.2f".format(Locale.US, amount)}?")
      .setContentText("$merchant · tap to review in RedCoins")
      .setStyle(Notification.BigTextStyle().bigText("Detected $merchant for ${"RM %.2f".format(Locale.US, amount)}. Tap to review the details before saving."))
      .setContentIntent(pendingIntent).setAutoCancel(true).setCategory(Notification.CATEGORY_RECOMMENDATION).build()
    manager.notify(fingerprint.take(8).hashCode(), notification)
  }

  private fun sha256(value: String): String = MessageDigest.getInstance("SHA-256").digest(value.toByteArray()).joinToString("") { "%02x".format(it) }
}
