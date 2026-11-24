# WorkManager (dipakai ML Kit) membuat WorkDatabase lewat refleksi Room; jangan dihapus R8.
-keep class androidx.work.** { *; }
-keep class androidx.room.** { *; }
-keep class * extends androidx.room.RoomDatabase { *; }
-keep class androidx.startup.** { *; }
-dontwarn androidx.work.**
