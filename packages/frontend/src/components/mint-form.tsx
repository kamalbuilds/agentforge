"use client";
import { waitForReceiptWithRetry } from "@/lib/wait-receipt";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Upload, CheckCircle2, Sparkles } from "lucide-react";

const FALLBACK_PORTRAITS = [
  "/agents/aurelius.png",
  "/agents/vesper.png",
  "/agents/borealis.png",
  "/agents/cassia.png",
  "/agents/drogon.png",
];
import { useAccount, usePublicClient, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { keccak256, decodeEventLog } from "viem";
import { AgentINFTAbi, addresses } from "@agentforge/shared";
import type { Abi, Log } from "viem";

const CHAIN_ID = 16602 as const;
// Use the server-side proxy to avoid CORS issues with the gateway
const GATEWAY_URL = "/api/gateway";

const mintSchema = z.object({
  name: z.string().min(1, "Agent name required").max(64),
  description: z.string().max(256, "Description too long").optional(),
});

type MintFormData = z.infer<typeof mintSchema>;

async function encryptFile(file: File): Promise<{ encryptedBlob: Blob; keyBytes: Uint8Array }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const buffer = await file.arrayBuffer();
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, buffer);
  const rawKey = await crypto.subtle.exportKey("raw", key);
  const keyBytes = new Uint8Array(rawKey);
  const combined = new Uint8Array(12 + ciphertext.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(ciphertext), 12);
  return { encryptedBlob: new Blob([combined], { type: "application/octet-stream" }), keyBytes };
}

async function uploadToGateway(blob: Blob, name: string): Promise<{ cid: string }> {
  const formData = new FormData();
  formData.append("file", blob, name);
  const res = await fetch(`${GATEWAY_URL}/storage/upload`, { method: "POST", body: formData });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`Gateway upload failed: ${text}`);
  }
  const json = (await res.json()) as { cid?: string };
  if (!json.cid) throw new Error("Gateway did not return a CID");
  return { cid: json.cid };
}

const TRANSFER_EVENT_ABI = [
  {
    type: "event" as const,
    name: "Transfer",
    inputs: [
      { name: "from",    type: "address" as const, indexed: true },
      { name: "to",      type: "address" as const, indexed: true },
      { name: "tokenId", type: "uint256" as const, indexed: true },
    ],
  },
] as const;

export function MintForm() {
  const router = useRouter();
  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [step, setStep] = useState<string | null>(null);
  const previewPortrait = FALLBACK_PORTRAITS[Math.floor(Math.random() * FALLBACK_PORTRAITS.length)];
  const [mintTxHash, setMintTxHash] = useState<`0x${string}` | undefined>();
  const { isLoading: isMintConfirming } = useWaitForTransactionReceipt({ hash: mintTxHash });
  const { writeContractAsync } = useWriteContract();
  const isLoading = !!step;

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
    if (!file)         { toast.error("Please select a weight file"); return; }
    if (!address)      { toast.error("Connect your wallet first"); return; }
    if (!publicClient) { toast.error("No RPC client — check your network"); return; }

    try {
      setStep("Encrypting weights...");
      const { encryptedBlob, keyBytes } = await encryptFile(file);

      setStep("Uploading to 0G Storage...");
      const { cid: weightCID } = await uploadToGateway(encryptedBlob, `${data.name}.enc`);

      setStep("Uploading metadata...");
      const metaJson = JSON.stringify({ name: data.name, description: data.description ?? "", weightCID, created: Date.now() });
      const metaBlob = new Blob([metaJson], { type: "application/json" });
      const { cid: metadataCID } = await uploadToGateway(metaBlob, `${data.name}-meta.json`);

      const sealedKeyHash = keccak256(keyBytes);

      setStep("Sending mint transaction...");
      const txHash = await writeContractAsync({
        address: addresses[CHAIN_ID].AgentINFT,
        abi: AgentINFTAbi as Abi,
        functionName: "mint",
        args: [address, weightCID, metadataCID, 0n, 0n, sealedKeyHash],
        chainId: CHAIN_ID,
      });
      setMintTxHash(txHash);
      setStep("Waiting for confirmation...");

      const receipt = await waitForReceiptWithRetry(publicClient, txHash);
      if (receipt.status !== "success") throw new Error("Transaction reverted");

      let newTokenId: bigint | undefined;
      for (const log of receipt.logs as Log[]) {
        try {
          const decoded = decodeEventLog({
            abi: TRANSFER_EVENT_ABI,
            data: log.data,
            topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
          });
          if (decoded.eventName === "Transfer") {
            const args = decoded.args as { from: string; to: string; tokenId: bigint };
            if (args.to.toLowerCase() === address.toLowerCase()) {
              newTokenId = args.tokenId;
              break;
            }
          }
        } catch { /* not this event */ }
      }

      toast.success("Agent minted successfully!");
      reset();
      setFile(null);
      router.push(newTokenId !== undefined ? `/agents/${newTokenId.toString()}` : "/agents");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Mint failed");
    } finally {
      setStep(null);
    }
  };

  return (
    <div className="glass-card rounded-2xl p-6 space-y-6">
      {/* Agent portrait preview */}
      <div className="flex items-center gap-4 pb-4 border-b border-white/[0.06]">
        <div className="relative w-16 h-16 rounded-xl overflow-hidden border border-[#7c3aed]/20 bg-[#7c3aed]/5 shrink-0">
          <Image
            src={file ? previewPortrait : previewPortrait}
            alt="Agent preview"
            fill
            className={`object-cover transition-opacity duration-500 ${file ? "opacity-100" : "opacity-50"}`}
            sizes="64px"
          />
          {!file && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-[#7c3aed] opacity-60" />
            </div>
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-[#ededed]" style={{ fontFamily: "var(--font-space-grotesk), sans-serif" }}>
            {file ? "Your agent will look like..." : "Genesis preview"}
          </p>
          <p className="text-xs text-white/35 mt-0.5">
            {file ? "Portrait generated on mint" : "Upload weights to mint your unique agent"}
          </p>
        </div>
      </div>
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

        {/* Status indicator */}
        {step && (
          <div className="flex items-center gap-2 bg-[#7c3aed]/10 border border-[#7c3aed]/20 rounded-xl px-4 py-3">
            <span className="w-2 h-2 rounded-full bg-[#7c3aed] animate-pulse shrink-0" />
            <p className="text-xs font-mono text-[#7c3aed]">{step}</p>
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={isLoading || !file || isMintConfirming}
          className="w-full bg-[#7c3aed] hover:bg-[#5b21b6] text-white font-bold py-4 rounded-xl transition-all hover:-translate-y-[2px] hover:shadow-[0_8px_30px_rgba(124,58,237,0.35)] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {isLoading ? step : "Mint Agent"}
        </Button>

        <p className="text-xs text-[#6b7280] font-mono text-center">
          Weights encrypted client-side · Stored on 0G Storage · Minted as ERC-7857 iNFT
        </p>
      </form>
    </div>
  );
}
