import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

// Lazy-initialized Gemini client (server-side only)
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI {
  if (!aiClient) {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }
  return aiClient;
}

// Endpoint: Clinical Orthography and Medical Phrasing Polish
app.post('/api/gemini/proofread', async (req, res) => {
  try {
    const { text, noteType } = req.body;
    if (!text || typeof text !== 'string') {
      return res.status(400).json({ error: 'Text is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      // Graceful fallback if key is not configured
      return res.json({ correctedText: text, note: 'Gemini API key no configurada, manteniendo texto original.' });
    }

    const prompt = `Actúa como un médico especialista e instructor de Medicina Interna de alta excelencia hospitalaria en México/Latinoamérica.
Revisa y corrige la ortografía, acentuación, puntuación y concordancia médica del siguiente texto clínico para una ${noteType || 'Nota de Evolución'}.
Reglas estrictas:
1. Respeta la terminología médica estándar (abreviaturas válidas como TA, FC, FR, SpO2, ECG, TFG, creatinina, leucocitos, afasia, disnea, etc.).
2. Corrige errores tipográficos, faltas de acentos (ej. hipertensión, nefropatía, infarto, tórax, gasometría) y errores comunes de teclado.
3. No inventes diagnósticos ni alteres dosis o valores de laboratorio.
4. Devuelve ÚNICAMENTE el texto corregido, con formato clínico limpio, sin introducciones ni comentarios adicionales.

Texto a corregir:
"""
${text}
"""`;

    const response = await getAiClient().models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    const correctedText = response.text?.trim() || text;
    res.json({ correctedText });
  } catch (error: any) {
    console.error('Error in proofread:', error);
    res.status(500).json({ error: error.message || 'Error processing request' });
  }
});

// Endpoint: Intelligent Institutional Progress Note Formulation
app.post('/api/gemini/generate-note', async (req, res) => {
  try {
    const { patientData, options } = req.body;
    if (!patientData) {
      return res.status(400).json({ error: 'Patient data is required' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.status(500).json({ error: 'GEMINI_API_KEY no disponible' });
    }

    const prompt = `Eres un médico residente de Medicina Interna de guardia redactando una nota médica institucional formal, concisa, orientada a problemas (estilo SOAP / IMSS / ISSSTE / Hospital General) de máxima calidad académica y legal.

DATOS DEL PACIENTE:
- Nombre / Identificador: ${patientData.name || 'Paciente'} (Cama: ${patientData.bed || 'S/A'}, Servicio: ${patientData.service || 'Medicina Interna'})
- Edad y Género: ${patientData.age || 'N/E'} años, ${patientData.gender || 'N/E'}
- Diagnósticos Activos: ${patientData.diagnoses || 'No especificados'}
- Días de Estancia: ${patientData.hospitalStayDays || '1'} día(s)
- Código Reanimación / Voluntad: ${patientData.codeStatus || 'RCP completo (RCP3)'}
- Alergias: ${patientData.allergies || 'Negadas'}

EVOLUCIÓN CLÍNICA DE HOY:
- Subjetivo / Estado Clínico percibido: ${options?.subjective || 'Paciente consciente, tranquilo, refiere adecuada tolerancia a la vía oral, sin dolor agudo.'}
- Signos Vitales: TA: ${options?.vitals?.bp || '120/80'} mmHg, FC: ${options?.vitals?.hr || '75'} lpm, FR: ${options?.vitals?.rr || '18'} rpm, Temp: ${options?.vitals?.temp || '36.5'}°C, SpO2: ${options?.vitals?.spo2 || '96'}% al aire ambiente, Glucemia capilar: ${options?.vitals?.glucose || 'N/E'} mg/dL.
- Exploración Física Dirigida: ${options?.physicalExam || 'Neurológico íntegro, ruidos cardiacos rítmicos sin soplos, campos pulmonares con adecuado murmullo vesicular sin estertores, abdomen blando no doloroso sin datos de irritación peritoneal, extremidades sin edema.'}
- Laboratorios Recientes: ${options?.recentLabs || 'Sin nuevos laboratorios reportados.'}
- Medicamentos / Antibióticos actuales: ${options?.medications || 'Tratamiento de sostén'}
- Pendientes del turno / Estudios solicitados: ${options?.pendings || 'Ninguno'}

INSTRUCCIÓN:
Genera la NOTA DE EVOLUCIÓN EN MEDICINA INTERNA estructurada con los siguientes apartados exactos:
1. SUBJETIVO
2. OBJETIVO (Signos vitales, exploración física por sistemas y laboratorios/gabinete relevantes con fecha y hora)
3. ANÁLISIS Y RAZONAMIENTO CLÍNICO (Análisis por problemas prioritarios, evolución clínica hacia la mejoría o deterioro, justificación de antibióticos con conteo de días, balance de riesgo)
4. PLAN TERAPÉUTICO E INDICACIONES COMPLETAS (Dieta, Soluciones parenterales, Medicamentos con dosis y día exacto de antibiótico, Medidas generales, Datos de alarma y pronóstico)

El lenguaje debe ser impecable, profesional, legalmente blindado, sin divagaciones y listo para COPIAR Y PEGAR directamente en el expediente clínico electrónico institucional.`;

    const response = await getAiClient().models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    res.json({ generatedNote: response.text?.trim() });
  } catch (error: any) {
    console.error('Error in generate-note:', error);
    res.status(500).json({ error: error.message || 'Error processing note generation' });
  }
});

// Setup Vite middleware in dev or static files in production
function startServer() {
  const isProd = process.env.NODE_ENV === 'production';
  const portNumber = Number(PORT) || 3000;

  if (!isProd) {
    const vitePromise = import('vite').then(({ createServer: createViteServer }) =>
      createViteServer({
        server: {
          middlewareMode: true,
          hmr: false,
          watch: process.env.DISABLE_HMR === 'true' ? null : {},
        },
        appType: 'spa',
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
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(portNumber, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${portNumber}`);
  });
}

startServer();
