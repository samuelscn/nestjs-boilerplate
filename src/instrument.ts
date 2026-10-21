import "dotenv/config";
import { initErrorTracking } from "./package/shared/module/error-tracking";

// Imported first by main.ts so the SDK is ready before the application loads.
initErrorTracking();
