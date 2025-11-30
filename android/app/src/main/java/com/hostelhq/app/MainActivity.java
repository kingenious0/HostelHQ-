package com.hostelhq.app;

import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import androidx.webkit.WebSettingsCompat;
import androidx.webkit.WebViewFeature;

public class MainActivity extends BridgeActivity {
    
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        
        // Enable WebAuthn support in WebView for fingerprint authentication
        enableWebAuthnSupport();
    }
    
    private void enableWebAuthnSupport() {
        try {
            // Get the WebView from Capacitor's bridge
            WebView webView = getBridge().getWebView();
            
            if (webView != null) {
                // Check if WebAuthn is supported in this WebView version
                if (WebViewFeature.isFeatureSupported(WebViewFeature.WEB_AUTHN)) {
                    WebSettingsCompat.setWebAuthenticationSupport(
                        webView.getSettings(),
                        WebSettingsCompat.WEB_AUTHN_SUPPORT_FOR_APP
                    );
                    android.util.Log.d("HostelHQ", "WebAuthn support enabled in WebView");
                } else {
                    android.util.Log.w("HostelHQ", "WebAuthn not supported in this WebView version");
                }
            }
        } catch (Exception e) {
            android.util.Log.e("HostelHQ", "Error enabling WebAuthn: " + e.getMessage());
        }
    }
}
