"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
    Search,
    Shield,
    ShieldCheck,
    ShieldX,
    AlertTriangle,
    FileText,
    Clipboard,
    ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
    detectWatermark,
    type WatermarkConfig,
    type WatermarkType,
    type InjectionMethod,
} from "@/lib/watermark";

export default function DetectPage() {
    const [reviewText, setReviewText] = useState("");
    const [configInput, setConfigInput] = useState("");
    const [manualTarget, setManualTarget] = useState("");
    const [manualType, setManualType] = useState<WatermarkType>("random-start");
    const [inputMode, setInputMode] = useState<"config" | "manual">("manual");
    const [result, setResult] = useState<{
        detected: boolean;
        confidence: number;
        matchIndex: number;
        details: string;
    } | null>(null);
    const [analyzing, setAnalyzing] = useState(false);

    const handleDetect = async () => {
        if (!reviewText.trim()) {
            toast.error("Please paste a review to analyze");
            return;
        }

        setAnalyzing(true);
        setResult(null);

        // Simulate processing delay for UX
        await new Promise((r) => setTimeout(r, 1500));

        let config: WatermarkConfig;

        if (inputMode === "config" && configInput.trim()) {
            try {
                config = JSON.parse(configInput);
            } catch {
                toast.error("Invalid config JSON. Please check the format.");
                setAnalyzing(false);
                return;
            }
        } else if (inputMode === "manual" && manualTarget.trim()) {
            // Build a config from manual input
            const combinationsMap: Record<WatermarkType, number> = {
                "random-start": 1512,
                "technical-term": 20,
                "random-citation": 1980,
            };
            config = {
                type: manualType,
                method: "white-text" as InjectionMethod,
                watermark: manualTarget,
                targetString: manualTarget,
                prompt: "",
                combinations: combinationsMap[manualType],
                timestamp: new Date().toISOString(),
            };
        } else {
            toast.error("Please provide the watermark target string or config");
            setAnalyzing(false);
            return;
        }

        const detection = detectWatermark(reviewText, config);
        setResult(detection);
        setAnalyzing(false);
    };

    const handlePasteFromClipboard = async () => {
        try {
            const text = await navigator.clipboard.readText();
            setReviewText(text);
            toast.success("Pasted from clipboard");
        } catch {
            toast.error("Unable to paste from clipboard");
        }
    };

    return (
        <div className="min-h-screen pt-24 pb-16 hero-gradient">
            <div className="grid-pattern absolute inset-0 opacity-20" />
            <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <motion.div
                    className="text-center mb-10"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                >
                    <h1 className="text-3xl sm:text-4xl font-bold mb-3">
                        <span className="gradient-text">Detect</span> AI Reviews
                    </h1>
                    <p className="text-muted-foreground">
                        Paste a submitted review to check for embedded watermarks
                    </p>
                </motion.div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Left: Input */}
                    <motion.div
                        className="space-y-4"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        {/* Review Text Input */}
                        <Card className="bg-card/50 border-border/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <FileText className="h-4 w-4 text-[hsl(265,89%,68%)]" />
                                    Review Text
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="relative">
                                    <Textarea
                                        placeholder="Paste the submitted review text here..."
                                        value={reviewText}
                                        onChange={(e) => setReviewText(e.target.value)}
                                        className="min-h-[200px] bg-background/50 border-border/30 resize-none"
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="absolute top-2 right-2 text-muted-foreground"
                                        onClick={handlePasteFromClipboard}
                                    >
                                        <Clipboard className="h-4 w-4 mr-1" />
                                        Paste
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mt-2">
                                    {reviewText.length} characters
                                </p>
                            </CardContent>
                        </Card>

                        {/* Watermark Config */}
                        <Card className="bg-card/50 border-border/50">
                            <CardHeader className="pb-3">
                                <CardTitle className="text-base flex items-center gap-2">
                                    <Shield className="h-4 w-4 text-[hsl(265,89%,68%)]" />
                                    Watermark Configuration
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <Tabs
                                    value={inputMode}
                                    onValueChange={(v) =>
                                        setInputMode(v as "config" | "manual")
                                    }
                                >
                                    <TabsList className="w-full mb-4">
                                        <TabsTrigger value="manual" className="flex-1">
                                            Manual Entry
                                        </TabsTrigger>
                                        <TabsTrigger value="config" className="flex-1">
                                            Paste Config JSON
                                        </TabsTrigger>
                                    </TabsList>

                                    <TabsContent value="manual" className="space-y-3">
                                        <div>
                                            <label className="text-sm text-muted-foreground mb-1 block">
                                                Target String
                                            </label>
                                            <Textarea
                                                placeholder='e.g., "The article explores a circumstance"'
                                                value={manualTarget}
                                                onChange={(e) => setManualTarget(e.target.value)}
                                                className="bg-background/50 border-border/30 h-20 resize-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-sm text-muted-foreground mb-1 block">
                                                Watermark Type
                                            </label>
                                            <div className="flex gap-2 flex-wrap">
                                                {(
                                                    [
                                                        "random-start",
                                                        "technical-term",
                                                        "random-citation",
                                                    ] as WatermarkType[]
                                                ).map((type) => (
                                                    <Badge
                                                        key={type}
                                                        variant={
                                                            manualType === type ? "default" : "outline"
                                                        }
                                                        className={`cursor-pointer transition-all ${manualType === type
                                                                ? "bg-[hsl(265,89%,68%)] text-white"
                                                                : "border-border/50 hover:border-[hsl(265,89%,68%)/30]"
                                                            }`}
                                                        onClick={() => setManualType(type)}
                                                    >
                                                        {type.replace("-", " ")}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </div>
                                    </TabsContent>

                                    <TabsContent value="config">
                                        <Textarea
                                            placeholder="Paste the JSON config from the Protect step..."
                                            value={configInput}
                                            onChange={(e) => setConfigInput(e.target.value)}
                                            className="bg-background/50 border-border/30 h-32 font-mono text-xs resize-none"
                                        />
                                    </TabsContent>
                                </Tabs>
                            </CardContent>
                        </Card>

                        <Button
                            onClick={handleDetect}
                            disabled={analyzing}
                            className="w-full bg-[hsl(265,89%,68%)] hover:bg-[hsl(265,89%,60%)] text-white h-12"
                        >
                            {analyzing ? (
                                <div className="flex items-center gap-2">
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    Analyzing Review...
                                </div>
                            ) : (
                                <>
                                    <Search className="mr-2 h-5 w-5" />
                                    Detect Watermark
                                    <ChevronRight className="ml-2 h-4 w-4" />
                                </>
                            )}
                        </Button>
                    </motion.div>

                    {/* Right: Results */}
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        {!result && !analyzing && (
                            <Card className="bg-card/50 border-border/50 h-full flex items-center justify-center">
                                <CardContent className="text-center p-12">
                                    <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4">
                                        <Search className="h-8 w-8 text-muted-foreground/50" />
                                    </div>
                                    <h3 className="font-semibold text-muted-foreground mb-2">
                                        No Results Yet
                                    </h3>
                                    <p className="text-sm text-muted-foreground/70">
                                        Paste a review and click &quot;Detect Watermark&quot; to see results
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {analyzing && (
                            <Card className="bg-card/50 border-border/50 h-full flex items-center justify-center">
                                <CardContent className="text-center p-12">
                                    <div className="w-16 h-16 rounded-2xl bg-[hsl(265,89%,68%)/10] flex items-center justify-center mx-auto mb-4">
                                        <div className="w-8 h-8 border-3 border-[hsl(265,89%,68%)/30] border-t-[hsl(265,89%,68%)] rounded-full animate-spin" />
                                    </div>
                                    <h3 className="font-semibold mb-2">Analyzing...</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Scanning for watermark patterns
                                    </p>
                                </CardContent>
                            </Card>
                        )}

                        {result && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.4 }}
                            >
                                <Card
                                    className={`border-2 ${result.detected
                                            ? "bg-rose-500/5 border-rose-500/30"
                                            : "bg-emerald-500/5 border-emerald-500/30"
                                        }`}
                                >
                                    <CardContent className="p-6 space-y-5">
                                        {/* Verdict */}
                                        <div className="text-center">
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{
                                                    type: "spring",
                                                    stiffness: 200,
                                                    delay: 0.2,
                                                }}
                                                className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${result.detected
                                                        ? "bg-rose-500/20"
                                                        : "bg-emerald-500/20"
                                                    }`}
                                            >
                                                {result.detected ? (
                                                    <ShieldX className="h-10 w-10 text-rose-400" />
                                                ) : (
                                                    <ShieldCheck className="h-10 w-10 text-emerald-400" />
                                                )}
                                            </motion.div>
                                            <h2
                                                className={`text-2xl font-bold mb-1 ${result.detected
                                                        ? "text-rose-400"
                                                        : "text-emerald-400"
                                                    }`}
                                            >
                                                {result.detected
                                                    ? "⚠ Watermark Detected"
                                                    : "✓ No Watermark Found"}
                                            </h2>
                                            <p className="text-sm text-muted-foreground">
                                                {result.detected
                                                    ? "This review likely was AI-generated"
                                                    : "This review appears to be human-written"}
                                            </p>
                                        </div>

                                        <Separator />

                                        {/* Confidence */}
                                        {result.confidence > 0 && (
                                            <div>
                                                <div className="flex justify-between text-sm mb-2">
                                                    <span className="text-muted-foreground">
                                                        Confidence
                                                    </span>
                                                    <span className="font-mono font-bold">
                                                        {result.confidence.toFixed(2)}%
                                                    </span>
                                                </div>
                                                <div className="w-full bg-muted/50 rounded-full h-3 overflow-hidden">
                                                    <motion.div
                                                        className={`h-full rounded-full ${result.detected
                                                                ? "bg-gradient-to-r from-rose-500 to-rose-400"
                                                                : "bg-gradient-to-r from-emerald-500 to-emerald-400"
                                                            }`}
                                                        initial={{ width: 0 }}
                                                        animate={{
                                                            width: `${Math.min(result.confidence, 100)}%`,
                                                        }}
                                                        transition={{ duration: 1, delay: 0.3 }}
                                                    />
                                                </div>
                                            </div>
                                        )}

                                        {/* Details */}
                                        <div className="bg-background/30 rounded-lg p-4 border border-border/20">
                                            <p className="text-xs text-muted-foreground mb-1">
                                                Analysis Details
                                            </p>
                                            <p className="text-sm">{result.details}</p>
                                        </div>

                                        {/* Match Position */}
                                        {result.matchIndex >= 0 && (
                                            <div className="bg-background/30 rounded-lg p-4 border border-border/20">
                                                <p className="text-xs text-muted-foreground mb-2">
                                                    Match found at position {result.matchIndex}:
                                                </p>
                                                <p className="text-sm font-mono">
                                                    <span className="text-muted-foreground">
                                                        ...
                                                        {reviewText.slice(
                                                            Math.max(0, result.matchIndex - 20),
                                                            result.matchIndex
                                                        )}
                                                    </span>
                                                    <span className="bg-rose-500/30 text-rose-300 px-1 rounded">
                                                        {reviewText.slice(
                                                            result.matchIndex,
                                                            result.matchIndex +
                                                            (manualTarget.length ||
                                                                configInput
                                                                ? 30
                                                                : 30)
                                                        )}
                                                    </span>
                                                    <span className="text-muted-foreground">
                                                        {reviewText.slice(
                                                            result.matchIndex + 30,
                                                            result.matchIndex + 50
                                                        )}
                                                        ...
                                                    </span>
                                                </p>
                                            </div>
                                        )}

                                        {result.detected && (
                                            <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                                                <AlertTriangle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
                                                <p className="text-xs text-muted-foreground">
                                                    This detection uses statistical analysis based on the
                                                    probability of the watermark appearing by chance.
                                                    Always combine with other evidence before making
                                                    conclusions.
                                                </p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </motion.div>
                        )}
                    </motion.div>
                </div>
            </div>
        </div>
    );
}
