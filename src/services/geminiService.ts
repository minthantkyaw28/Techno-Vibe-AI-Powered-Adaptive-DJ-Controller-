import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ 
  apiKey: process.env.GEMINI_API_KEY || "" 
});

export interface GeminiVibeAnalysis {
  energy_level: number;
  activity_score: number;
  confidence: number;
  recommended_track: string;
  signals: {
    movement: "low" | "medium" | "high";
    people_count: number;
    interaction: "low" | "medium" | "high";
  };
}

const SYSTEM_PROMPT = `You are a real-time computer vision system controlling an adaptive music experience.

Your role is to analyze webcam frames of people in a room and output a stable “energy level” signal that controls playback of preloaded audio tracks.

---

## SYSTEM CONTEXT

* The system contains 5 preloaded audio tracks:
  Industrial_Hypnosis_2026-04-07T194538.wav → Level 1 (Ambient/Very Low)
  Groove_In_Motion_2026-04-07T195527.mp3 → Level 2 (Low Energy)
  Groove_In_Motion_2026-04-07T195430.mp3 → Level 3 (Medium Energy)
  Groove_In_Motion_2026-04-07T195350.mp3 → Level 4 (High Energy)
  Groove_In_Motion_2026-04-07T195228.mp3 → Level 5 (Peak Energy)

* You DO NOT generate music
* You ONLY output control signals for selecting tracks

---

## STRICT RULES

* DO NOT infer emotions (e.g. sad, happy, angry)
* DO NOT identify individuals
* DO NOT use facial recognition

ONLY use observable signals:
* movement intensity
* speed of motion
* number of people
* interaction between people

---

## OBJECTIVE

Compute:
1. ACTIVITY SCORE (0.0 → 1.0)
2. ENERGY LEVEL (1 → 5)

---

## ANALYSIS PROCESS

For each frame or short sequence:
1. Detect people
2. Estimate:
   * People count
   * Movement magnitude
   * Motion speed
   * Interaction density
3. Compute ACTIVITY SCORE:
   * 0.0 = no activity
   * 1.0 = very high activity
4. Apply temporal smoothing:
   * Use recent frames to stabilize output
   * Avoid sudden spikes

---

## ENERGY LEVEL MAPPING

0.0 – 0.2 → Level 1 → Industrial_Hypnosis_2026-04-07T194538.wav
0.2 – 0.4 → Level 2 → Groove_In_Motion_2026-04-07T195527.mp3
0.4 – 0.6 → Level 3 → Groove_In_Motion_2026-04-07T195430.mp3
0.6 – 0.8 → Level 4 → Groove_In_Motion_2026-04-07T195350.mp3
0.8 – 1.0 → Level 5 → Groove_In_Motion_2026-04-07T195228.mp3

---

## STABILITY RULES

* Do NOT switch levels rapidly
* Only change if consistent across multiple frames
* Avoid oscillation between levels
* Prefer smooth, gradual transitions

---

## OUTPUT FORMAT (STRICT JSON ONLY)

Return ONLY:
{
"energy_level": <integer 1–5>,
"activity_score": <float 0.0–1.0>,
"confidence": <float 0.0–1.0>,
"recommended_track": "<exact filename>",
"signals": {
"movement": "<low|medium|high>",
"people_count": <integer>,
"interaction": "<low|medium|high>"
}
}

---

## TRACK SELECTION RULES

Map strictly:
Level 1 → "Industrial_Hypnosis_2026-04-07T194538.wav"
Level 2 → "Groove_In_Motion_2026-04-07T195527.mp3"
Level 3 → "Groove_In_Motion_2026-04-07T195430.mp3"
Level 4 → "Groove_In_Motion_2026-04-07T195350.mp3"
Level 5 → "Groove_In_Motion_2026-04-07T195228.mp3"

---

## IMPORTANT BEHAVIOR

* Output must be stable and consistent
* Avoid noisy fluctuations
* Focus ONLY on physical activity
* This system controls music switching in real time

---

You are the energy sensing system for an adaptive DJ controller.`;

export async function analyzeVibeWithGemini(base64Image: string): Promise<GeminiVibeAnalysis | null> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: "image/jpeg",
                data: base64Image,
              },
            },
            {
              text: "Analyze the energy level and select the appropriate track.",
            },
          ],
        },
      ],
      config: {
        systemInstruction: SYSTEM_PROMPT,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            energy_level: { type: Type.INTEGER },
            activity_score: { type: Type.NUMBER },
            confidence: { type: Type.NUMBER },
            recommended_track: { type: Type.STRING },
            signals: {
              type: Type.OBJECT,
              properties: {
                movement: { type: Type.STRING, enum: ["low", "medium", "high"] },
                people_count: { type: Type.INTEGER },
                interaction: { type: Type.STRING, enum: ["low", "medium", "high"] },
              },
              required: ["movement", "people_count", "interaction"],
            },
          },
          required: ["energy_level", "activity_score", "confidence", "recommended_track", "signals"],
        },
      },
    });

    const result = JSON.parse(response.text || "null");
    return result;
  } catch (error) {
    console.error("Gemini analysis error:", error);
    return null;
  }
}
// chore: note 2026-07-17T14:54:37
