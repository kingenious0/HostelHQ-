import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "Gemini API key is not configured on the server." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const { question, hostel, room } = body as {
      question?: string;
      hostel?: { name?: string; location?: string };
      room?: { name?: string; price?: number; capacity?: number; availability?: string };
    };

    if (!question || !question.trim()) {
      return NextResponse.json(
        { error: "Question is required." },
        { status: 400 }
      );
    }

    const contextPieces: string[] = [];
    if (hostel?.name) contextPieces.push(`Hostel name: ${hostel.name}`);
    if (hostel?.location) contextPieces.push(`Location: ${hostel.location}`);
    if (room?.name) contextPieces.push(`Room type: ${room.name}`);
    if (room?.price) contextPieces.push(`Annual rent (GHS): ${room.price}`);
    if (room?.capacity) contextPieces.push(`Capacity: ${room.capacity} students`);
    if (room?.availability) contextPieces.push(`Availability: ${room.availability}`);

    const systemPrompt =
      "You are HostelHQ's room advisor AI. Give short, clear, practical answers (2-4 sentences) to help students decide if a room is a good fit. Use only the information given; if something is unknown, say so briefly.";

    const userPrompt = `Context about the hostel and room (if available):\n${
      contextPieces.length ? "- " + contextPieces.join("\n- ") : "(no extra context provided)"
    }\n\nStudent question: ${question}`;

    const geminiResponse = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" +
        encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "user", parts: [{ text: userPrompt }] },
          ],
        }),
      }
    );

    if (!geminiResponse.ok) {
      const text = await geminiResponse.text();
      console.error("Gemini API error:", text);
      return NextResponse.json(
        { error: "AI helper is temporarily unavailable." },
        { status: 502 }
      );
    }

    const data = await geminiResponse.json();
    const answer =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "I couldn't generate a helpful answer from the AI.";

    return NextResponse.json({ answer });
  } catch (error) {
    console.error("Room AI helper error:", error);
    return NextResponse.json(
      { error: "Unexpected error while talking to the AI." },
      { status: 500 }
    );
  }
}
