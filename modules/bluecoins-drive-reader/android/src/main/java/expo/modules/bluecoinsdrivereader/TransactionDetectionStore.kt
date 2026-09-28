package expo.modules.bluecoinsdrivereader

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject

object TransactionDetectionStore {
  private const val PREFS = "redcoins_detector"
  private const val KEY = "detections"
  private const val LIMIT = 40

  fun add(context: Context, id: String, merchant: String, amount: Double, accountHint: String, source: String, createdAt: Long = System.currentTimeMillis()) {
    val rows = readJson(context).filterNot { it.optString("id") == id }.toMutableList()
    rows.add(0, JSONObject().apply {
      put("id", id); put("merchant", merchant); put("amount", amount); put("accountHint", accountHint)
      put("source", source); put("createdAt", createdAt)
    })
    writeJson(context, rows.take(LIMIT))
  }

  fun dismiss(context: Context, id: String) = writeJson(context, readJson(context).filterNot { it.optString("id") == id })

  fun list(context: Context): List<Map<String, Any>> = readJson(context).map { row ->
    mapOf(
      "id" to row.optString("id"), "merchant" to row.optString("merchant"), "amount" to row.optDouble("amount"),
      "accountHint" to row.optString("accountHint"), "source" to row.optString("source"), "createdAt" to row.optLong("createdAt").toDouble()
    )
  }

  private fun readJson(context: Context): List<JSONObject> {
    val raw = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY, "[]") ?: "[]"
    return try { val array = JSONArray(raw); (0 until array.length()).mapNotNull { array.optJSONObject(it) } } catch (_: Exception) { emptyList() }
  }

  private fun writeJson(context: Context, rows: List<JSONObject>) {
    val array = JSONArray(); rows.forEach { array.put(it) }
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().putString(KEY, array.toString()).apply()
  }
}
