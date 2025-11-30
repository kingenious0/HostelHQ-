"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { collection, doc, getDoc, query, where, onSnapshot, updateDoc, deleteDoc } from "firebase/firestore";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle2, XCircle, Star } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";

interface Review {
  id: string;
  hostelId: string;
  studentId: string;
  studentName: string;
  studentEmail?: string;
  studentPhone?: string;
  rating: number;
  comment: string;
  status: "pending" | "approved" | "rejected";
  flaggedForProfanity?: boolean;
  createdAt?: any;
}

export default function AdminReviewsPage() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [hostelsById, setHostelsById] = useState<Record<string, any>>({});
  const { toast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (userSnap.exists()) {
          const data = userSnap.data() as any;
          setUserRole(data.role ?? null);
        } else {
          setUserRole(null);
        }
      } else {
        setUserRole(null);
      }
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Listen for flagged reviews (pending status)
  useEffect(() => {
    if (!currentUser || userRole !== "admin") return;

    setLoading(true);

    const q = query(collection(db, "reviews"), where("status", "==", "pending"));
    const unsub = onSnapshot(q, (snapshot) => {
      const reviewsList: Review[] = snapshot.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          hostelId: data.hostelId || "",
          studentId: data.studentId || "",
          studentName: data.studentName || "Anonymous",
          studentEmail: data.studentEmail,
          studentPhone: data.studentPhone,
          rating: data.rating || 0,
          comment: data.comment || "",
          status: data.status || "pending",
          flaggedForProfanity: data.flaggedForProfanity || false,
          createdAt: data.createdAt || undefined,
        };
      });

      setReviews(reviewsList);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser, userRole]);

  // Load hostel names for display
  useEffect(() => {
    const loadHostels = async () => {
      const uniqueHostelIds = Array.from(new Set(reviews.map((r) => r.hostelId).filter(Boolean)));
      if (uniqueHostelIds.length === 0) return;

      const loadedHostels: Record<string, any> = {};
      await Promise.all(
        uniqueHostelIds.map(async (id) => {
          if (hostelsById[id]) return;
          try {
            const snap = await getDoc(doc(db, "hostels", id));
            if (snap.exists()) {
              loadedHostels[id] = { id, name: snap.data().name || "Unknown Hostel" };
            }
          } catch (e) {
            console.error("Error loading hostel for review:", e);
          }
        })
      );

      if (Object.keys(loadedHostels).length > 0) {
        setHostelsById((prev) => ({ ...prev, ...loadedHostels }));
      }
    };

    if (reviews.length > 0) {
      void loadHostels();
    }
  }, [reviews, hostelsById]);

  const handleApprove = async (review: Review) => {
    if (!currentUser) return;
    setProcessingId(review.id);
    toast({ title: "Approving review..." });

    try {
      await updateDoc(doc(db, "reviews", review.id), {
        status: "approved",
        approvedAt: new Date().toISOString(),
        approvedBy: currentUser.uid,
      });

      toast({
        title: "Review Approved",
        description: "The review is now live on the hostel page.",
      });
    } catch (error) {
      console.error("Error approving review:", error);
      toast({
        title: "Approval failed",
        description: "Could not approve this review. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (review: Review) => {
    if (!currentUser) return;
    if (!window.confirm("Reject this review? It will be permanently deleted.")) return;

    setProcessingId(review.id);

    try {
      await deleteDoc(doc(db, "reviews", review.id));

      toast({
        title: "Review Rejected",
        description: "The review has been deleted.",
      });
    } catch (error) {
      console.error("Error rejecting review:", error);
      toast({
        title: "Rejection failed",
        description: "Could not reject this review. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="flex flex-1 items-center justify-center">
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
        </main>
      </div>
    );
  }

  if (!currentUser || userRole !== "admin") {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <main className="container mx-auto px-4 py-12">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Access Denied</AlertTitle>
            <AlertDescription>You must be an admin to view this page.</AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="container mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Flagged Reviews</h1>
          <p className="text-muted-foreground mt-2">
            Reviews containing inappropriate content that require manual approval
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Pending Reviews ({reviews.length})</CardTitle>
            <CardDescription>
              Reviews flagged by the profanity filter for admin review
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-3" />
                <p className="text-muted-foreground">No flagged reviews at the moment!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((review) => {
                  const hostel = hostelsById[review.hostelId];
                  const isProcessing = processingId === review.id;

                  return (
                    <Card key={review.id} className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
                      <CardContent className="pt-6">
                        <div className="space-y-3">
                          <div className="flex items-start justify-between">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                <h3 className="font-semibold">{review.studentName}</h3>
                                <Badge variant="destructive">Flagged</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {hostel?.name || "Loading hostel..."}
                              </p>
                              <div className="flex items-center gap-1">
                                {Array.from({ length: 5 }).map((_, i) => (
                                  <Star
                                    key={i}
                                    className={`h-4 w-4 ${
                                      i < review.rating
                                        ? "text-yellow-400 fill-yellow-400"
                                        : "text-gray-300"
                                    }`}
                                  />
                                ))}
                                <span className="text-sm text-muted-foreground ml-1">
                                  ({review.rating}/5)
                                </span>
                              </div>
                            </div>
                            <div className="text-right text-sm text-muted-foreground">
                              <p>{review.studentEmail}</p>
                              <p>{review.studentPhone}</p>
                            </div>
                          </div>

                          <div className="rounded-lg bg-background p-3 border">
                            <p className="text-sm">{review.comment}</p>
                          </div>

                          <div className="flex gap-2 justify-end">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleReject(review)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <XCircle className="h-4 w-4 mr-1" />
                                  Reject & Delete
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleApprove(review)}
                              disabled={isProcessing}
                            >
                              {isProcessing ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle2 className="h-4 w-4 mr-1" />
                                  Approve
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
