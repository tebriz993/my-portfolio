import express from "express";
import serverless from "serverless-http";
import { registerRoutes } from "../../server/routes";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// CRITICAL FIX: Netlify strips /api from path when using :splat redirect
// Incoming path from Netlify: /games/scores
// Expected by routes: /api/games/scores
// We need to add /api prefix back
app.use((req, res, next) => {
    console.log(`[Netlify] Original: ${req.method} ${req.url}`);

    if (!req.url.startsWith('/api')) {
        req.url = '/api' + req.url;
        console.log(`[Netlify] Rewritten: ${req.method} ${req.url}`);
    }
    next();
});

// Register routes directly to app
registerRoutes(app);

// Catch-all 404 handler for debugging
app.use((req, res) => {
    console.log(`[Netlify] 404: ${req.method} ${req.url}`);
    res.status(404).json({
        error: "Route not found",
        path: req.path,
        url: req.url,
        method: req.method
    });
});

export const handler = serverless(app);
