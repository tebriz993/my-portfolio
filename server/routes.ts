import type { Express } from "express";
import { createServer, type Server } from "http";
import { MailService } from '@sendgrid/mail';
import { db } from "./db";
import { gameScores, insertGameScoreSchema } from "@shared/schema";
import { desc, asc, eq, and } from "drizzle-orm";

export async function registerRoutes(app: Express): Promise<Server> {
  // GitHub API proxy endpoint
  app.get("/api/github/repos", async (req, res) => {
    try {
      const response = await fetch(
        "https://api.github.com/users/tebriz993/repos?sort=updated&per_page=20",
        {
          headers: {
            "User-Agent": "Portfolio-Website",
            ...(process.env.GITHUB_TOKEN && {
              Authorization: `token ${process.env.GITHUB_TOKEN}`,
            }),
          },
        }
      );

      if (!response.ok) {
        throw new Error(`GitHub API error: ${response.status}`);
      }

      const repos = await response.json();
      
      // Filter out forks and sort by stars/activity
      const filteredRepos = repos
        .filter((repo: any) => !repo.fork)
        .sort((a: any, b: any) => {
          // Sort by stars first, then by update date
          if (b.stargazers_count !== a.stargazers_count) {
            return b.stargazers_count - a.stargazers_count;
          }
          return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
        });

      res.json(filteredRepos);
    } catch (error) {
      console.error("Error fetching GitHub repos:", error);
      res.status(500).json({ 
        error: "Failed to fetch repositories",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Contact form email endpoint
  app.post("/api/contact", async (req, res) => {
    try {
      const { name, email, subject, message } = req.body;

      // Validate required fields
      if (!name || !email || !subject || !message) {
        return res.status(400).json({ 
          error: "Missing required fields",
          message: "Name, email, subject, and message are required"
        });
      }

      // Check if SendGrid API key is available
      if (!process.env.SENDGRID_API_KEY) {
        return res.status(500).json({ 
          error: "Email service not configured",
          message: "SendGrid API key is missing"
        });
      }

      // Initialize SendGrid
      const mailService = new MailService();
      mailService.setApiKey(process.env.SENDGRID_API_KEY);

      // Prepare email content
      const emailContent = {
        to: 'latifovtebriz@gmail.com', // Your email address
        from: 'latifovtebriz@gmail.com', // Must be verified in SendGrid
        subject: `Portfolio Contact: ${subject}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <p><strong>Name:</strong> ${name}</p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Subject:</strong> ${subject}</p>
          <h3>Message:</h3>
          <p>${message.replace(/\n/g, '<br>')}</p>
          <hr>
          <p><small>Sent from your portfolio website contact form</small></p>
        `,
        text: `
          New Contact Form Submission
          
          Name: ${name}
          Email: ${email}
          Subject: ${subject}
          
          Message:
          ${message}
          
          Sent from your portfolio website contact form
        `
      };

      // Send email
      await mailService.send(emailContent);

      res.json({ 
        success: true,
        message: "Email sent successfully"
      });

    } catch (error) {
      console.error("Error sending email:", error);
      res.status(500).json({ 
        error: "Failed to send email",
        message: error instanceof Error ? error.message : "Unknown error"
      });
    }
  });

  // Game scores API endpoints
  
  // Get top scores for a specific game
  app.get("/api/games/:gameType/scores", async (req, res) => {
    try {
      const { gameType } = req.params;
      const { limit = "10" } = req.query;
      
      let orderBy;
      if (gameType === "memory") {
        // For memory game, lower time is better
        orderBy = asc(gameScores.timeInSeconds);
      } else {
        // For other games, higher score is better
        orderBy = desc(gameScores.score);
      }
      
      const scores = await db
        .select()
        .from(gameScores)
        .where(eq(gameScores.gameType, gameType))
        .orderBy(orderBy)
        .limit(parseInt(limit as string));
        
      res.json(scores);
    } catch (error) {
      console.error("Error fetching game scores:", error);
      res.status(500).json({ error: "Failed to fetch scores" });
    }
  });

  // Submit a new score (generic endpoint)
  app.post("/api/games/scores", async (req, res) => {
    try {
      const scoreData = insertGameScoreSchema.parse(req.body);
      
      const [newScore] = await db
        .insert(gameScores)
        .values(scoreData)
        .returning();
        
      res.json(newScore);
    } catch (error) {
      console.error("Error saving game score:", error);
      res.status(500).json({ error: "Failed to save score" });
    }
  });

  // Head Ball specific endpoints
  app.get("/api/games/headball/scores", async (req, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      
      const scores = await db
        .select({
          id: gameScores.id,
          playerName: gameScores.playerName,
          score: gameScores.score,
          timeInSeconds: gameScores.timeInSeconds,
          createdAt: gameScores.createdAt,
        })
        .from(gameScores)
        .where(eq(gameScores.gameType, 'headball'))
        .orderBy(desc(gameScores.score))
        .limit(limit || 100);
        
      res.json(scores);
    } catch (error) {
      console.error("Error fetching Head Ball scores:", error);
      res.status(500).json({ error: "Failed to fetch scores" });
    }
  });

  app.post("/api/games/headball/scores", async (req, res) => {
    try {
      const { playerName, score, timeInSeconds } = req.body;
      
      if (!playerName || typeof score !== 'number' || typeof timeInSeconds !== 'number') {
        return res.status(400).json({ error: "Invalid score data" });
      }
      
      const [newScore] = await db
        .insert(gameScores)
        .values({
          playerName,
          gameType: 'headball',
          score,
          timeInSeconds,
        })
        .returning();
        
      res.json(newScore);
    } catch (error) {
      console.error("Error saving Head Ball score:", error);
      res.status(500).json({ error: "Failed to save score" });
    }
  });

  // Get personal best for a player in a specific game
  app.get("/api/games/:gameType/player/:playerName/best", async (req, res) => {
    try {
      const { gameType, playerName } = req.params;
      
      let orderBy;
      if (gameType === "memory") {
        orderBy = asc(gameScores.timeInSeconds);
      } else {
        orderBy = desc(gameScores.score);
      }
      
      const [bestScore] = await db
        .select()
        .from(gameScores)
        .where(and(
          eq(gameScores.gameType, gameType),
          eq(gameScores.playerName, playerName)
        ))
        .orderBy(orderBy)
        .limit(1);
        
      res.json(bestScore || null);
    } catch (error) {
      console.error("Error fetching player best score:", error);
      res.status(500).json({ error: "Failed to fetch player best score" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
