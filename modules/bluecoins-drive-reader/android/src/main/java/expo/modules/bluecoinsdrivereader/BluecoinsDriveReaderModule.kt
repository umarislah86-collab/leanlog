package expo.modules.bluecoinsdrivereader

import android.net.Uri
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream

class BluecoinsDriveReaderModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("BluecoinsDriveReader")

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
