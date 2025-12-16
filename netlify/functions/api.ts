import express, { Router } from "express";
import serverless from "serverless-http";
import { registerRoutes } from "../../server/routes";

const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Create a router for the API
const router = Router();

// Register the existing routes to the router (needs verification if registerRoutes attaches to app or router)
// Inspecting server/routes.ts: registerRoutes(app: Express)
// We need to pass the app to registerRoutes
registerRoutes(app);

// For Netlify Functions, paths are typically /.netlify/functions/api/resource
// We will use a rewrite in netlify.toml to map /api/* to /.netlify/functions/api

export const handler = serverless(app);
