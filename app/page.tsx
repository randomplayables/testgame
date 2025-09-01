"use client";

import { useState } from 'react';
import GameTester from '@/components/GameTester';
import { Spinner } from '@/components/spinner';

export default function GameTestingPage() {
  const [githubUrl, setGithubUrl] = useState('https://github.com/randomplayables/rectify');
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [key, setKey] = useState(0); // Used to force re-mount of GameTester

  const handleFetchRepo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim()) {
      setError('Please enter a valid GitHub repository URL.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setFiles(null);

    try {
      const response = await fetch(`/api/fetch-repo?url=${encodeURIComponent(githubUrl)}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch repository.');
      }

      setFiles(data.files);
      setKey(prevKey => prevKey + 1); // Increment key to re-mount the tester component
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      console.error("Fetch repo error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold text-gray-800">Game Testing Platform</h1>
        <p className="mt-2 text-lg text-gray-600">
          Test your RandomPlayables game integration in a live sandbox environment.
        </p>
      </div>

      <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md border">
        <form onSubmit={handleFetchRepo}>
          <label htmlFor="githubUrl" className="block text-sm font-medium text-gray-700">
            GitHub Repository URL
          </label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <input
              type="url"
              name="githubUrl"
              id="githubUrl"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              className="flex-1 block w-full rounded-none rounded-l-md border-gray-300 focus:ring-emerald-500 focus:border-emerald-500 sm:text-sm"
              placeholder="https://github.com/username/my-rpts-game"
              required
            />
            <button
              type="submit"
              disabled={isLoading}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-r-md text-white bg-emerald-600 hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 disabled:opacity-50"
            >
              {isLoading ? <Spinner className="w-5 h-5" /> : 'Test Game'}
            </button>
          </div>
        </form>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      <div className="mt-8">
        {isLoading && (
          <div className="text-center p-8 text-gray-500">
            <p>Fetching and preparing your repository...</p>
            <p className="text-sm">(This might take a moment)</p>
          </div>
        )}
        {files && <GameTester key={key} files={files} repoUrl={githubUrl} />}
      </div>
    </div>
  );
}