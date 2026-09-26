package expo.modules.bluecoinsdrivereader

import android.net.Uri
import android.provider.DocumentsContract
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

class BluecoinsDriveReaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BluecoinsDriveReader")

    AsyncFunction("listFydbFilesAsync") { treeUriValue: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val treeUri = Uri.parse(treeUriValue)

      try {
        val treeDocumentId = DocumentsContract.getTreeDocumentId(treeUri)
        val childrenUri = DocumentsContract.buildChildDocumentsUriUsingTree(treeUri, treeDocumentId)
        val projection = arrayOf(
          DocumentsContract.Document.COLUMN_DOCUMENT_ID,
          DocumentsContract.Document.COLUMN_DISPLAY_NAME,
          DocumentsContract.Document.COLUMN_LAST_MODIFIED,
          DocumentsContract.Document.COLUMN_SIZE
        )
        val files = mutableListOf<Map<String, Any?>>()

        context.contentResolver.query(childrenUri, projection, null, null, null)?.use { cursor ->
          val idColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DOCUMENT_ID)
          val nameColumn = cursor.getColumnIndexOrThrow(DocumentsContract.Document.COLUMN_DISPLAY_NAME)
          val modifiedColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_LAST_MODIFIED)
          val sizeColumn = cursor.getColumnIndex(DocumentsContract.Document.COLUMN_SIZE)

          while (cursor.moveToNext()) {
            val name = cursor.getString(nameColumn) ?: continue
            if (!name.endsWith(".fydb", ignoreCase = true)) continue
            val documentId = cursor.getString(idColumn)
            val documentUri = DocumentsContract.buildDocumentUriUsingTree(treeUri, documentId)
            files.add(mapOf(
              "uri" to documentUri.toString(),
              "name" to name,
              "lastModified" to if (modifiedColumn >= 0 && !cursor.isNull(modifiedColumn)) cursor.getLong(modifiedColumn).toDouble() else 0.0,
              "size" to if (sizeColumn >= 0 && !cursor.isNull(sizeColumn)) cursor.getLong(sizeColumn).toDouble() else 0.0
            ))
          }
        } ?: throw CodedException("BLUECOINS_DRIVE_FOLDER_EMPTY", "Google Drive returned no folder cursor", null)

        files
      } catch (error: CodedException) {
        throw error
      } catch (error: Exception) {
        throw CodedException("BLUECOINS_DRIVE_LIST_FAILED", error.message ?: "Could not list the Google Drive folder", error)
      }
    }

    AsyncFunction("copyContentUriToFileAsync") { sourceUri: String, destinationUri: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val source = Uri.parse(sourceUri)
      val destination = Uri.parse(destinationUri)
      val destinationPath = destination.path
        ?: throw CodedException("BLUECOINS_DESTINATION_INVALID", "Destination URI has no filesystem path", null)
      val destinationFile = File(destinationPath)

      destinationFile.parentFile?.mkdirs()
      if (destinationFile.exists() && !destinationFile.delete()) {
        throw CodedException("BLUECOINS_DESTINATION_DELETE_FAILED", "Could not replace the previous local database", null)
      }

      try {
        val input = context.contentResolver.openInputStream(source)
          ?: throw CodedException("BLUECOINS_DRIVE_STREAM_EMPTY", "Google Drive returned no input stream", null)
        input.use { sourceStream ->
          FileOutputStream(destinationFile).use { destinationStream ->
            sourceStream.copyTo(destinationStream, DEFAULT_BUFFER_SIZE * 8)
            destinationStream.fd.sync()
          }
        }
      } catch (error: CodedException) {
        throw error
      } catch (error: Exception) {
        destinationFile.delete()
        throw CodedException("BLUECOINS_DRIVE_READ_FAILED", error.message ?: "Could not stream the Google Drive file", error)
      }

      val bytesCopied = destinationFile.length()
      if (bytesCopied <= 0L) {
        destinationFile.delete()
        throw CodedException("BLUECOINS_DRIVE_FILE_EMPTY", "Google Drive returned an empty file", null)
      }
      bytesCopied.toDouble()
    }
  }
}
