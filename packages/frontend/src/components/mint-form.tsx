"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, CheckCircle2 } from "lucide-react";

const mintSchema = z.object({
  name: z.string().min(1, "Agent name required").max(64),
  description: z.string().max(256, "Description too long").optional(),
});

type MintFormData = z.infer<typeof mintSchema>;

export function MintForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<MintFormData>({
    resolver: zodResolver(mintSchema),
  });

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) {
      setFile(dropped);
      toast.success(`Selected: ${dropped.name}`);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (selected) {
      setFile(selected);
      toast.success(`Selected: ${selected.name}`);
    }
  };

  const onSubmit = async (data: MintFormData) => {
    if (!file) {
      toast.error("Please select a weight file");
      return;
    }

    setIsLoading(true);
    try {
      // Real flow:
      // 1. Client-side AES-GCM 256-bit encryption
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const key = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt"]
      );
      const buffer = await file.arrayBuffer();
      await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, buffer);

      // 2. Upload to 0G Storage via gateway
      // 3. AgentNFT.mint(to, name, description, storageRef)
      // All steps throw NOT_IMPLEMENTED until contracts are deployed
      throw new Error("NOT_IMPLEMENTED: waiting on AgentNFT contract deploy and 0G gateway");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mint failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Weight File Upload */}
        <div className="space-y-2">
          <Label className="text-xs font-mono text-[#6b7280] uppercase tracking-wider">
            Weight File
          </Label>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer ${
              isDragging
                ? "border-[#7c3aed] bg-[#7c3aed]/5"
                : file
                ? "border-[#10b981]/50 bg-[#10b981]/5"
                : "border-white/[0.08] hover:border-white/20"
            }`}
          >
            <input
              type="file"
              accept=".bin,.weights,.onnx,.pt,.safetensors"
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              onChange={handleFileInput}
            />
            {file ? (
              <div className="space-y-2">
                <CheckCircle2 className="w-8 h-8 text-[#10b981] mx-auto" />
                <p className="font-semibold text-[#10b981]">{file.name}</p>
                <p className="text-xs text-[#6b7280] font-mono">
                  {(file.size / 1024).toFixed(1)} KB · Will be encrypted before upload
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="w-8 h-8 text-[#6b7280] mx-auto" />
                <p className="text-sm text-[#6b7280]">
                  Drop weight file here or click to browse
                </p>
                <p className="text-xs text-[#6b7280]/60 font-mono">
                  .bin .weights .onnx .pt .safetensors
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Agent Name */}
        <div className="space-y-2">
          <Label
            htmlFor="name"
            className="text-xs font-mono text-[#6b7280] uppercase tracking-wider"
          >
            Agent Name
          </Label>
          <Input
            id="name"
            placeholder="e.g. AlphaOmega, NeuralKnight, VoidCrawler"
            className="bg-white/[0.03] border-white/[0.08] focus:border-[#7c3aed]/50 rounded-xl text-[#ededed] placeholder:text-[#6b7280]"
            {...register("name")}
          />
          {errors.name && (
            <p className="text-xs text-[#dc2626]">{errors.name.message}</p>
          )}
        </div>

        {/* Description */}
        <div className="space-y-2">
          <Label
            htmlFor="description"
            className="text-xs font-mono text-[#6b7280] uppercase tracking-wider"
          >
            Description{" "}
            <span className="text-[#6b7280]/50 normal-case font-normal">
              (optional)
            </span>
          </Label>
          <textarea
            id="description"
            placeholder="Describe your agent's architecture, specialties, and battle strategy"
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 text-sm text-[#ededed] placeholder:text-[#6b7280] focus:border-[#7c3aed]/50 focus:outline-none resize-none"
            rows={3}
            {...register("description")}
          />
          {errors.description && (
            <p className="text-xs text-[#dc2626]">
              {errors.description.message}
            </p>
          )}
        </div>

        {/* Submit */}
        <Button
          type="submit"
          disabled={isLoading || !file}
          className="w-full bg-[#7c3aed] hover:bg-[#5b21b6] text-white font-bold py-4 rounded-xl transition-all hover:-translate-y-[2px] hover:shadow-[0_8px_30px_rgba(124,58,237,0.35)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {isLoading ? "Encrypting & Minting..." : "Mint Agent"}
        </Button>

        <p className="text-xs text-[#6b7280] font-mono text-center">
          Weights encrypted client-side · Stored on 0G Storage · Minted as ERC-7857 iNFT
        </p>
      </form>
    </div>
  );
}
