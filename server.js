// server.ts
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { GoogleGenAI } from "@google/genai";
dotenv.config();
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var app = express();
var PORT = process.env.PORT || 3e3;
app.use(express.json({ limit: "10mb" }));
var aiClient = null;
function getAiClient() {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });
  }
  return aiClient;
}
app.post("/api/gemini/proofread", async (req, res) => {
  try {
    const { text, noteType } = req.body;
    if (!text || typeof text !== "string") {
      return res.status(400).json({ error: "Text is required" });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.json({ correctedText: text, note: "Gemini API key no configurada, manteniendo texto original." });
    }
    const prompt = `Act\xFAa como un m\xE9dico especialista e instructor de Medicina Interna de alta excelencia hospitalaria en M\xE9xico/Latinoam\xE9rica.
Revisa y corrige la ortograf\xEDa, acentuaci\xF3n, puntuaci\xF3n y concordancia m\xE9dica del siguiente texto cl\xEDnico para una ${noteType || "Nota de Evoluci\xF3n"}.
Reglas estrictas:
1. Respeta la terminolog\xEDa m\xE9dica est\xE1ndar (abreviaturas v\xE1lidas como TA, FC, FR, SpO2, ECG, TFG, creatinina, leucocitos, afasia, disnea, etc.).
2. Corrige errores tipogr\xE1ficos, faltas de acentos (ej. hipertensi\xF3n, nefropat\xEDa, infarto, t\xF3rax, gasometr\xEDa) y errores comunes de teclado.
3. No inventes diagn\xF3sticos ni alteres dosis o valores de laboratorio.
4. Devuelve \xDANICAMENTE el texto corregido, con formato cl\xEDnico limpio, sin introducciones ni comentarios adicionales.

Texto a corregir:
"""
${text}
"""`;
    const response = await getAiClient().models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt
    });
    const correctedText = response.text?.trim() || text;
    res.json({ correctedText });
  } catch (error) {
    console.error("Error in proofread:", error);
    res.status(500).json({ error: error.message || "Error processing request" });
  }
});
app.post("/api/gemini/generate-note", async (req, res) => {
  try {
    const { patientData, options } = req.body;
    if (!patientData) {
      return res.status(400).json({ error: "Patient data is required" });
    }
    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: "GEMINI_API_KEY no disponible" });
    }
    const prompt = `Eres un m\xE9dico residente de Medicina Interna de guardia redactando una nota m\xE9dica institucional formal, concisa, orientada a problemas (estilo SOAP / IMSS / ISSSTE / Hospital General) de m\xE1xima calidad acad\xE9mica y legal.

DATOS DEL PACIENTE:
- Nombre / Identificador: ${patientData.name || "Paciente"} (Cama: ${patientData.bed || "S/A"}, Servicio: ${patientData.service || "Medicina Interna"})
- Edad y G\xE9nero: ${patientData.age || "N/E"} a\xF1os, ${patientData.gender || "N/E"}
- Diagn\xF3sticos Activos: ${patientData.diagnoses || "No especificados"}
- D\xEDas de Estancia: ${patientData.hospitalStayDays || "1"} d\xEDa(s)
- C\xF3digo Reanimaci\xF3n / Voluntad: ${patientData.codeStatus || "RCP completo (RCP3)"}
- Alergias: ${patientData.allergies || "Negadas"}

EVOLUCI\xD3N CL\xCDNICA DE HOY:
- Subjetivo / Estado Cl\xEDnico percibido: ${options?.subjective || "Paciente consciente, tranquilo, refiere adecuada tolerancia a la v\xEDa oral, sin dolor agudo."}
- Signos Vitales: TA: ${options?.vitals?.bp || "120/80"} mmHg, FC: ${options?.vitals?.hr || "75"} lpm, FR: ${options?.vitals?.rr || "18"} rpm, Temp: ${options?.vitals?.temp || "36.5"}\xB0C, SpO2: ${options?.vitals?.spo2 || "96"}% al aire ambiente, Glucemia capilar: ${options?.vitals?.glucose || "N/E"} mg/dL.
- Exploraci\xF3n F\xEDsica Dirigida: ${options?.physicalExam || "Neurol\xF3gico \xEDntegro, ruidos cardiacos r\xEDtmicos sin soplos, campos pulmonares con adecuado murmullo vesicular sin estertores, abdomen blando no doloroso sin datos de irritaci\xF3n peritoneal, extremidades sin edema."}
- Laboratorios Recientes: ${options?.recentLabs || "Sin nuevos laboratorios reportados."}
- Medicamentos / Antibi\xF3ticos actuales: ${options?.medications || "Tratamiento de sost\xE9n"}
- Pendientes del turno / Estudios solicitados: ${options?.pendings || "Ninguno"}

INSTRUCCI\xD3N:
Genera la NOTA DE EVOLUCI\xD3N EN MEDICINA INTERNA estructurada con los siguientes apartados exactos:
1. SUBJETIVO
2. OBJETIVO (Signos vitales, exploraci\xF3n f\xEDsica por sistemas y laboratorios/gabinete relevantes con fecha y hora)
3. AN\xC1LISIS Y RAZONAMIENTO CL\xCDNICO (An\xE1lisis por problemas prioritarios, evoluci\xF3n cl\xEDnica hacia la mejor\xEDa o deterioro, justificaci\xF3n de antibi\xF3ticos con conteo de d\xEDas, balance de riesgo)
4. PLAN TERAP\xC9UTICO E INDICACIONES COMPLETAS (Dieta, Soluciones parenterales, Medicamentos con dosis y d\xEDa exacto de antibi\xF3tico, Medidas generales, Datos de alarma y pron\xF3stico)

El lenguaje debe ser impecable, profesional, legalmente blindado, sin divagaciones y listo para COPIAR Y PEGAR directamente en el expediente cl\xEDnico electr\xF3nico institucional.`;
    const response = await getAiClient().models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt
    });
    res.json({ generatedNote: response.text?.trim() });
  } catch (error) {
    console.error("Error in generate-note:", error);
    res.status(500).json({ error: error.message || "Error processing note generation" });
  }
});
function startServer() {
  const isProd = process.env.NODE_ENV === "production";
  const portNumber = Number(PORT) || 3e3;
  if (!isProd) {
    const vitePromise = import("vite").then(
      ({ createServer: createViteServer }) => createViteServer({
        server: {
          middlewareMode: true,
          hmr: process.env.DISABLE_HMR !== "true",
          watch: process.env.DISABLE_HMR === "true" ? null : {}
        },
        appType: "spa"
      })
    );
    app.use(async (req, res, next) => {
      try {
        const vite = await vitePromise;
        vite.middlewares(req, res, next);
      } catch (err) {
        next(err);
      }
    });
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }
  app.listen(portNumber, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${portNumber}`);
  });
}
startServer();
