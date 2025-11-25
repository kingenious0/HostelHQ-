/**
 * Comprehensive HostelHQ Knowledge Base for Hostie AI Assistant
 * Contains all platform information, processes, and conversational context
 */

export interface HostelHQKnowledge {
  platform: PlatformInfo;
  processes: ProcessInfo;
  features: FeatureInfo;
  policies: PolicyInfo;
  locations: LocationInfo;
  pricing: PricingInfo;
  support: SupportInfo;
}

interface PlatformInfo {
  name: string;
  mission: string;
  description: string;
  targetAudience: string;
  coverage: string;
  statistics: {
    cities: number;
    hostels: number;
    students: number;
    institutions: number;
  };
}

interface ProcessInfo {
  booking: BookingProcess;
  payment: PaymentProcess;
  verification: VerificationProcess;
  roommate: RoommateProcess;
}

interface BookingProcess {
  steps: string[];
  requirements: string[];
  timeline: string;
  cancellation: string;
}

interface PaymentProcess {
  methods: string[];
  security: string[];
  refunds: string;
  pricing: string;
}

interface VerificationProcess {
  hostelVerification: string[];
  studentVerification: string[];
  safetyMeasures: string[];
}

interface RoommateProcess {
  matching: string[];
  preferences: string[];
  communication: string[];
}

interface FeatureInfo {
  core: string[];
  unique: string[];
  upcoming: string[];
  integrations: string[];
}

interface PolicyInfo {
  terms: string[];
  privacy: string[];
  safety: string[];
  disputes: string[];
}

interface LocationInfo {
  cities: CityInfo[];
  institutions: InstitutionInfo[];
}

interface CityInfo {
  name: string;
  hostels: number;
  averagePrice: number;
  popularAreas: string[];
}

interface InstitutionInfo {
  name: string;
  location: string;
  nearbyHostels: number;
  studentPopulation: number;
}

interface PricingInfo {
  ranges: PriceRange[];
  factors: string[];
  inclusions: string[];
  exclusions: string[];
}

interface PriceRange {
  type: string;
  min: number;
  max: number;
  description: string;
}

interface SupportInfo {
  channels: string[];
  hours: string;
  responseTime: string;
  escalation: string[];
}

