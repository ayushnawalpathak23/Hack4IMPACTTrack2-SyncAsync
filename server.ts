import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import dotenv from "dotenv";
import session from "express-session";
import mongoose, { Schema } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import passportLocalMongoose from "passport-local-mongoose";
import { v2 } from "@google-cloud/translate";
const { Translate } = v2;
import { TextToSpeechClient } from "@google-cloud/text-to-speech";
import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import { z } from "zod";

if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const app = express();
app.set("trust proxy", 1);

const PORT = 3000;
const GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/medicode";
let memoryMongo: MongoMemoryServer | null = null;

const userSchema = new Schema({}, { timestamps: true });
userSchema.plugin(passportLocalMongoose, {
  usernameLowerCase: true,
  usernameUnique: true,
});
const User = mongoose.model("User", userSchema);

const reportSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true },
  originalText: { type: String, required: true },
  simplifiedData: {
    summary: { type: String, required: true },
    concerns: [
      {
        item: { type: String, required: true },
        severity: { type: String, enum: ["Normal", "Caution", "Critical"], default: "Normal" },
      },
    ],
    meaning: { type: String, required: true },
  },
  fileUrl: { type: String, default: "" },
}, { timestamps: true });

const messageSchema = new Schema({
  reportId: { type: Schema.Types.ObjectId, ref: "Report", required: true, index: true },
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  role: { type: String, enum: ["user", "model"], required: true },
  text: { type: String, required: true },
}, { timestamps: true });

const ReportModel = mongoose.model("Report", reportSchema);
const MessageModel = mongoose.model("Message", messageSchema);

type GroqMessage = {
  role: "system" | "user" | "assistant";
  content: any;
};

const objectIdParamSchema = z.object({
  id: z.string().trim().min(1, "id is required"),
});

const authBodySchema = z.object({
  username: z.string().trim().min(3, "username must be at least 3 characters").max(64, "username is too long"),
  password: z.string().min(6, "password must be at least 6 characters").max(128, "password is too long"),
});

const concernSeveritySchema = z.enum(["Normal", "Caution", "Critical"]);

const concernSchema = z.object({
  item: z.string().trim().min(1, "concern item is required"),
  severity: concernSeveritySchema,
});

const simplifiedDataSchema = z.object({
  summary: z.string().trim().min(1, "summary is required"),
  concerns: z.array(concernSchema).default([]),
  meaning: z.string().trim().min(1, "meaning is required"),
});

const createReportBodySchema = z.object({
  title: z.string().trim().min(1, "title is required").max(200, "title is too long"),
  originalText: z.string().trim().min(1, "originalText is required"),
  simplifiedData: simplifiedDataSchema,
  fileUrl: z.string().trim().optional().default(""),
});

const updateReportTitleBodySchema = z.object({
  title: z.string().trim().min(1, "title is required").max(200, "title is too long"),
});

const messageBodySchema = z.object({
  role: z.enum(["user", "model"]),
  text: z.string().trim().min(1, "text is required").max(10000, "text is too long"),
});

const aiSimplifyBodySchema = z.object({
  reportText: z.string().trim().optional().default(""),
  fileUrl: z.string().trim().optional().default(""),
  fileName: z.string().trim().optional().default(""),
  imageDataUrls: z.array(z.string()).optional().default([]),
}).refine((data) => {
  return Boolean(data.reportText || data.fileUrl || data.imageDataUrls.length > 0);
}, {
  message: "Missing report content, fileUrl, or images",
  path: ["reportText"],
});

const aiChatBodySchema = z.object({
  messageText: z.string().trim().min(1, "messageText is required").max(10000, "messageText is too long"),
  currentReport: z.object({
    originalText: z.string().optional().default(""),
    simplifiedData: z.object({
      summary: z.string().optional().default(""),
    }).passthrough(),
  }).passthrough(),
  currentHistory: z.array(z.object({
    role: z.enum(["user", "model"]),
    text: z.string(),
  })).optional().default([]),
});

const translateBodySchema = z.object({
  text: z.string().min(1, "text is required"),
  targetLanguage: z.string().trim().min(2, "targetLanguage is required").max(32, "targetLanguage is too long"),
});

