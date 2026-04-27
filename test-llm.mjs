import { config } from "dotenv";
config();

// Load env manually
const forgeApiUrl = process.env.BUILT_IN_FORGE_API_URL;
const forgeApiKey = process.env.BUILT_IN_FORGE_API_KEY;

console.log("FORGE_API_URL:", forgeApiUrl ? "SET" : "MISSING");
console.log("FORGE_API_KEY:", forgeApiKey ? "SET" : "MISSING");

if (!forgeApiUrl || !forgeApiKey) {
  console.error("Missing env vars - checking .env file...");
  process.exit(1);
}

const payload = {
  model: "gemini-2.5-flash",
  messages: [
    {
      role: "system",
      content: "Eres un experto en oposiciones de Arquitecto Técnico en España. Genera preguntas tipo test. Devuelve ÚNICAMENTE JSON válido."
    },
    {
      role: "user",
      content: "Genera 1 pregunta tipo test sobre Estructuras. Formato JSON: {\"questions\":[{\"question\":\"...\",\"optionA\":\"...\",\"optionB\":\"...\",\"optionC\":\"...\",\"optionD\":\"...\",\"correctOption\":\"A\",\"explanation\":\"...\",\"difficulty\":\"facil\"}]}"
    }
  ],
  max_tokens: 1000,
  response_format: {
    type: "json_schema",
    json_schema: {
      name: "generated_questions",
      strict: true,
      schema: {
        type: "object",
        properties: {
          questions: {
            type: "array",
            items: {
              type: "object",
              properties: {
                question: { type: "string" },
                optionA: { type: "string" },
                optionB: { type: "string" },
                optionC: { type: "string" },
                optionD: { type: "string" },
                correctOption: { type: "string", enum: ["A", "B", "C", "D"] },
                explanation: { type: "string" },
                difficulty: { type: "string", enum: ["facil", "medio", "dificil"] }
              },
              required: ["question", "optionA", "optionB", "optionC", "optionD", "correctOption", "explanation", "difficulty"],
              additionalProperties: false
            }
          }
        },
        required: ["questions"],
        additionalProperties: false
      }
    }
  }
};

try {
  const apiUrl = forgeApiUrl.replace(/\/+$/, "") + "/v1/chat/completions";
  console.log("Calling:", apiUrl);
  
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${forgeApiKey}`
    },
    body: JSON.stringify(payload)
  });

  console.log("HTTP Status:", response.status, response.statusText);
  
  const result = await response.json();
  console.log("Response keys:", Object.keys(result));
  
  if (result.choices) {
    console.log("choices[0].message.content (first 300 chars):", 
      String(result.choices[0]?.message?.content).substring(0, 300));
  } else if (result.error) {
    console.error("API Error:", JSON.stringify(result.error));
  } else {
    console.log("Full response:", JSON.stringify(result).substring(0, 500));
  }
} catch (err) {
  console.error("Fetch error:", err.message);
}
