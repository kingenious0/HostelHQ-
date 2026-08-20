"use client";

import { useState } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { auth } from "@/lib/firebase";
import { sendNotification } from "@/lib/notification-service";
import { Loader2 } from "lucide-react";

export default function TestNotificationPage() {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleTestNotification = async () => {
    const user = auth.currentUser;
    if (!user) {
      toast({
        title: "Not logged in",
        description: "Please log in to test notifications",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      console.log("[Test] Sending test notification to:", user.uid);
      
      const result = await sendNotification({
        userId: user.uid,
        title: "🧪 Test Notification",
        body: "This is a test notification from HostelHQ. If you see this, notifications are working!",
        url: "/",
        tag: "test-notification",
      });

      console.log("[Test] Notification sent successfully:", result);

      toast({
        title: "✅ Notification Sent!",
        description: `Sent to ${result.sent} device(s). Check your notification bell!`,
      });
    } catch (error: any) {
      console.error("[Test] Failed to send notification:", error);
      toast({
        title: "❌ Failed to send",
        description: error.message || "Check console for details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-1 container mx-auto px-4 py-12">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>🧪 Test Notifications</CardTitle>
            <CardDescription>
              Send a test notification to yourself to verify the system is working
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h3 className="font-semibold">Before testing:</h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                <li>Make sure you're logged in</li>
                <li>Enable notifications (click your profile → Enable Notifications)</li>
                <li>Grant permission when browser asks</li>
                <li>Open browser console (F12) to see detailed logs</li>
              </ol>
            </div>

            <Button
              onClick={handleTestNotification}
              disabled={loading}
              size="lg"
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Test Notification"
              )}
            </Button>

            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg space-y-2">
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">
                What to expect:
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-blue-800 dark:text-blue-200">
                <li>Browser push notification (if tab is in background)</li>
                <li>Red badge on notification bell icon</li>
                <li>Notification appears in bell dropdown</li>
                <li>Console logs showing the process</li>
              </ul>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg space-y-2">
              <h3 className="font-semibold text-yellow-900 dark:text-yellow-100">
                Common issues:
              </h3>
              <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800 dark:text-yellow-200">
                <li>
                  <strong>No FCM tokens found:</strong> You haven't enabled notifications yet
                </li>
                <li>
                  <strong>Firebase Admin error:</strong> Server-side Firebase not configured
                </li>
                <li>
                  <strong>CORS error:</strong> API route issue (shouldn't happen in Next.js)
                </li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
