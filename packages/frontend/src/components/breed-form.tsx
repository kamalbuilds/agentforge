"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Dna, AlertCircle } from "lucide-react";

const breedSchema = z.object({
  parentA: z.string().min(1, "Select parent A"),
  parentB: z.string().min(1, "Select parent B"),
  royaltyBps: z.coerce.number().min(0).max(5000, "Max 50% royalty"),
});

type BreedFormData = z.infer<typeof breedSchema>;

interface BreedFormProps {
  ownedAgents?: Array<{ tokenId: string; name: string; elo: number }>;
}

export function BreedForm({ ownedAgents = [] }: BreedFormProps) {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<BreedFormData>({
    resolver: zodResolver(breedSchema),
    defaultValues: { parentA: "", parentB: "", royaltyBps: 500 },
  });

  const parentA = watch("parentA");
  const parentB = watch("parentB");
  const royaltyBps = watch("royaltyBps");

  const onSubmit = async (data: BreedFormData) => {
    if (data.parentA === data.parentB) {
      toast.error("Parents must be different agents");
      return;
    }

    setIsLoading(true);
    try {
      // Real flow: BreedingHub.requestBreed(parentA, parentB, royaltyBps) { value: breedFee }
      throw new Error("NOT_IMPLEMENTED: waiting on BreedingHub contract deploy");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Breed failed");
    } finally {
      setIsLoading(false);
    }
  };

  const isDeploying = ownedAgents.length === 0;

  return (
    <div className="glass-card rounded-2xl p-6 space-y-6">
      {isDeploying && (
        <div className="flex items-start gap-3 bg-[#7c3aed]/10 border border-[#7c3aed]/20 rounded-xl p-4">
          <AlertCircle className="w-4 h-4 text-[#7c3aed] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-[#ededed]">Contracts Deploying</p>
            <p className="text-xs text-[#6b7280]">
              Mint agents first. Breeding requires at least 2 owned agents once
              BreedingHub is live on 0G Galileo.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* DNA icon */}
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-[#10b981]/10 border border-[#10b981]/20 flex items-center justify-center">
            <Dna className="w-6 h-6 text-[#10b981]" />
          </div>
        </div>

        {/* Parent A */}
        <div className="space-y-2">
          <Label className="text-xs font-mono text-[#6b7280] uppercase tracking-wider">
            Parent A
          </Label>
          <select
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 text-[#ededed] focus:border-[#10b981]/50 focus:outline-none text-sm"
            {...register("parentA")}
            disabled={isDeploying}
          >
            <option value="">Select parent A</option>
            {ownedAgents.map((agent) => (
              <option key={agent.tokenId} value={agent.tokenId}>
                {agent.name} (#{agent.tokenId}) · ELO {agent.elo}
              </option>
            ))}
          </select>
          {errors.parentA && (
            <p className="text-xs text-[#dc2626]">{errors.parentA.message}</p>
          )}
        </div>

        {/* Parent B */}
        <div className="space-y-2">
          <Label className="text-xs font-mono text-[#6b7280] uppercase tracking-wider">
            Parent B
          </Label>
          <select
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 text-[#ededed] focus:border-[#10b981]/50 focus:outline-none text-sm"
            {...register("parentB")}
            disabled={isDeploying}
          >
            <option value="">Select parent B</option>
            {ownedAgents
              .filter((a) => a.tokenId !== parentA)
              .map((agent) => (
                <option key={agent.tokenId} value={agent.tokenId}>
                  {agent.name} (#{agent.tokenId}) · ELO {agent.elo}
                </option>
              ))}
          </select>
          {errors.parentB && (
            <p className="text-xs text-[#dc2626]">{errors.parentB.message}</p>
          )}
        </div>

        {/* Royalty Slider */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-mono text-[#6b7280] uppercase tracking-wider">
              Royalty for Offspring Breeds
            </Label>
            <span className="text-sm font-black text-[#10b981] font-mono">
              {(royaltyBps / 100).toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="5000"
            step="100"
            className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
            style={{ accentColor: "#10b981" }}
            {...register("royaltyBps")}
            disabled={isDeploying}
          />
          <div className="flex justify-between text-xs text-[#6b7280] font-mono">
            <span>0%</span>
            <span>50%</span>
          </div>
          <p className="text-xs text-[#6b7280]">
            You earn this % from every breed that uses your offspring as parents
          </p>
        </div>

        {/* Preview box */}
        {parentA && parentB && parentA !== parentB && (
          <div className="bg-[#10b981]/5 border border-[#10b981]/20 rounded-xl p-4 space-y-1">
            <p className="text-xs font-mono text-[#10b981] uppercase tracking-wider mb-2">
              Breed Preview
            </p>
            <p className="text-xs text-[#6b7280]">
              Offspring will be Gen{" "}
              <span className="text-[#ededed]">N+1</span> · Royalty:{" "}
              <span className="text-[#10b981]">{(royaltyBps / 100).toFixed(1)}%</span>
            </p>
            <p className="text-xs text-[#6b7280]">
              Breeding fee calculated from parent ELO sum at time of transaction
            </p>
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={isLoading || isDeploying || !parentA || !parentB}
          className="w-full bg-[#10b981] hover:bg-[#059669] text-black font-bold py-4 rounded-xl transition-all hover:-translate-y-[2px] disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-y-0"
        >
          {isLoading ? "Submitting..." : "Request Breed"}
        </Button>
      </form>
    </div>
  );
}
