import express, { Router } from "express";
import serverless from "serverless-http";
import { registerRoutes } from "../../server/routes";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Debugging middleware
app.use((req, res, next) => {
    console.log(`[Netlify Function] ${req.method} ${req.path}`);
    console.log(`[Netlify Function] Original URL: ${req.originalUrl}`);
    next();
});

// Create a router for the API
const router = Router();

// Register existing routes to the Router instead of the App
// This allows us to mount the router at the Netlify function path
registerRoutes(router as any);

// Mount the router so it handles requests starting with /.netlify/functions
// When a request comes in as /.netlify/functions/api/x, the router sees /api/x
// which matches the routes defined in registerRoutes
app.use('/.netlify/functions', router);

// Also mount at /api for local testing or direct access if rewrites behave differently
app.use('/api', router);

// Catch-all 404 handler for debugging (after routes)
app.use((req, res) => {
    console.log(`[Netlify Function] 404 Not Found: ${req.method} ${req.path}`);
    res.status(404).json({
        error: "Route not found",
        path: req.path,
        originalUrl: req.originalUrl,
        method: req.method,
        message: "This response is from the Netlify Function express app"
    });
});

export const handler = serverless(app);
