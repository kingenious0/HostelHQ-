package com.hostelhq.app;

import android.annotation.SuppressLint;
import android.content.Intent;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.widget.VideoView;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.splashscreen.SplashScreen;

@SuppressLint("CustomSplashScreen")
public class VideoSplashActivity extends AppCompatActivity {

    private VideoView videoView;
    private boolean isVideoReady = false;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Install and hold the splash screen
        SplashScreen splashScreen = SplashScreen.installSplashScreen(this);
        super.onCreate(savedInstanceState);

        // Keep the splash screen visible until the video is ready to play
        splashScreen.setKeepOnScreenCondition(() -> !isVideoReady);

        // Set immersive mode
        View decorView = getWindow().getDecorView();
        int uiOptions = View.SYSTEM_UI_FLAG_FULLSCREEN |
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
        decorView.setSystemUiVisibility(uiOptions);

        setContentView(R.layout.activity_video_splash);

        videoView = findViewById(R.id.videoView);
        Uri videoUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.splash_video);
        videoView.setVideoURI(videoUri);

        videoView.setOnPreparedListener(mp -> {
            // Video is ready. Let the splash screen go and start playback.
            isVideoReady = true;
            mp.start();
        });

        videoView.setOnCompletionListener(mp -> startMainActivity());

        videoView.setOnErrorListener((mp, what, extra) -> {
            // On error, skip the video and go to the main activity.
            startMainActivity();
            return true;
        });
    }

    private void startMainActivity() {
        if (isFinishing()) {
            return;
        }
        Intent intent = new Intent(VideoSplashActivity.this, MainActivity.class);
        startActivity(intent);
        finish();
        overridePendingTransition(android.R.anim.fade_in, android.R.anim.fade_out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (videoView != null && videoView.isPlaying()) {
            videoView.pause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (videoView != null && !videoView.isPlaying() && isVideoReady) {
            videoView.start();
        }
    }
}
