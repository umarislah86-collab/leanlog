# RedCoins receipt folders

No Google login, Drive API or Google Cloud console configuration is needed.

1. Open a transaction and its Receipts panel.
2. Choose folder using the Android system picker. A folder dedicated to receipts is recommended.
3. Attach camera/photo/PDF receipts, then Save the transaction. If a folder is selected, originals are copied there automatically.
4. If copying fails, the transaction and private local original remain saved. Use Retry save. You may need to choose the original folder again after permissions are revoked.
5. Older local receipts can be copied with Save to folder.

Names contain date, item, amount and transaction/receipt IDs. Receipts are copied directly into the chosen folder without adding subdirectories. Keep this folder separate from the app's JSON backup folder if preferred.

Google Drive availability in the folder picker depends on the installed provider. This feature does not implement direct Google Drive upload. A normal local folder works; users can move or sync its files to Drive separately.

JSON backups contain metadata only. Folder permissions and private originals do not transfer to another phone. Keep the exported receipt files with your backups. Clearing/changing the selected folder or deleting a transaction does not delete previously saved receipt originals.

Implementation: app-local source copy with byte/MD5 verification, 20 MB cap, SAF destination reservation, full byte read-back, latest-state SQL metadata updates, device-private destination binding to prevent arbitrary restored writes. Base64 is used only transiently for SAF file I/O. No financial entry is fabricated for a receipt copy.
