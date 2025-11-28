package com.hostelhq.app;

import android.content.Intent;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.view.View;
import android.widget.VideoView;
import androidx.appcompat.app.AppCompatActivity;

public class VideoSplashActivity extends AppCompatActivity {
    private VideoView videoView;
    private static final int SPLASH_DURATION = 3000; // 3 seconds fallback

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Hide system bars for immersive experience
        View decorView = getWindow().getDecorView();
        int uiOptions = View.SYSTEM_UI_FLAG_FULLSCREEN | 
                       View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | 
                       View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;
        decorView.setSystemUiVisibility(uiOptions);
        
        setContentView(R.layout.activity_video_splash);
        
        videoView = findViewById(R.id.videoView);
        
        // Load video from raw resources
        Uri videoUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.splash_video);
        videoView.setVideoURI(videoUri);
        
        // Set up video completion listener
        videoView.setOnCompletionListener(new MediaPlayer.OnCompletionListener() {
            @Override
            public void onCompletion(MediaPlayer mp) {
                startMainActivity();
            }
        });
        
        // Set up error listener
        videoView.setOnErrorListener(new MediaPlayer.OnErrorListener() {
            @Override
            public boolean onError(MediaPlayer mp, int what, int extra) {
                // If video fails, start main activity after delay
                new Handler().postDelayed(new Runnable() {
                    @Override
                    public void run() {
                        startMainActivity();
                    }
                }, SPLASH_DURATION);
                return true;
            }
        });
        
        // Start video playback
        videoView.start();
        
        // Fallback timer in case video doesn't complete
        new Handler().postDelayed(new Runnable() {
            @Override
            public void run() {
                if (videoView.isPlaying()) {
                    videoView.stopPlayback();
                }
                startMainActivity();
            }
        }, SPLASH_DURATION);
    }
    
    private void startMainActivity() {
        Intent intent = new Intent(VideoSplashActivity.this, MainActivity.class);
        startActivity(intent);
        finish();
        // Override transition for smooth fade
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
        if (videoView != null && !videoView.isPlaying()) {
            videoView.start();
        }
    }
}
