# English4Kids — ProGuard / R8 rules (Sprint 5, S5-2).
#
# R8 strips unused classes and renames members in release builds. The default
# Capacitor template is conservative but lets a few Next.js / wasm runtime
# symbols through that we have to keep by name. These rules are merged into
# android/app/proguard-rules.pro by the post-cap-add.sh script.

# ---------------------------------------------------------------------------
# Capacitor core + plugins
# ---------------------------------------------------------------------------
-keep public class com.getcapacitor.** { *; }
-keep public class com.getcapacitor.plugin.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * {
    @com.getcapacitor.PluginMethod public *;
}

# Community Microphone + SpeechRecognition plugins use reflection to wire
# their JS bridge methods.
-keep class com.getcapacitor.community.microphone.** { *; }
-keep class com.getcapacitor.community.speechrecognition.** { *; }

# ---------------------------------------------------------------------------
# WebView JavaScript bridge
# ---------------------------------------------------------------------------
-keepattributes JavascriptInterface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# ---------------------------------------------------------------------------
# whisper.wasm runtime
# ---------------------------------------------------------------------------
# The wasm loader looks up the model file by string name at runtime; keep
# the assets path resolver intact.
-keep class app.english4kids.assets.** { *; }

# ---------------------------------------------------------------------------
# Source file + line number preservation
# ---------------------------------------------------------------------------
# Crash reports (when the user runs `adb logcat` locally) are useless without
# line numbers. Keep these — they add ~100KB to the AAB which is negligible.
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# ---------------------------------------------------------------------------
# AndroidX + Kotlin metadata
# ---------------------------------------------------------------------------
-keepclassmembers class kotlin.Metadata { *; }
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn org.openjsse.**
