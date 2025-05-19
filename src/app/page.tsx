"use client";

import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { VideoPlayer } from '@/components/VideoPlayer';
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Link2, Play, Loader2, AlertCircle } from 'lucide-react';
import { useToast } from "@/hooks/use-toast";


export default function HomePage() {
  const [manifestUrlInput, setManifestUrlInput] = useState<string>('');
  const [proxiedManifestUrl, setProxiedManifestUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!manifestUrlInput.trim()) {
      setError('Please enter a valid HLS manifest URL.');
      toast({
        title: "Input Error",
        description: "Please enter a valid HLS manifest URL.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    setError(null);
    setProxiedManifestUrl(null);

    try {
      // Validate URL basic structure on client-side
      new URL(manifestUrlInput);
      // The actual proxying happens when HLS.js requests this URL
      const generatedProxiedUrl = `/api/proxy/manifest?origin_url=${encodeURIComponent(manifestUrlInput)}`;
      setProxiedManifestUrl(generatedProxiedUrl);
       toast({
        title: "Stream Ready",
        description: "Proxy URL generated. Player will now attempt to load the stream.",
      });
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : 'Invalid URL format.';
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

  return (
    <div className="flex flex-col items-center space-y-8">
      <Card className="w-full max-w-2xl shadow-xl">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-center text-primary">HLS Stream Proxy</CardTitle>
          <CardDescription className="text-center text-muted-foreground pt-2">
            Enter an HLS manifest URL (.m3u8) to proxy and play the stream.
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="relative">
              <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input
                type="url"
                placeholder="https://example.com/stream.m3u8"
                value={manifestUrlInput}
                onChange={(e) => setManifestUrlInput(e.target.value)}
                disabled={isLoading}
                className="pl-10 text-base"
                aria-label="HLS Manifest URL"
              />
            </div>
             {error && (
              <Alert variant="destructive" className="mt-4">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Error</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full bg-accent hover:bg-accent/90 text-accent-foreground" disabled={isLoading}>
              {isLoading ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <Play className="mr-2 h-5 w-5" />
              )}
              {isLoading ? 'Processing...' : 'Proxy and Play'}
            </Button>
          </CardFooter>
        </form>
      </Card>

      {proxiedManifestUrl && !error && (
        <div className="w-full max-w-3xl mt-8">
           <h2 className="text-2xl font-semibold mb-4 text-center">Proxied Stream</h2>
          <VideoPlayer manifestUrl={proxiedManifestUrl} />
        </div>
      )}
       {!proxiedManifestUrl && !isLoading && !error && (
        <div className="w-full max-w-3xl mt-8 p-8 border-2 border-dashed border-muted-foreground/30 rounded-lg text-center text-muted-foreground">
            <Tv2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <p>Your proxied video will appear here.</p>
            <p className="text-sm">Enter a manifest URL above and click "Proxy and Play".</p>
        </div>
      )}
    </div>
  );
}
