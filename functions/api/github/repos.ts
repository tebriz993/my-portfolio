export const onRequestGet: PagesFunction<{ GITHUB_TOKEN?: string }> = async (context) => {
    try {
        const response = await fetch(
            "https://api.github.com/users/tebriz993/repos?sort=updated&per_page=20",
            {
                headers: {
                    "User-Agent": "Portfolio-Website",
                    ...(context.env.GITHUB_TOKEN && {
                        Authorization: `token ${context.env.GITHUB_TOKEN}`,
                    }),
                },
            }
        );

        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }

        const repos: any[] = await response.json();

        const filteredRepos = repos
            .filter((repo) => !repo.fork)
            .sort((a, b) => {
                if (b.stargazers_count !== a.stargazers_count) {
                    return b.stargazers_count - a.stargazers_count;
                }
                return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
            });

        return new Response(JSON.stringify(filteredRepos), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        return new Response(JSON.stringify({
            error: "Failed to fetch repositories",
            message: String(error)
        }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
};
