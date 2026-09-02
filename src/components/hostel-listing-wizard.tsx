"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Upload,
  Sparkles,
  MapPin,
  Loader2,
  AlertTriangle,
  DollarSign,
  PlusCircle,
  Trash2,
  BedDouble,
  ShieldCheck,
  FileText,
  Lightbulb,
  Building,
  Check,
  ArrowRight,
  ArrowLeft,
  Camera,
  Layers,
  Sparkle,
  Film,
  Video,
  Play,
  Eye,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, collection, addDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { onAuthStateChanged, User } from "firebase/auth";
import { uploadImage, uploadVideo } from "@/lib/cloudinary";
import { RoomType, Hostel } from "@/lib/data";
import { HostelLocationPicker } from "@/components/hostel-location-picker";
import { enhanceHostelDescription } from "@/ai/flows/enhance-hostel-description";
import { saveHostelAction } from "@/app/actions/db";

const hostelAmenitiesList = [
  "WiFi",
  "Car Parking Space",
  "DSTV Room",
  "General Kitchen",
  "Study Room",
  "Laundry",
  "Gym",
  "Security",
];

const roomAmenitiesList = [
  "Private Washroom",
  "Shared Washroom",
  "Mattress",
  "Wardrobe",
  "Furniture (Table, Chair)",
  "TV",
  "Ceiling Fan",
  "Balcony",
  "Private Kitchen",
  "AC",
];

const billsIncludedList = ["Water", "Refuse"];
const billsExcludedList = ["Gas", "Electricity"];
const securitySafetyList = [
  "Security Alarm",
  "Maintenance Team (24-hour on call)",
  "Entire Building Fenced",
  "Controlled Access Gate (24-hour)",
  "Tanoso Police Station (close)",
];

const deriveCapacityFromName = (name?: string | null) => {
  if (!name) return 0;
  const numericMatch = name.match(/\d+/);
  if (numericMatch) return Number(numericMatch[0]);
  const words: Record<string, number> = {
    one: 1,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
    seven: 7,
    eight: 8,
  };
  const first = name.trim().split(" ")[0]?.toLowerCase() ?? "";
  return words[first] ?? 0;
};

interface HostelListingWizardProps {
  mode: "admin" | "manager";
}

