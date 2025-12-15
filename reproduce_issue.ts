// using global fetch

async function testScoreSubmission() {
    const payload = {
        playerName: "TestPlayer",
        gameType: "tic-tac-toe",
        score: 100,
        timeInSeconds: 0,
        level: 1
    };

    try {
        const response = await fetch("http://localhost:5000/api/games/scores", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            console.error(`Status: ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.error("Body:", text);
        } else {
            const data = await response.json();
            console.log("Success:", data);
        }
    } catch (error) {
        console.error("Fetch error:", error);
    }
}

testScoreSubmission();