const ttsBodySchema = z.object({
  text: z.string().trim().min(1, "text is required").max(15000, "text is too long"),
  targetLang: z.string().trim().optional().default("en"),
});

function formatZodIssues(error: z.ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.length ? issue.path.join(".") : "payload"}: ${issue.message}`)
    .join("; ");
}

function validatePayload<T>(schema: z.ZodType<T>, payload: unknown, res: express.Response, source: string): T | null {
  const parsed = schema.safeParse(payload);
  if (!parsed.success) {
    res.status(400).json({
      error: `Invalid ${source}`,
      details: formatZodIssues(parsed.error),
    });
    return null;
  }
  return parsed.data;
}

function extractJsonObject(text: string): string {
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("AI response did not contain a valid JSON object.");
  }
  return text.slice(first, last + 1);
}

async function generateWithGroq(messages: GroqMessage[], asJson: boolean, model?: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === "MY_GROQ_API_KEY") {
    throw new Error("GROQ_API_KEY is missing or invalid.");
  }

  const requestBody: Record<string, unknown> = {
    model: model || "llama-3.3-70b-versatile",
    temperature: asJson ? 0.2 : 0.4,
    messages,
  };

  if (asJson) {
    requestBody.response_format = { type: "json_object" };
  }

  const response = await fetch(GROQ_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq API request failed (${response.status}): ${errorText}`);
  }

  const data = await response.json() as any;
  const content = data?.choices?.[0]?.message?.content;
  if (!content || typeof content !== "string") {
    throw new Error("Groq API returned an empty response.");
  }

  return content.trim();
}