export function HostelListingWizard({ mode }: HostelListingWizardProps) {
  const [step, setStep] = useState(1);
  const totalSteps = 6;
  const progress = (step / totalSteps) * 100;

  const router = useRouter();
  const { toast } = useToast();

  // Auth State
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loadingAuth, setLoadingAuth] = useState(true);

  // Form State
  // Step 1: Basics
  const [hostelName, setHostelName] = useState("");
  const [institution, setInstitution] = useState("KNUST KUMASI CAMPUS");
  const [gender, setGender] = useState("Mixed");
  const [nearbyLandmarks, setNearbyLandmarks] = useState("");
  const [distanceToUni, setDistanceToUni] = useState("");
  const [description, setDescription] = useState("");

  // Step 2: Location (GhanaPostGPS + Map)
  const [locationData, setLocationData] = useState<{
    lat: number | null;
    lng: number | null;
    address: string;
    digitalAddress?: string;
  }>({
    lat: null,
    lng: null,
    address: "",
    digitalAddress: "",
  });

  // Step 3: Room Types & Pricing
  const [roomTypes, setRoomTypes] = useState<Partial<RoomType>[]>([
    {
      name: "1 in a room",
      price: 0,
      availability: "Available",
      capacity: 1,
      occupancy: 0,
      numberOfRooms: 1,
      roomNumbers: ["101"],
      roomAmenities: ["Mattress", "Wardrobe", "Ceiling Fan"],
      images: [],
      videos: [],
    },
  ]);

  type RoomMediaItem = {
    file: File;
    previewUrl: string;
    type: "image" | "video";
  };
  const [roomTypeMedia, setRoomTypeMedia] = useState<Record<number, RoomMediaItem[]>>({});

  // Step 4: Amenities & Policies
  const [selectedAmenities, setSelectedAmenities] = useState<string[]>([
    "WiFi",
    "Security",
    "General Kitchen",
  ]);
  const [billsIncluded, setBillsIncluded] = useState<string[]>(["Water", "Refuse"]);
  const [billsExcluded, setBillsExcluded] = useState<string[]>(["Electricity"]);
  const [securityAndSafety, setSecurityAndSafety] = useState<string[]>([
    "Controlled Access Gate (24-hour)",
    "Entire Building Fenced",
  ]);

  // Step 5: Photos
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);

  // UI state
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const userDoc = await getDoc(doc(db, "users", user.uid));
          if (userDoc.exists()) {
            setUserRole(userDoc.data().role);
          }
        } catch (e) {
          console.error("Error fetching user role:", e);
        }
      }
      setLoadingAuth(false);
    });
    return () => unsubscribe();
  }, []);

  // Room Type Handlers
  const handleRoomTypeChange = (
    index: number,
    field: keyof RoomType,
    val: string | number | undefined
  ) => {
    const updated = [...roomTypes];
    (updated[index] as any)[field] = val;

    if (field === "name") {
      const derived = deriveCapacityFromName(String(val));
      if (derived > 0) {
        (updated[index] as any).capacity = derived;
      }
    }

    setRoomTypes(updated);
  };

  const addRoomType = () => {
    setRoomTypes([
      ...roomTypes,
      {
        name: "",
        price: 0,
        availability: "Available",
        capacity: 0,
        occupancy: 0,
        numberOfRooms: 1,
        roomAmenities: [],
        images: [],
        videos: [],
      },
    ]);
  };

  const removeRoomType = (index: number) => {
    if (roomTypes.length <= 1) {
      toast({
        title: "Cannot Remove",
        description: "You must have at least one room type.",
        variant: "destructive",
      });
      return;
    }
    setRoomTypes(roomTypes.filter((_, i) => i !== index));
    setRoomTypeMedia((prev) => {
      const next: Record<number, RoomMediaItem[]> = {};
      let nextIdx = 0;
      for (let i = 0; i < roomTypes.length; i++) {
        if (i !== index) {
          if (prev[i]) {
            next[nextIdx] = prev[i];
          }
          nextIdx++;
        }
      }
      return next;
    });
  };

  const handleAddRoomMedia = (roomIndex: number, e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const files = Array.from(e.target.files);
      const newItems: RoomMediaItem[] = files.map((file) => ({
        file,
        previewUrl: URL.createObjectURL(file),
        type: file.type.startsWith("video/") ? "video" : "image",
      }));
      setRoomTypeMedia((prev) => ({
        ...prev,
        [roomIndex]: [...(prev[roomIndex] || []), ...newItems],
      }));
    }
    e.target.value = "";
  };

  const handleRemoveRoomMedia = (roomIndex: number, mediaIndex: number) => {
    setRoomTypeMedia((prev) => {
      const list = prev[roomIndex] || [];
      return {
        ...prev,
        [roomIndex]: list.filter((_, i) => i !== mediaIndex),
      };
    });
  };

  const toggleRoomNumberForType = (index: number, val: string, checked: boolean) => {
    const updated = [...roomTypes];
    const current = updated[index].roomNumbers || [];
    const targetCount = updated[index].numberOfRooms ?? 0;

    if (checked && targetCount > 0 && current.length >= targetCount) {
      toast({
        title: "Room number limit reached",
        description: `You set Number of Rooms to ${targetCount}. You cannot select more than ${targetCount} room numbers.`,
        variant: "destructive",
      });
      return;
    }

    updated[index].roomNumbers = checked
      ? Array.from(new Set([...current, val]))
      : current.filter((v) => v !== val);

    setRoomTypes(updated);
  };

  const toggleCheckbox = (
    setter: React.Dispatch<React.SetStateAction<string[]>>,
    item: string,
    checked: boolean
  ) => {
    setter((prev) => (checked ? [...prev, item] : prev.filter((i) => i !== item)));
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files).slice(0, 8 - photos.length);
      if (files.length > 0) {
        setPhotos((prev) => [...prev, ...files]);
        const newPreviews = files.map((file) => URL.createObjectURL(file));
        setPhotoPreviews((prev) => [...prev, ...newPreviews]);
      }
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  // AI Description Enhancement
  const handleEnhanceDescription = async () => {
    if (!description && !hostelName) {
      toast({
        title: "Information Needed",
        description: "Please enter at least a hostel name or draft description first.",
        variant: "destructive",
      });
      return;
    }

    setIsEnhancing(true);
    try {
      const enhanced = await enhanceHostelDescription({
        photosDataUris: photoPreviews.length > 0 ? photoPreviews : [],
        gpsLocation: locationData.lat && locationData.lng ? `${locationData.lat}, ${locationData.lng}` : "Near Campus",
        nearbyLandmarks: nearbyLandmarks.trim() || locationData.address || "Near University Campus",
        amenities: selectedAmenities.join(", "),
        roomFeatures: roomTypes.map((rt) => `${rt.name} (GH₵${rt.price})`).join(", "),
        currentDescription: description.trim() || `${hostelName} student accommodation.`,
      });

      if (enhanced?.enhancedDescription) {
        setDescription(enhanced.enhancedDescription);
        toast({
          title: "Description Enhanced",
          description: "AI polished your description for student appeal.",
        });
      }
    } catch (err) {
      console.error("AI enhancement error:", err);
      toast({
        title: "Enhancement Failed",
        description: "Could not enhance description at this time.",
        variant: "destructive",
      });
    } finally {
      setIsEnhancing(false);
    }
  };

  // Validation per step
  const validateStep = (currentStep: number): boolean => {
    if (currentStep === 1) {
      if (!hostelName.trim()) {
        toast({
          title: "Hostel Name Required",
          description: "Please enter the official name of your hostel.",
          variant: "destructive",
        });
        return false;
      }
      if (!institution.trim()) {
        toast({
          title: "Institution Required",
          description: "Please select the nearest university campus.",
          variant: "destructive",
        });
        return false;
      }
      if (!distanceToUni.trim()) {
        toast({
          title: "Distance Required",
          description: "Please specify approximate distance to campus (e.g. 5 mins walk).",
          variant: "destructive",
        });
        return false;
      }
    }

    if (currentStep === 2) {
      // Location Validation (blocking condition per spec)
      if (
        !locationData.lat ||
        !locationData.lng ||
        isNaN(locationData.lat) ||
        isNaN(locationData.lng)
      ) {
        toast({
          title: "Location Coordinates Required",
          description:
            "Please look up a GhanaPostGPS address or drop a manual pin on the map before continuing.",
          variant: "destructive",
        });
        return false;
      }
    }

    if (currentStep === 3) {
      if (roomTypes.length === 0) {
        toast({
          title: "Room Type Required",
          description: "Please add at least one room configuration.",
          variant: "destructive",
        });
        return false;
      }
      for (const [i, rt] of roomTypes.entries()) {
        if (!rt.name?.trim()) {
          toast({
            title: "Room Name Missing",
            description: `Room Type ${i + 1} needs a name (e.g. 2 in a room).`,
            variant: "destructive",
          });
          return false;
        }
        if (!rt.price || rt.price <= 0) {
          toast({
            title: "Price Required",
            description: `Room Type ${i + 1} needs a valid price in GH₵.`,
            variant: "destructive",
          });
          return false;
        }
      }
    }

    if (currentStep === 5) {
      if (photos.length === 0) {
        toast({
          title: "Photos Required",
          description: "Please upload at least 1 photo of the hostel or room.",
          variant: "destructive",
        });
        return false;
      }
    }

    return true;
  };

  const nextStep = () => {
    if (validateStep(step)) {
      setStep((s) => Math.min(s + 1, totalSteps));
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  const prevStep = () => {
    setStep((s) => Math.max(s - 1, 1));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Final Submission
  const handleSubmit = async () => {
    if (!validateStep(step)) return;

    if (!currentUser) {
      toast({
        title: "Authentication Required",
        description: "Please log in to submit this hostel.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    toast({
      title: "Submitting Hostel...",
      description: "Uploading media and saving property records.",
    });

    try {
      // 1. Upload photos to Cloudinary
      const uploadedImageUrls: string[] = [];
      for (const file of photos) {
        const url = await uploadImage(file);
        uploadedImageUrls.push(url);
      }

      // 2. Upload per-room-type media (images and videos) to Cloudinary with auto-compression
      const processedRoomTypes: RoomType[] = [];
      for (let index = 0; index < roomTypes.length; index++) {
        const rt = roomTypes[index];
        const mediaItems = roomTypeMedia[index] || [];
        const roomImages: string[] = [];
        const roomVideos: string[] = [];

        for (const item of mediaItems) {
          try {
            if (item.type === "video") {
              const videoUrl = await uploadVideo(item.file);
              roomVideos.push(videoUrl);
            } else {
              const imgUrl = await uploadImage(item.file);
              roomImages.push(imgUrl);
            }
          } catch (uploadErr) {
            console.warn(`Error uploading media for room ${rt.name || index}:`, uploadErr);
          }
        }

        processedRoomTypes.push({
          id: `rt-${index + 1}-${Date.now()}`,
          name: rt.name || "Standard Room",
          price: rt.price || 0,
          availability: rt.availability || "Available",
          capacity: rt.capacity || 1,
          occupancy: rt.occupancy || 0,
          numberOfRooms: rt.numberOfRooms || 1,
          roomNumbers: rt.roomNumbers || [],
          roomAmenities: rt.roomAmenities || [],
          images: roomImages,
          videos: roomVideos,
        });
      }

      const minPrice = Math.min(...roomTypes.map((r) => r.price || 0));
      const maxPrice = Math.max(...roomTypes.map((r) => r.price || 0));

      const isPending = mode === "manager";
      const hostelId = `hostel_${Date.now()}`;

      const hostelPayload: any = {
        id: hostelId,
        originalId: hostelId,
        name: hostelName.trim(),
        location: locationData.address || nearbyLandmarks,
        institution,
        gender,
        nearbyLandmarks: nearbyLandmarks.trim(),
        distanceToUniversity: distanceToUni.trim(),
        description:
          description.trim() ||
          `${hostelName} provides verified university accommodation near ${institution}.`,
        amenities: selectedAmenities,
        roomAmenities: Array.from(new Set(roomTypes.flatMap((r) => r.roomAmenities || []))),
        billsIncluded,
        billsExcluded,
        securityAndSafety,
        images: uploadedImageUrls.length > 0 ? uploadedImageUrls : ["/hero-student-housing.jpg"],
        priceRange: { min: minPrice, max: maxPrice },
        roomTypes: processedRoomTypes,
        availability: "Available",
        rating: 5.0,
        reviewCount: 0,
        verified: mode === "admin",
        status: isPending ? "pending" : "approved",
        latitude: locationData.lat,
        longitude: locationData.lng,
        digitalAddress: locationData.digitalAddress || null,
        fullAddress: locationData.address,
        managerId: currentUser.uid,
        managerEmail: currentUser.email || "",
        createdAt: new Date().toISOString(),
      };

      // 2. Save directly to primary DynamoDB via Server Action
      await saveHostelAction(hostelPayload, isPending);

      // 3. Sync to Firestore with identical ID for real-time manager, admin & fallback listeners
      await setDoc(doc(db, "hostels", hostelId), {
        ...hostelPayload,
        createdAt: serverTimestamp(),
      });

      // Also persist roomTypes subcollection for Firestore fallback compatibility
      if (Array.isArray(hostelPayload.roomTypes)) {
        for (const rt of hostelPayload.roomTypes) {
          try {
            await setDoc(doc(db, "hostels", hostelId, "roomTypes", rt.id), rt);
          } catch (rtErr) {
            console.warn("Subcollection room write warning:", rtErr);
          }
        }
      }

      // If manager mode, also log a hostel request entry for tracking
      if (mode === "manager") {
        await addDoc(collection(db, "hostelRequests"), {
          hostelId: hostelId,
          hostelName: hostelName.trim(),
          location: locationData.address || nearbyLandmarks,
          managerId: currentUser.uid,
          managerEmail: currentUser.email,
          status: "pending",
          createdAt: new Date().toISOString(),
        });

        toast({
          title: "Registration Submitted!",
          description:
            "Your hostel has been submitted and is queued for verification by the University Coordinator.",
        });

        router.push("/manager/dashboard#hostels");
      } else {
        toast({
          title: "Hostel Published!",
          description: "New hostel is now live and approved on HostelHQ.",
        });

        router.push("/admin/dashboard");
      }
    } catch (err: any) {
      console.error("Failed to submit hostel:", err);
      toast({
        title: "Submission Error",
        description: err.message || "Failed to save hostel record. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadingAuth) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
      </div>
    );
  }

  if (mode === "admin" && userRole !== "admin") {
    return (
      <div className="max-w-xl mx-auto py-12 px-4">
        <Alert variant="destructive" className="rounded-2xl">
          <AlertTriangle className="h-5 w-5" />
          <AlertTitle>Admin Access Required</AlertTitle>
          <AlertDescription>
            You must be logged in as an Administrator to access direct hostel creation.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="w-full max-w-3xl mx-auto py-6 px-4">
      {/* Wizard Progress & Header */}
      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-muted-foreground">
          <span>
            {mode === "admin" ? "Admin Listing Tool" : "Manager Property Registration"}
          </span>
          <span className="text-primary font-extrabold">
            Step {step} of {totalSteps}
          </span>
        </div>

        <Progress value={progress} className="h-2 rounded-full bg-muted" />

        <div className="flex justify-between items-center pt-2">
          <h2 className="text-2xl sm:text-3xl font-headline font-extrabold text-foreground">
            {step === 1 && "Property Basics & Identity"}
            {step === 2 && "Location & GhanaPostGPS"}
            {step === 3 && "Room Configurations & Pricing"}
            {step === 4 && "Amenities & Facilities"}
            {step === 5 && "Property Photography"}
            {step === 6 && "Review & Submit"}
          </h2>
          <Badge
            variant="outline"
            className="text-[11px] font-semibold hidden sm:inline-flex"
          >
            {mode === "admin" ? "Immediate Publish" : "Requires Coordinator Review"}
          </Badge>
        </div>
      </div>

      {/* Step Card Container */}
      <Card className="border border-border/80 shadow-xl rounded-3xl overflow-hidden bg-card">
        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* ================= STEP 1: BASICS ================= */}
          {step === 1 && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground flex items-start gap-2.5">
                <Lightbulb className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  Tip: Provide the official, recognizable name of the hostel as known on campus to
                  help students find you easily.
                </span>
              </div>

              <div className="space-y-2">
                <Label htmlFor="hostel-name" className="text-sm font-semibold">
                  Hostel Name *
                </Label>
                <Input
                  id="hostel-name"
                  placeholder="e.g., Pioneer Hall Annex"
                  value={hostelName}
                  onChange={(e) => setHostelName(e.target.value)}
                  className="rounded-xl h-11 text-base"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="institution" className="text-sm font-semibold">
                    Nearest Institution / Campus *
                  </Label>
                  <Select value={institution} onValueChange={setInstitution}>
                    <SelectTrigger id="institution" className="rounded-xl h-11">
                      <SelectValue placeholder="Select Campus" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="KNUST KUMASI CAMPUS">KNUST KUMASI CAMPUS</SelectItem>
                      <SelectItem value="KNUST OBUASI CAMPUS">KNUST OBUASI CAMPUS</SelectItem>
                      <SelectItem value="KUMASI TECHNICAL UNIVERSITY (KSTU)">
                        KUMASI TECHNICAL UNIVERSITY (KSTU)
                      </SelectItem>
                      <SelectItem value="UNIVERSITY OF GHANA (UG)">UNIVERSITY OF GHANA (UG)</SelectItem>
                      <SelectItem value="A A M U S T E D">A A M U S T E D</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gender" className="text-sm font-semibold">
                    Allowed Student Gender *
                  </Label>
                  <Select value={gender} onValueChange={setGender}>
                    <SelectTrigger id="gender" className="rounded-xl h-11">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mixed">Mixed (Male & Female)</SelectItem>
                      <SelectItem value="Male">Male Students Only</SelectItem>
                      <SelectItem value="Female">Female Students Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="landmarks" className="text-sm font-semibold">
                    Nearby Landmarks / Area
                  </Label>
                  <Input
                    id="landmarks"
                    placeholder="e.g., Near Post Office, Commercial Area"
                    value={nearbyLandmarks}
                    onChange={(e) => setNearbyLandmarks(e.target.value)}
                    className="rounded-xl h-11"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="distance" className="text-sm font-semibold">
                    Distance to Campus *
                  </Label>
                  <Input
                    id="distance"
                    placeholder="e.g., 5 mins walk / 10 mins drive"
                    value={distanceToUni}
                    onChange={(e) => setDistanceToUni(e.target.value)}
                    className="rounded-xl h-11"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="description" className="text-sm font-semibold">
                    Short Property Description
                  </Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleEnhanceDescription}
                    disabled={isEnhancing}
                    className="text-xs text-primary font-bold hover:bg-primary/10 gap-1 h-8 px-2"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    {isEnhancing ? "Enhancing..." : "Auto-Generate with AI"}
                  </Button>
                </div>
                <Textarea
                  id="description"
                  placeholder="Describe your hostel, vibe, study environment, and building condition..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="rounded-xl resize-none text-sm"
                />
              </div>
            </div>
          )}

          {/* ================= STEP 2: LOCATION (GHANAPOSTGPS) ================= */}
          {step === 2 && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>
                  HostelHQ uses official GhanaPostGPS digital addresses to calculate exact walking
                  distances and provide students with turnkey GPS directions for in-person tours.
                </span>
              </div>

              {/* Dedicated Reusable Location Picker */}
              <HostelLocationPicker
                value={locationData}
                onChange={(loc) => {
                  setLocationData(loc);
                }}
              />
            </div>
          )}

          {/* ================= STEP 3: ROOMS & PRICING ================= */}
          {step === 3 && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-foreground">Room Configurations</h3>
                  <p className="text-xs text-muted-foreground">
                    Set up room categories, yearly/semester rates, and room numbers.
                  </p>
                </div>
                <Button
                  type="button"
                  onClick={addRoomType}
                  size="sm"
                  variant="outline"
                  className="rounded-xl text-xs gap-1.5 font-bold"
                >
                  <PlusCircle className="h-4 w-4 text-primary" />
                  Add Another Room Type
                </Button>
              </div>

              <div className="space-y-5">
                {roomTypes.map((rt, i) => (
                  <div
                    key={i}
                    className="p-4 sm:p-5 rounded-2xl border border-border bg-muted/20 space-y-4 relative group"
                  >
                    <div className="flex items-center justify-between">
                      <Badge className="bg-primary/20 text-primary border-primary/30 text-xs font-bold">
                        Room Type #{i + 1}
                      </Badge>
                      {roomTypes.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeRoomType(i)}
                          className="h-8 w-8 text-rose-500 hover:text-rose-700 hover:bg-rose-500/10 rounded-full"
                          title="Remove room type"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Category Name *</Label>
                        <Select
                          value={rt.name}
                          onValueChange={(val) => handleRoomTypeChange(i, "name", val)}
                        >
                          <SelectTrigger className="rounded-xl h-10 text-xs">
                            <SelectValue placeholder="Select type" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="1 in a room">1 in a room (Single)</SelectItem>
                            <SelectItem value="2 in a room">2 in a room</SelectItem>
                            <SelectItem value="3 in a room">3 in a room</SelectItem>
                            <SelectItem value="4 in a room">4 in a room</SelectItem>
                            <SelectItem value="Master Bedroom">Master Bedroom</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Price per Academic Year (GH₵) *</Label>
                        <Input
                          type="number"
                          min={0}
                          placeholder="e.g. 4500"
                          value={rt.price || ""}
                          onChange={(e) =>
                            handleRoomTypeChange(i, "price", Number(e.target.value))
                          }
                          className="rounded-xl h-10 text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold">Number of Rooms</Label>
                        <Input
                          type="number"
                          min={1}
                          placeholder="e.g. 4"
                          value={rt.numberOfRooms || 1}
                          onChange={(e) =>
                            handleRoomTypeChange(i, "numberOfRooms", Number(e.target.value))
                          }
                          className="rounded-xl h-10 text-xs"
                        />
                      </div>
                    </div>

                    {/* Room Amenities Sub-Selector */}
                    <div className="space-y-2 pt-2 border-t border-border/50">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                        Included in this room type:
                      </Label>
                      <div className="flex flex-wrap gap-2">
                        {roomAmenitiesList.map((amenity) => {
                          const isSelected = (rt.roomAmenities || []).includes(amenity);
                          return (
                            <button
                              key={amenity}
                              type="button"
                              onClick={() => {
                                const current = rt.roomAmenities || [];
                                const updated = isSelected
                                  ? current.filter((a) => a !== amenity)
                                  : [...current, amenity];
                                handleRoomTypeChange(i, "roomAmenities", updated as any);
                              }}
                              className={`text-[11px] px-2.5 py-1 rounded-lg border transition-all ${
                                isSelected
                                  ? "bg-primary text-white border-primary font-semibold shadow-xs"
                                  : "bg-background text-muted-foreground border-border hover:border-primary/40"
                              }`}
                            >
                              {amenity}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Room Photos & Video Walkthrough Section */}
                    <div className="space-y-3 pt-3 border-t border-border/60">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                        <div>
                          <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Camera className="h-3.5 w-3.5 text-primary" />
                            Photos &amp; Walkthrough of this Room Type
                          </Label>
                          <p className="text-[11px] text-muted-foreground">
                            Upload photos or videos showing what this &quot;{rt.name || `Room Type #${i + 1}`}&quot; looks like inside (bedding, washroom, study desk).
                          </p>
                        </div>
                        <span className="text-[10px] text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 rounded-full font-semibold flex items-center gap-1 shrink-0 self-start sm:self-auto">
                          ⚡ Auto-compressed
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        <label className="cursor-pointer inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-background border border-border/80 hover:border-primary/50 text-xs font-semibold text-foreground hover:bg-primary/5 transition-all shadow-xs">
                          <Upload className="h-3.5 w-3.5 text-primary" />
                          <span>Attach Room Photos &amp; Videos</span>
                          <input
                            type="file"
                            multiple
                            accept="image/*,video/*"
                            className="hidden"
                            onChange={(e) => handleAddRoomMedia(i, e)}
                          />
                        </label>
                        <span className="text-[11px] text-muted-foreground">
                          {(roomTypeMedia[i] || []).length} media attached
                        </span>
                      </div>

                      {/* Thumbnails Grid */}
                      {(roomTypeMedia[i] || []).length > 0 && (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2.5 pt-1">
                          {(roomTypeMedia[i] || []).map((item, mIdx) => (
                            <div
                              key={mIdx}
                              className="relative aspect-video sm:aspect-square rounded-xl overflow-hidden border border-border/80 bg-muted/50 group"
                            >
                              {item.type === "video" ? (
                                <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center text-white p-2">
                                  <Film className="h-6 w-6 text-primary mb-1" />
                                  <span className="text-[9px] font-semibold text-white/80 text-center truncate max-w-full">
                                    Video Walkthrough
                                  </span>
                                </div>
                              ) : (
                                <Image
                                  src={item.previewUrl}
                                  alt={`Room ${i + 1} media ${mIdx + 1}`}
                                  fill
                                  className="object-cover"
                                />
                              )}

                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveRoomMedia(i, mIdx)}
                                  className="h-7 w-7 rounded-full bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 transition-colors shadow-md"
                                  title="Remove media"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>

                              {mIdx === 0 && item.type === "image" && (
                                <span className="absolute bottom-1 left-1 text-[8px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-bold shadow-xs">
                                  Primary Photo
                                </span>
                              )}
                              {item.type === "video" && (
                                <span className="absolute bottom-1 right-1 text-[8px] bg-indigo-600 text-white px-1.5 py-0.5 rounded font-bold shadow-xs flex items-center gap-0.5">
                                  <Film className="h-2.5 w-2.5" /> Video
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ================= STEP 4: AMENITIES & POLICIES ================= */}
          {step === 4 && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              {/* General Hostel Amenities */}
              <div className="space-y-3">
                <Label className="text-sm font-bold text-foreground">General Building Amenities</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {hostelAmenitiesList.map((amenity) => {
                    const isChecked = selectedAmenities.includes(amenity);
                    return (
                      <div
                        key={amenity}
                        onClick={() => toggleCheckbox(setSelectedAmenities, amenity, !isChecked)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs transition-all ${
                          isChecked
                            ? "bg-primary/10 border-primary text-foreground font-semibold"
                            : "bg-muted/30 border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        <Checkbox checked={isChecked} />
                        <span>{amenity}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Utility Bills Included */}
              <div className="space-y-3 pt-3 border-t border-border">
                <Label className="text-sm font-bold text-foreground">Utility Bills Included in Rent</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {billsIncludedList.map((bill) => {
                    const isChecked = billsIncluded.includes(bill);
                    return (
                      <div
                        key={bill}
                        onClick={() => toggleCheckbox(setBillsIncluded, bill, !isChecked)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs transition-all ${
                          isChecked
                            ? "bg-emerald-500/10 border-emerald-500 text-foreground font-semibold"
                            : "bg-muted/30 border-border text-muted-foreground hover:border-emerald-500/40"
                        }`}
                      >
                        <Checkbox checked={isChecked} />
                        <span>{bill} Included</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Security & Safety Features */}
              <div className="space-y-3 pt-3 border-t border-border">
                <Label className="text-sm font-bold text-foreground">Security & Safety Features</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {securitySafetyList.map((sec) => {
                    const isChecked = securityAndSafety.includes(sec);
                    return (
                      <div
                        key={sec}
                        onClick={() => toggleCheckbox(setSecurityAndSafety, sec, !isChecked)}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border cursor-pointer text-xs transition-all ${
                          isChecked
                            ? "bg-teal-500/10 border-teal-500 text-foreground font-semibold"
                            : "bg-muted/30 border-border text-muted-foreground hover:border-teal-500/40"
                        }`}
                      >
                        <Checkbox checked={isChecked} />
                        <span>{sec}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ================= STEP 5: PHOTOS ================= */}
          {step === 5 && (
            <div className="space-y-5 animate-in fade-in-50 duration-200">
              <div className="p-3.5 rounded-2xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground flex items-start gap-2.5">
                <Camera className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                <span>
                  Tip: Include clean photos of the room interior, desk setup, washroom, and exterior gate.
                  Clear, well-lit photos receive 3x more visit bookings from students.
                </span>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-semibold">Upload Property Photos (Min 1, Max 8)</Label>
                <div
                  onClick={() => document.getElementById("wizard-photo-upload")?.click()}
                  className="border-2 border-dashed border-border hover:border-primary/60 rounded-2xl p-8 text-center cursor-pointer bg-muted/20 hover:bg-muted/40 transition-all flex flex-col items-center justify-center gap-2"
                >
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Upload className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">
                    Click to browse or drag and drop images
                  </p>
                  <p className="text-xs text-muted-foreground">PNG, JPG, WEBP up to 10MB each</p>
                  <input
                    id="wizard-photo-upload"
                    type="file"
                    multiple
                    accept="image/*"
                    className="hidden"
                    onChange={handlePhotoChange}
                    disabled={photos.length >= 8}
                  />
                </div>
              </div>

              {/* Photo Previews Grid */}
              {photoPreviews.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {photoPreviews.map((src, i) => (
                    <div
                      key={i}
                      className="relative aspect-video rounded-xl overflow-hidden border border-border bg-slate-900 group"
                    >
                      <Image
                        src={src}
                        alt={`Photo ${i + 1}`}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                      <button
                        type="button"
                        onClick={() => removePhoto(i)}
                        className="absolute top-1.5 right-1.5 h-6 w-6 rounded-full bg-black/70 text-white flex items-center justify-center hover:bg-rose-600 transition-colors"
                        title="Delete photo"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                      {i === 0 && (
                        <span className="absolute bottom-1.5 left-1.5 text-[9px] bg-primary text-white px-2 py-0.5 rounded font-bold">
                          Cover Photo
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================= STEP 6: REVIEW & SUBMIT ================= */}
          {step === 6 && (
            <div className="space-y-6 animate-in fade-in-50 duration-200">
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-300">
                <h4 className="font-bold flex items-center gap-1.5 mb-1">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  Ready for Final Review
                </h4>
                <p>
                  Please double-check all hostel details below before submitting.{" "}
                  {mode === "manager"
                    ? "Your listing will be dispatched to the University Accommodation Coordinator for verification."
                    : "As Admin, this listing will be published immediately on the public directory."}
                </p>
              </div>

              {/* Summary Card */}
              <div className="rounded-2xl border border-border p-5 bg-muted/20 space-y-4 text-xs">
                <div className="flex justify-between items-start border-b border-border pb-3">
                  <div>
                    <h3 className="text-lg font-bold font-headline text-foreground">{hostelName}</h3>
                    <p className="text-muted-foreground flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                      {locationData.address || "Address not specified"}
                    </p>
                  </div>
                  <Badge className="bg-primary/20 text-primary border-primary/30 font-bold">
                    {institution}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-muted-foreground font-medium">Digital Address:</span>
                    <p className="font-mono font-bold text-foreground">
                      {locationData.digitalAddress || "Manual Pin"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Gender Allowed:</span>
                    <p className="font-semibold text-foreground">{gender}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Distance:</span>
                    <p className="font-semibold text-foreground">{distanceToUni}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Room Categories:</span>
                    <p className="font-semibold text-foreground">
                      {roomTypes.length} types ({Object.values(roomTypeMedia).reduce((acc, list) => acc + list.length, 0)} room media)
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Hostel Photos:</span>
                    <p className="font-semibold text-foreground">{photos.length} photos</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground font-medium">Price Range:</span>
                    <p className="font-bold text-primary">
                      GH₵ {Math.min(...roomTypes.map((r) => r.price || 0)).toLocaleString()} - GH₵{" "}
                      {Math.max(...roomTypes.map((r) => r.price || 0)).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-border">
                  <span className="text-muted-foreground font-medium">Description:</span>
                  <p className="text-slate-700 dark:text-slate-300 mt-1 leading-relaxed">
                    {description || "No custom description provided."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </CardContent>

        {/* Wizard Footer Controls */}
        <CardFooter className="p-6 border-t border-border bg-muted/10 flex items-center justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={prevStep}
            disabled={step === 1 || isSubmitting}
            className="rounded-xl text-xs font-semibold gap-1.5 h-10 px-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Previous
          </Button>

          {step < totalSteps ? (
            <Button
              type="button"
              onClick={nextStep}
              className="rounded-xl text-xs font-bold gap-1.5 h-10 px-5 bg-primary hover:bg-primary/90 text-white shadow-md shadow-primary/20"
            >
              <span>Continue</span>
              <ArrowRight className="h-4 w-4" />
            </Button>
          ) : (
            <Button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="rounded-xl text-xs font-extrabold gap-2 h-11 px-6 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-600/30"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Publishing Property...
                </>
              ) : mode === "manager" ? (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  Submit for University Verification
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  Publish Hostel Directly
                </>
              )}
            </Button>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}
