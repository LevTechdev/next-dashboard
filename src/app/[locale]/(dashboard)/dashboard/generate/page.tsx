"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoaderCircleIcon, CopyIcon, SparklesIcon, SaveIcon } from "lucide-animated";
import { CheckIcon } from "lucide-react";

export default function GeneratePage() {
  const [topic, setTopic] = useState("");
  const [tone, setTone] = useState("professional");
  const [type, setType] = useState("blog");
  const [isGenerating, setIsGenerating] = useState(false);
  const [result, setResult] = useState("");
  const [copied, setCopied] = useState(false);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setResult("");
    
    // Mocking an AI generation delay
    setTimeout(() => {
      setResult(`Here is the generated ${tone} ${type} about "${topic}":\n\nNext Dashboard is an incredible platform that allows you to manage users, process payments, and generate AI content seamlessly. It offers unparalleled speed and beautiful UI design!\n\nSign up today to skyrocket your productivity.`);
      setIsGenerating(false);
    }, 2500);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">AI Content Generator</h1>
        <p className="text-zinc-500 mt-2">Generate high-converting copy in seconds using our advanced AI model.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-5">
          <Card>
            <form onSubmit={handleGenerate}>
              <CardHeader>
                <CardTitle>Configuration</CardTitle>
                <CardDescription>Tell the AI what you want to write.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="topic">Topic or Prompt</Label>
                  <Textarea 
                    id="topic" 
                    placeholder="e.g., A welcome email for new SaaS users..." 
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    required
                    className="h-24 resize-none"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Content Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="blog">Blog Post</SelectItem>
                      <SelectItem value="email">Email Campaign</SelectItem>
                      <SelectItem value="social">Social Media Post</SelectItem>
                      <SelectItem value="ad">Ad Copy</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Tone of Voice</Label>
                  <Select value={tone} onValueChange={setTone}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select tone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="professional">Professional</SelectItem>
                      <SelectItem value="casual">Casual & Friendly</SelectItem>
                      <SelectItem value="humorous">Humorous</SelectItem>
                      <SelectItem value="urgent">Urgent & Persuasive</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  type="submit" 
                  disabled={!topic || isGenerating} 
                  className="w-full bg-[#F25C38] hover:bg-[#D94C2B] text-white"
                >
                  {isGenerating ? (
                    <><LoaderCircleIcon size={16} className="mr-2 animate-spin" /> Generating...</>
                  ) : (
                    <><SparklesIcon size={16} className="mr-2" /> Generate Content</>
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        </div>

        <div className="md:col-span-7">
          <Card className="h-full flex flex-col">
            <CardHeader>
              <CardTitle>Result</CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              {isGenerating ? (
                <div className="flex-1 flex flex-col items-center justify-center space-y-4 py-12 text-zinc-400">
                  <SparklesIcon size={32} className="animate-pulse text-[#F25C38]" />
                  <p>AI is writing your content...</p>
                </div>
              ) : result ? (
                <div className="flex-1 bg-zinc-50 dark:bg-zinc-900/50 p-4 rounded-md border border-zinc-200 dark:border-zinc-800 whitespace-pre-wrap font-medium text-zinc-700 dark:text-zinc-300">
                  {result}
                </div>
              ) : (
                <div className="flex-1 flex items-center justify-center py-12 text-zinc-400 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-md">
                  <p>Your generated content will appear here.</p>
                </div>
              )}
            </CardContent>
            {result && !isGenerating && (
              <CardFooter className="flex justify-end space-x-2 border-t border-zinc-100 dark:border-zinc-800 pt-4">
                <Button variant="outline" onClick={handleCopy} className="w-24">
                  {copied ? <><CheckIcon size={16} className="mr-2 text-green-500" /> Copied</> : <><CopyIcon size={16} className="mr-2" /> Copy</>}
                </Button>
                <Button variant="default" className="bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
                  <SaveIcon size={16} className="mr-2" /> Save to Projects
                </Button>
              </CardFooter>
            )}
          </Card>
        </div>
      </div>
    </div>
  );

}