async function startServer() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("MongoDB connected for Passport local auth");
  } catch (error) {
    console.error("MongoDB connection failed, falling back to in-memory MongoDB:", error);
    memoryMongo = await MongoMemoryServer.create();
    const memoryUri = memoryMongo.getUri();
    await mongoose.connect(memoryUri);
    console.log("In-memory MongoDB connected for Passport local auth");
  }

  app.use(express.json({ limit: "25mb" }));
  app.use(session({
    secret: process.env.SESSION_SECRET || "dev-session-secret-change-me",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: 1000 * 60 * 60 * 24 * 7,
    },
  }));

  passport.use(new LocalStrategy((User as any).authenticate()));
  passport.serializeUser((User as any).serializeUser());
  passport.deserializeUser((User as any).deserializeUser());

  app.use(passport.initialize());
  app.use(passport.session());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post("/api/auth/signup", async (req, res) => {
    const authBody = validatePayload(authBodySchema, req.body, res, "request body");
    if (!authBody) return;
    const { username, password } = authBody;

    try {
      const registeredUser = await (User as any).register(new User({ username }), password);
      (req as any).login(registeredUser, (err: unknown) => {
        if (err) {
          console.error("Signup login session error:", err);
          return res.status(500).json({ error: "User created, but session initialization failed" });
        }
        return res.json({
          user: {
            id: registeredUser._id,
            username: registeredUser.username,
          },
        });
      });
    } catch (error: any) {
      console.error("Signup error:", error);
      if (error?.name === "UserExistsError") {
        return res.status(409).json({ error: "Username already exists" });
      }
      return res.status(500).json({ error: "Signup failed" });
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    const authBody = validatePayload(authBodySchema, req.body, res, "request body");
    if (!authBody) return;
    req.body = authBody;

    passport.authenticate("local", (err: unknown, user: any, info: any) => {
      if (err) {
        console.error("Login auth error:", err);
        return res.status(500).json({ error: "Login failed" });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid username or password" });
      }
      (req as any).login(user, (loginErr: unknown) => {
        if (loginErr) {
          console.error("Login session error:", loginErr);
          return res.status(500).json({ error: "Login session failed" });
        }
        return res.json({
          user: {
            id: user._id,
            username: user.username,
          },
        });
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res) => {
    (req as any).logout((err: unknown) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ ok: true });
    });
  });

  app.get("/api/auth/me", (req, res) => {
    const authReq = req as any;
    if (!authReq.isAuthenticated || !authReq.isAuthenticated()) {
      return res.status(401).json({ user: null });
    }
    const user = authReq.user;
    return res.json({
      user: {
        id: user._id,
        username: user.username,
      },
    });
  });

  const requireAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authReq = req as any;
    if (!authReq.isAuthenticated || !authReq.isAuthenticated()) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    next();
  };

  app.get("/api/reports", requireAuth, async (req, res) => {
    const authReq = req as any;
    const ownerId = authReq.user._id;
    const reports = await ReportModel.find({ ownerId }).sort({ createdAt: -1 }).lean();
    res.json({
      reports: reports.map((report: any) => ({
        id: String(report._id),
        userId: String(report.ownerId),
        title: report.title,
        originalText: report.originalText,
        simplifiedData: report.simplifiedData,
        fileUrl: report.fileUrl,
        createdAt: report.createdAt,
      })),
    });
  });

  app.post("/api/reports", requireAuth, async (req, res) => {
    const authReq = req as any;
    const ownerId = authReq.user._id;
    const body = validatePayload(createReportBodySchema, req.body, res, "request body");
    if (!body) return;
    const { title, originalText, simplifiedData, fileUrl } = body;
    const report = await ReportModel.create({
      ownerId,
      title,
      originalText,
      simplifiedData,
      fileUrl: fileUrl || "",
    });
    res.json({
      report: {
        id: String(report._id),
        userId: String(report.ownerId),
        title: report.title,
        originalText: report.originalText,
        simplifiedData: report.simplifiedData,
        fileUrl: report.fileUrl,
        createdAt: report.createdAt,
      },
    });
  });

  app.patch("/api/reports/:id", requireAuth, async (req, res) => {
    const authReq = req as any;
    const ownerId = authReq.user._id;
    const params = validatePayload(objectIdParamSchema, req.params, res, "request params");
    if (!params) return;
    const body = validatePayload(updateReportTitleBodySchema, req.body, res, "request body");
    if (!body) return;
    const { id } = params;
    const { title } = body;
    const updated = await ReportModel.findOneAndUpdate(
      { _id: id, ownerId },
      { $set: { title: title.trim() } },
      { new: true }
    ).lean();
    if (!updated) {
      return res.status(404).json({ error: "Report not found" });
    }
    res.json({ ok: true });
  });

  app.delete("/api/reports/:id", requireAuth, async (req, res) => {
    const authReq = req as any;
    const ownerId = authReq.user._id;
    const params = validatePayload(objectIdParamSchema, req.params, res, "request params");
    if (!params) return;
    const { id } = params;
    const deleted = await ReportModel.findOneAndDelete({ _id: id, ownerId });
    if (!deleted) {
      return res.status(404).json({ error: "Report not found" });
    }
    await MessageModel.deleteMany({ reportId: id, ownerId });
    res.json({ ok: true });
  });

  app.get("/api/reports/:id/messages", requireAuth, async (req, res) => {
    const authReq = req as any;
    const ownerId = authReq.user._id;
    const params = validatePayload(objectIdParamSchema, req.params, res, "request params");
    if (!params) return;
    const { id } = params;
    const report = await ReportModel.findOne({ _id: id, ownerId }).lean();
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    const messages = await MessageModel.find({ reportId: id, ownerId }).sort({ createdAt: 1 }).lean();
    res.json({
      messages: messages.map((message: any) => ({
        id: String(message._id),
        role: message.role,
        text: message.text,
        createdAt: message.createdAt,
      })),
    });
  });

  app.post("/api/reports/:id/messages", requireAuth, async (req, res) => {
    const authReq = req as any;
    const ownerId = authReq.user._id;
    const params = validatePayload(objectIdParamSchema, req.params, res, "request params");
    if (!params) return;
    const body = validatePayload(messageBodySchema, req.body, res, "request body");
    if (!body) return;
    const { id } = params;
    const { role, text } = body;
    const report = await ReportModel.findOne({ _id: id, ownerId }).lean();
    if (!report) {
      return res.status(404).json({ error: "Report not found" });
    }
    const message = await MessageModel.create({ reportId: id, ownerId, role, text });
    res.json({
      message: {
        id: String(message._id),
        role: message.role,
        text: message.text,
        createdAt: message.createdAt,
      },
    });
  });

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });

  const upload = multer({ storage: multer.memoryStorage() });

  app.post("/api/stt", upload.single("audio"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No audio provided" });
    }
    if (!req.file.mimetype.startsWith("audio/")) {
      return res.status(400).json({ error: "Invalid audio file format" });
    }
    const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;
    const hasElevenLabs = Boolean(elevenLabsApiKey && elevenLabsApiKey !== "MY_ELEVENLABS_API_KEY");
    const hasGroq = Boolean(groqApiKey && groqApiKey !== "MY_GROQ_API_KEY");
    if (!hasElevenLabs && !hasGroq) {
      return res.status(500).json({ error: "No STT provider configured. Set ELEVENLABS_API_KEY or GROQ_API_KEY." });
    }
    try {
      const audioBytes = Uint8Array.from(req.file.buffer);
      const audioBlob = new Blob([audioBytes], { type: req.file.mimetype || "audio/webm" });
      if (hasElevenLabs) {
        try {
          const elevenForm = new FormData();
          elevenForm.append("file", audioBlob, req.file.originalname || "speech.webm");
          elevenForm.append("model_id", process.env.ELEVENLABS_STT_MODEL || "scribe_v2");
          const elevenResponse = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
            method: "POST",
            headers: { "xi-api-key": String(elevenLabsApiKey) },
            body: elevenForm,
          });
          if (elevenResponse.ok) {
            const elevenData = await elevenResponse.json() as any;
            const transcript = String(elevenData?.text || elevenData?.transcript || "").trim();
            if (transcript) {
              return res.json({ text: transcript, provider: "elevenlabs" });
            }
          } else {
            const elevenErrText = await elevenResponse.text();
            console.error(`ElevenLabs STT failed (${elevenResponse.status}):`, elevenErrText);
          }
        } catch (elevenErr) {
          console.error("ElevenLabs STT exception, falling back to Groq:", elevenErr);
        }
      }
      if (!hasGroq) {
        return res.status(500).json({ error: "Speech transcription failed with ElevenLabs and GROQ fallback is not configured." });
      }
      const groqForm = new FormData();
      groqForm.append("file", audioBlob, req.file.originalname || "speech.webm");
      groqForm.append("model", "whisper-large-v3-turbo");
      groqForm.append("response_format", "json");
      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqApiKey}` },
        body: groqForm,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Groq STT failed (${response.status}): ${errorText}`);
      }
      const data = await response.json() as any;
      res.json({ text: String(data?.text || ""), provider: "groq" });
    } catch (err) {
      console.error("Speech transcription error:", err);
      res.status(500).json({ error: "Speech-to-text transcription failed" });
    }
  });

  app.post("/api/upload", upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }
    const allowedMimes = new Set(["image/jpeg", "image/jpg", "image/png", "application/pdf"]);
    if (!allowedMimes.has(req.file.mimetype)) {
      return res.status(400).json({ error: "Only JPEG, PNG, and PDF files are supported." });
    }
    try {
      const b64 = Buffer.from(req.file.buffer).toString("base64");
      const dataURI = "data:" + req.file.mimetype + ";base64," + b64;
      const result = await cloudinary.uploader.upload(dataURI, {
        resource_type: "auto",
        folder: "medical_reports",
      });
      res.json({ url: result.secure_url, public_id: result.public_id });
    } catch (err) {
      console.error("Cloudinary upload error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  });

  app.post("/api/ai/simplify", async (req, res) => {
    const body = validatePayload(aiSimplifyBodySchema, req.body, res, "request body");
    if (!body) return;
    const { reportText, fileUrl, fileName, imageDataUrls } = body;
    try {
      const systemPrompt = "You are a medical expert who creates comprehensive, detailed patient-friendly explanations for medical reports. Include all important clinical findings, test results, measurements, and professional interpretations. Your summaries should be thorough and include complete information from the report. Respond strictly in JSON with keys: summary, concerns, meaning.";
      const userPromptText = [
        "Create a comprehensive, detailed patient-friendly explanation for this medical report. Include all important findings, test results, measurements, and clinical information. The summary should be thorough and include all key details from the report.",
        reportText ? `Report text: ${reportText}` : "No pasted report text provided.",
        fileUrl ? `Uploaded file URL: ${fileUrl}` : "No uploaded file URL provided.",
        Array.isArray(imageDataUrls) && imageDataUrls.length > 0 ? `Attached image pages: ${imageDataUrls.length}` : "No attached image pages.",
        fileName ? `Uploaded file name: ${fileName}` : "",
        "Return JSON in this exact shape:",
        '{"summary":"...","concerns":[{"item":"...","severity":"Normal|Caution|Critical"}],"meaning":"..."}'
      ].filter(Boolean).join("\n\n");

      const attachedImages = Array.isArray(imageDataUrls)
        ? imageDataUrls.filter((url: unknown) => typeof url === "string" && url.startsWith("data:image/"))
        : [];
      const hasVisionInput = attachedImages.length > 0;
      const userContent = hasVisionInput
        ? [
            { type: "text", text: userPromptText },
            ...attachedImages.map((url: string) => ({ type: "image_url", image_url: { url } })),
          ]
        : userPromptText;

      const rawResponse = await generateWithGroq(
        [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        true,
        hasVisionInput ? "meta-llama/llama-4-scout-17b-16e-instruct" : undefined
      );

      let parsed: any;
      try {
        parsed = JSON.parse(rawResponse);
      } catch {
        parsed = JSON.parse(extractJsonObject(rawResponse));
      }

      const concerns = Array.isArray(parsed?.concerns)
        ? parsed.concerns.map((entry: any) => {
            if (typeof entry === "string") {
              return { item: entry.trim(), severity: "Normal" as const };
            }
            const severity = entry?.severity === "Critical" || entry?.severity === "Caution" ? entry.severity : "Normal";
            return { item: String(entry?.item ?? "").trim(), severity };
          }).filter((entry: { item: string }) => entry.item.length > 0)
        : [];

      const simplifiedData = {
        summary: String(parsed?.summary ?? ""),
        concerns,
        meaning: String(parsed?.meaning ?? ""),
      };

      if (!simplifiedData.summary || !simplifiedData.meaning) {
        return res.status(500).json({ error: "AI returned an incomplete simplification result." });
      }

      res.json({ simplifiedData });
    } catch (err) {
      console.error("Groq simplify error:", err);
      res.status(500).json({ error: "Groq simplification failed" });
    }
  });

  app.post("/api/ai/chat", async (req, res) => {
    const body = validatePayload(aiChatBodySchema, req.body, res, "request body");
    if (!body) return;
    const { messageText, currentReport, currentHistory } = body;
    try {
      const systemPrompt = [
        "You are a medical assistant helping a patient understand their report.",
        `Report summary: ${currentReport?.simplifiedData?.summary ?? "N/A"}`,
        `Original report text: ${currentReport?.originalText ?? "N/A"}`,
        "Answer clearly, safely, and empathetically.",
      ].join("\n");

      const historyMessages: GroqMessage[] = Array.isArray(currentHistory)
        ? currentHistory
            .filter((m: any) => typeof m?.text === "string" && (m?.role === "user" || m?.role === "model"))
            .map((m: any) => ({ role: m.role === "user" ? "user" : "assistant", content: m.text }))
        : [];

      const aiText = await generateWithGroq(
        [
          { role: "system", content: systemPrompt },
          ...historyMessages,
          { role: "user", content: String(messageText) },
        ],
        false
      );

      res.json({ text: aiText });
    } catch (err) {
      console.error("Groq chat error:", err);
      res.status(500).json({ error: "Groq chat failed" });
    }
  });

  app.post("/api/translate", async (req, res) => {
    const body = validatePayload(translateBodySchema, req.body, res, "request body");
    if (!body) return;
    const { text, targetLanguage } = body;
    try {
      let parsedJson: any = null;
      let isJsonPayload = false;
      try {
        parsedJson = JSON.parse(text);
        isJsonPayload = typeof parsedJson === "object" && parsedJson !== null;
      } catch {
        isJsonPayload = false;
      }

      const googleApiKey = process.env.GOOGLE_CLOUD_API_KEY || process.env.GEMINI_API_KEY;
      if (googleApiKey && googleApiKey !== "MY_GOOGLE_CLOUD_API_KEY") {
        try {
          const translate = new Translate({ key: googleApiKey });
          if (isJsonPayload) {
            const translatedObj: any = {};
            for (const [key, value] of Object.entries(parsedJson)) {
              if (typeof value === "string") {
                const [translation] = await translate.translate(value, targetLanguage);
                translatedObj[key] = translation;
              } else if (Array.isArray(value)) {
                const translatedArray = [];
                for (const item of value) {
                  if (typeof item === "object" && item !== null) {
                    const translatedItem: any = {};
                    for (const [iKey, iValue] of Object.entries(item)) {
                      if (typeof iValue === "string" && iKey !== "severity") {
                        const [iTranslation] = await translate.translate(iValue, targetLanguage);
                        translatedItem[iKey] = iTranslation;
                      } else {
                        translatedItem[iKey] = iValue;
                      }
                    }
                    translatedArray.push(translatedItem);
                  } else {
                    translatedArray.push(item);
                  }
                }
                translatedObj[key] = translatedArray;
              } else {
                translatedObj[key] = value;
              }
            }
            return res.json({ translatedText: JSON.stringify(translatedObj) });
          }
          const [translation] = await translate.translate(text, targetLanguage);
          return res.json({ translatedText: translation });
        } catch (googleErr) {
          console.error("Google translation failed, falling back to Groq:", googleErr);
        }
      }

      if (isJsonPayload) {
        const raw = await generateWithGroq(
          [
            { role: "system", content: "Translate report JSON values to target language. Keep keys identical. Preserve severity values exactly as one of: Normal, Caution, Critical. Return only valid JSON." },
            { role: "user", content: `Target language: ${targetLanguage}\n\nJSON:\n${JSON.stringify(parsedJson)}` },
          ],
          true
        );
        let translatedJson: any;
        try {
          translatedJson = JSON.parse(raw);
        } catch {
          translatedJson = JSON.parse(extractJsonObject(raw));
        }
        return res.json({ translatedText: JSON.stringify(translatedJson) });
      }

      const translatedText = await generateWithGroq(
        [
          { role: "system", content: "You are a translation assistant. Return only translated text." },
          { role: "user", content: `Translate to ${targetLanguage}:\n\n${String(text)}` },
        ],
        false
      );
      return res.json({ translatedText: translatedText.trim() });
    } catch (err) {
      console.error("Translation error:", err);
      res.status(500).json({ error: "Translation failed" });
    }
  });

  app.post("/api/tts", async (req, res) => {
    const body = validatePayload(ttsBodySchema, req.body, res, "request body");
    if (!body) return;
    const { text, targetLang } = body;

    const ttsLanguageMap: Record<string, string> = {
      en: "en-US", hi: "hi-IN", or: "or-IN", mr: "mr-IN", te: "te-IN",
      bn: "bn-IN", ta: "ta-IN", kn: "kn-IN", gu: "gu-IN", ml: "ml-IN", pa: "pa-IN",
    };
    const langNameMap: Record<string, string> = {
      en: "English", hi: "Hindi", or: "Odia", mr: "Marathi", te: "Telugu",
      bn: "Bengali", ta: "Tamil", kn: "Kannada", gu: "Gujarati", ml: "Malayalam", pa: "Punjabi",
    };

    try {
      const elevenLabsApiKey = process.env.ELEVENLABS_API_KEY;
      const defaultVoiceId = process.env.ELEVENLABS_VOICE_ID || "EXAVITQu4vr4xnSDxMaL";
      const indianVoiceFallback = process.env.ELEVENLABS_VOICE_ID_INDIAN;
      const languageKey = String(targetLang || "en").toLowerCase();
      const languageVoiceMap: Record<string, string | undefined> = {
        en: process.env.ELEVENLABS_VOICE_ID_EN,
        hi: process.env.ELEVENLABS_VOICE_ID_HI,
        bn: process.env.ELEVENLABS_VOICE_ID_BN,
        or: process.env.ELEVENLABS_VOICE_ID_OR,
      };
      const elevenLabsVoiceId = languageVoiceMap[languageKey] || indianVoiceFallback || defaultVoiceId;
      const requiresDialoguePacing = ["bn", "or", "mr"].includes(languageKey);
      const MAX_ELEVENLABS_CHARS = 9500;

      let spokenText = String(text);
      if (spokenText.length > MAX_ELEVENLABS_CHARS) {
        spokenText = spokenText.substring(0, MAX_ELEVENLABS_CHARS).trim();
      }

      try {
        const rewriteInstruction =
          languageKey === "en"
            ? "Rewrite medical text for clear spoken narration in Indian English. Keep meaning intact, expand abbreviations naturally, and break long sentences into short sentences with natural pause punctuation so TTS sounds slower and clearer. Return only rewritten text."
            : requiresDialoguePacing
              ? "Rewrite medical text for clear spoken narration in the requested language. Keep meaning intact, use native script, reduce English code-switching, and add natural dialogue pause punctuation (commas, ellipses, question marks). Break sentences sparingly to keep text compact. Make it sound like calm dialogue narration. Return only rewritten text, do not expand length unnecessarily."
              : "Rewrite medical text for clear spoken narration in the requested language. Keep meaning intact, use native script, reduce English code-switching, expand abbreviations naturally, and break long sentences into shorter sentences with natural pause punctuation so TTS sounds slower and clearer. Return only rewritten text.";
        const spokenRewrite = await generateWithGroq(
          [
            { role: "system", content: rewriteInstruction },
            { role: "user", content: `Language: ${langNameMap[languageKey] || languageKey}\n\nText:\n${spokenText}` },
          ],
          false
        );
        if (spokenRewrite?.trim()) {
          let rewritten = spokenRewrite.trim();
          if (rewritten.length > MAX_ELEVENLABS_CHARS) {
            rewritten = rewritten.substring(0, MAX_ELEVENLABS_CHARS).trim();
          }
          spokenText = rewritten;
        }
      } catch (rewriteErr) {
        console.error("TTS spoken-text rewrite failed, using original text:", rewriteErr);
      }

      if (elevenLabsApiKey) {
        try {
          const elevenResponse = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`, {
            method: "POST",
            headers: {
              "xi-api-key": elevenLabsApiKey,
              "Content-Type": "application/json",
              "Accept": "audio/mpeg",
            },
            body: JSON.stringify({
              text: spokenText,
              model_id: "eleven_v3",
              voice_settings: { stability: 0.45, similarity_boost: 0.75 },
            }),
          });
          if (elevenResponse.ok) {
            const audioArrayBuffer = await elevenResponse.arrayBuffer();
            const audioBase64 = Buffer.from(audioArrayBuffer).toString("base64");
            return res.json({ audioData: audioBase64 });
          }
          const elevenErr = await elevenResponse.text();
          console.error("ElevenLabs TTS failed, falling back to Google TTS:", elevenErr);
        } catch (elevenCatchErr) {
          console.error("ElevenLabs TTS exception, falling back to Google TTS:", elevenCatchErr);
        }
      }

      const apiKey = process.env.GOOGLE_CLOUD_API_KEY || process.env.GEMINI_API_KEY;
      if (!apiKey || apiKey === "MY_GOOGLE_CLOUD_API_KEY") {
        console.error("No usable TTS provider configured.");
        return res.status(500).json({ error: "No usable TTS provider configured." });
      }

      const client = new TextToSpeechClient({ apiKey });
      const languageCode = ttsLanguageMap[String(targetLang || "en")] || "en-US";
      const googleVoiceNameMap: Record<string, string | undefined> = {
        en: "en-IN-Standard-D",
        hi: "hi-IN-Standard-A",
      };
      const preferredGoogleVoice = googleVoiceNameMap[languageKey];
      const request = {
        input: { text: spokenText },
        voice: preferredGoogleVoice
          ? { languageCode, name: preferredGoogleVoice }
          : { languageCode, ssmlGender: "NEUTRAL" as const },
        audioConfig: {
          audioEncoding: "MP3" as const,
          speakingRate: requiresDialoguePacing ? 0.72 : (languageKey !== "en" && languageKey !== "hi" ? 0.82 : 0.95),
        },
      };

      const [response] = await client.synthesizeSpeech(request);
      const audioContent = response.audioContent;
      if (audioContent) {
        const audioBase64 = Buffer.from(audioContent).toString("base64");
        res.json({ audioData: audioBase64 });
      } else {
        res.status(500).json({ error: "TTS failed to generate audio" });
      }
    } catch (err) {
      console.error("TTS error:", err);
      res.status(500).json({ error: "TTS failed" });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();