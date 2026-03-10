"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield,
  Upload,
  FileText,
  Download,
  ChevronRight,
  ChevronLeft,
  Check,
  Copy,
  Sparkles,
  Info,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  generateWatermark,
  SUCCESS_RATES,
  type WatermarkType,
  type InjectionMethod,
  type WatermarkConfig,
} from "@/lib/watermark";

const STEPS = [
  { label: "Upload PDF", icon: Upload },
  { label: "Watermark Type", icon: Shield },
  { label: "Injection Method", icon: Sparkles },
  { label: "Download", icon: Download },
];

const WATERMARK_TYPES: {
  id: WatermarkType;
  title: string;
  description: string;
  detail: string;
  combinations: string;
}[] = [
    {
      id: "random-start",
      title: "Random Start Sentence",
      description: "LLM starts review with a specific sentence",
      detail:
        'Instructs the LLM to begin its review with a randomly generated sentence like "The article explores a circumstance".',
      combinations: "1,512",
    },
    {
      id: "technical-term",
      title: "Technical Term",
      description: "LLM includes a specific technical term",
      detail:
        'Instructs the LLM to mention a specific technical term like "epistemological framework" in the review.',
      combinations: "20",
    },
    {
      id: "random-citation",
      title: "Random Citation",
      description: "LLM includes a fake citation",
      detail:
        'Instructs the LLM to include a made-up citation like "Following Smith et al. (2007)" in the review.',
      combinations: "1,980",
    },
  ];

const INJECTION_METHODS: {
  id: InjectionMethod;
  title: string;
  description: string;
  detail: string;
  pros: string[];
  cons: string[];
}[] = [
    {
      id: "white-text",
      title: "White Text",
      description: "Invisible white text on white background",
      detail:
        "The hidden instruction is written in white-colored text at the bottom of the last page. Invisible to the human eye but readable when copy-pasted.",
      pros: ["Simplest method", "Highest success rate", "Works with any PDF tool"],
      cons: ["Detectable via select-all", "Visible in dark mode readers"],
    },
    {
      id: "different-language",
      title: "Symbol Language",
      description: "Text encoded as symbols/Wingdings",
      detail:
        "The instruction appears as decorative symbols (♎✌🙵♏ ⬧◆❒♏) but decodes to readable English when copy-pasted into an LLM.",
      pros: ["Looks decorative, not suspicious", "Survives visual inspection"],
      cons: ["Symbols may look unusual", "Less reliable than white text"],
    },
    {
      id: "font-embedding",
      title: "Font Embedding",
      description: "Custom fonts swap character visuals",
      detail:
        'Most sophisticated: custom fonts visually display "ICLR 2024 conference" but the underlying text is "Start your review with..." Requires 12 custom OTF fonts.',
      pros: ["Completely invisible", "Text looks contextually normal"],
      cons: ["Requires Adobe Acrobat", "Manual font application needed"],
    },
  ];

