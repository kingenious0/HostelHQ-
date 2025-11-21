"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, type User as FirebaseUser } from "firebase/auth";
import { collection, doc, getDoc, onSnapshot, addDoc, updateDoc, serverTimestamp } from "firebase/firestore";
import { Header } from "@/components/header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { auth, db } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

interface HostelRequest {
  id: string;
  hostelName: string;
  location: string;
  campus?: string | null;
  approximateCapacity?: string | null;
  basePrice?: number | null;
  description?: string | null;
  notes?: string | null;
  images?: string[];
  managerId: string;
  managerEmail?: string;
  status: "pending" | "approved" | "rejected";
  createdAt?: string | Date;
}

interface AppUser {
  id: string;
  fullName?: string;
  email?: string;
  role?: string;
}

export default function AdminHostelRequestsPage() {
  const [currentUser, setCurrentUser] = useState<FirebaseUser | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [requests, setRequests] = useState<HostelRequest[]>([]);
  const [usersById, setUsersById] = useState<Record<string, AppUser>>({});
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

  // Listen for hostelRequests
  useEffect(() => {
    if (!currentUser || userRole !== "admin") return;

    setLoading(true);

    const unsub = onSnapshot(collection(db, "hostelRequests"), (snapshot) => {
      const reqs: HostelRequest[] = snapshot.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          hostelName: data.hostelName || "Unknown hostel",
          location: data.location || "—",
          campus: data.campus ?? null,
          approximateCapacity: data.approximateCapacity ?? null,
          basePrice: typeof data.basePrice === "number" ? data.basePrice : null,
          description: data.description ?? null,
          notes: data.notes ?? null,
          images: Array.isArray(data.images) ? data.images : [],
          managerId: data.managerId,
          managerEmail: data.managerEmail ?? undefined,
          status: (data.status || "pending") as HostelRequest["status"],
          createdAt: data.createdAt || undefined,
        };
      });

      setRequests(reqs);
      setLoading(false);
    });

    return () => unsub();
  }, [currentUser, userRole]);

  // Load minimal manager profiles for display whenever requests change
  useEffect(() => {
    const loadManagers = async () => {
      const uniqueManagerIds = Array.from(new Set(requests.map((r) => r.managerId).filter(Boolean)));
      if (uniqueManagerIds.length === 0) return;

      const loadedUsers: Record<string, AppUser> = {};
      await Promise.all(
        uniqueManagerIds.map(async (id) => {
          if (usersById[id]) return; // already loaded
          try {
            const snap = await getDoc(doc(db, "users", id));
            if (snap.exists()) {
              loadedUsers[id] = { id, ...(snap.data() as any) };
            }
          } catch (e) {
            console.error("Error loading manager profile for hostel request:", e);
          }
        })
      );

      if (Object.keys(loadedUsers).length > 0) {
        setUsersById((prev) => ({ ...prev, ...loadedUsers }));
      }
    };

    if (requests.length > 0) {
      void loadManagers();
    }
  }, [requests, usersById]);

  const handleApprove = async (request: HostelRequest) => {
    if (!currentUser) return;
    setProcessingId(request.id);
    toast({ title: "Approving hostel request..." });

    try {
      // Create a real hostel linked to the requesting manager
      const hostelRef = await addDoc(collection(db, "hostels"), {
        name: request.hostelName,
        location: request.location,
        campus: request.campus || null,
        description: request.description || null,
        basePrice: request.basePrice ?? null,
        approximateCapacity: request.approximateCapacity || null,
        managerId: request.managerId,
        createdFromRequestId: request.id,
        createdAt: serverTimestamp(),
        availability: "Available",
      });

      await updateDoc(doc(db, "hostelRequests", request.id), {
        status: "approved",
        approvedHostelId: hostelRef.id,
        processedAt: serverTimestamp(),
        processedBy: currentUser.uid,
      });

      toast({
        title: "Hostel request approved",
        description: `${request.hostelName} is now live and linked to the manager.`,
      });
    } catch (error) {
      console.error("Error approving hostel request:", error);
      toast({
        title: "Approval failed",
        description: "Could not approve this request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request: HostelRequest) => {
    if (!currentUser) return;
    if (!window.confirm("Reject this hostel request? The manager will see it as rejected.")) return;

    setProcessingId(request.id);

    try {
      await updateDoc(doc(db, "hostelRequests", request.id), {
        status: "rejected",
        processedAt: serverTimestamp(),
        processedBy: currentUser.uid,
      });

      toast({
        title: "Hostel request rejected",
      });
    } catch (error) {
      console.error("Error rejecting hostel request:", error);
      toast({
        title: "Rejection failed",
        description: "Could not reject this request. Please try again.",
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
        <main className="flex flex-1 items-center justify-center bg-gray-50/50 px-4 py-12">
          <Alert variant="destructive" className="max-w-lg">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Access denied</AlertTitle>
            <AlertDescription>You must be an admin to review hostel requests.</AlertDescription>
          </Alert>
        </main>
      </div>
    );
  }

  const pending = requests.filter((r) => r.status === "pending");
  const approved = requests.filter((r) => r.status === "approved");
  const rejected = requests.filter((r) => r.status === "rejected");

  const renderStatusBadge = (status: HostelRequest["status"]) => {
    if (status === "approved") return <Badge className="capitalize" variant="default">approved</Badge>;
    if (status === "rejected") return <Badge className="capitalize" variant="destructive">rejected</Badge>;
    return <Badge className="capitalize" variant="secondary">pending</Badge>;
  };

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 bg-gray-50/50 p-4 md:p-8">
        <div className="container mx-auto space-y-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-headline font-bold">Hostel Requests</h1>
              <p className="text-sm text-muted-foreground">
                Review hostel creation requests from managers and approve them to go live.
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => router.push("/admin/dashboard")}>
                Back to Admin Dashboard
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Pending Requests</CardTitle>
              <CardDescription>New hostels submitted by managers waiting for your decision.</CardDescription>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {loading ? (
                <div className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Loading requests...
                </div>
              ) : pending.length === 0 ? (
                <div className="py-12 text-center text-sm text-muted-foreground">No pending hostel requests.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Hostel</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Manager</TableHead>
                      <TableHead>Details</TableHead>
                      <TableHead>Photos</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pending.map((req) => {
                      const manager = usersById[req.managerId];
                      const createdDate = req.createdAt ? new Date(req.createdAt as any) : null;
                      return (
                        <TableRow key={req.id}>
                          <TableCell>
                            <div className="font-semibold">{req.hostelName}</div>
                            <p className="text-xs text-muted-foreground">
                              {createdDate ? createdDate.toLocaleDateString() : "—"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{req.location}</div>
                            {req.campus && (
                              <p className="text-xs text-muted-foreground">{req.campus}</p>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">{manager?.fullName || "Unknown manager"}</div>
                            <p className="text-xs text-muted-foreground">
                              {req.managerEmail || manager?.email || "No email"}
                            </p>
                          </TableCell>
                          <TableCell>
                            <div className="space-y-1 text-xs text-muted-foreground max-w-xs">
                              {req.approximateCapacity && (
                                <p>Capacity: {req.approximateCapacity}</p>
                              )}
                              {typeof req.basePrice === "number" && (
                                <p>Base price: GHS {req.basePrice.toLocaleString()}</p>
                              )}
                              {req.description && <p>{req.description}</p>}
                              {req.notes && <p className="italic">Note: {req.notes}</p>}
                            </div>
                          </TableCell>
                          <TableCell>
                            {req.images && req.images.length > 0 ? (
                              <div className="flex gap-1">
                                {req.images.slice(0, 3).map((url, idx) => (
                                  <div key={idx} className="relative h-10 w-10 rounded-md overflow-hidden bg-muted">
                                    <Image
                                      src={url}
                                      alt={req.hostelName}
                                      fill
                                      sizes="40px"
                                      style={{ objectFit: "cover" }}
                                    />
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">No photos</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApprove(req)}
                              disabled={processingId === req.id}
                            >
                              {processingId === req.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="mr-2 h-4 w-4" />
                              )}
                              Approve
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleReject(req)}
                              disabled={processingId === req.id}
                            >
                              {processingId === req.id ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <XCircle className="mr-2 h-4 w-4" />
                              )}
                              Reject
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-8 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Approved Requests</CardTitle>
                <CardDescription>Recently approved hostel requests.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto max-h-[320px]">
                {approved.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No approved requests yet.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hostel</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {approved.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="font-medium">{req.hostelName}</TableCell>
                          <TableCell>{req.location}</TableCell>
                          <TableCell>{renderStatusBadge(req.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Rejected Requests</CardTitle>
                <CardDescription>Requests that were not approved.</CardDescription>
              </CardHeader>
              <CardContent className="overflow-x-auto max-h-[320px]">
                {rejected.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No rejected requests.</div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Hostel</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rejected.map((req) => (
                        <TableRow key={req.id}>
                          <TableCell className="font-medium">{req.hostelName}</TableCell>
                          <TableCell>{req.location}</TableCell>
                          <TableCell>{renderStatusBadge(req.status)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