export const HOSTELHQ_KNOWLEDGE: HostelHQKnowledge = {
  platform: {
    name: "HostelHQ",
    mission: "To make student accommodation transparent, affordable, and delightful for everyone in Ghana",
    description: "Ghana's most trusted student housing platform connecting ALL students with verified, safe, and affordable hostels",
    targetAudience: "ALL university and tertiary students seeking accommodation - local and international",
    coverage: "Major tertiary education hubs across Ghana serving students from every institution",
    statistics: {
      cities: 5,
      hostels: 70,
      students: 20000,
      institutions: 15
    }
  },

  processes: {
    booking: {
      steps: [
        "Browse verified hostels on our platform",
        "Filter by location, price, amenities, and room type",
        "View detailed room information and amenities",
        "Book a visit to see the hostel in person",
        "Choose your preferred date and time for visit",
        "Visit the hostel and inspect the facilities",
        "If satisfied, secure your room with payment",
        "Complete digital tenancy agreement",
        "Receive confirmation and move-in details"
      ],
      requirements: [
        "Valid student ID or admission letter",
        "Government-issued ID (Ghana Card/Passport)",
        "Emergency contact information",
        "Payment method (mobile money/bank transfer/card)"
      ],
      timeline: "Visit booking: Instant confirmation. Room securing: Within 24 hours of visit completion",
      cancellation: "Free cancellation up to 24 hours before visit. Room bookings: See terms and conditions"
    },

    payment: {
      methods: [
        "Mobile Money (MTN, Vodafone, AirtelTigo)",
        "Bank Transfer (All major Ghanaian banks)",
        "Debit/Credit Cards (Visa, Mastercard)",
        "Paystack secure payment gateway"
      ],
      security: [
        "256-bit SSL encryption",
        "PCI DSS compliant payment processing",
        "Secure escrow system",
        "Fraud protection measures"
      ],
      refunds: "Full refund if hostel doesn't match description. Partial refunds based on cancellation policy",
      pricing: "Transparent pricing with no hidden fees. What you see is what you pay"
    },

    verification: {
      hostelVerification: [
        "Physical inspection by HostelHQ team",
        "Safety and security assessment",
        "Amenities verification and photography",
        "Legal documentation review",
        "Regular quality audits"
      ],
      studentVerification: [
        "Student ID verification",
        "Institution enrollment confirmation",
        "Identity document verification",
        "Emergency contact validation"
      ],
      safetyMeasures: [
        "24/7 security at verified hostels",
        "Fire safety compliance",
        "Emergency evacuation plans",
        "CCTV surveillance",
        "Secure access control"
      ]
    },

    roommate: {
      matching: [
        "Complete personality and lifestyle questionnaire",
        "Specify preferences (study habits, cleanliness, social level)",
        "Browse compatible roommate profiles",
        "Connect through secure messaging",
        "Meet virtually or in person before deciding"
      ],
      preferences: [
        "Study schedule compatibility",
        "Cleanliness standards",
        "Social interaction level",
        "Sleep schedule",
        "Shared expenses approach",
        "Guest policies"
      ],
      communication: [
        "In-app secure messaging (e.g., end-to-end encryption, two-factor authentication)",
        "Video call integration",
        "Profile sharing with privacy controls (e.g., who can see your profile, photos, and contact information)",
        "Compatibility scoring system"
      ]
    }
  },

  features: {
    core: [
      "Verified hostel listings with real photos",
      "Transparent pricing with no hidden fees",
      "Virtual and physical hostel tours",
      "Secure online booking and payment",
      "Digital tenancy agreements",
      "Roommate matching system",
      "24/7 customer support",
      "Mobile-responsive platform",
      "Real-time availability updates",
      "Review and rating system"
    ],
    unique: [
      "Ghana-specific payment methods (Mobile Money)",
      "Local institution partnerships",
      "Culturally relevant roommate matching",
      "Academic calendar integration",
      "Local language support",
      "Campus proximity mapping",
      "Student-focused amenities filtering"
    ],
    upcoming: [
      "AI-powered room recommendations",
      "Virtual reality hostel tours",
      "Smart contract tenancy agreements",
      "IoT room monitoring",
      "Blockchain-based reviews",
      "Advanced analytics dashboard"
    ],
    integrations: [
      "Google Maps for location services",
      "Paystack for payments",
      "Firebase for real-time data",
      "SMS notifications via Wigal/Frog",
      "Email automation",
      "Social media authentication"
    ]
  },

  policies: {
    terms: [
      "Users must be enrolled students or have admission letters",
      "All bookings subject to hostel availability",
      "Payment required to secure room booking",
      "Cancellation policies vary by hostel",
      "Users responsible for accurate information",
      "Platform facilitates connections but doesn't own hostels"
    ],
    privacy: [
      "Personal data encrypted and secure",
      "Information shared only with chosen hostels",
      "No data sold to third parties",
      "Users control profile visibility",
      "GDPR-compliant data handling",
      "Right to data deletion upon request"
    ],
    safety: [
      "All hostels undergo safety inspections",
      "Emergency contact system in place",
      "24/7 support for safety concerns",
      "Incident reporting mechanism",
      "Regular safety audits",
      "Collaboration with local authorities"
    ],
    disputes: [
      "Mediation service for student-hostel conflicts",
      "Escalation to HostelHQ support team",
      "Refund consideration for valid complaints",
      "Legal support referrals when needed",
      "Fair resolution process",
      "Appeal mechanism available"
    ]
  },

  locations: {
    cities: [
      {
        name: "Accra",
        hostels: 25,
        averagePrice: 4200,
        popularAreas: ["Legon", "East Legon", "Madina", "Ashongman"]
      },
      {
        name: "Kumasi",
        hostels: 20,
        averagePrice: 3800,
        popularAreas: ["KNUST Campus", "Ayeduase", "Bomso", "Kentinkrono"]
      },
      {
        name: "Cape Coast",
        hostels: 12,
        averagePrice: 3200,
        popularAreas: ["UCC Campus", "Pedu", "Amamoma", "Kwaprow"]
      },
      {
        name: "Tamale",
        hostels: 8,
        averagePrice: 2800,
        popularAreas: ["UDS Campus", "Dungu", "Kalpohin", "Vittin"]
      },
      {
        name: "Ho",
        hostels: 5,
        averagePrice: 2500,
        popularAreas: ["UHAS Campus", "Bankoe", "Ahoe", "Kpenoe"]
      }
    ],
    institutions: [
      {
        name: "University of Ghana",
        location: "Legon, Accra",
        nearbyHostels: 15,
        studentPopulation: 38000
      },
      {
        name: "Kwame Nkrumah University of Science and Technology",
        location: "Kumasi",
        nearbyHostels: 18,
        studentPopulation: 60000
      },
      {
        name: "University of Cape Coast",
        location: "Cape Coast",
        nearbyHostels: 12,
        studentPopulation: 70000
      },
      {
        name: "University for Development Studies",
        location: "Tamale",
        nearbyHostels: 8,
        studentPopulation: 40000
      },
      {
        name: "University of Health and Allied Sciences",
        location: "Ho",
        nearbyHostels: 5,
        studentPopulation: 4000
      }
    ]
  },

  pricing: {
    ranges: [
      {
        type: "Budget Shared Room (4-6 people)",
        min: 2000,
        max: 3500,
        description: "Basic amenities, shared facilities, good for budget-conscious students"
      },
      {
        type: "Standard Shared Room (2-4 people)",
        min: 3000,
        max: 4500,
        description: "Better amenities, semi-private facilities, balanced comfort and cost"
      },
      {
        type: "Premium Shared Room (2 people)",
        min: 4000,
        max: 6000,
        description: "High-quality amenities, private/semi-private facilities"
      },
      {
        type: "Private Single Room",
        min: 5000,
        max: 8000,
        description: "Complete privacy, premium amenities, ideal for focused study"
      }
    ],
    factors: [
      "Location proximity to campus",
      "Room type and capacity",
      "Amenities included",
      "Hostel quality and ratings",
      "Seasonal demand",
      "Academic calendar timing"
    ],
    inclusions: [
      "Electricity (fair usage)",
      "Water supply",
      "Basic furniture",
      "Security services",
      "Waste management",
      "Common area access"
    ],
    exclusions: [
      "Personal meals",
      "Laundry services (unless specified)",
      "Internet/WiFi (varies by hostel)",
      "Personal utilities overages",
      "Cleaning services",
      "Personal transportation"
    ]
  },

  support: {
    channels: [
      "In-app chat with Hostie AI",
      "WhatsApp support line",
      "Email support",
      "Phone support",
      "Social media channels",
      "Help center and FAQ"
    ],
    hours: "24/7 for emergencies, 8 AM - 8 PM for general inquiries",
    responseTime: "Immediate for AI chat, within 2 hours for human support",
    escalation: [
      "Level 1: Hostie AI Assistant",
      "Level 2: Customer Support Agent",
      "Level 3: Senior Support Specialist",
      "Level 4: Management Team"
    ]
  }
};

// Conversation context and personality traits for Hostie
export const HOSTIE_PERSONALITY = {
  traits: [
    "Friendly and approachable to everyone",
    "Knowledgeable about student life across ALL institutions",
    "Empathetic to ALL students' financial constraints",
    "Professional yet conversational",
    "Proactive in offering help to every student",
    "Inclusive and welcoming to local and international students"
  ],
  
  conversationStyle: {
    greeting: "Warm and welcoming with emojis",
    responses: "Clear, helpful, and actionable",
    tone: "Professional but friendly",
    language: "Simple English with occasional Ghanaian context",
    empathy: "Understanding of student challenges"
  },

  capabilities: [
    "Answer any question about HostelHQ platform",
    "Provide detailed hostel information",
    "Guide through booking process",
    "Explain payment methods and security",
    "Help with roommate matching",
    "Resolve common issues",
    "Provide location-specific advice",
    "Understand and respond to context",
    "Remember conversation history",
    "Escalate complex issues to human support"
  ]
};