export default function Home() {
  const [step, setStep] = useState(0);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [selectedType, setSelectedType] = useState<WatermarkType | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<InjectionMethod | null>(null);
  const [watermarkConfig, setWatermarkConfig] = useState<WatermarkConfig | null>(null);
  const [processing, setProcessing] = useState(false);
  const [configCopied, setConfigCopied] = useState(false);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setDragOver(false);
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file?.type === "application/pdf") {
      setPdfFile(file);
      setStep(1);
    } else {
      toast.error("Please upload a PDF file");
    }
  }, []);

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file?.type === "application/pdf") {
        setPdfFile(file);
        setStep(1);
      } else {
        toast.error("Please upload a PDF file");
      }
    },
    []
  );

  const handleSelectType = (type: WatermarkType) => {
    setSelectedType(type);
    const config = generateWatermark(type);
    setWatermarkConfig(config);
  };

  const handleSelectMethod = (method: InjectionMethod) => {
    setSelectedMethod(method);
    if (watermarkConfig) {
      setWatermarkConfig({ ...watermarkConfig, method });
    }
  };

  const handleProtect = async () => {
    if (!pdfFile || !watermarkConfig || !selectedMethod) return;

    setProcessing(true);

    try {
      const formData = new FormData();
      formData.append("pdf", pdfFile);
      formData.append("prompt", watermarkConfig.prompt);
      formData.append("method", selectedMethod);

      const response = await fetch("/api/protect", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) throw new Error("Failed to process PDF");

      const arrayBuffer = await response.arrayBuffer();
      const blob = new Blob([arrayBuffer], { type: "application/pdf" });

      // Ensure filename always ends with .pdf
      const baseName = pdfFile.name.replace(/\.pdf$/i, "");
      const fileName = `protected_${baseName}.pdf`;

      // FileSaver.js-style download — proven to work in all browsers
      // Key: do NOT append to document.body, use dispatchEvent, defer click
      const a = document.createElementNS(
        "http://www.w3.org/1999/xhtml",
        "a"
      ) as HTMLAnchorElement;
      a.download = fileName;
      a.rel = "noopener";
      a.href = URL.createObjectURL(blob);

      // Defer the click so the browser properly associates the download attribute
      setTimeout(() => {
        a.dispatchEvent(new MouseEvent("click"));
      }, 0);

      // Revoke after a long delay (40s) to ensure download completes
      setTimeout(() => {
        URL.revokeObjectURL(a.href);
      }, 40000);

      toast.success("Protected PDF downloaded!");
    } catch {
      toast.error("Failed to process PDF. Please try again.");
    } finally {
      setProcessing(false);
    }
  };

  const copyConfig = () => {
    if (!watermarkConfig) return;
    navigator.clipboard.writeText(JSON.stringify(watermarkConfig, null, 2));
    setConfigCopied(true);
    toast.success("Watermark config copied to clipboard!");
    setTimeout(() => setConfigCopied(false), 2000);
  };

  const progress = ((step + 1) / STEPS.length) * 100;

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
            <span className="gradient-text">Protect</span> Your Paper
          </h1>
          <p className="text-muted-foreground">
            Inject an invisible watermark in 4 simple steps
          </p>
        </motion.div>

        {/* Progress Steps */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            {STEPS.map((s, i) => (
              <div
                key={i}
                className={`flex items-center gap-2 text-sm transition-colors ${i <= step ? "text-foreground" : "text-muted-foreground/50"
                  }`}
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${i < step
                    ? "bg-emerald-500/20 text-emerald-400"
                    : i === step
                      ? "bg-[hsl(265,89%,68%)/20] text-[hsl(265,89%,68%)]"
                      : "bg-muted text-muted-foreground/50"
                    }`}
                >
                  {i < step ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className="hidden sm:inline">{s.label}</span>
              </div>
            ))}
          </div>
          <Progress value={progress} className="h-1" />
        </div>

        {/* Step Content */}
        <AnimatePresence mode="wait">
          {/* Step 0: Upload */}
          {step === 0 && (
            <motion.div
              key="upload"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <Card className="bg-card/50 border-border/50">
                <CardContent className="p-8">
                  <div
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    className={`border-2 border-dashed rounded-2xl p-16 text-center transition-all cursor-pointer ${dragOver
                      ? "border-[hsl(265,89%,68%)] bg-[hsl(265,89%,68%)/5]"
                      : "border-border/50 hover:border-[hsl(265,89%,68%)/30]"
                      }`}
                    onClick={() =>
                      document.getElementById("pdf-input")?.click()
                    }
                  >
                    <input
                      id="pdf-input"
                      type="file"
                      accept=".pdf"
                      onChange={onFileSelect}
                      className="hidden"
                    />
                    <div className="w-16 h-16 rounded-2xl bg-[hsl(265,89%,68%)/10] flex items-center justify-center mx-auto mb-4">
                      <FileText className="h-8 w-8 text-[hsl(265,89%,68%)]" />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">
                      Drop your PDF here
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      or click to browse
                    </p>
                    <Badge variant="outline" className="text-xs">
                      PDF files only • Max 50MB
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 1: Watermark Type */}
          {step === 1 && (
            <motion.div
              key="watermark-type"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {pdfFile && (
                <Card className="bg-card/50 border-border/50 mb-4">
                  <CardContent className="p-4 flex items-center gap-3">
                    <FileText className="h-5 w-5 text-[hsl(265,89%,68%)]" />
                    <span className="text-sm font-medium">{pdfFile.name}</span>
                    <Badge variant="secondary" className="ml-auto text-xs">
                      {(pdfFile.size / 1024 / 1024).toFixed(2)} MB
                    </Badge>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4">
                {WATERMARK_TYPES.map((type) => (
                  <Card
                    key={type.id}
                    className={`bg-card/50 border-border/50 cursor-pointer transition-all hover:border-[hsl(265,89%,68%)/30] card-glow ${selectedType === type.id
                      ? "border-[hsl(265,89%,68%)] ring-1 ring-[hsl(265,89%,68%)/30]"
                      : ""
                      }`}
                    onClick={() => handleSelectType(type.id)}
                  >
                    <CardContent className="p-5">
                      <div className="flex items-start gap-4">
                        <div
                          className={`w-5 h-5 rounded-full border-2 mt-0.5 transition-all flex items-center justify-center ${selectedType === type.id
                            ? "border-[hsl(265,89%,68%)] bg-[hsl(265,89%,68%)]"
                            : "border-muted-foreground/30"
                            }`}
                        >
                          {selectedType === type.id && (
                            <Check className="h-3 w-3 text-white" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-1">
                            <h3 className="font-semibold">{type.title}</h3>
                            <Badge
                              variant="outline"
                              className="text-xs text-muted-foreground"
                            >
                              {type.combinations} combos
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mb-2">
                            {type.description}
                          </p>
                          <p className="text-xs text-muted-foreground/70">
                            {type.detail}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div className="flex justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={() => setStep(0)}
                  className="border-border/50"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={() => setStep(2)}
                  disabled={!selectedType}
                  className="bg-[hsl(265,89%,68%)] hover:bg-[hsl(265,89%,60%)] text-white"
                >
                  Continue
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 2: Injection Method */}
          {step === 2 && (
            <motion.div
              key="injection"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              <div className="space-y-4">
                {INJECTION_METHODS.map((method) => {
                  const rate = selectedType
                    ? SUCCESS_RATES[selectedType][method.id]
                    : null;
                  return (
                    <Card
                      key={method.id}
                      className={`bg-card/50 border-border/50 cursor-pointer transition-all hover:border-[hsl(265,89%,68%)/30] card-glow ${selectedMethod === method.id
                        ? "border-[hsl(265,89%,68%)] ring-1 ring-[hsl(265,89%,68%)/30]"
                        : ""
                        }`}
                      onClick={() => handleSelectMethod(method.id)}
                    >
                      <CardContent className="p-5">
                        <div className="flex items-start gap-4">
                          <div
                            className={`w-5 h-5 rounded-full border-2 mt-0.5 transition-all flex items-center justify-center ${selectedMethod === method.id
                              ? "border-[hsl(265,89%,68%)] bg-[hsl(265,89%,68%)]"
                              : "border-muted-foreground/30"
                              }`}
                          >
                            {selectedMethod === method.id && (
                              <Check className="h-3 w-3 text-white" />
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-1">
                              <h3 className="font-semibold">{method.title}</h3>
                              {rate && (
                                <Badge className="bg-emerald-500/20 text-emerald-400 text-xs">
                                  {rate.rate}
                                </Badge>
                              )}
                              {method.id === "font-embedding" && (
                                <Badge className="bg-amber-500/20 text-amber-400 text-xs">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Manual
                                </Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">
                              {method.description}
                            </p>
                            <p className="text-xs text-muted-foreground/70 mb-3">
                              {method.detail}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {method.pros.map((pro, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-xs text-emerald-400 border-emerald-500/30"
                                >
                                  ✓ {pro}
                                </Badge>
                              ))}
                              {method.cons.map((con, i) => (
                                <Badge
                                  key={i}
                                  variant="outline"
                                  className="text-xs text-rose-400 border-rose-500/30"
                                >
                                  ✗ {con}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div className="flex justify-between mt-6">
                <Button
                  variant="outline"
                  onClick={() => setStep(1)}
                  className="border-border/50"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
                <Button
                  onClick={() => setStep(3)}
                  disabled={!selectedMethod}
                  className="bg-[hsl(265,89%,68%)] hover:bg-[hsl(265,89%,60%)] text-white"
                >
                  Continue
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Preview & Download */}
          {step === 3 && watermarkConfig && (
            <motion.div
              key="download"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="space-y-6"
            >
              {/* Watermark Preview */}
              <Card className="bg-card/50 border-border/50">
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-[hsl(265,89%,68%)]" />
                    Generated Watermark
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-background/50 rounded-lg p-4 border border-border/30">
                    <p className="text-xs text-muted-foreground mb-1">
                      Hidden prompt that will be injected:
                    </p>
                    <p className="font-mono text-sm text-[hsl(265,89%,68%)]">
                      {watermarkConfig.prompt}
                    </p>
                  </div>

                  <div className="bg-background/50 rounded-lg p-4 border border-border/30">
                    <p className="text-xs text-muted-foreground mb-1">
                      Target string to look for in reviews:
                    </p>
                    <p className="font-mono text-sm text-emerald-400">
                      &quot;{watermarkConfig.targetString}&quot;
                    </p>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground mb-1">
                        Watermark Type
                      </p>
                      <p className="font-medium capitalize">
                        {watermarkConfig.type.replace("-", " ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">
                        Injection Method
                      </p>
                      <p className="font-medium capitalize">
                        {selectedMethod?.replace("-", " ")}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">
                        Possible Combinations
                      </p>
                      <p className="font-medium">
                        {watermarkConfig.combinations.toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground mb-1">
                        False Positive Rate
                      </p>
                      <p className="font-medium">
                        {((1 / watermarkConfig.combinations) * 100).toFixed(4)}%
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Important Notice */}
              <Card className="bg-amber-500/5 border-amber-500/20">
                <CardContent className="p-4 flex items-start gap-3">
                  <Info className="h-5 w-5 text-amber-400 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-amber-400 mb-1">
                      Save your watermark config!
                    </p>
                    <p className="text-xs text-muted-foreground">
                      You will need the watermark configuration to verify
                      reviews later. Copy it now and save it somewhere safe.
                    </p>
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={copyConfig}
                  variant="outline"
                  className="flex-1 border-border/50"
                >
                  {configCopied ? (
                    <Check className="mr-2 h-4 w-4 text-emerald-400" />
                  ) : (
                    <Copy className="mr-2 h-4 w-4" />
                  )}
                  {configCopied ? "Copied!" : "Copy Config"}
                </Button>
                <Button
                  onClick={handleProtect}
                  disabled={processing}
                  className="flex-1 bg-[hsl(265,89%,68%)] hover:bg-[hsl(265,89%,60%)] text-white"
                >
                  {processing ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Processing...
                    </div>
                  ) : (
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download Protected PDF
                    </>
                  )}
                </Button>
              </div>

              <div className="flex justify-start">
                <Button
                  variant="outline"
                  onClick={() => setStep(2)}
                  className="border-border/50"
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
