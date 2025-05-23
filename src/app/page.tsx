"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VideoPlayer } from "@/components/VideoPlayer";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link2, Play, Loader2, AlertCircle, Tv2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function HomePage() {
  const [manifestUrlInput, setManifestUrlInput] = useState<string>("");
  const [proxiedManifestUrl, setProxiedManifestUrl] = useState<string | null>(
    null
  );
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const publicUrl = process.env.NEXT_PUBLIC_URL;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manifestUrlInput.trim()) {
      setError("Please enter a valid URL.");
      toast({
        title: "Input Error",
        description: "Please enter a valid URL.",
        variant: "destructive",
      });
      return;
    }
  
    setIsLoading(true);
    setError(null);
    setProxiedManifestUrl(null);
  
    try {
      const inputUrl = new URL(manifestUrlInput);
      let generatedUrl: string;
  
      // Detect YouTube livestream URLs
      const isYouTube = /^(?:https?:)?\/\/(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?v=|live\/|channel\/[^/]+\/live|c\/[^/]+\/live|@[^/]+\/live)|youtu\.be\/[^/]+)/i.test(
        manifestUrlInput
      );
  
      if (isYouTube) {
        // Use YouTube proxy endpoint
        generatedUrl = `/api/proxy/youtube?url=${encodeURIComponent(
          manifestUrlInput
        )}`;
        generatedUrl += generatedUrl.includes("?") ? "&oxycors=livestream.m3u8" : "?oxycors=livestream.m3u8";
      } else {
        // Assume plain HLS manifest
        generatedUrl = `/api/proxy/manifest?url=${encodeURIComponent(
          manifestUrlInput
        )}`;
      }
  
      setProxiedManifestUrl(generatedUrl);
      toast({
        title: "Stream Ready",
        description: isYouTube
          ? "YouTube stream proxy URL generated. Player will now attempt to load the stream."
          : "Proxy URL generated. Player will now attempt to load the stream.",
      });
  
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : "Invalid URL format.";
      setError(`Invalid URL: ${errorMessage}`);
      toast({
        title: "URL Error",
        description: `Invalid URL: ${errorMessage}`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };  

  const handleInputChange = (inputValue: string) => {
    setManifestUrlInput(inputValue);
    if (error) setError(null);
    if (proxiedManifestUrl) setProxiedManifestUrl(null);
  };

  return (
    <div className="flex flex-col items-center space-y-10 py-12 bg-gray-900 min-h-screen">
      <Card className="w-full max-w-3xl bg-gray-800 border border-gray-700 shadow-lg">
        <CardHeader>
          <CardTitle className="text-2xl font-semibold text-white text-center">
            HLS media proxy
          </CardTitle>
          <CardDescription className="text-center text-gray-400 mt-1">
            Enter an HLS manifest URL (<code>.m3u8</code>) or a YouTube livestream link to proxy and play.
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
              <Input
                type="url"
                placeholder="https://example.com/stream.m3u8 or https://youtu.be/XYZ"
                value={manifestUrlInput}
                onChange={(e) => handleInputChange(e.target.value)}
                disabled={isLoading}
                className="pl-10 bg-gray-700 text-gray-100 placeholder-gray-500 border-gray-600 focus:border-teal-400"
                aria-label="Stream URL"
              />
            </div>
            {error && (
              <Alert
                variant="destructive"
                className="mt-2 bg-gray-800 border-red-600 text-red-200"
              >
                <AlertCircle className="h-5 w-5 text-red-400" />
                <AlertTitle className="text-red-300">Error</AlertTitle>
                <AlertDescription className="text-red-200">
                  {error}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button
              type="submit"
              className="w-full bg-teal-500 hover:bg-teal-600 text-white"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Play className="mr-2 h-5 w-5" />
              )}
              {isLoading ? "Processing..." : "Proxy and Play"}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {proxiedManifestUrl && !error && (
        <>
          <VideoPlayer manifestUrl={proxiedManifestUrl} />
          <Card className="w-full max-w-3xl border bg-gray-900 border-gray-700 shadow-lg mt-8">
            <CardHeader>
              <CardTitle className="text-base text-white text-center">
                Proxied Stream Access on:
              </CardTitle>
            </CardHeader>
            <CardFooter>
              <a
                href={publicUrl ? publicUrl + proxiedManifestUrl : window.location.origin + proxiedManifestUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="block text-sm font-mono text-teal-400 break-all hover:underline"
              >
                {publicUrl ? publicUrl + proxiedManifestUrl : window.location.origin + proxiedManifestUrl}
              </a>
            </CardFooter>
          </Card>
        </>
      )}

      {!proxiedManifestUrl && !isLoading && !error && (
        <div className="w-full max-w-3xl mt-8 p-8 border-2 border-dashed border-gray-700 rounded-lg text-center text-gray-500">
          <Tv2 className="mx-auto h-12 w-12 mb-4 text-gray-600" />
          <p>Your proxied video will be played here.</p>
          <p className="text-sm">
            Enter a manifest URL above and click on “Proxy and Play”
          </p>
        </div>
      )}
    </div>
  );
}
