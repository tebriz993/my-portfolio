import { useQuery } from "@tanstack/react-query";

interface GitHubRepo {
  id: number;
  name: string;
  description: string | null;
  html_url: string;
  homepage: string | null;
  language: string | null;
  topics: string[];
  stargazers_count: number;
  forks_count: number;
  updated_at: string;
}

export function useGitHubRepos() {
  return useQuery<GitHubRepo[]>({
    queryKey: ["/api/github/repos"],
    staleTime: 1000 * 60 * 10, // 10 minutes
  });
}
