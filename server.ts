import express from "express";
import { createServer as createViteServer } from "vite";
import { getReports, createReport, deleteReport, searchReports, getReportById } from "./src/db";
import { generateReportStream } from "./src/services/gemini";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' })); // Increase limit for large payloads if needed

  // API Routes
  app.post("/api/generate", async (req, res) => {
    try {
      const { companyName, website, description, files } = req.body;
      
      const reportContent = await generateReportStream({
        companyName,
        website,
        description,
        files
      });
      
      res.json({ content: reportContent });
    } catch (error) {
      console.error("Generation error:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.get("/api/reports", (req, res) => {
    try {
      const { search } = req.query;
      if (search) {
        const reports = searchReports(search as string);
        res.json(reports);
      } else {
        const reports = getReports();
        res.json(reports);
      }
    } catch (error) {
      console.error("Error fetching reports:", error);
      res.status(500).json({ error: "Failed to fetch reports" });
    }
  });

  app.get("/api/reports/:id", (req, res) => {
    try {
      const report = getReportById(Number(req.params.id));
      if (report) {
        res.json(report);
      } else {
        res.status(404).json({ error: "Report not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch report" });
    }
  });

  app.post("/api/reports", (req, res) => {
    try {
      const newReport = createReport(req.body);
      res.json(newReport);
    } catch (error) {
      console.error("Error creating report:", error);
      res.status(500).json({ error: "Failed to create report" });
    }
  });

  app.delete("/api/reports/:id", (req, res) => {
    try {
      deleteReport(Number(req.params.id));
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete report" });
    }
  });

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    const path = await import("path");
    const distPath = path.resolve(process.cwd(), "dist");
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
