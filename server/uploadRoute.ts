import express from "express";
import multer from "multer";
import { storagePut } from "./storage";
import { getDb } from "./db";
import { documents } from "../drizzle/schema";
import { eq } from "drizzle-orm";

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } });

export function registerUploadRoute(app: express.Express) {
  app.post("/api/upload", upload.single("file"), async (req, res) => {
    try {
      const file = (req as express.Request & { file?: Express.Multer.File }).file;
      const key = req.body.key as string;

      if (!file || !key) {
        res.status(400).json({ error: "Missing file or key" });
        return;
      }

      await storagePut(key, file.buffer, file.mimetype || "application/pdf");

      // Mark document as uploaded (find by storageKey)
      const db = await getDb();
      if (db) {
        await db
          .update(documents)
          .set({ processed: false })
          .where(eq(documents.storageKey, key));
      }

      res.json({ success: true, key });
    } catch (err) {
      console.error("[Upload] Error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  });
}
