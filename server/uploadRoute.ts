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
      const key = req.body.key as string; // placeholder key from getUploadUrl
      const docIdStr = req.body.docId as string;

      if (!file || !key) {
        res.status(400).json({ error: "Missing file or key" });
        return;
      }

      // storagePut appends a hash suffix — we get back the REAL key
      const { key: realKey } = await storagePut(key, file.buffer, file.mimetype || "application/pdf");

      // Update the document record with the real storage key so extractQuestions can find it
      const db = await getDb();
      if (db && docIdStr) {
        const docId = parseInt(docIdStr, 10);
        if (!isNaN(docId)) {
          await db
            .update(documents)
            .set({ storageKey: realKey, storageUrl: `/manus-storage/${realKey}` })
            .where(eq(documents.id, docId));
        }
      } else if (db) {
        // Fallback: match by placeholder key
        await db
          .update(documents)
          .set({ storageKey: realKey, storageUrl: `/manus-storage/${realKey}` })
          .where(eq(documents.storageKey, key));
      }

      res.json({ success: true, key: realKey });
    } catch (err) {
      console.error("[Upload] Error:", err);
      res.status(500).json({ error: "Upload failed" });
    }
  });
}
