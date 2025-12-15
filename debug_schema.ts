
import { insertGameScoreSchema } from "./shared/schema";

const payloads = [
    {
        playerName: "TestPlayer",
        gameType: "tic-tac-toe",
        score: 100,
    },
    {
        playerName: "TestPlayer",
        gameType: "sudoku",
        score: 1,
        timeInSeconds: 120,
    },
    {
        playerName: "TestPlayer",
        gameType: "reaction-time",
        score: 300,
    },
];

console.log("Testing payloads against insertGameScoreSchema...");

payloads.forEach((payload, index) => {
    try {
        const result = insertGameScoreSchema.parse(payload);
        console.log(`Payload ${index} VALID:`, result);
    } catch (error: any) {
        console.error(`Payload ${index} INVALID:`, error.issues);
    }
});
