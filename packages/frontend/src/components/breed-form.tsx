"use client";
import { waitForReceiptWithRetry } from "@/lib/wait-receipt";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Dna, Loader2 } from "lucide-react";
import {
  useAccount,
  usePublicClient,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { parseEther } from "viem";
import { AgentINFTAbi, BreedingMarketAbi, ArenaAbi, addresses } from "@agentforge/shared";
import type { Abi } from "viem";

const CHAIN_ID = 16602 as const;
const DEFAULT_BREED_FEE = parseEther("0.01");

type BreedFormData = { parentA: string; parentB: string; royaltyBps: number };

interface OwnedAgent { tokenId: string; elo: number; }

function useOwnedTokenIds(address: `0x${string}` | undefined) {
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const [tokenIds, setTokenIds] = useState<bigint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!publicClient || !address) { setTokenIds([]); return; }
    setLoading(true);
    publicClient.getLogs({
      address: addresses[CHAIN_ID].AgentINFT,
      event: {
        type: "event",
        name: "Transfer",
        inputs: [
          { name: "from",    type: "address", indexed: true },
          { name: "to",      type: "address", indexed: true },
          { name: "tokenId", type: "uint256", indexed: true },
        ],
      } as const,
      args: { to: address },
      fromBlock: 0n,
      toBlock: "latest",
    }).then(async (logs) => {
      const candidateIds = logs.map((l) => (l.args as { tokenId?: bigint }).tokenId).filter((id): id is bigint => id !== undefined);
      const ownerResults = await Promise.all(
        candidateIds.map((id) => publicClient.readContract({ address: addresses[CHAIN_ID].AgentINFT, abi: AgentINFTAbi as Abi, functionName: "ownerOf", args: [id] }).catch(() => null))
      );
      const owned = candidateIds.filter((_, i) => typeof ownerResults[i] === "string" && (ownerResults[i] as string).toLowerCase() === address.toLowerCase());
      setTokenIds(owned);
    }).catch(() => setTokenIds([])).finally(() => setLoading(false));
  }, [publicClient, address]);

  return { tokenIds, loading };
}

