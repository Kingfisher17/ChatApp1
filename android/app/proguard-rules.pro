# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.

# React Native
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
}
-keepclassmembers @com.facebook.proguard.annotations.KeepGettersAndSetters class * {
  void set*(***);
  *** get*();
}

# SQLite
-keep class io.liteglue.** { *; }
-keep class org.sqlite.** { *; }
-dontwarn io.liteglue.**
-dontwarn org.sqlite.**

# React Native FS
-keep class com.rnfs.** { *; }
-dontwarn com.rnfs.**

# React Native Image Picker
-keep class com.imagepicker.** { *; }
-dontwarn com.imagepicker.**

# React Native Video
-keep class com.brentvatne.react.** { *; }
-dontwarn com.brentvatne.react.**

# React Native Audio Recorder Player
-keep class com.hyochan.** { *; }
-dontwarn com.hyochan.**