export function BreedForm() {
  const searchParams = useSearchParams();
  const preselectedB = searchParams.get("parentB") ?? "";

  const { address } = useAccount();
  const publicClient = usePublicClient({ chainId: CHAIN_ID });
  const { tokenIds, loading: loadingTokens } = useOwnedTokenIds(address);

  const eloContracts = tokenIds.map((id) => ({
    address: addresses[CHAIN_ID].Arena as `0x${string}`,
    abi: ArenaAbi as Abi,
    functionName: "getElo" as const,
    args: [id],
    chainId: CHAIN_ID,
  }));
  const { data: elosData } = useReadContracts({ contracts: eloContracts });

  const ownedAgents: OwnedAgent[] = tokenIds.map((id, i) => ({
    tokenId: id.toString(),
    elo: Number((elosData?.[i]?.result as bigint | undefined) ?? 1200n),
  }));

  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const { writeContractAsync } = useWriteContract();

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<BreedFormData>({
    defaultValues: { parentA: "", parentB: preselectedB, royaltyBps: 500 },
  });

  const parentA = watch("parentA");
  const parentB = watch("parentB");
  const royaltyBps = watch("royaltyBps");

  const onSubmit = async (data: BreedFormData) => {
    if (data.parentA === data.parentB) { toast.error("Parents must be different agents"); return; }
    if (!address) { toast.error("Connect your wallet first"); return; }
    if (!publicClient) { toast.error("No RPC client — check your network"); return; }

    setIsLoading(true);
    try {
      const idA = BigInt(data.parentA);
      const idB = BigInt(data.parentB);

      setStatusMsg("Checking breeding approvals...");
      const [approvedA, approvedB] = await Promise.all([
        publicClient.readContract({ address: addresses[CHAIN_ID].BreedingMarket, abi: BreedingMarketAbi as Abi, functionName: "isBreedingApproved", args: [idA] }),
        publicClient.readContract({ address: addresses[CHAIN_ID].BreedingMarket, abi: BreedingMarketAbi as Abi, functionName: "isBreedingApproved", args: [idB] }),
      ]);

      if (!approvedA) {
        setStatusMsg(`Approving agent #${data.parentA} for breeding...`);
        const hash = await writeContractAsync({ address: addresses[CHAIN_ID].BreedingMarket, abi: BreedingMarketAbi as Abi, functionName: "setBreedingApproval" as never, args: [idA, true] as never, chainId: CHAIN_ID });
        await waitForReceiptWithRetry(publicClient, hash);
      }

      if (!approvedB) {
        setStatusMsg(`Approving agent #${data.parentB} for breeding...`);
        const hash = await writeContractAsync({ address: addresses[CHAIN_ID].BreedingMarket, abi: BreedingMarketAbi as Abi, functionName: "setBreedingApproval" as never, args: [idB, true] as never, chainId: CHAIN_ID });
        await waitForReceiptWithRetry(publicClient, hash);
      }

      setStatusMsg("Submitting breed request...");
      const breedHash = await writeContractAsync({
        address: addresses[CHAIN_ID].BreedingMarket,
        abi: BreedingMarketAbi as Abi,
        functionName: "requestBreed",
        args: [idA, idB, BigInt(data.royaltyBps)],
        value: DEFAULT_BREED_FEE,
        chainId: CHAIN_ID,
      });

      setStatusMsg("Waiting for confirmation...");
      await waitForReceiptWithRetry(publicClient, breedHash);

      toast.success("Breed request submitted! Offspring will mint when the operator fulfills.");
      setValue("parentA", "");
      setValue("parentB", "");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Breed failed");
    } finally {
      setIsLoading(false);
      setStatusMsg(null);
    }
  };

  const noAgents = !loadingTokens && ownedAgents.length === 0;

  return (
    <div className="glass-card rounded-2xl p-6 space-y-6">
      {noAgents && (
        <div className="flex items-start gap-3 bg-[#7c3aed]/10 border border-[#7c3aed]/20 rounded-xl p-4">
          <Dna className="w-4 h-4 text-[#7c3aed] shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-sm font-bold text-[#ededed]">No Agents Owned</p>
            <p className="text-xs text-[#6b7280]">
              Mint at least two agents before you can breed on 0G Galileo.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* DNA icon */}
        <div className="flex justify-center">
          <div className="w-12 h-12 rounded-2xl bg-[#7c3aed]/10 border border-[#7c3aed]/20 flex items-center justify-center">
            {loadingTokens ? <Loader2 className="w-6 h-6 text-[#7c3aed] animate-spin" /> : <Dna className="w-6 h-6 text-[#7c3aed]" />}
          </div>
        </div>

        {/* Parent A */}
        <div className="space-y-2">
          <Label className="text-xs font-mono text-[#6b7280] uppercase tracking-wider">
            Parent A
          </Label>
          <select
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 text-[#ededed] focus:border-[#7c3aed]/50 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]/30 text-sm cursor-pointer appearance-none transition-colors hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%236b7280' d='M1 1l5 5 5-5'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 1rem center',
              paddingRight: '2.5rem',
            }}
            {...register("parentA")}
            disabled={noAgents || isLoading}
          >
            <option value="">Select parent A</option>
            {ownedAgents.map((agent) => (
              <option key={agent.tokenId} value={agent.tokenId}>
                #{agent.tokenId} · ELO {agent.elo}
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
            className="w-full bg-white/[0.03] border border-white/[0.08] rounded-xl p-3 text-[#ededed] focus:border-[#7c3aed]/50 focus:outline-none focus:ring-1 focus:ring-[#7c3aed]/30 text-sm cursor-pointer appearance-none transition-colors hover:bg-white/[0.05] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath fill='%236b7280' d='M1 1l5 5 5-5'/%3E%3C/svg%3E")`,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'right 1rem center',
              paddingRight: '2.5rem',
            }}
            {...register("parentB")}
            disabled={noAgents || isLoading}
          >
            <option value="">Select parent B</option>
            {ownedAgents
              .filter((a) => a.tokenId !== parentA)
              .map((agent) => (
                <option key={agent.tokenId} value={agent.tokenId}>
                  #{agent.tokenId} · ELO {agent.elo}
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
            <span
              className="text-sm font-bold tabular"
              style={{ fontFamily: "var(--font-space-mono), monospace", color: "#7c3aed" }}
            >
              {(royaltyBps / 100).toFixed(1)}%
            </span>
          </div>
          <input
            type="range"
            min="100"
            max="5000"
            step="100"
            className="w-full h-2 rounded-full appearance-none cursor-pointer outline-none transition-all accent-[#7c3aed]"
            {...register("royaltyBps", { valueAsNumber: true })}
            disabled={noAgents || isLoading}
          />
          <div className="flex justify-between text-xs text-[#6b7280] font-mono">
            <span>1%</span>
            <span>50%</span>
          </div>
          <p className="text-xs text-[#6b7280]">
            You earn this % from every breed that uses your offspring as parents
          </p>
        </div>

        {/* Preview box */}
        {parentA && parentB && parentA !== parentB && (
          <div className="bg-[#7c3aed]/5 border border-[#7c3aed]/20 rounded-xl p-4 space-y-1">
            <p className="text-xs font-mono text-[#7c3aed] uppercase tracking-wider mb-2">
              Breed Preview
            </p>
            <p className="text-xs text-[#6b7280]">
              Offspring will be Gen{" "}
              <span className="text-[#ededed]">N+1</span> · Royalty:{" "}
              <span style={{ color: "#7c3aed" }}>{(royaltyBps / 100).toFixed(1)}%</span>
            </p>
            <p className="text-xs text-[#6b7280]">
              Breed fee: <span className="text-[#ededed] font-mono">0.01 0G</span>
            </p>
          </div>
        )}

        {/* Status */}
        {statusMsg && (
          <div className="flex items-center gap-2 bg-[#7c3aed]/10 border border-[#7c3aed]/20 rounded-xl px-4 py-3">
            <span className="w-2 h-2 rounded-full bg-[#7c3aed] animate-pulse shrink-0" />
            <p className="text-xs font-mono text-[#7c3aed]">{statusMsg}</p>
          </div>
        )}

        {/* Submit */}
        <Button
          type="submit"
          disabled={isLoading || noAgents || !parentA || !parentB}
          className="w-full text-white font-semibold py-4 rounded-xl transition-all hover:-translate-y-[1px] disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:translate-y-0"
          style={{ background: "#7c3aed", fontFamily: "var(--font-space-grotesk), sans-serif" }}
        >
          {isLoading ? (statusMsg ?? "Processing...") : "Request Breed"}
        </Button>
      </form>
    </div>
  );
}
